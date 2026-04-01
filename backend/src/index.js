require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const webpush = require('web-push');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const dabRoutes = require('./routes/dabs');
const friendRoutes = require('./routes/friends');
const leaderboardRoutes = require('./routes/leaderboard');

const { getDb } = require('./db');

const app = express();
const server = http.createServer(app);

// CORS
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

// Web Push
webpush.setVapidDetails(
  process.env.VAPID_MAILTO || 'mailto:admin@terp.app',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Expose VAPID public key to frontend
app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dabs', dabRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true, name: 'terp' }));

// Socket.io — real-time feed
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Attach io to app so routes can emit
app.set('io', io);

// Authenticate socket connections with JWT
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Unauthorized'));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = payload;
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.user.id;
  // Join personal room so server can push to this user
  socket.join(`user:${userId}`);
  console.log(`[socket] user ${socket.user.username} connected`);

  socket.on('disconnect', () => {
    console.log(`[socket] user ${socket.user.username} disconnected`);
  });
});

// Initialize DB
getDb();

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🌬️  Terp backend running on http://localhost:${PORT}`);
});
