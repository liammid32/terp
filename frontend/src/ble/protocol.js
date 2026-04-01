/**
 * Terp BLE Protocol
 * Adapted from melt (https://github.com/ryleyio/melt) for the Web Bluetooth API.
 *
 * melt uses @abandonware/noble (Node.js). Here we use navigator.bluetooth (browser).
 * The Puffco Proxy BLE protocol, characteristic UUIDs, and authentication
 * handshake are sourced from the melt project — install melt alongside this
 * project and import createAuthToken from '@ryleyio/melt/src/ble/protocol' if you
 * need the full auth implementation, or see the melt source directly.
 */

// ─── Service & Characteristic UUIDs ─────────────────────────────────────────

export const UUIDS = {
  // Characteristics (discovered from melt/connection.js)
  COMMAND:     '60133d5c-5727-4f2c-9697-d842c5292a3c',
  RESPONSE:    '8dc5ec05-8f7d-45ad-99db-3fbde65dbd9c',
  DEVICE_STATE:'58b0a7aa-d89f-4bf2-961d-0d892d7439d8',
  NOTIFY_ALT:  '43312cd1-7d34-46ce-a7d3-0a98fd9b4cb8',
};

// ─── Command Opcodes ──────────────────────────────────────────────────────────

export const OPCODES = {
  GET:          0x40,
  SET:          0x41,
  SUBSCRIBE:    0x42,
  AUTH_SEED:    0x60,
  AUTH_UNLOCK:  0x61,
  LIMITS:       0x62,
  INIT:         0x27,
};

// ─── Device State ─────────────────────────────────────────────────────────────

export const DEVICE_STATE = {
  0:  'IDLE',
  1:  'PREHEAT',
  2:  'ACTIVE',
  3:  'FADE',
  4:  'IDLE_HOT',
  5:  'SLEEP',
  6:  'SLEEP_CHARGING',
  7:  'CHARGING',
  8:  'LANTERN_ACTIVE',
  9:  'LANTERN_IDLE',
  10: 'FACTORY_TEST',
};

// Active states that indicate a dab is in progress / just completed
export const DAB_ACTIVE_STATES = new Set([2, 3]); // ACTIVE, FADE

// ─── Device Paths (REST-like BLE paths) ───────────────────────────────────────

export const PATHS = {
  BATTERY_CHARGE:   'battery/charge',
  BATTERY_CHARGING: 'battery/charging',
  HEATER_TEMP:      'heater/temp',
  HEATER_TARGET:    'heater/target',
  HEATER_STATE:     'heater/state',
  DAB_COUNT_TOTAL:  'usage/dab_count_total',
  DAB_COUNT_SESSION:'usage/dab_count_session',
  PROFILE_CURRENT:  'profile/current',
  PROFILE_0:        'profile/0',
  PROFILE_1:        'profile/1',
  PROFILE_2:        'profile/2',
  PROFILE_3:        'profile/3',
  DEVICE_NAME:      'device/name',
  DEVICE_SERIAL:    'device/serial',
  DEVICE_FIRMWARE:  'device/firmware',
};

// ─── Packet Builder ───────────────────────────────────────────────────────────

export function buildCommand(seq, opcode, pathOrPayload = '') {
  const pathBytes = typeof pathOrPayload === 'string'
    ? new TextEncoder().encode(pathOrPayload)
    : pathOrPayload;

  const buf = new ArrayBuffer(3 + pathBytes.length);
  const view = new DataView(buf);
  view.setUint16(0, seq, true); // little-endian seq
  view.setUint8(2, opcode);
  new Uint8Array(buf).set(pathBytes, 3);
  return buf;
}

export function buildGetCommand(seq, path) {
  return buildCommand(seq, OPCODES.GET, path);
}

export function buildSubscribeCommand(seq, path) {
  return buildCommand(seq, OPCODES.SUBSCRIBE, path);
}

// ─── Response Parser ──────────────────────────────────────────────────────────

export function parseResponse(dataView) {
  if (dataView.byteLength < 3) return { seq: 0, status: -1, data: null };
  const seq    = dataView.getUint16(0, true);
  const status = dataView.getUint8(2);
  const data   = dataView.byteLength > 3
    ? new DataView(dataView.buffer, dataView.byteOffset + 3)
    : null;
  return { seq, status, data };
}

// ─── Data Decoders ────────────────────────────────────────────────────────────

export function decodeUint8(dv)  { return dv?.getUint8(0) ?? null; }
export function decodeUint16(dv) { return dv?.getUint16(0, true) ?? null; }
export function decodeUint32(dv) { return dv?.getUint32(0, true) ?? null; }
export function decodeFloat(dv)  { return dv?.getFloat32(0, true) ?? null; }
export function decodeString(dv) {
  if (!dv) return null;
  return new TextDecoder().decode(new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength));
}

// Temperature conversion (decicelsius ↔ Fahrenheit, same as melt)
export function decicelsiusToF(dc) { return (dc / 10) * 9 / 5 + 32; }
export function fToDecicelsius(f)  { return Math.round((f - 32) * 5 / 9 * 10); }
