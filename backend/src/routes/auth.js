const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email, and password are required' });
  }
  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({ error: 'Username must be 3–20 characters' });
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existing) {
    return res.status(409).json({ error: 'Username or email already taken' });
  }

  const hash = await bcrypt.hash(password, 10);

  // Random avatar color from a nice palette
  const colors = ['#7c3aed', '#db2777', '#ea580c', '#16a34a', '#0284c7', '#9333ea'];
  const avatar_color = colors[Math.floor(Math.random() * colors.length)];

  const result = db.prepare(
    'INSERT INTO users (username, email, password_hash, avatar_color) VALUES (?, ?, ?, ?)'
  ).run(username, email, hash, avatar_color);

  const token = jwt.sign(
    { id: result.lastInsertRowid, username },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.status(201).json({
    token,
    user: { id: result.lastInsertRowid, username, email, avatar_color }
  });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { login, password } = req.body; // login = username or email

  if (!login || !password) {
    return res.status(400).json({ error: 'login and password are required' });
  }

  const db = getDb();
  const user = db.prepare(
    'SELECT * FROM users WHERE username = ? OR email = ?'
  ).get(login, login);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar_color: user.avatar_color,
      device_name: user.device_name,
      bio: user.bio,
      notifications_enabled: !!user.notifications_enabled,
      is_global_leaderboard: !!user.is_global_leaderboard
    }
  });
});

module.exports = router;
