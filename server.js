try { require('dotenv').config(); } catch (_) {}
const express = require('express'), path = require('path'), multer = require('multer'), fs = require('fs');
const db = require('./database/db');
const app = express();
const PORT = process.env.PORT || 3000, ENV = process.env.NODE_ENV || 'development';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'rollbook-admin-2024';
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}_${Math.random().toString(36).slice(2,8)}${path.extname(file.originalname)||'.jpg'}`)
});
const upload = multer({ storage, limits: { fileSize: 25*1024*1024 }, fileFilter: (req, file, cb) => {
  if (/^(image|video)\/(jpeg|jpg|png|gif|webp|mp4|mov|quicktime|webm)$/.test(file.mimetype)) cb(null, true);
  else cb(new Error('Only images and videos allowed'));
}});

const ALLOWED = (process.env.ALLOWED_ORIGINS||'*').split(',').map(s=>s.trim()).filter(Boolean);
app.use((req,res,next) => {
  const origin = req.headers.origin||'*';
  if (ALLOWED.includes('*')||ALLOWED.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-admin-token');
  }
  if (req.method==='OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function auth(req,res,next) {
  const token = (req.headers.authorization||'').replace('Bearer ','');
  if (!token) return res.status(401).json({ error: 'No token' });
  const user = db.getUserByToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired token' });
  req.user = user; next();
}
function optionalAuth(req,res,next) { const t=(req.headers.authorization||'').replace('Bearer ',''); if(t) req.user=db.getUserByToken(t); next(); }
function requireAdmin(req,res,next) { if(req.headers['x-admin-token']!==ADMIN_TOKEN) return res.status(401).json({error:'Unauthorized'}); next(); }

app.get('/api/health', (req,res) => res.json({ status:'ok', env:ENV, app:'Rollbook' }));

// AUTH
app.post('/api/auth/register', (req,res) => {
  const {username,email,password,display_name}=req.body;
  if(!username||!email||!password) return res.status(400).json({error:'Username, email, and password required'});
  if(username.length<3) return res.status(400).json({error:'Username must be at least 3 characters'});
  if(password.length<6) return res.status(400).json({error:'Password must be at least 6 characters'});
  if(!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({error:'Username: letters, numbers, underscore only'});
  const r=db.registerUser({username,email,password,display_name}); if(r.error) return res.status(409).json(r); res.json(r);
});
app.post('/api/auth/login', (req,res) => {
  const {login,password}=req.body; if(!login||!password) return res.status(400).json({error:'Required'});
  const r=db.loginUser({login,password}); if(r.error) return res.status(401).json(r); res.json(r);
});
app.post('/api/auth/logout', auth, (req,res) => { db.logoutToken((req.headers.authorization||'').replace('Bearer ','')); res.json({ok:true}); });
app.get('/api/auth/me', auth, (req,res) => res.json(req.user));

// PROFILE
app.get('/api/profile/:userId', optionalAuth, (req,res) => {
  const p=db.getPublicProfile(req.params.userId); if(!p) return res.status(404).json({error:'Not found'});
  if(req.user) { p.friendship=db.getFriendshipStatus(req.user.id,req.params.userId); p.is_self=req.user.id===req.params.userId; }
  res.json(p);
});
app.put('/api/profile', auth, (req,res) => { db.updateProfile(req.user.id, req.body); res.json({ok:true}); });
app.get('/api/users/search', auth, (req,res) => { const q=req.query.q||''; if(q.length<2) return res.json([]); res.json(db.searchUsers(q,req.user.id)); });
app.post('/api/profile/avatar', auth, upload.single('file'), (req,res) => {
  if(!req.file) return res.status(400).json({error:'No file'}); const url=`/uploads/${req.file.filename}`; db.updateProfile(req.user.id,{avatar_url:url}); res.json({url});
});

// FRIENDS
app.get('/api/friends', auth, (req,res) => res.json(db.getFriends(req.user.id)));
app.get('/api/friends/pending', auth, (req,res) => res.json(db.getPendingRequests(req.user.id)));
app.post('/api/friends/request', auth, (req,res) => { const r=db.sendFriendRequest(req.user.id,req.body.user_id); if(r.error) return res.status(400).json(r); res.json(r); });
app.post('/api/friends/respond', auth, (req,res) => { const r=db.respondFriendRequest(req.body.friendship_id,req.user.id,req.body.accept); if(r.error) return res.status(400).json(r); res.json(r); });
app.delete('/api/friends/:friendId', auth, (req,res) => res.json(db.removeFriend(req.user.id,req.params.friendId)));

// POSTS (unified with sessions)
app.get('/api/feed', auth, (req,res) => res.json(db.getFeed(req.user.id, parseInt(req.query.offset)||0)));
app.get('/api/posts/user/:userId', auth, (req,res) => res.json(db.getUserPosts(req.params.userId, req.user.id, parseInt(req.query.offset)||0)));
app.get('/api/posts/:id', auth, (req,res) => { const p=db.getPost(req.params.id,req.user.id); if(!p) return res.status(404).json({error:'Not found'}); res.json(p); });
app.post('/api/posts', auth, (req,res) => res.json({ id: db.createPost(req.user.id, req.body) }));
app.put('/api/posts/:id', auth, (req,res) => { const r=db.updatePost(req.user.id,req.params.id,req.body); if(r.error) return res.status(404).json(r); res.json(r); });
app.delete('/api/posts/:id', auth, (req,res) => res.json(db.deletePost(req.user.id,req.params.id)));
app.post('/api/posts/upload', auth, upload.single('file'), (req,res) => {
  if(!req.file) return res.status(400).json({error:'No file'});
  res.json({ url:`/uploads/${req.file.filename}`, type: req.file.mimetype.startsWith('video/')?'video':'image' });
});
app.get('/api/sessions', auth, (req,res) => { const uid=req.query.user_id||req.user.id; res.json(db.getUserSessions(uid,req.user.id)); });
app.get('/api/explore', auth, (req,res) => res.json(db.getExplore(parseInt(req.query.offset)||0)));
app.get('/api/search', auth, (req,res) => { const q=req.query.q||''; if(q.length<2) return res.json({users:[],posts:[]}); res.json({users:db.searchUsers(q,req.user.id),posts:db.searchPosts(q,req.user.id)}); });

// LIKES & COMMENTS
app.post('/api/posts/:id/like', auth, (req,res) => res.json(db.toggleLike(req.user.id,req.params.id)));
app.get('/api/posts/:id/likes', auth, (req,res) => res.json(db.getPostLikes(req.params.id)));
app.get('/api/posts/:id/comments', auth, (req,res) => res.json(db.getPostComments(req.params.id,req.user.id)));
app.post('/api/posts/:id/comments', auth, (req,res) => { if(!req.body.content) return res.status(400).json({error:'Content required'}); res.json(db.addComment(req.user.id,req.params.id,req.body.content)); });
app.delete('/api/comments/:id', auth, (req,res) => res.json(db.deleteComment(req.user.id,req.params.id)));
app.post('/api/comments/:id/like', auth, (req,res) => res.json(db.toggleCommentLike(req.user.id,req.params.id)));

// NOTIFICATIONS
app.get('/api/notifications', auth, (req,res) => res.json(db.getNotifications(req.user.id)));
app.get('/api/notifications/unread-count', auth, (req,res) => res.json({ count: db.getUnreadCount(req.user.id) }));
app.post('/api/notifications/mark-read', auth, (req,res) => { db.markNotificationsRead(req.user.id); res.json({ok:true}); });

// TECHNIQUES
app.get('/api/techniques', (req,res) => res.json(db.getApprovedTechniques()));
app.post('/api/techniques/submit', auth, (req,res) => {
  const {name,category,description}=req.body; if(!name||!category) return res.status(400).json({error:'Name and category required'});
  const r=db.submitTechnique({name,category,description,submitted_by:req.user.username}); if(r.alreadyExists) return res.status(409).json({error:`"${name}" already exists`}); res.json(r);
});

// ADMIN
app.get('/api/admin/stats', requireAdmin, (req,res) => res.json(db.getAdminStats()));
app.get('/api/admin/submissions', requireAdmin, (req,res) => res.json(db.getAllSubmissions()));
app.get('/api/admin/techniques', requireAdmin, (req,res) => res.json(db.getAllTechniques()));
app.put('/api/admin/submissions/:id/approve', requireAdmin, (req,res) => { db.approveSubmission(req.params.id); res.json({ok:true}); });
app.put('/api/admin/submissions/:id/reject', requireAdmin, (req,res) => { db.rejectSubmission(req.params.id,req.body.reason||''); res.json({ok:true}); });
app.delete('/api/admin/techniques/:id', requireAdmin, (req,res) => { db.deleteTechnique(req.params.id); res.json({ok:true}); });

app.get('*', (req,res) => res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT, () => console.log(`\n  🥋 Rollbook — ${ENV} — http://localhost:${PORT}\n`));
module.exports = app;
