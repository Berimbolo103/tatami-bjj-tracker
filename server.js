try { require('dotenv').config(); } catch (_) {}

const express = require('express');
const path    = require('path');
const multer  = require('multer');
const fs      = require('fs');
const db      = require('./database/db');

const app  = express();
const PORT = process.env.PORT || 3000;
const ENV  = process.env.NODE_ENV || 'development';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'tatami-admin-2024';

// ── FILE UPLOADS ────────────────────────────────────────────────────────────
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2,8)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|jpg|png|gif|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only images allowed'));
  }
});

// ── CORS ────────────────────────────────────────────────────────────────────
const ALLOWED = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim()).filter(Boolean);
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  const allowed = ALLOWED.includes('*') || ALLOWED.includes(origin);
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-admin-token');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });
  const user = db.getUserByToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired token' });
  req.user = user;
  next();
}

function optionalAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (token) req.user = db.getUserByToken(token);
  next();
}

function requireAdmin(req, res, next) {
  if (req.headers['x-admin-token'] !== ADMIN_TOKEN)
    return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ── HEALTH ──────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: ENV, timestamp: new Date().toISOString() });
});

// ══════════════════════════════════════════════════════════════════════════════
//  AUTH ROUTES
// ══════════════════════════════════════════════════════════════════════════════
app.post('/api/auth/register', (req, res) => {
  const { username, email, password, display_name } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'Username, email, and password required' });
  if (username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({ error: 'Username can only contain letters, numbers, underscore' });
  const result = db.registerUser({ username, email, password, display_name });
  if (result.error) return res.status(409).json(result);
  res.json(result);
});

app.post('/api/auth/login', (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) return res.status(400).json({ error: 'Login and password required' });
  const result = db.loginUser({ login, password });
  if (result.error) return res.status(401).json(result);
  res.json(result);
});

app.post('/api/auth/logout', auth, (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  db.logoutToken(token);
  res.json({ ok: true });
});

app.get('/api/auth/me', auth, (req, res) => {
  res.json(req.user);
});

// ══════════════════════════════════════════════════════════════════════════════
//  PROFILE
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/profile/:userId', optionalAuth, (req, res) => {
  const profile = db.getPublicProfile(req.params.userId);
  if (!profile) return res.status(404).json({ error: 'User not found' });
  if (req.user) {
    profile.friendship = db.getFriendshipStatus(req.user.id, req.params.userId);
    profile.is_self = req.user.id === req.params.userId;
  }
  res.json(profile);
});

app.put('/api/profile', auth, (req, res) => {
  db.updateProfile(req.user.id, req.body);
  res.json({ ok: true });
});

app.get('/api/users/search', auth, (req, res) => {
  const q = req.query.q || '';
  if (q.length < 2) return res.json([]);
  res.json(db.searchUsers(q, req.user.id));
});

// ── AVATAR UPLOAD ───────────────────────────────────────────────────────────
app.post('/api/profile/avatar', auth, upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = `/uploads/${req.file.filename}`;
  db.updateProfile(req.user.id, { avatar_url: url });
  res.json({ avatar_url: url });
});

// ══════════════════════════════════════════════════════════════════════════════
//  FRIENDS
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/friends', auth, (req, res) => {
  res.json(db.getFriends(req.user.id));
});

app.get('/api/friends/pending', auth, (req, res) => {
  res.json(db.getPendingRequests(req.user.id));
});

app.post('/api/friends/request', auth, (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  const result = db.sendFriendRequest(req.user.id, user_id);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/friends/respond', auth, (req, res) => {
  const { friendship_id, accept } = req.body;
  if (!friendship_id) return res.status(400).json({ error: 'friendship_id required' });
  const result = db.respondFriendRequest(friendship_id, req.user.id, accept);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.delete('/api/friends/:friendId', auth, (req, res) => {
  res.json(db.removeFriend(req.user.id, req.params.friendId));
});

// ══════════════════════════════════════════════════════════════════════════════
//  SESSIONS
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/sessions', auth, (req, res) => {
  const userId = req.query.user_id || req.user.id;
  res.json(db.getUserSessions(userId, req.user.id));
});

app.post('/api/sessions', auth, (req, res) => {
  const id = db.createSession(req.user.id, req.body);
  res.json({ id });
});

app.put('/api/sessions/:id', auth, (req, res) => {
  const result = db.updateSession(req.user.id, req.params.id, req.body);
  if (result.error) return res.status(404).json(result);
  res.json({ ok: true });
});

