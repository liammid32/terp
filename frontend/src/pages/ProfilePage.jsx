import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDevice } from '../context/DeviceContext';

export default function ProfilePage() {
  const { user, updateUser, authFetch, logout } = useAuth();
  const { status: deviceStatus } = useDevice();
  const navigate = useNavigate();

  const [stats, setStats]           = useState(null);
  const [editing, setEditing]       = useState(false);
  const [bio, setBio]               = useState(user?.bio || '');
  const [globalOpt, setGlobalOpt]   = useState(user?.is_global_leaderboard || false);
  const [notifPref, setNotifPref]   = useState(user?.notifications_enabled !== false);
  const [saving, setSaving]         = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushActive, setPushActive] = useState(false);

  useEffect(() => {
    authFetch('/api/dabs/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});

    setPushSupported('serviceWorker' in navigator && 'PushManager' in window);
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await authFetch('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          bio,
          is_global_leaderboard: globalOpt,
          notifications_enabled: notifPref,
        })
      });
      const updated = await res.json();
      updateUser(updated);
      setEditing(false);
    } catch { /* TODO: surface error */ }
    setSaving(false);
  };

  const requestPushPermission = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const keyRes = await authFetch('/api/push/vapid-public-key');
      const { key } = await keyRes.json();

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key)
      });

      await authFetch('/api/users/push-subscription', {
        method: 'POST',
        body: JSON.stringify(sub)
      });
      setPushActive(true);
    } catch (err) {
      console.error('Push subscription failed:', err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;
  const initials = user.username.slice(0, 2).toUpperCase();

  return (
    <div className="page">
      {/* Profile header */}
      <div className="card" style={{ textAlign: 'center', padding: '28px 16px', marginBottom: 16 }}>
        <div
          className="avatar avatar-lg"
          style={{ background: user.avatar_color, margin: '0 auto 12px' }}
        >
          {initials}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>@{user.username}</div>
        {user.device_name && (
          <div className="badge badge-purple" style={{ marginTop: 6 }}>
            {user.device_name}
          </div>
        )}
        {user.bio && (
          <div className="text-muted text-sm" style={{ marginTop: 8 }}>{user.bio}</div>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="flex gap-2" style={{ marginBottom: 16 }}>
          {[
            { label: 'Total',  value: stats.total_dabs ?? 0 },
            { label: 'Week',   value: stats.dabs_this_week ?? 0 },
            { label: 'Today',  value: stats.dabs_today ?? 0 },
            { label: 'Streak', value: `${stats.streak_days ?? 0}🔥` },
          ].map(({ label, value }) => (
            <div key={label} className="card flex-col items-center" style={{ flex: 1, padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{value}</div>
              <div className="text-xs text-muted mt-2">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Settings */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: editing ? 16 : 0 }}>
          <div style={{ fontWeight: 700 }}>Settings</div>
          <button
            className="btn btn-ghost"
            style={{ padding: '5px 12px', fontSize: 12 }}
            onClick={() => editing ? save() : setEditing(true)}
            disabled={saving}
          >
            {editing ? (saving ? 'Saving…' : 'Save') : 'Edit'}
          </button>
        </div>

        {editing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div className="label" style={{ marginBottom: 6 }}>Bio</div>
              <textarea
                className="input"
                rows={2}
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Short bio (optional)"
                style={{ resize: 'vertical' }}
              />
            </div>

            <div className="divider" />

            <ToggleRow
              label="Show me on global leaderboard"
              description="Anyone on Terp can see your dab count"
              checked={globalOpt}
              onChange={setGlobalOpt}
            />

            <ToggleRow
              label="Enable notifications"
              description="Receive dab alerts from friends"
              checked={notifPref}
              onChange={setNotifPref}
            />
          </div>
        )}

        {!editing && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SettingRow label="Global leaderboard" value={user.is_global_leaderboard ? 'On' : 'Off'} />
            <SettingRow label="Notifications" value={user.notifications_enabled !== false ? 'On' : 'Off'} />
            <SettingRow label="Device" value={user.device_name || 'Not connected'} />
            <SettingRow label="Avg temp" value={stats?.avg_temp_f ? `${Math.round(stats.avg_temp_f)}°F` : '—'} />
          </div>
        )}
      </div>

      {/* Push notifications */}
      {pushSupported && !pushActive && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Push Notifications</div>
          <div className="text-sm text-muted" style={{ marginBottom: 12 }}>
            Get notified when friends take a dab, even when Terp isn't open.
          </div>
          <button className="btn btn-primary btn-full" onClick={requestPushPermission}>
            Enable Push Notifications
          </button>
        </div>
      )}

      {/* Danger zone */}
      <button className="btn btn-danger btn-full" onClick={handleLogout}>
        Log out
      </button>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
        {description && <div className="text-xs text-muted">{description}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 42,
          height: 24,
          borderRadius: 12,
          border: 'none',
          background: checked ? 'var(--accent)' : 'var(--border)',
          position: 'relative',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'background 0.2s',
        }}
      >
        <div style={{
          position: 'absolute',
          top: 3, left: checked ? 20 : 3,
          width: 18, height: 18,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s',
        }} />
      </button>
    </div>
  );
}

function SettingRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted">{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}
