const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getDb } = require('../db');

const router = express.Router();

// Helper: get dab counts for a set of user IDs across time windows
function getLeaderboardData(userIds, db) {
  if (!userIds.length) return [];

  const placeholders = userIds.map(() => '?').join(',');
  return db.prepare(`
    SELECT
      u.id, u.username, u.avatar_color, u.device_name,
      COUNT(dl.id) as total_dabs,
      COUNT(CASE WHEN dl.logged_at >= datetime('now', '-7 days') THEN 1 END) as dabs_this_week,
      COUNT(CASE WHEN date(dl.logged_at) = date('now') THEN 1 END) as dabs_today,
      MAX(dl.logged_at) as last_dab_at,
      ROUND(AVG(dl.temperature_f), 1) as avg_temp_f
    FROM users u
    LEFT JOIN dab_logs dl ON dl.user_id = u.id
    WHERE u.id IN (${placeholders})
    GROUP BY u.id
    ORDER BY total_dabs DESC
  `).all(...userIds);
}

// GET /api/leaderboard/friends?period=alltime|weekly|daily
router.get('/friends', requireAuth, (req, res) => {
  const db = getDb();
  const userId = req.user.id;
  const period = req.query.period || 'alltime';

  // Get all accepted friend IDs + self
  const friendRows = db.prepare(`
    SELECT CASE WHEN requester_id = ? THEN addressee_id ELSE requester_id END as friend_id
    FROM friendships
    WHERE (requester_id = ? OR addressee_id = ?) AND status = 'accepted'
  `).all(userId, userId, userId);

  const userIds = [userId, ...friendRows.map(r => r.friend_id)];
  const board = getLeaderboardData(userIds, db);

  // Sort by the requested period
  const sorted = sortByPeriod(board, period);
  const ranked = sorted.map((u, i) => ({ ...u, rank: i + 1, is_self: u.id === userId }));

  res.json(ranked);
});

// GET /api/leaderboard/global?period=alltime|weekly|daily
router.get('/global', requireAuth, (req, res) => {
  const db = getDb();
  const period = req.query.period || 'alltime';
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);

  let orderClause;
  switch (period) {
    case 'daily':   orderClause = 'dabs_today DESC'; break;
    case 'weekly':  orderClause = 'dabs_this_week DESC'; break;
    default:        orderClause = 'total_dabs DESC';
  }

  const board = db.prepare(`
    SELECT
      u.id, u.username, u.avatar_color, u.device_name,
      COUNT(dl.id) as total_dabs,
      COUNT(CASE WHEN dl.logged_at >= datetime('now', '-7 days') THEN 1 END) as dabs_this_week,
      COUNT(CASE WHEN date(dl.logged_at) = date('now') THEN 1 END) as dabs_today,
      MAX(dl.logged_at) as last_dab_at,
      ROUND(AVG(dl.temperature_f), 1) as avg_temp_f
    FROM users u
    LEFT JOIN dab_logs dl ON dl.user_id = u.id
    WHERE u.is_global_leaderboard = 1
    GROUP BY u.id
    ORDER BY ${orderClause}
    LIMIT ?
  `).all(limit);

  const ranked = board.map((u, i) => ({
    ...u,
    rank: i + 1,
    is_self: u.id === req.user.id
  }));

  res.json(ranked);
});

function sortByPeriod(board, period) {
  switch (period) {
    case 'daily':   return [...board].sort((a, b) => b.dabs_today - a.dabs_today);
    case 'weekly':  return [...board].sort((a, b) => b.dabs_this_week - a.dabs_this_week);
    default:        return [...board].sort((a, b) => b.total_dabs - a.total_dabs);
  }
}

module.exports = router;