app.delete('/api/sessions/:id', auth, (req, res) => {
  res.json(db.deleteSession(req.user.id, req.params.id));
});

// ══════════════════════════════════════════════════════════════════════════════
//  POSTS
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/feed', auth, (req, res) => {
  const offset = parseInt(req.query.offset) || 0;
  res.json(db.getFeed(req.user.id, offset));
});

app.get('/api/posts/user/:userId', auth, (req, res) => {
  const offset = parseInt(req.query.offset) || 0;
  res.json(db.getUserPosts(req.params.userId, req.user.id, offset));
});

app.post('/api/posts', auth, (req, res) => {
  const id = db.createPost(req.user.id, req.body);
  res.json({ id });
});

app.delete('/api/posts/:id', auth, (req, res) => {
  res.json(db.deletePost(req.user.id, req.params.id));
});

// ── POST IMAGE UPLOAD ───────────────────────────────────────────────────────
app.post('/api/posts/upload-image', auth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ image_url: `/uploads/${req.file.filename}` });
});

// ══════════════════════════════════════════════════════════════════════════════
//  LIKES & COMMENTS
// ══════════════════════════════════════════════════════════════════════════════
app.post('/api/posts/:id/like', auth, (req, res) => {
  res.json(db.toggleLike(req.user.id, req.params.id));
});

app.get('/api/posts/:id/likes', auth, (req, res) => {
  res.json(db.getPostLikes(req.params.id));
});

app.get('/api/posts/:id/comments', auth, (req, res) => {
  res.json(db.getPostComments(req.params.id));
});

app.post('/api/posts/:id/comments', auth, (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });
  res.json(db.addComment(req.user.id, req.params.id, content));
});

app.delete('/api/comments/:id', auth, (req, res) => {
  res.json(db.deleteComment(req.user.id, req.params.id));
});

// ══════════════════════════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/notifications', auth, (req, res) => {
  res.json(db.getNotifications(req.user.id));
});

app.get('/api/notifications/unread-count', auth, (req, res) => {
  res.json({ count: db.getUnreadCount(req.user.id) });
});

app.post('/api/notifications/mark-read', auth, (req, res) => {
  db.markNotificationsRead(req.user.id);
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════════════════════════
//  TECHNIQUES
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/techniques', (req, res) => res.json(db.getApprovedTechniques()));

app.post('/api/techniques/submit', auth, (req, res) => {
  const { name, category, description } = req.body;
  if (!name || !category) return res.status(400).json({ error: 'Name and category required' });
  const result = db.submitTechnique({ name, category, description, submitted_by: req.user.username });
  if (result.alreadyExists) return res.status(409).json({ error: `"${name}" already exists`, status: result.status });
  res.json({ id: result.id, status: 'pending' });
});

app.get('/api/techniques/my-submissions', auth, (req, res) => {
  res.json(db.getSubmissionsByUser(req.user.username));
});

// ══════════════════════════════════════════════════════════════════════════════
//  ADMIN
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/admin/stats',       requireAdmin, (req, res) => res.json(db.getAdminStats()));
app.get('/api/admin/submissions', requireAdmin, (req, res) => res.json(db.getAllSubmissions()));
app.get('/api/admin/techniques',  requireAdmin, (req, res) => res.json(db.getAllTechniques()));
app.put('/api/admin/submissions/:id/approve', requireAdmin, (req, res) => { db.approveSubmission(req.params.id); res.json({ ok: true }); });
app.put('/api/admin/submissions/:id/reject',  requireAdmin, (req, res) => { db.rejectSubmission(req.params.id, req.body.reason||''); res.json({ ok: true }); });
app.delete('/api/admin/techniques/:id',       requireAdmin, (req, res) => { db.deleteTechnique(req.params.id); res.json({ ok: true }); });

// ── CATCH-ALL SPA ───────────────────────────────────────────────────────────
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log('\n  ╔══════════════════════════════════════════════════════╗');
  console.log(`  ║   TATAMI — BJJ Social Platform — ${ENV.padEnd(12)}     ║`);
  console.log('  ╚══════════════════════════════════════════════════════╝');
  console.log(`\n  🥋  App:    http://localhost:${PORT}`);
  console.log(`  🔐  Admin:  http://localhost:${PORT}/admin.html`);
  console.log(`  🔑  Token:  ${ADMIN_TOKEN}`);
  console.log(`  💾  DB:     ${process.env.DB_DIR || './database'}/tatami.db\n`);
});

module.exports = app;
