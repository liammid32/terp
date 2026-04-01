import { useAuth } from '../context/AuthContext';

function rankClass(rank) {
  if (rank === 1) return 'rank rank-1';
  if (rank === 2) return 'rank rank-2';
  if (rank === 3) return 'rank rank-3';
  return 'rank rank-n';
}

function timeAgo(dateStr) {
  if (!dateStr) return 'never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function LeaderboardTable({ entries = [], period = 'alltime', loading }) {
  const { user } = useAuth();

  const countKey = period === 'daily'  ? 'dabs_today'
                 : period === 'weekly' ? 'dabs_this_week'
                 : 'total_dabs';

  if (loading) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading…
      </div>
    );
  }

  if (!entries.length) {
    return (
      <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🌿</div>
        <div>No dabs logged yet. Hit that device!</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {entries.map((entry) => {
        const isSelf = entry.id === user?.id;
        const initials = entry.username.slice(0, 2).toUpperCase();
        const count = entry[countKey] ?? 0;

        return (
          <div
            key={entry.id}
            className="card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              border: isSelf
                ? '1px solid var(--accent)'
                : '1px solid var(--border)',
              background: isSelf ? 'rgba(124,58,237,0.08)' : 'var(--bg-card)',
            }}
          >
            {/* Rank */}
            <div className={rankClass(entry.rank)}>
              {entry.rank <= 3 ? ['🥇','🥈','🥉'][entry.rank - 1] : entry.rank}
            </div>

            {/* Avatar */}
            <div
              className="avatar"
              style={{ background: entry.avatar_color }}
            >
              {initials}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>
                  {entry.username}
                  {isSelf && (
                    <span style={{ color: 'var(--accent-2)', marginLeft: 4, fontSize: 11 }}>you</span>
                  )}
                </span>
                {entry.device_name && (
                  <span className="badge badge-purple" style={{ fontSize: 10 }}>
                    {entry.device_name}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Last dab {timeAgo(entry.last_dab_at)}
                {entry.avg_temp_f && ` · avg ${Math.round(entry.avg_temp_f)}°F`}
              </div>
            </div>

            {/* Dab count */}
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{count}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                {period === 'daily' ? 'today' : period === 'weekly' ? 'this week' : 'all time'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
