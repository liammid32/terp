const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getDb } = require('../db');

const router = express.Router();

// GET /api/friends — list accepted friends with their dab stats
router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const userId = req.user.id;

  const friends = db.prepare(`
    SELECT
      u.id, u.username, u.avatar_color, u.device_name,
      COUNT(dl.id) as total_dabs,
      COUNT(CASE WHEN dl.logged_at >= datetime('now', '-7 days') THEN 1 END) as dabs_this_week,
      COUNT(CASE WHEN date(dl.logged_at) = date('now') THEN 1 END) as dabs_today,
      MAX(dl.logged_at) as last_dab_at,
      COALESCE(np.enabled, 1) as notify_enabled
    FROM friendships f
    JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
    LEFT JOIN dab_logs dl ON dl.user_id = u.id
    LEFT JOIN notification_prefs np ON np.user_id = ? AND np.friend_id = u.id
    WHERE (f.requester_id = ? OR f.addressee_id = ?)
      AND f.status = 'accepted'
    GROUP BY u.id
    ORDER BY dabs_this_week DESC
  `).all(userId, userId, userId, userId);

  res.json(friends.map(f => ({
    ...f,
    notify_enabled: !!f.notify_enabled
  })));
});

// GET /api/friends/requests — incoming pending requests
router.get('/requests', requireAuth, (req, res) => {
  const db = getDb();
  const pending = db.prepare(`
    SELECT f.id as request_id, u.id, u.username, u.avatar_color, f.created_at
    FROM friendships f
    JOIN users u ON u.id = f.requester_id
    WHERE f.addressee_id = ? AND f.status = 'pending'
    ORDER BY f.created_at DESC
  `).all(req.user.id);

  res.json(pending);
});

// GET /api/friends/sent — outgoing pending requests
router.get('/sent', requireAuth, (req, res) => {
  const db = getDb();
  const sent = db.prepare(`
    SELECT f.id as request_id, u.id, u.username, u.avatar_color, f.created_at
    FROM friendships f
    JOIN users u ON u.id = f.addressee_id
    WHERE f.requester_id = ? AND f.status = 'pending'
    ORDER BY f.created_at DESC
  `).all(req.user.id);

  res.json(sent);
});

// POST /api/friends/request/:userId — send friend request
router.post('/request/:userId', requireAuth, (req, res) => {
  const db = getDb();
  const addresseeId = parseInt(req.params.userId);

  if (addresseeId === req.user.id) {
    return res.status(400).json({ error: 'Cannot add yourself' });
  }

  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(addresseeId);
  if (!target) return res.status(404).json({ error: 'User not found' });

  // Check for existing friendship in either direction
  const existing = db.prepare(`
    SELECT id, status FROM friendships
    WHERE (requester_id = ? AND addressee_id = ?)
       OR (requester_id = ? AND addressee_id = ?)
  `).get(req.user.id, addresseeId, addresseeId, req.user.id);

  if (existing) {
    if (existing.status === 'accepted') return res.status(409).json({ error: 'Already friends' });
    if (existing.status === 'pending') return res.status(409).json({ error: 'Request already pending' });
  }

  db.prepare(
    'INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, ?)'
  ).run(req.user.id, addresseeId, 'pending');

  res.status(201).json({ ok: true });
});

// POST /api/friends/accept/:requestId
router.post('/accept/:requestId', requireAuth, (req, res) => {
  const db = getDb();
  const request = db.prepare(
    'SELECT * FROM friendships WHERE id = ? AND addressee_id = ? AND status = ?'
  ).get(req.params.requestId, req.user.id, 'pending');

  if (!request) return res.status(404).json({ error: 'Request not found' });

  db.prepare(
    "UPDATE friendships SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(request.id);

  // Create default notification pref (enabled) for both users
  const insertPref = db.prepare(`
    INSERT OR IGNORE INTO notification_prefs (user_id, friend_id, enabled) VALUES (?, ?, 1)
  `);
  insertPref.run(req.user.id, request.requester_id);
  insertPref.run(request.requester_id, req.user.id);

  res.json({ ok: true });
});

// POST /api/friends/reject/:requestId
router.post('/reject/:requestId', requireAuth, (req, res) => {
  const db = getDb();
  const request = db.prepare(
    'SELECT * FROM friendships WHERE id = ? AND addressee_id = ? AND status = ?'
  ).get(req.params.requestId, req.user.id, 'pending');

  if (!request) return res.status(404).json({ error: 'Request not found' });

  db.prepare(
    "UPDATE friendships SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(request.id);

  res.json({ ok: true });
});

// DELETE /api/friends/:userId — remove a friend
router.delete('/:userId', requireAuth, (req, res) => {
  const db = getDb();
  const friendId = parseInt(req.params.userId);

  db.prepare(`
    DELETE FROM friendships
    WHERE ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))
      AND status = 'accepted'
  `).run(req.user.id, friendId, friendId, req.user.id);

  res.json({ ok: true });
});

module.exports = router;
