# 🥋 TATAMI — BJJ Social Platform

> **The Strava for Grapplers.** Track your training, share sessions, connect with training partners.

TATAMI is a full-stack social platform built for the Brazilian Jiu-Jitsu community. It combines personal training logs with social features inspired by Strava, letting you track your progress while connecting with your training partners.

## 🔥 Features

### Social Feed (Strava-style)
- **Activity feed** showing friends' training sessions and posts
- **Kudos (likes)** — quick thumbs-up on any post
- **Comments** — engage with training partners
- **Photo sharing** — upload training photos
- **Session sharing** — attach your training log to a post
- **Tagging** — mention training partners in posts with @username
- **Privacy controls** — choose what's public and what stays private

### Training Log (your private diary)
- **Session logging** — date, duration, sparring rounds, drills
- **Technique tracking** — record which techniques you practiced
- **Submission log** — track taps (given and received!)
- **Public/Private toggle** — hide your diary if you got tapped by a white belt 😅
- **Progress charts** — visualize your training over time
- **Session stats** — total hours, rounds, and session counts

### Social Features
- **Friend/Buddy system** — send and accept friend requests
- **User profiles** — belt rank, gym, training stats, bio
- **User search** — find fellow grapplers
- **Profile pages** — view anyone's public posts and sessions
- **Notifications** — likes, comments, friend requests, tags

### Technique Library
- **70+ pre-loaded techniques** across guards, passes, submissions, sweeps, takedowns, controls, and escapes
- **Community submissions** — submit new techniques for admin review
- **Searchable** — filter by name or category

### Admin Panel
- Dashboard with platform stats
- Approve/reject technique submissions
- Manage technique library

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm

### Local Development
```bash
git clone <your-repo-url>
cd tatami
npm install
npm start
# → http://localhost:3000
```

### Environment Variables
```bash
PORT=3000
NODE_ENV=development
ADMIN_TOKEN=tatami-admin-2024
DB_DIR=./database
ALLOWED_ORIGINS=*
```

## 🚂 Deploy to Railway

This app is **Railway-ready** out of the box:

1. Push to GitHub
2. Connect your repo to [Railway](https://railway.app)
3. Set environment variables:
   - `NODE_ENV=production`
   - `ADMIN_TOKEN=<your-secret-token>`
   - `DB_DIR=/data/database` (if using persistent volume)
   - `UPLOAD_DIR=/data/uploads` (if using persistent volume)
4. Deploy!

> **Note**: For persistent data on Railway, attach a volume mounted at `/data` and set `DB_DIR=/data/database` and `UPLOAD_DIR=/data/uploads`.

The `nixpacks.toml` includes build dependencies needed for `better-sqlite3`.

## 🏗 Architecture

```
tatami/
├── server.js              # Express API server
├── database/
│   └── db.js              # SQLite database + all queries
├── public/
│   ├── index.html          # Single-page app (all frontend)
│   ├── admin.html          # Admin panel
│   ├── manifest.json       # PWA manifest
│   ├── sw.js               # Service worker
│   ├── icons/              # App icons
│   └── uploads/            # User-uploaded images
├── tests/
│   └── api.test.js         # Jest + supertest API tests
├── package.json
├── railway.json            # Railway config
├── nixpacks.toml           # Build deps for Railway
├── Procfile                # Process file
└── .gitignore
```

### Tech Stack
- **Backend**: Node.js + Express
- **Database**: SQLite via better-sqlite3
- **Frontend**: Vanilla HTML/CSS/JS (single-page app)
- **Auth**: Token-based (scrypt hashing)
- **File uploads**: Multer
- **Charts**: Chart.js
- **PWA**: Service worker + manifest

## 🔒 API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/logout` | Sign out |
| GET | `/api/auth/me` | Current user info |

### Profile
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/profile/:userId` | View profile |
| PUT | `/api/profile` | Update own profile |
| POST | `/api/profile/avatar` | Upload avatar |
| GET | `/api/users/search?q=` | Search users |

### Friends
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/friends` | List friends |
| GET | `/api/friends/pending` | Pending requests |
| POST | `/api/friends/request` | Send friend request |
| POST | `/api/friends/respond` | Accept/decline request |
| DELETE | `/api/friends/:friendId` | Remove friend |

### Sessions
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sessions` | List sessions |
| POST | `/api/sessions` | Log new session |
| PUT | `/api/sessions/:id` | Update session |
| DELETE | `/api/sessions/:id` | Delete session |

### Posts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/feed` | Social feed |
| GET | `/api/posts/user/:userId` | User's posts |
| POST | `/api/posts` | Create post |
| DELETE | `/api/posts/:id` | Delete post |
| POST | `/api/posts/upload-image` | Upload post image |
| POST | `/api/posts/:id/like` | Toggle like |
| GET | `/api/posts/:id/likes` | List likes |
| GET | `/api/posts/:id/comments` | List comments |
| POST | `/api/posts/:id/comments` | Add comment |

### Notifications
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications` | List notifications |
| GET | `/api/notifications/unread-count` | Unread count |
| POST | `/api/notifications/mark-read` | Mark all read |

### Techniques
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/techniques` | List approved techniques |
| POST | `/api/techniques/submit` | Submit new technique |

## 🧪 Testing

```bash
npm test               # Run tests
npm run test:coverage  # With coverage report
```

## 📱 PWA

TATAMI works as a Progressive Web App — add it to your home screen on iOS/Android for a native-like experience.

## 🤝 Contributing

1. Fork the repo
2. Create your feature branch
3. Commit changes
4. Push and open a PR

## 📄 License

MIT — see [LICENSE](LICENSE)

---

**OSS! 🤙 Train hard, roll smart, share the journey.**
