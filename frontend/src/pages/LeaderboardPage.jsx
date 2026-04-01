import { useState, useEffect } from 'react';
import LeaderboardTable from '../components/LeaderboardTable';
import { useAuth } from '../context/AuthContext';
import { useDevice } from '../context/DeviceContext';

const PERIODS = [
  { key: 'alltime', label: 'All Time' },
  { key: 'weekly',  label: 'This Week' },
  { key: 'daily',   label: 'Today' },
];

const SCOPES = [
  { key: 'friends', label: '👥 Friends' },
  { key: 'global',  label: '🌍 Global' },
];

export default function LeaderboardPage() {
  const { authFetch } = useAuth();
  const { lastDab } = useDevice();
  const [period, setPeriod] = useState('alltime');
  const [scope, setScope]   = useState('friends');
  const [data, setData]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    authFetch(`/api/leaderboard/${scope}?period=${period}`)
      .then(r => r.json())
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [period, scope, lastDab]);

  return (
    <div className="page">
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>Leaderboard 🏆</div>
        <div className="text-muted text-sm">Who's hitting it hardest?</div>
      </div>

      {/* Scope toggle */}
      <div className="flex gap-2 mb-3" style={{ marginBottom: 12 }}>
        {SCOPES.map(s => (
          <button
            key={s.key}
            onClick={() => setScope(s.key)}
            className="btn"
            style={{
              flex: 1,
              padding: '8px 0',
              fontSize: 13,
              background: scope === s.key ? 'var(--accent)' : 'var(--bg-card)',
              color: scope === s.key ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${scope === s.key ? 'var(--accent)' : 'var(--border)'}`,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Period tabs */}
      <div className="flex gap-2" style={{ marginBottom: 16 }}>
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            style={{
              flex: 1,
              padding: '6px 0',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              border: 'none',
              background: period === p.key ? 'var(--accent-glow)' : 'transparent',
              color: period === p.key ? 'var(--accent-2)' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <LeaderboardTable entries={data} period={period} loading={loading} />

      {scope === 'global' && (
        <div className="text-xs text-muted mt-3" style={{ textAlign: 'center' }}>
          Opt in to the global leaderboard in Profile → Settings
        </div>
      )}
    </div>
  );
}
