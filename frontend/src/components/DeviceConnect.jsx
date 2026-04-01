import { useState } from 'react';
import { useDevice } from '../context/DeviceContext';

export default function DeviceConnect() {
  const { status, deviceName, connect, disconnect, sessionDabs, lastDab } = useDevice();
  const [error, setError] = useState(null);

  const handleConnect = async () => {
    setError(null);
    try {
      await connect();
    } catch (err) {
      setError(err.message);
    }
  };

  if (status === 'connected') {
    return (
      <div className="card" style={{
        border: '1px solid var(--accent)',
        background: 'rgba(124,58,237,0.06)',
      }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--green)',
              boxShadow: '0 0 8px var(--green)',
            }} className="glow-pulse" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{deviceName || 'Puffco Proxy'}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {sessionDabs} dab{sessionDabs !== 1 ? 's' : ''} this session
              </div>
            </div>
          </div>
          <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={disconnect}>
            Disconnect
          </button>
        </div>

        {lastDab && (
          <div style={{
            marginTop: 10,
            padding: '8px 10px',
            background: 'var(--bg)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 12,
            color: 'var(--text-muted)',
          }}>
            Last dab
            {lastDab.temperature_f ? ` · ${Math.round(lastDab.temperature_f)}°F` : ''}
            {lastDab.profile_name ? ` · ${lastDab.profile_name}` : ''}
          </div>
        )}
      </div>
    );
  }

  if (status === 'connecting') {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
        <div style={{ fontWeight: 600 }}>Scanning for Proxy…</div>
        <div className="text-muted text-sm mt-2">Make sure your device is awake and in range</div>
      </div>
    );
  }

  return (
    <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>💨</div>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Connect your Proxy</div>
      <div className="text-muted text-sm" style={{ marginBottom: 14 }}>
        Pair via Bluetooth to auto-track your dabs
      </div>
      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid var(--red)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px 12px',
          fontSize: 12,
          color: 'var(--red)',
          marginBottom: 12,
          textAlign: 'left'
        }}>
          {error}
        </div>
      )}
      <button className="btn btn-primary btn-full" onClick={handleConnect}>
        Connect Device
      </button>
      <div className="text-muted text-xs mt-2">
        Requires Chrome or Edge · Bluetooth must be on
      </div>
    </div>
  );
}
