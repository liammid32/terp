import { useEffect, useState } from 'react';
import DeviceConnect from '../components/DeviceConnect';
import { useAuth } from '../context/AuthContext';
import { useDevice } from '../context/DeviceContext';

export default function Home() {
  const { user, authFetch } = useAuth();
  const { lastDab, sessionDabs, isConnected } = useDevice();
  const [stats, setStats] = useState(null);
  const [feed, setFeed] = useState([]); // recent friend dabs

  useEffect(() => {
    authFetch('/api/dabs/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});

    // Load recent friend activity from leaderboard
    authFetch('/api/leaderboard/friends?period=daily')
      .then(r => r.json())
      .then(data => setFeed(data.filter(e => !e.is_self).slice(0, 5)))
      .catch(() => {});
  }, [lastDab]);

  const initials = user?.username?.slice(0, 2).toUpperCase();

  return (
    <div className="page">
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>
            terp 🌬️
          </div>
          <div className="text-muted text-sm">hey, {user?.username}</div>
        </div>
        <div
          className="avatar"
          style={{ background: user?.avatar_color || '#7c3aed' }}
        >
          {initials}
        </div>
      </div>

      {/* Device connect */}
      <DeviceConnect />

      {/* Stats row */}
      {stats && (
        <div className="flex gap-3 mt-3">
          {[
            { label: 'All time',   value: stats.total_dabs ?? 0 },
            { label: 'This week',  value: stats.dabs_this_week ?? 0 },
            { label: 'Today',      value: stats.dabs_today ?? 0 },
            { label: 'Day streak', value: stats.streak_days ?? 0, suffix: '🔥' },
          ].map(({ label, value, suffix }) => (
            <div key={label} className="card flex-col items-center" style={{ flex: 1, padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>
                {value}{suffix || ''}
              </div>
              <div className="text-xs text-muted mt-2">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Session dab count when connected */}
      {isConnected && (
        <div className="card mt-3 flex items-center gap-3">
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: 'var(--accent-glow)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
          }}>
            💨
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>{sessionDabs}</div>
            <div className="text-sm text-muted">dabs this session</div>
          </div>
        </div>
      )}

      {/* Friend activity feed */}
      {feed.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div className="label" style={{ marginBottom: 10 }}>Friend Activity Today</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {feed.map(f => (
              <div key={f.id} className="card flex items-center gap-3" style={{ padding: '10px 14px' }}>
                <div className="avatar avatar-sm" style={{ background: f.avatar_color }}>{f.username.slice(0,2).toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600 }}>{f.username}</span>
                  <span className="text-muted"> · {f.dabs_today} dab{f.dabs_today !== 1 ? 's' : ''} today</span>
                </div>
                {f.last_dab_at && (
                  <span className="text-xs text-muted">{timeAgo(f.last_dab_at)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
