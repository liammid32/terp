import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode]     = useState('login'); // login | register
  const [form, setForm]     = useState({ username: '', email: '', login: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login({ login: form.login, password: form.password });
      } else {
        await register({ username: form.username, email: form.email, password: form.password });
      }
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24
    }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🌬️</div>
          <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-1px' }}>terp</div>
          <div className="text-muted text-sm" style={{ marginTop: 4 }}>
            The Puffco leaderboard
          </div>
        </div>

        {/* Tab toggle */}
        <div className="flex gap-2" style={{ marginBottom: 20 }}>
          {['login', 'register'].map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              style={{
                flex: 1,
                padding: '9px 0',
                fontSize: 13,
                fontWeight: 700,
                border: `1px solid ${mode === m ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 8,
                background: mode === m ? 'rgba(124,58,237,0.15)' : 'var(--bg-card)',
                color: mode === m ? 'var(--accent-2)' : 'var(--text-muted)',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {m === 'login' ? 'Log in' : 'Sign up'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'register' && (
            <input
              className="input"
              placeholder="Username"
              value={form.username}
              onChange={e => update('username', e.target.value)}
              autoCapitalize="off"
              required
            />
          )}
          {mode === 'register' && (
            <input
              className="input"
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={e => update('email', e.target.value)}
              required
            />
          )}
          {mode === 'login' && (
            <input
              className="input"
              placeholder="Username or email"
              value={form.login}
              onChange={e => update('login', e.target.value)}
              autoCapitalize="off"
              required
            />
          )}
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={e => update('password', e.target.value)}
            required
          />

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid var(--red)',
              color: 'var(--red)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 13
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
            style={{ marginTop: 4 }}
          >
            {loading ? '…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <div className="text-xs text-muted" style={{ textAlign: 'center', marginTop: 20 }}>
          Unofficial Puffco companion app · Not affiliated with Puffco
        </div>
      </div>
    </div>
  );
}
