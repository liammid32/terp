# 🌬️ Terp

> A social Puffco leaderboard. Track your dabs, compete with friends.

Built on top of [melt](https://github.com/ryleyio/melt) — an unofficial Puffco Proxy BLE controller.
Unofficial project. Not affiliated with Puffco.

---

## Project Structure

```
terp/
├── backend/       Node.js + Express + SQLite + Socket.io
└── frontend/      React + Vite (Web Bluetooth API)
```

## Features

- 🔵 **BLE Device Connect** — Pair your Puffco Proxy directly in the browser via Web Bluetooth
- 🌬️ **Auto Dab Detection** — Device state watcher fires when you take a dab (ACTIVE/FADE state)
- 🏆 **Leaderboard** — Friends leaderboard + opt-in global board with All Time / Weekly / Today views
- 👥 **Friends System** — Search users, send/accept friend requests
- 🔔 **Notifications** — Real-time socket events + Web Push when friends dab (per-friend toggle)

## Requirements

- Node.js 18+
- Chrome or Edge (Web Bluetooth API)
- Puffco Proxy device

## Setup

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env — set JWT_SECRET and generate VAPID keys:
#   npx web-push generate-vapid-keys
npm install
npm run dev
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in Chrome or Edge.

### 3. Completing BLE Authentication

The BLE connection uses a SHA256-based auth handshake from the melt protocol.
To enable full authenticated access:

1. Install melt: `npm install @ryleyio/melt`
2. In `frontend/src/ble/connection.js`, find the `_authenticate()` method
3. Import `createAuthToken` from `@ryleyio/melt/src/ble/protocol` and complete the auth steps

Without auth, device state subscriptions (dab detection) still work on most firmware versions.

## Database

SQLite via `better-sqlite3`. Schema auto-initializes on first run. DB file at `backend/terp.db`.

## Tech Stack

| Layer       | Tech                              |
|-------------|-----------------------------------|
| Frontend    | React 18 + Vite + React Router    |
| BLE         | Web Bluetooth API                 |
| Backend     | Node.js + Express                 |
| Database    | SQLite (better-sqlite3)           |
| Real-time   | Socket.io                         |
| Push notifs | Web Push API                      |
| Auth        | JWT (30-day tokens)               |

---

*Unofficial tool. Not affiliated with Puffco. Use at your own risk.*
