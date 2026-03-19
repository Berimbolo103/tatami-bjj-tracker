# 🥋 TATAMI — BJJ Progress Tracker

[![CI](https://github.com/YOUR_USERNAME/tatami-bjj-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/tatami-bjj-tracker/actions)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A full-stack BJJ training tracker — log sessions, drill techniques, track submission analytics, and get a playstyle prediction based on your physical profile. Includes an admin panel for moderating user-submitted techniques and positions.

**Built as a Progressive Web App (PWA)** — works offline, installable on home screen, and ready to wrap into native iOS/Android via Capacitor.

---

## Features

### User App
| Feature | Description |
|---------|-------------|
| Dashboard | Streak, mat time, weekly volume chart, position breakdown |
| Session Log | Log training with techniques, submissions, sparring, notes |
| Library | Browse your personal technique library by category and drill count |
| Submit Techniques | Submit new positions for admin review; see pending/rejected status live |
| Submission Analytics | Attempt vs finish rate, ranked by success %, bar chart |
| Profile & Playstyle | Belt/rank, physical profile, AI-predicted playstyle, data-detected style |
| PWA / Installable | Works offline, add-to-homescreen |

### Admin Panel (/admin.html)
| Feature | Description |
|---------|-------------|
| Approve | Approve pending technique submissions — they go live instantly |
| Reject | Reject with an optional reason (user sees it in their Library) |
| Re-approve | Reconsider a previously rejected submission |
| Delete | Remove user-added techniques from the DB |
| Stats | Sessions, techniques, pending count, total mat time, unique submitters |

---

## Quick Start (Local)

Prerequisites: Node.js 18+ and npm 8+

```bash
git clone https://github.com/YOUR_USERNAME/tatami-bjj-tracker.git
cd tatami-bjj-tracker
npm install
cp .env.example .env
# Edit .env — change ADMIN_TOKEN to something secret
npm start
```

Open:
- App: http://localhost:3000
- Admin: http://localhost:3000/admin.html  (token in your .env)
- Dev mode (live reload): `npm run dev`

---

## Testing

```bash
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage report
```

Tests use a temporary SQLite DB — your real data is never touched.

The test suite covers: health endpoint, profile CRUD, technique listing and submission, duplicate detection, session CRUD, admin authentication, approve/reject/delete flows, and edge cases.

---

## Deploy to the Cloud

### Railway (recommended)

1. Push your repo to GitHub
2. Go to railway.app → New Project → Deploy from GitHub
3. Add a Volume mount at `/data` for persistent SQLite
4. Set environment variables:
   ```
   NODE_ENV=production
   ADMIN_TOKEN=your-strong-secret
   DB_DIR=/data
   ALLOWED_ORIGINS=https://your-app.up.railway.app
   ```
5. Railway auto-detects Node.js and runs `npm start`

### Render

A `render.yaml` is included — connect your repo at render.com → New → Blueprint. It auto-configures a 1GB disk at `/data` for SQLite. Set `ADMIN_TOKEN` in the dashboard.

### Any VPS

```bash
npm install --omit=dev
cp .env.example .env  # edit it
NODE_ENV=production npm start
```

Use PM2 to keep it running: `pm2 start server.js --name tatami`

---

## Mobile App (iOS & Android) — Roadmap

The app is already a PWA — users can install it from the browser. When you're ready to publish to app stores, wrap it with Capacitor:

```bash
npm run cap:add:ios      # Requires macOS + Xcode
npm run cap:add:android  # Requires Android Studio
npm run cap:sync         # Sync web code to native projects
npm run cap:ios          # Open in Xcode
npm run cap:android      # Open in Android Studio
```

> For native builds: `fetch('/api/...')` needs a base URL pointing to your hosted server, or use `@capacitor-community/sqlite` for fully offline operation.

### Publishing Checklist
- [ ] Replace placeholder icons in `public/icons/` with real 192x192 and 512x512 PNGs
- [ ] Update `capacitor.config.json` with your real `appId`
- [ ] Add splash screens via Capacitor Assets
- [ ] Configure API base URL for native builds
- [ ] Test on real devices via TestFlight / Play Console internal testing
- [ ] Fill out App Store / Play Store metadata, screenshots, privacy policy

---

## Project Structure

```
tatami-bjj-tracker/
├── .github/workflows/ci.yml    ← GitHub Actions CI
├── database/db.js              ← SQLite layer (better-sqlite3)
├── public/
│   ├── index.html              ← Main user app (SPA)
│   ├── admin.html              ← Admin panel
│   ├── manifest.json           ← PWA manifest
│   ├── sw.js                   ← Service Worker (offline support)
│   └── icons/                  ← PWA icons (replace with real art)
├── tests/api.test.js           ← Full API test suite
├── .env.example                ← Environment variable template
├── capacitor.config.json       ← Native app config
├── package.json
├── railway.json                ← Railway deploy config
├── render.yaml                 ← Render deploy config
└── server.js                   ← Express API server
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| NODE_ENV | development | Environment |
| ADMIN_TOKEN | tatami-admin-2024 | Change this in production! |
| DB_DIR | ./database | Directory for tatami.db |
| ALLOWED_ORIGINS | * | CORS origins (comma-separated) |

---

## API Reference

### Public

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check |
| GET | /api/profile | Get profile |
| PUT | /api/profile | Save profile |
| GET | /api/techniques | Approved techniques |
| POST | /api/techniques/submit | Submit new technique |
| GET | /api/techniques/my-submissions?submitted_by=Name | User's submissions |
| GET | /api/sessions | All sessions |
| POST | /api/sessions | Create session |
| PUT | /api/sessions/:id | Update session |
| DELETE | /api/sessions/:id | Delete session |

### Admin (require x-admin-token header)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/admin/stats | Overview stats |
| GET | /api/admin/submissions | All user submissions |
| PUT | /api/admin/submissions/:id/approve | Approve |
| PUT | /api/admin/submissions/:id/reject | Reject with { reason } |
| GET | /api/admin/techniques | All techniques |
| DELETE | /api/admin/techniques/:id | Delete technique |
| GET | /api/admin/sessions | All sessions |

---

## Things to Test Before Going to App Stores

- [ ] Does onboarding feel smooth on a real phone?
- [ ] Is session logging fast enough to use right after class?
- [ ] Quick-log shortcut — just duration + 1-tap techniques?
- [ ] Multi-user support (right now single-profile per server instance)
- [ ] Training goals — sessions per week with a progress ring
- [ ] Sparring partner tracking
- [ ] Injury log — track aches and rest days
- [ ] Stripe/promotion tracker over time
- [ ] Push notification reminders ("You haven't trained in 3 days")
- [ ] Rate limiting on the API (express-rate-limit)
- [ ] Input sanitisation middleware

---

## License

MIT
