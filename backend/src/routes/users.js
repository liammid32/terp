const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getDb } = require('../db');

const router = express.Router();

// GET /api/users/me
router.get('/me', requireAuth, (req, res) => {
  const db = getDb();
  const user = db.prepare(
    'SELECT id, username, email, avatar_color, device_name, bio, notifications_enabled, is_global_leaderboard, created_at FROM users WHERE id = ?'
  ).get(req.user.id);

  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({
    ...user,
    notifications_enabled: !!user.notifications_enabled,
    is_global_leaderboard: !!user.is_global_leaderboard
  });
});

// PATCH /api/users/me
router.patch('/me', requireAuth, (req, res) => {
  const { device_name, bio, notifications_enabled, is_global_leaderboard } = req.body;
  const db = getDb();

  const fields = [];
  const values = [];

  if (device_name !== undefined) { fields.push('device_name = ?'); values.push(device_name); }
  if (bio !== undefined) { fields.push('bio = ?'); values.push(bio); }
  if (notifications_enabled !== undefined) { fields.push('notifications_enabled = ?'); values.push(notifications_enabled ? 1 : 0); }
  if (is_global_leaderboard !== undefined) { fields.push('is_global_leaderboard = ?'); values.push(is_global_leaderboard ? 1 : 0); }

  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

  values.push(req.user.id);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare(
    'SELECT id, username, email, avatar_color, device_name, bio, notifications_enabled, is_global_leaderboard FROM users WHERE id = ?'
  ).get(req.user.id);

  res.json({
    ...updated,
    notifications_enabled: !!updated.notifications_enabled,
    is_global_leaderboard: !!updated.is_global_leaderboard
  });
});

// GET /api/users/search?q=username
router.get('/search', requireAuth, (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.status(400).json({ error: 'Query must be at least 2 characters' });

  const db = getDb();
  const users = db.prepare(
    `SELECT id, username, avatar_color, device_name FROM users
     WHERE username LIKE ? AND id != ?
     LIMIT 20`
  ).all(`%${q}%`, req.user.id);

  res.json(users);
});

// GET /api/users/:username/profile
router.get('/:username/profile', requireAuth, (req, res) => {
  const db = getDb();
  const user = db.prepare(
    'SELECT id, username, avatar_color, device_name, bio, created_at FROM users WHERE username = ?'
  ).get(req.params.username);

  if (!user) return res.status(404).json({ error: 'User not found' });

  // Dab stats
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_dabs,
      COUNT(CASE WHEN date(logged_at) = date('now') THEN 1 END) as dabs_today,
      COUNT(CASE WHEN logged_at >= datetime('now', '-7 days') THEN 1 END) as dabs_this_week,
      ROUND(AVG(temperature_f), 1) as avg_temp,
      MAX(logged_at) as last_dab_at
    FROM dab_logs WHERE user_id = ?
  `).get(user.id);

  res.json({ ...user, stats });
});

// Notification prefs for a specific friend
// GET /api/users/notifications/:friendId
router.get('/notifications/:friendId', requireAuth, (req, res) => {
  const db = getDb();
  const pref = db.prepare(
    'SELECT enabled FROM notification_prefs WHERE user_id = ? AND friend_id = ?'
  ).get(req.user.id, req.params.friendId);

  res.json({ enabled: pref ? !!pref.enabled : true }); // default enabled
});

// PUT /api/users/notifications/:friendId
router.put('/notifications/:friendId', requireAuth, (req, res) => {
  const { enabled } = req.body;
  const db = getDb();

  db.prepare(`
    INSERT INTO notification_prefs (user_id, friend_id, enabled)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, friend_id) DO UPDATE SET enabled = excluded.enabled
  `).run(req.user.id, req.params.friendId, enabled ? 1 : 0);

  res.json({ enabled: !!enabled });
});

// Push subscription management
// POST /api/users/push-subscription
router.post('/push-subscription', requireAuth, (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'Invalid push subscription' });
  }

  const db = getDb();
  db.prepare(`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth
  `).run(req.user.id, endpoint, keys.p256dh, keys.auth);

  res.json({ ok: true });
});

// DELETE /api/users/push-subscription
router.delete('/push-subscription', requireAuth, (req, res) => {
  const { endpoint } = req.body;
  const db = getDb();
  db.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?')
    .run(req.user.id, endpoint);
  res.json({ ok: true });
});

module.exports = router;
