const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getDb } = require('../db');
const webpush = require('web-push');

const router = express.Router();

// POST /api/dabs — log a dab (called by frontend after BLE detects ACTIVE state)
router.post('/', requireAuth, (req, res) => {
  const { temperature_f, profile_name, duration_ms, device_name } = req.body;
  const db = getDb();

  const result = db.prepare(`
    INSERT INTO dab_logs (user_id, temperature_f, profile_name, duration_ms, device_name)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.user.id, temperature_f || null, profile_name || null, duration_ms || null, device_name || null);

  // Get user info for notifications
  const dabber = db.prepare(
    'SELECT username, avatar_color, notifications_enabled FROM users WHERE id = ?'
  ).get(req.user.id);

  // Push notifications to friends who have this user enabled
  if (dabber.notifications_enabled) {
    sendDabNotifications(req.user.id, dabber, db);
  }

  // Get the io instance attached to the app for real-time events
  const io = req.app.get('io');
  if (io) {
    io.to(`user:${req.user.id}`).emit('dab:logged', {
      userId: req.user.id,
      username: req.user.username,
      temperature_f,
      profile_name,
      logged_at: new Date().toISOString()
    });

    // Notify friends' rooms
    notifyFriendsRealtime(req.user.id, req.user.username, temperature_f, profile_name, db, io);
  }

  res.status(201).json({ id: result.lastInsertRowid, ok: true });
});

// GET /api/dabs/me — your dab history
router.get('/me', requireAuth, (req, res) => {
  const db = getDb();
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;

  const dabs = db.prepare(`
    SELECT id, temperature_f, profile_name, duration_ms, device_name, logged_at
    FROM dab_logs WHERE user_id = ?
    ORDER BY logged_at DESC
    LIMIT ? OFFSET ?
  `).all(req.user.id, limit, offset);

  const total = db.prepare('SELECT COUNT(*) as count FROM dab_logs WHERE user_id = ?').get(req.user.id);

  res.json({ dabs, total: total.count });
});

// GET /api/dabs/stats — your stats across all time periods
router.get('/stats', requireAuth, (req, res) => {
  const db = getDb();
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_dabs,
      COUNT(CASE WHEN date(logged_at) = date('now') THEN 1 END) as dabs_today,
      COUNT(CASE WHEN logged_at >= datetime('now', '-7 days') THEN 1 END) as dabs_this_week,
      ROUND(AVG(temperature_f), 1) as avg_temp_f,
      MAX(logged_at) as last_dab_at
    FROM dab_logs WHERE user_id = ?
  `).get(req.user.id);

  // Streak calculation
  const streak = calcStreak(req.user.id, db);

  res.json({ ...stats, streak_days: streak });
});

function calcStreak(userId, db) {
  const days = db.prepare(`
    SELECT DISTINCT date(logged_at) as day
    FROM dab_logs WHERE user_id = ?
    ORDER BY day DESC
    LIMIT 365
  `).all(userId).map(r => r.day);

  if (!days.length) return 0;

  const today = new Date().toISOString().split('T')[0];
  if (days[0] !== today) return 0;

  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]);
    const curr = new Date(days[i]);
    const diff = (prev - curr) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

async function sendDabNotifications(dabberId, dabber, db) {
  // Find all friends who have notifications enabled for this dabber
  const subs = db.prepare(`
    SELECT ps.endpoint, ps.p256dh, ps.auth, u.username as watcher
    FROM notification_prefs np
    JOIN push_subscriptions ps ON ps.user_id = np.user_id
    JOIN users u ON u.id = np.user_id
    WHERE np.friend_id = ? AND np.enabled = 1
      AND u.notifications_enabled = 1
  `).all(dabberId);

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: '🌬️ Terp',
          body: `${dabber.username} just took a dab`,
          icon: '/icon-192.png',
          badge: '/badge.png',
          data: { url: `/profile/${dabber.username}` }
        })
      );
    } catch (err) {
      // Sub may be expired — clean it up
      if (err.statusCode === 410) {
        db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(sub.endpoint);
      }
    }
  }
}

function notifyFriendsRealtime(dabberId, dabberUsername, temperature_f, profile_name, db, io) {
  // Find friends of the dabber who have notifications enabled
  const friendIds = db.prepare(`
    SELECT CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END as friend_id
    FROM friendships f
    JOIN notification_prefs np ON np.friend_id = ? AND np.user_id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
    WHERE (f.requester_id = ? OR f.addressee_id = ?)
      AND f.status = 'accepted'
      AND np.enabled = 1
  `).all(dabberId, dabberId, dabberId, dabberId, dabberId);

  const event = {
    type: 'friend_dabbed',
    userId: dabberId,
    username: dabberUsername,
    temperature_f,
    profile_name,
    logged_at: new Date().toISOString()
  };

  for (const { friend_id } of friendIds) {
    io.to(`user:${friend_id}`).emit('friend:dabbed', event);
  }
}

module.exports = router;
