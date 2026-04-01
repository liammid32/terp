import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { getConnection, resetConnection } from '../ble/connection';
import { useAuth } from './AuthContext';

const DeviceContext = createContext(null);

export function DeviceProvider({ children }) {
  const { user, authFetch } = useAuth();
  const [status, setStatus]           = useState('disconnected'); // disconnected | connecting | connected
  const [deviceName, setDeviceName]   = useState(null);
  const [deviceState, setDeviceState] = useState(null);
  const [lastDab, setLastDab]         = useState(null);
  const [sessionDabs, setSessionDabs] = useState(0);
  const connRef = useRef(null);

  const connect = useCallback(async () => {
    setStatus('connecting');
    try {
      const conn = getConnection();
      connRef.current = conn;

      conn.addEventListener('connected', (e) => {
        setDeviceName(e.detail.deviceName);
        setStatus('connected');
      });

      conn.addEventListener('disconnected', () => {
        setStatus('disconnected');
        setDeviceName(null);
        setDeviceState(null);
        resetConnection();
        connRef.current = null;
      });

      conn.addEventListener('stateChange', (e) => {
        setDeviceState(e.detail);
      });

      conn.addEventListener('dabDetected', async (e) => {
        // Fetch full status to get temperature + profile
        let temp_f = null;
        let profile_name = null;
        let duration_ms = null;

        try {
          const status = await conn.getStatus();
          temp_f = status.temp_f;
          duration_ms = null; // could track timing
        } catch { /* non-fatal */ }

        const dabEvent = {
          temperature_f: temp_f,
          profile_name,
          duration_ms,
          device_name: deviceName,
          logged_at: new Date().toISOString()
        };

        setLastDab(dabEvent);
        setSessionDabs(prev => prev + 1);

        // Log to backend
        if (user) {
          authFetch('/api/dabs', {
            method: 'POST',
            body: JSON.stringify(dabEvent)
          }).catch(console.error);
        }
      });

      await conn.connect();

      // Update device name in profile
      if (user && conn.deviceName) {
        authFetch('/api/users/me', {
          method: 'PATCH',
          body: JSON.stringify({ device_name: conn.deviceName })
        }).catch(() => {});
      }
    } catch (err) {
      setStatus('disconnected');
      resetConnection();
      connRef.current = null;
      throw err;
    }
  }, [user, authFetch, deviceName]);

  const disconnect = useCallback(async () => {
    if (connRef.current) {
      await connRef.current.disconnect();
    }
    resetConnection();
    connRef.current = null;
    setStatus('disconnected');
    setDeviceName(null);
    setDeviceState(null);
    setSessionDabs(0);
  }, []);

  const getDeviceStatus = useCallback(async () => {
    if (!connRef.current?.connected) return null;
    return connRef.current.getStatus();
  }, []);

  const getProfiles = useCallback(async () => {
    if (!connRef.current?.connected) return [];
    return connRef.current.getProfiles();
  }, []);

  return (
    <DeviceContext.Provider value={{
      status,
      deviceName,
      deviceState,
      lastDab,
      sessionDabs,
      isConnected: status === 'connected',
      isConnecting: status === 'connecting',
      connect,
      disconnect,
      getDeviceStatus,
      getProfiles,
    }}>
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevice() {
  const ctx = useContext(DeviceContext);
  if (!ctx) throw new Error('useDevice must be used inside DeviceProvider');
  return ctx;
}
