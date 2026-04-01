import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

function timeAgo(dateStr) {
  if (!dateStr) return 'never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function FriendsPage() {
  const { authFetch } = useAuth();
  const [tab, setTab]           = useState('friends'); // friends | requests | search
  const [friends, setFriends]   = useState([]);
  const [requests, setRequests] = useState([]);
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const [sentIds, setSentIds]   = useState(new Set());

  useEffect(() => {
    loadFriends();
    loadRequests();
  }, []);

  const loadFriends = () => {
    authFetch('/api/friends')
      .then(r => r.json())
      .then(d => setFriends(Array.isArray(d) ? d : []))
      .catch(() => {});
  };

  const loadRequests = () => {
    authFetch('/api/friends/requests')
      .then(r => r.json())
      .then(d => setRequests(Array.isArray(d) ? d : []))
      .catch(() => {});
  };

  const search = async (q) => {
    setQuery(q);
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await authFetch(`/api/users/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch { setResults([]); }
    setSearching(false);
  };

  const sendRequest = async (userId) => {
    await authFetch(`/api/friends/request/${userId}`, { method: 'POST' });
    setSentIds(prev => new Set([...prev, userId]));
  };

  const acceptRequest = async (requestId) => {
    await authFetch(`/api/friends/accept/${requestId}`, { method: 'POST' });
    loadRequests();
    loadFriends();
  };

  const rejectRequest = async (requestId) => {
    await authFetch(`/api/friends/reject/${requestId}`, { method: 'POST' });
    loadRequests();
  };

  const toggleNotify = async (friendId, current) => {
    await authFetch(`/api/users/notifications/${friendId}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled: !current })
    });
    setFriends(prev => prev.map(f =>
      f.id === friendId ? { ...f, notify_enabled: !current } : f
    ));
  };

  const removeFriend = async (friendId) => {
    if (!confirm('Remove this friend?')) return;
    await authFetch(`/api/friends/${friendId}`, { method: 'DELETE' });
    setFriends(prev => prev.filter(f => f.id !== friendId));
  };

  return (
    <div className="page">
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Friends 👥</div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2" style={{ marginBottom: 16 }}>
        {[
          { key: 'friends',  label: `Friends (${friends.length})` },
          { key: 'requests', label: `Requests ${requests.length ? `(${requests.length})` : ''}` },
          { key: 'search',   label: 'Add' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1,
              padding: '8px 0',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 8,
              border: `1px solid ${tab === t.key ? 'var(--accent)' : 'var(--border)'}`,
              background: tab === t.key ? 'rgba(124,58,237,0.15)' : 'var(--bg-card)',
              color: tab === t.key ? 'var(--accent-2)' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Friends list */}
      {tab === 'friends' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {friends.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🤝</div>
              Add friends to see their dab stats!
            </div>
          )}
          {friends.map(f => (
            <div key={f.id} className="card" style={{ padding: '12px 14px' }}>
              <div className="flex items-center gap-3">
                <div className="avatar avatar-sm" style={{ background: f.avatar_color }}>
                  {f.username.slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{f.username}</div>
                  <div className="text-xs text-muted">last dab {timeAgo(f.last_dab_at)}</div>
                </div>
                {/* Notification bell */}
                <button
                  onClick={() => toggleNotify(f.id, f.notify_enabled)}
                  title={f.notify_enabled ? 'Notifications on' : 'Notifications off'}
                  style={{
                    background: 'none', border: 'none',
                    fontSize: 18, cursor: 'pointer',
                    opacity: f.notify_enabled ? 1 : 0.35,
                  }}
                >
                  🔔
                </button>
                <button
                  onClick={() => removeFriend(f.id)}
                  style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', opacity: 0.4 }}
                >
                  ✕
                </button>
              </div>
              {/* Mini stats */}
              <div className="flex gap-3 mt-2" style={{ paddingLeft: 44 }}>
                {[
                  { v: f.total_dabs,    l: 'total' },
                  { v: f.dabs_this_week, l: 'week' },
                  { v: f.dabs_today,    l: 'today' },
                ].map(({ v, l }) => (
                  <div key={l} style={{ fontSize: 12 }}>
                    <span style={{ fontWeight: 700 }}>{v ?? 0}</span>
                    <span className="text-muted"> {l}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pending requests */}
      {tab === 'requests' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {requests.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
              No pending requests
            </div>
          )}
          {requests.map(req => (
            <div key={req.request_id} className="card flex items-center gap-3" style={{ padding: '12px 14px' }}>
              <div className="avatar avatar-sm" style={{ background: req.avatar_color }}>
                {req.username.slice(0,2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{req.username}</div>
                <div className="text-xs text-muted">wants to be your friend</div>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn btn-primary"
                  style={{ padding: '6px 12px', fontSize: 12 }}
                  onClick={() => acceptRequest(req.request_id)}
                >
                  Accept
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ padding: '6px 10px', fontSize: 12 }}
                  onClick={() => rejectRequest(req.request_id)}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search / Add friends */}
      {tab === 'search' && (
        <div>
          <input
            className="input"
            placeholder="Search by username…"
            value={query}
            onChange={e => search(e.target.value)}
            autoFocus
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {searching && (
              <div className="text-muted text-sm" style={{ textAlign: 'center', padding: 16 }}>
                Searching…
              </div>
            )}
            {!searching && results.length === 0 && query.length >= 2 && (
              <div className="text-muted text-sm" style={{ textAlign: 'center', padding: 16 }}>
                No users found
              </div>
            )}
            {results.map(u => {
              const sent = sentIds.has(u.id);
              return (
                <div key={u.id} className="card flex items-center gap-3" style={{ padding: '12px 14px' }}>
                  <div className="avatar avatar-sm" style={{ background: u.avatar_color }}>
                    {u.username.slice(0,2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{u.username}</div>
                    {u.device_name && <div className="text-xs text-muted">{u.device_name}</div>}
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ padding: '6px 14px', fontSize: 12, opacity: sent ? 0.5 : 1 }}
                    disabled={sent}
                    onClick={() => sendRequest(u.id)}
                  >
                    {sent ? 'Sent ✓' : 'Add'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
