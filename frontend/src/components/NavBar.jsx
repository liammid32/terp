import { NavLink } from 'react-router-dom';
import { useDevice } from '../context/DeviceContext';

const NAV = [
  { to: '/',            icon: '🌬️', label: 'Home'      },
  { to: '/leaderboard', icon: '🏆', label: 'Board'     },
  { to: '/friends',     icon: '👥', label: 'Friends'   },
  { to: '/profile',     icon: '👤', label: 'Profile'   },
];

export default function NavBar() {
  const { isConnected } = useDevice();

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: 480,
      background: 'rgba(10,10,15,0.95)',
      borderTop: '1px solid var(--border)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      zIndex: 50,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {NAV.map(({ to, icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          style={({ isActive }) => ({
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '10px 0 8px',
            gap: 3,
            color: isActive ? 'var(--accent-2)' : 'var(--text-dim)',
            fontSize: 11,
            fontWeight: 600,
            transition: 'color 0.15s',
          })}
        >
          <span style={{ fontSize: 20 }}>{icon}</span>
          <span>{label}</span>
        </NavLink>
      ))}

      {/* Connection dot indicator */}
      <div style={{
        position: 'absolute',
        top: 8,
        right: 12,
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: isConnected ? 'var(--green)' : 'var(--text-dim)',
        boxShadow: isConnected ? '0 0 6px var(--green)' : 'none',
        transition: 'all 0.3s',
      }} />
    </nav>
  );
}
