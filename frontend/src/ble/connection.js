/**
 * Terp BLE Connection — Web Bluetooth API adapter
 * Mirrors the structure of melt's connection.js but for the browser.
 */

import {
  UUIDS, OPCODES, DEVICE_STATE, DAB_ACTIVE_STATES, PATHS,
  buildCommand, buildGetCommand, buildSubscribeCommand,
  parseResponse, decodeUint8, decodeUint16, decodeFloat,
  decodeString, decicelsiusToF
} from './protocol';

export class TerpConnection extends EventTarget {
  constructor() {
    super();
    this.device       = null;
    this.server       = null;
    this.chars        = {};
    this.seq          = 0;
    this.pendingCmds  = new Map(); // seq → { resolve, reject, timer }
    this.connected    = false;
    this.authenticated = false;
    this.deviceName   = 'Proxy';
    this._stateBuffer = null; // last known device state
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  async connect() {
    if (!navigator.bluetooth) {
      throw new Error('Web Bluetooth is not supported in this browser. Use Chrome or Edge.');
    }

    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'Proxy' }],
      // Declare all services we'll access — required by Web Bluetooth security model
      optionalServices: [
        // We use discoverAllCharacteristics via known UUIDs; provide common
        // Puffco service UUIDs. If your firmware uses a different service UUID,
        // add it here. We fall back to acceptAllDevices if needed.
        'generic_access',
        'device_information',
      ]
    });

    this.deviceName = this.device.name || 'Proxy';
    this.device.addEventListener('gattserverdisconnected', () => this._onDisconnect());

    this.server = await this.device.gatt.connect();
    await this._discoverCharacteristics();
    await this._subscribe();
    await this._sendInit();
    await this._authenticate();

    this.connected = true;
    this._emit('connected', { deviceName: this.deviceName });
    return this.deviceName;
  }

  async disconnect() {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this._cleanup();
  }

  async sendCommand(buffer, timeoutMs = 5000) {
    const view = new DataView(buffer);
    const seq  = view.getUint16(0, true);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCmds.delete(seq);
        reject(new Error(`Command timed out (seq=${seq})`));
      }, timeoutMs);

      this.pendingCmds.set(seq, { resolve, reject, timer });

      this.chars.command.writeValueWithResponse(buffer).catch((err) => {
        clearTimeout(timer);
        this.pendingCmds.delete(seq);
        reject(err);
      });
    });
  }

  async getStatus() {
    const results = await Promise.allSettled([
      this._get(PATHS.BATTERY_CHARGE),
      this._get(PATHS.BATTERY_CHARGING),
      this._get(PATHS.HEATER_TEMP),
      this._get(PATHS.HEATER_TARGET),
      this._get(PATHS.HEATER_STATE),
      this._get(PATHS.DAB_COUNT_TOTAL),
      this._get(PATHS.DAB_COUNT_SESSION),
      this._get(PATHS.DEVICE_NAME),
    ]);

    const [charge, charging, temp, target, state, totalDabs, sessionDabs, name] =
      results.map(r => r.status === 'fulfilled' ? r.value : null);

    return {
      battery:       charge !== null ? charge / 100 : null,
      charging:      !!charging,
      temp_f:        temp !== null ? decicelsiusToF(temp) : null,
      target_f:      target !== null ? decicelsiusToF(target) : null,
      state:         DEVICE_STATE[state] ?? 'UNKNOWN',
      state_code:    state,
      total_dabs:    totalDabs,
      session_dabs:  sessionDabs,
      device_name:   name || this.deviceName,
    };
  }

  async getProfiles() {
    const profiles = [];
    for (let i = 0; i < 4; i++) {
      try {
        const raw = await this._getRaw(PATHS[`PROFILE_${i}`]);
        if (raw) profiles.push(this._parseProfile(raw, i));
      } catch {
        profiles.push(null);
      }
    }
    return profiles;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  async _discoverCharacteristics() {
    // Web Bluetooth requires iterating over known services.
    // We enumerate all services and find our known characteristic UUIDs.
    const services = await this.server.getPrimaryServices();

    for (const service of services) {
      let characteristics;
      try {
        characteristics = await service.getCharacteristics();
      } catch {
        continue;
      }

      for (const char of characteristics) {
        const uuid = char.uuid;
        if (uuid === UUIDS.COMMAND)      this.chars.command     = char;
        if (uuid === UUIDS.RESPONSE)     this.chars.response    = char;
        if (uuid === UUIDS.DEVICE_STATE) this.chars.deviceState = char;
        if (uuid === UUIDS.NOTIFY_ALT)   this.chars.notifyAlt   = char;
      }
    }

    if (!this.chars.command || !this.chars.response) {
      throw new Error('Could not find Puffco command/response characteristics. Make sure the device is a Puffco Proxy and is awake.');
    }
  }

  async _subscribe() {
    // Subscribe to response channel (matched by seq ID)
    await this.chars.response.startNotifications();
    this.chars.response.addEventListener('characteristicvaluechanged', (e) => {
      this._onNotification(e.target.value);
    });

    // Subscribe to device state changes for dab detection
    if (this.chars.deviceState) {
      await this.chars.deviceState.startNotifications();
      this.chars.deviceState.addEventListener('characteristicvaluechanged', (e) => {
        this._onStateChange(e.target.value);
      });
    }

    // Subscribe to alt notify channel
    if (this.chars.notifyAlt) {
      try {
        await this.chars.notifyAlt.startNotifications();
        this.chars.notifyAlt.addEventListener('characteristicvaluechanged', (e) => {
          this._emit('event', { data: e.target.value });
        });
      } catch { /* non-fatal */ }
    }
  }

  async _sendInit() {
    // Init command from melt: opcode 0x27 with fixed payload
    const buf = new Uint8Array([0x00, 0x00, OPCODES.INIT, 0x01, 0xC0, 0x03]).buffer;
    try {
      await this.sendCommand(buf, 2000);
    } catch { /* non-fatal */ }
  }

  async _authenticate() {
    /**
     * The authentication handshake requires SHA256-based token generation
     * with hardcoded keys from the Puffco firmware.
     *
     * Full implementation: see melt/src/ble/protocol.js → createAuthToken()
     * To integrate: npm install @ryleyio/melt and import createAuthToken.
     *
     * Steps:
     *  1. GET limits   → maxPayload, maxFiles, maxCmds
     *  2. GET auth seed (16 bytes)
     *  3. createAuthToken(seed) → 32-byte HMAC-SHA256 token
     *  4. SET unlock with token → device grants full access
     */
    console.warn(
      '[Terp BLE] Authentication step: integrate createAuthToken from melt/src/ble/protocol.js.\n' +
      'Without auth, some commands may be limited. Device state subscriptions still work.'
    );
    // TODO: import { createAuthToken } from '@ryleyio/melt/src/ble/protocol'
    // and complete the auth handshake here.
  }

  _nextSeq() {
    this.seq = (this.seq + 1) % 65535;
    return this.seq;
  }

  async _get(path) {
    const seq = this._nextSeq();
    const cmd = buildGetCommand(seq, path);
    const response = await this.sendCommand(cmd);
    const { status, data } = parseResponse(response);
    if (status !== 0 || !data) return null;
    return decodeUint32(data) ?? decodeUint16(data) ?? decodeUint8(data);
  }

  async _getRaw(path) {
    const seq = this._nextSeq();
    const cmd = buildGetCommand(seq, path);
    const response = await this.sendCommand(cmd);
    const { status, data } = parseResponse(response);
    return status === 0 ? data : null;
  }

  _parseProfile(dv, index) {
    // Profile packet layout (from melt commands.js):
    // temp_dc (2 bytes) + duration_200ms (2 bytes) + name (up to 16 bytes)
    try {
      const temp_dc   = dv.getUint16(0, true);
      const dur_raw   = dv.getUint16(2, true);
      const name_bytes = new Uint8Array(dv.buffer, dv.byteOffset + 4);
      const name      = new TextDecoder().decode(name_bytes).replace(/\0/g, '').trim();
      return {
        index,
        name:     name || `Profile ${index + 1}`,
        temp_f:   decicelsiusToF(temp_dc),
        duration: Math.round(dur_raw / 200), // seconds
      };
    } catch {
      return { index, name: `Profile ${index + 1}`, temp_f: null, duration: null };
    }
  }

  _onNotification(dataView) {
    const seq = dataView.getUint16(0, true);
    const pending = this.pendingCmds.get(seq);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingCmds.delete(seq);
      pending.resolve(dataView);
      return;
    }
    // Unsolicited notification
    this._emit('notification', { data: dataView });
  }

  _onStateChange(dataView) {
    const newState = dataView.getUint8(0);
    const prevState = this._stateBuffer;
    this._stateBuffer = newState;

    const stateName = DEVICE_STATE[newState] ?? 'UNKNOWN';
    this._emit('stateChange', { state: newState, stateName });

    // Dab detection: transition into ACTIVE or FADE
    if (DAB_ACTIVE_STATES.has(newState) && !DAB_ACTIVE_STATES.has(prevState)) {
      this._emit('dabDetected', { state: stateName, state_code: newState });
    }
  }

  _onDisconnect() {
    this._cleanup();
    this._emit('disconnected', {});
  }

  _cleanup() {
    this.connected    = false;
    this.authenticated = false;
    this.chars        = {};
    this.pendingCmds.forEach(({ reject, timer }) => {
      clearTimeout(timer);
      reject(new Error('Disconnected'));
    });
    this.pendingCmds.clear();
  }

  _emit(eventName, detail) {
    this.dispatchEvent(new CustomEvent(eventName, { detail }));
  }
}

// Singleton
let _instance = null;
export function getConnection() {
  if (!_instance) _instance = new TerpConnection();
  return _instance;
}

export function resetConnection() {
  _instance = null;
}
