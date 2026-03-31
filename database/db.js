try { require('dotenv').config(); } catch (_) {}
const Database = require('better-sqlite3');
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const DB_DIR = process.env.DB_DIR || path.join(__dirname);
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
const db = new Database(path.join(DB_DIR, 'rollbook.db'));
db.pragma('journal_mode = WAL'); db.pragma('foreign_keys = ON');

function uid() { return crypto.randomBytes(12).toString('hex'); }
function hashPw(pw, salt) { salt = salt || crypto.randomBytes(16).toString('hex'); return { salt, hash: crypto.scryptSync(pw, salt, 64).toString('hex') }; }
function verifyPw(pw, salt, hash) { return crypto.scryptSync(pw, salt, 64).toString('hex') === hash; }

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL,
    display_name TEXT DEFAULT '', bio TEXT DEFAULT '', avatar_url TEXT DEFAULT '',
    gym TEXT DEFAULT '', belt TEXT DEFAULT 'white', stripes INTEGER DEFAULT 0,
    start_date TEXT DEFAULT '', height TEXT DEFAULT '', weight TEXT DEFAULT '',
    profile_public INTEGER DEFAULT 1, theme TEXT DEFAULT 'dark',
    onboarded INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS tokens (
    token TEXT PRIMARY KEY, user_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')), expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS friendships (
    id TEXT PRIMARY KEY, requester_id TEXT NOT NULL, receiver_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending', created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(requester_id, receiver_id)
  );
  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
    content TEXT DEFAULT '', feeling TEXT DEFAULT '',
    image_url TEXT DEFAULT '', video_url TEXT DEFAULT '',
    is_session INTEGER DEFAULT 0,
    session_date TEXT DEFAULT '', session_duration INTEGER DEFAULT 0,
    session_drills INTEGER DEFAULT 0, session_sparring INTEGER DEFAULT 0,
    session_notes TEXT DEFAULT '', session_techniques TEXT DEFAULT '[]',
    session_submissions TEXT DEFAULT '[]',
    tagged_users TEXT DEFAULT '[]', is_public INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS likes (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, post_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')), UNIQUE(user_id, post_id)
  );
  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, post_id TEXT NOT NULL,
    content TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS comment_likes (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, comment_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')), UNIQUE(user_id, comment_id)
  );
  CREATE TABLE IF NOT EXISTS techniques (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT NOT NULL,
    description TEXT DEFAULT '', submitted_by TEXT DEFAULT 'system',
    status TEXT DEFAULT 'approved', rejection_reason TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_techniques_name_lower ON techniques(LOWER(name));
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, from_user_id TEXT,
    type TEXT NOT NULL, reference_id TEXT, preview TEXT DEFAULT '',
    is_read INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY, sender_id TEXT NOT NULL, receiver_id TEXT NOT NULL,
    content TEXT NOT NULL, is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Add columns if missing (safe migration for existing DBs)
try { db.exec(`ALTER TABLE notifications ADD COLUMN preview TEXT DEFAULT ''`); } catch(_){}
try { db.exec(`ALTER TABLE users ADD COLUMN onboarded INTEGER DEFAULT 0`); } catch(_){}

// Seed techniques
const SEED=[{name:'Closed Guard',category:'guard'},{name:'Half Guard',category:'guard'},{name:'Deep Half Guard',category:'guard'},{name:'Butterfly Guard',category:'guard'},{name:'De La Riva Guard',category:'guard'},{name:'Reverse De La Riva',category:'guard'},{name:'X Guard',category:'guard'},{name:'Single Leg X',category:'guard'},{name:'Lasso Guard',category:'guard'},{name:'Spider Guard',category:'guard'},{name:'Worm Guard',category:'guard'},{name:'Rubber Guard',category:'guard'},{name:'Z Guard',category:'guard'},{name:'K Guard',category:'guard'},{name:'Torreando Pass',category:'pass'},{name:'Over Under Pass',category:'pass'},{name:'Leg Drag',category:'pass'},{name:'Headquarters',category:'pass'},{name:'Knee Slice',category:'pass'},{name:'Smash Pass',category:'pass'},{name:'Bullfighter Pass',category:'pass'},{name:'Double Under Pass',category:'pass'},{name:'X Pass',category:'pass'},{name:'Back Step',category:'pass'},{name:'Long Step',category:'pass'},{name:'Pressure Pass',category:'pass'},{name:'Triangle Choke',category:'submission'},{name:'Rear Naked Choke',category:'submission'},{name:'Armbar',category:'submission'},{name:'Kimura',category:'submission'},{name:'Guillotine',category:'submission'},{name:'Heel Hook',category:'submission'},{name:'Straight Ankle Lock',category:'submission'},{name:'Kneebar',category:'submission'},{name:'Omoplata',category:'submission'},{name:'Gogoplata',category:'submission'},{name:'Bow and Arrow',category:'submission'},{name:'Cross Collar Choke',category:'submission'},{name:'Baseball Bat Choke',category:'submission'},{name:'Darce Choke',category:'submission'},{name:'Anaconda Choke',category:'submission'},{name:'North South Choke',category:'submission'},{name:'Clock Choke',category:'submission'},{name:'Ezekiel',category:'submission'},{name:'Wristlock',category:'submission'},{name:'Calf Slicer',category:'submission'},{name:'Toe Hold',category:'submission'},{name:'Hip Bump Sweep',category:'sweep'},{name:'Scissor Sweep',category:'sweep'},{name:'Flower Sweep',category:'sweep'},{name:'Balloon Sweep',category:'sweep'},{name:'Butterfly Sweep',category:'sweep'},{name:'X Guard Sweep',category:'sweep'},{name:'Sickle Sweep',category:'sweep'},{name:'Tripod Sweep',category:'sweep'},{name:'Berimbolo',category:'sweep'},{name:'Kiss of Dragon',category:'sweep'},{name:'Lumberjack Sweep',category:'sweep'},{name:'Single Leg',category:'takedown'},{name:'Double Leg',category:'takedown'},{name:'Body Lock',category:'takedown'},{name:'Judo Hip Throw',category:'takedown'},{name:'Osoto Gari',category:'takedown'},{name:'Seoi Nage',category:'takedown'},{name:'Ankle Pick',category:'takedown'},{name:'Foot Sweep',category:'takedown'},{name:'Guard Pull',category:'takedown'},{name:'Back Control',category:'control'},{name:'Mount',category:'control'},{name:'Side Control',category:'control'},{name:'Knee on Belly',category:'control'},{name:'North South',category:'control'},{name:'Crucifix',category:'control'},{name:'Body Triangle',category:'control'},{name:'Bridge and Roll',category:'escape'},{name:'Elbow Knee Escape',category:'escape'},{name:'Guard Recovery',category:'escape'},{name:'Back Step Escape',category:'escape'},{name:'Hip Escape',category:'escape'},{name:'Granby Roll',category:'escape'}];
const ins = db.prepare(`INSERT OR IGNORE INTO techniques (name,category,status,submitted_by) VALUES (@name,@category,'approved','system')`);
db.transaction(() => SEED.forEach(t => ins.run(t)))();

// ═══ AUTH ═══
function registerUser({ username, email, password, display_name }) {
  const id = uid(), { salt, hash } = hashPw(password);
  try {
    db.prepare(`INSERT INTO users(id,username,email,password_hash,password_salt,display_name) VALUES(?,?,?,?,?,?)`).run(id, username.trim(), email.trim().toLowerCase(), hash, salt, display_name || username);
    return { id, token: createToken(id) };
  } catch (e) {
    if (e.message.includes('users.username')) return { error: 'Username already taken' };
    if (e.message.includes('users.email')) return { error: 'Email already registered' };
    throw e;
  }
}
function loginUser({ login, password }) {
  const u = db.prepare(`SELECT * FROM users WHERE username=? OR email=?`).get(login, login.toLowerCase());
  if (!u) return { error: 'User not found' };
  if (!verifyPw(password, u.password_salt, u.password_hash)) return { error: 'Invalid password' };
  return { id: u.id, token: createToken(u.id) };
}
function createToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare(`INSERT INTO tokens(token,user_id,expires_at) VALUES(?,?,?)`).run(token, userId, new Date(Date.now()+30*86400000).toISOString());
  return token;
}
function getUserByToken(token) {
  const r = db.prepare(`SELECT u.* FROM tokens t JOIN users u ON u.id=t.user_id WHERE t.token=? AND t.expires_at>datetime('now')`).get(token);
  if (!r) return null;
  const { password_hash, password_salt, ...safe } = r;
  return safe;
}
function logoutToken(token) { db.prepare(`DELETE FROM tokens WHERE token=?`).run(token); }

// ═══ PROFILE ═══
function getPublicProfile(userId) {
  const u = db.prepare(`SELECT id,username,display_name,bio,avatar_url,gym,belt,stripes,start_date,profile_public,theme,onboarded,created_at FROM users WHERE id=?`).get(userId);
  if (!u) return null;
  u.session_count = db.prepare(`SELECT COUNT(*) as c FROM posts WHERE user_id=? AND is_session=1`).get(userId).c;
  u.friend_count = db.prepare(`SELECT COUNT(*) as c FROM friendships WHERE (requester_id=? OR receiver_id=?) AND status='accepted'`).get(userId, userId).c;
  u.total_hours = Math.round((db.prepare(`SELECT COALESCE(SUM(session_duration),0) as s FROM posts WHERE user_id=? AND is_session=1`).get(userId).s||0)/60);
  u.post_count = db.prepare(`SELECT COUNT(*) as c FROM posts WHERE user_id=?`).get(userId).c;
  return u;
}
function updateProfile(userId, data) {
  const fields = ['display_name','bio','avatar_url','gym','belt','stripes','start_date','height','weight','profile_public','theme','onboarded'];
  const sets=[], vals=[];
  for (const f of fields) { if (data[f]!==undefined) { sets.push(`${f}=?`); vals.push(data[f]); } }
  if (!sets.length) return;
  vals.push(userId);
  db.prepare(`UPDATE users SET ${sets.join(',')},updated_at=datetime('now') WHERE id=?`).run(...vals);
}
function searchUsers(query, currentUserId) {
  return db.prepare(`SELECT id,username,display_name,avatar_url,gym,belt,stripes FROM users WHERE id!=? AND (username LIKE ? OR display_name LIKE ?) LIMIT 20`).all(currentUserId, `%${query}%`, `%${query}%`);
}

// ═══ FRIENDS ═══
function sendFriendRequest(rId, rcId) {
  if (rId === rcId) return { error: 'Cannot friend yourself' };
  const ex = db.prepare(`SELECT * FROM friendships WHERE (requester_id=? AND receiver_id=?) OR (requester_id=? AND receiver_id=?)`).get(rId, rcId, rcId, rId);
  if (ex) {
    if (ex.status === 'accepted') return { error: 'Already friends' };
    if (ex.status === 'pending') return { error: 'Request already pending' };
    if (ex.status === 'declined') { db.prepare(`UPDATE friendships SET status='pending',requester_id=?,receiver_id=?,created_at=datetime('now') WHERE id=?`).run(rId, rcId, ex.id); addNotification(rcId, rId, 'friend_request', ex.id); return { ok: true }; }
  }
  const id = uid();
  db.prepare(`INSERT INTO friendships(id,requester_id,receiver_id) VALUES(?,?,?)`).run(id, rId, rcId);
  addNotification(rcId, rId, 'friend_request', id);
  return { ok: true, id };
}
function respondFriendRequest(fId, userId, accept) {
  const f = db.prepare(`SELECT * FROM friendships WHERE id=? AND receiver_id=? AND status='pending'`).get(fId, userId);
  if (!f) return { error: 'Request not found' };
  db.prepare(`UPDATE friendships SET status=? WHERE id=?`).run(accept?'accepted':'declined', fId);
  if (accept) addNotification(f.requester_id, userId, 'friend_accept', fId);
  return { ok: true };
}
function removeFriend(userId, friendId) { db.prepare(`DELETE FROM friendships WHERE ((requester_id=? AND receiver_id=?) OR (requester_id=? AND receiver_id=?)) AND status='accepted'`).run(userId, friendId, friendId, userId); return { ok: true }; }
function getFriends(userId) { return db.prepare(`SELECT u.id,u.username,u.display_name,u.avatar_url,u.gym,u.belt,u.stripes FROM friendships f JOIN users u ON u.id = CASE WHEN f.requester_id=? THEN f.receiver_id ELSE f.requester_id END WHERE (f.requester_id=? OR f.receiver_id=?) AND f.status='accepted' ORDER BY u.display_name`).all(userId, userId, userId); }
function getPendingRequests(userId) { return db.prepare(`SELECT f.id as friendship_id,u.id,u.username,u.display_name,u.avatar_url,u.belt,u.stripes,f.created_at FROM friendships f JOIN users u ON u.id=f.requester_id WHERE f.receiver_id=? AND f.status='pending' ORDER BY f.created_at DESC`).all(userId); }
function getFriendshipStatus(userId, otherId) { const f = db.prepare(`SELECT * FROM friendships WHERE (requester_id=? AND receiver_id=?) OR (requester_id=? AND receiver_id=?)`).get(userId, otherId, otherId, userId); if (!f) return { status: 'none' }; return { status: f.status, friendship_id: f.id, is_receiver: f.receiver_id === userId }; }
function getFriendIds(userId) {
  return db.prepare(`SELECT CASE WHEN f.requester_id=? THEN f.receiver_id ELSE f.requester_id END as fid FROM friendships f WHERE (f.requester_id=? OR f.receiver_id=?) AND f.status='accepted'`).all(userId, userId, userId).map(r => r.fid);
}

// ═══ POSTS ═══
function createPost(userId, d) {
  const id = uid();
  db.prepare(`INSERT INTO posts(id,user_id,content,feeling,image_url,video_url,is_session,session_date,session_duration,session_drills,session_sparring,session_notes,session_techniques,session_submissions,tagged_users,is_public) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, userId, d.content||'', d.feeling||'', d.image_url||'', d.video_url||'', d.is_session?1:0, d.session_date||'', d.session_duration||0, d.session_drills||0, d.session_sparring||0, d.session_notes||'', JSON.stringify(d.session_techniques||[]), JSON.stringify(d.session_submissions||[]), JSON.stringify(d.tagged_users||[]), d.is_public!==undefined?(d.is_public?1:0):1);
  if (d.tagged_users?.length) { for (const tid of d.tagged_users) { if (tid !== userId) addNotification(tid, userId, 'tag', id); } }
  return id;
}
function updatePost(userId, postId, d) {
  const p = db.prepare(`SELECT * FROM posts WHERE id=? AND user_id=?`).get(postId, userId);
  if (!p) return { error: 'Not found' };
  db.prepare(`UPDATE posts SET content=?,feeling=?,image_url=?,video_url=?,session_date=?,session_duration=?,session_drills=?,session_sparring=?,session_notes=?,session_techniques=?,session_submissions=?,tagged_users=?,is_public=?,updated_at=datetime('now') WHERE id=?`)
    .run(d.content??p.content, d.feeling??p.feeling, d.image_url??p.image_url, d.video_url??p.video_url, d.session_date??p.session_date, d.session_duration??p.session_duration, d.session_drills??p.session_drills, d.session_sparring??p.session_sparring, d.session_notes??p.session_notes, JSON.stringify(d.session_techniques||JSON.parse(p.session_techniques||'[]')), JSON.stringify(d.session_submissions||JSON.parse(p.session_submissions||'[]')), JSON.stringify(d.tagged_users||JSON.parse(p.tagged_users||'[]')), d.is_public!==undefined?(d.is_public?1:0):p.is_public, postId);
  return { ok: true };
}
function deletePost(userId, postId) { db.prepare(`DELETE FROM posts WHERE id=? AND user_id=?`).run(postId, userId); return { ok: true }; }
function getPost(postId, viewerId) {
  const r = db.prepare(`SELECT p.*, u.username, u.display_name, u.avatar_url, u.belt, u.stripes, (SELECT COUNT(*) FROM likes WHERE post_id=p.id) as like_count, (SELECT COUNT(*) FROM comments WHERE post_id=p.id) as comment_count, (SELECT COUNT(*) FROM likes WHERE post_id=p.id AND user_id=?) as user_liked FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=?`).get(viewerId, postId);
  return r ? parsePost(r) : null;
}
function parsePost(r) {
  if (!r) return r;
  return { ...r, session_techniques: JSON.parse(r.session_techniques||'[]'), session_submissions: JSON.parse(r.session_submissions||'[]'), tagged_users: JSON.parse(r.tagged_users||'[]'), user_liked: (r.user_liked||0) > 0 };
}

// FEED: own + friends' public + tagged
function getFeed(userId, offset = 0, limit = 10) {
  return db.prepare(`
    SELECT p.*, u.username, u.display_name, u.avatar_url, u.belt, u.stripes,
      (SELECT COUNT(*) FROM likes WHERE post_id=p.id) as like_count,
      (SELECT COUNT(*) FROM comments WHERE post_id=p.id) as comment_count,
      (SELECT COUNT(*) FROM likes WHERE post_id=p.id AND user_id=?) as user_liked
    FROM posts p JOIN users u ON u.id=p.user_id
    WHERE (
      p.user_id=?
      OR (p.user_id IN (
        SELECT CASE WHEN f.requester_id=? THEN f.receiver_id ELSE f.requester_id END
        FROM friendships f WHERE (f.requester_id=? OR f.receiver_id=?) AND f.status='accepted'
      ) AND p.is_public=1)
      OR p.tagged_users LIKE '%' || ? || '%'
    )
    ORDER BY p.created_at DESC LIMIT ? OFFSET ?
  `).all(userId, userId, userId, userId, userId, userId, limit, offset).map(parsePost);
}
function getUserPosts(userId, viewerId, offset = 0, limit = 20) {
  const w = userId === viewerId ? '' : 'AND p.is_public=1';
  return db.prepare(`SELECT p.*, u.username, u.display_name, u.avatar_url, u.belt, u.stripes, (SELECT COUNT(*) FROM likes WHERE post_id=p.id) as like_count, (SELECT COUNT(*) FROM comments WHERE post_id=p.id) as comment_count, (SELECT COUNT(*) FROM likes WHERE post_id=p.id AND user_id=?) as user_liked FROM posts p JOIN users u ON u.id=p.user_id WHERE p.user_id=? ${w} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`).all(viewerId, userId, limit, offset).map(parsePost);
}
function getUserSessions(userId, viewerId) {
  const w = userId === viewerId ? '' : 'AND is_public=1';
  return db.prepare(`SELECT * FROM posts WHERE user_id=? AND is_session=1 ${w} ORDER BY session_date DESC`).all(userId).map(r => ({ ...r, session_techniques: JSON.parse(r.session_techniques||'[]'), session_submissions: JSON.parse(r.session_submissions||'[]'), tagged_users: JSON.parse(r.tagged_users||'[]') }));
}

// Explore: ONLY images/videos, NO session-only posts, randomized
function getExplore(offset = 0, limit = 30) {
  return db.prepare(`SELECT p.id, p.image_url, p.video_url, p.content, p.feeling, p.is_session, p.session_date, p.session_duration, p.session_sparring, p.created_at, u.username, u.display_name, u.avatar_url, u.belt, u.id as user_id, (SELECT COUNT(*) FROM likes WHERE post_id=p.id) as like_count, (SELECT COUNT(*) FROM comments WHERE post_id=p.id) as comment_count FROM posts p JOIN users u ON u.id=p.user_id WHERE p.is_public=1 AND (p.image_url!='' OR p.video_url!='') ORDER BY (p.id || strftime('%j','now')) LIMIT ? OFFSET ?`).all(limit, offset);
}

function searchPosts(query, userId, offset = 0, limit = 20) {
  return db.prepare(`SELECT p.*, u.username, u.display_name, u.avatar_url, u.belt, u.stripes, (SELECT COUNT(*) FROM likes WHERE post_id=p.id) as like_count, (SELECT COUNT(*) FROM comments WHERE post_id=p.id) as comment_count, (SELECT COUNT(*) FROM likes WHERE post_id=p.id AND user_id=?) as user_liked FROM posts p JOIN users u ON u.id=p.user_id WHERE p.is_public=1 AND (p.content LIKE ? OR p.feeling LIKE ? OR p.session_notes LIKE ? OR u.username LIKE ? OR u.display_name LIKE ?) ORDER BY p.created_at DESC LIMIT ? OFFSET ?`).all(userId, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, limit, offset).map(parsePost);
}

// ═══ LIKES & COMMENTS ═══
function toggleLike(userId, postId) {
  const ex = db.prepare(`SELECT id FROM likes WHERE user_id=? AND post_id=?`).get(userId, postId);
  if (ex) { db.prepare(`DELETE FROM likes WHERE id=?`).run(ex.id); return { liked: false }; }
  const id = uid(); db.prepare(`INSERT INTO likes(id,user_id,post_id) VALUES(?,?,?)`).run(id, userId, postId);
  const post = db.prepare(`SELECT user_id FROM posts WHERE id=?`).get(postId);
  if (post && post.user_id !== userId) addNotification(post.user_id, userId, 'like', postId);
  return { liked: true };
}
function getPostLikes(postId) { return db.prepare(`SELECT u.id,u.username,u.display_name,u.avatar_url FROM likes l JOIN users u ON u.id=l.user_id WHERE l.post_id=? ORDER BY l.created_at DESC`).all(postId); }

function addComment(userId, postId, content) {
  const id = uid(); db.prepare(`INSERT INTO comments(id,user_id,post_id,content) VALUES(?,?,?,?)`).run(id, userId, postId, content);
  const post = db.prepare(`SELECT user_id FROM posts WHERE id=?`).get(postId);
  if (post && post.user_id !== userId) addNotification(post.user_id, userId, 'comment', postId, content.slice(0,80));
  // Handle @mentions in comment
  const mentions = content.match(/@(\w+)/g);
  if (mentions) {
    const commenter = db.prepare(`SELECT username FROM users WHERE id=?`).get(userId);
    mentions.forEach(m => {
      const uname = m.slice(1);
      const mentioned = db.prepare(`SELECT id FROM users WHERE username=? COLLATE NOCASE`).get(uname);
      if (mentioned && mentioned.id !== userId && (!post || mentioned.id !== post.user_id)) {
        addNotification(mentioned.id, userId, 'mention', postId, content.slice(0,80));
      }
    });
  }
  return { id };
}
function getPostComments(postId, viewerId) {
  return db.prepare(`SELECT c.*, u.username, u.display_name, u.avatar_url, u.belt,
    (SELECT COUNT(*) FROM comment_likes WHERE comment_id=c.id) as like_count,
    (SELECT COUNT(*) FROM comment_likes WHERE comment_id=c.id AND user_id=?) as user_liked
    FROM comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=? ORDER BY c.created_at ASC`).all(viewerId||'', postId).map(c => ({...c, user_liked: (c.user_liked||0) > 0}));
}
function deleteComment(userId, commentId) { db.prepare(`DELETE FROM comments WHERE id=? AND user_id=?`).run(commentId, userId); return { ok: true }; }

function toggleCommentLike(userId, commentId) {
  const ex = db.prepare(`SELECT id FROM comment_likes WHERE user_id=? AND comment_id=?`).get(userId, commentId);
  if (ex) { db.prepare(`DELETE FROM comment_likes WHERE id=?`).run(ex.id); return { liked: false }; }
  const id = uid(); db.prepare(`INSERT INTO comment_likes(id,user_id,comment_id) VALUES(?,?,?)`).run(id, userId, commentId);
  const comment = db.prepare(`SELECT user_id FROM comments WHERE id=?`).get(commentId);
  if (comment && comment.user_id !== userId) addNotification(comment.user_id, userId, 'comment_like', commentId);
  return { liked: true };
}

// ═══ NOTIFICATIONS ═══
function addNotification(userId, fromUserId, type, referenceId, preview) {
  const id = uid();
  db.prepare(`INSERT INTO notifications(id,user_id,from_user_id,type,reference_id,preview) VALUES(?,?,?,?,?,?)`).run(id, userId, fromUserId, type, referenceId||'', preview||'');
}
function getNotifications(userId, limit = 50) { return db.prepare(`SELECT n.*, u.username as from_username, u.display_name as from_display_name, u.avatar_url as from_avatar_url FROM notifications n LEFT JOIN users u ON u.id=n.from_user_id WHERE n.user_id=? ORDER BY n.created_at DESC LIMIT ?`).all(userId, limit); }
function getUnreadCount(userId) { return db.prepare(`SELECT COUNT(*) as c FROM notifications WHERE user_id=? AND is_read=0`).get(userId).c; }
function markNotificationsRead(userId) { db.prepare(`UPDATE notifications SET is_read=1 WHERE user_id=? AND is_read=0`).run(userId); }

// ═══ MESSAGES ═══
function sendMessage(senderId, receiverId, content) {
  const id = uid();
  db.prepare(`INSERT INTO messages(id,sender_id,receiver_id,content) VALUES(?,?,?,?)`).run(id, senderId, receiverId, content);
  addNotification(receiverId, senderId, 'message', id, content.slice(0,60));
  return { id };
}
function getMessages(userId, otherId, limit = 50, offset = 0) {
  return db.prepare(`SELECT m.*, su.username as sender_username, su.display_name as sender_name, su.avatar_url as sender_avatar FROM messages m JOIN users su ON su.id=m.sender_id WHERE (m.sender_id=? AND m.receiver_id=?) OR (m.sender_id=? AND m.receiver_id=?) ORDER BY m.created_at ASC LIMIT ? OFFSET ?`).all(userId, otherId, otherId, userId, limit, offset);
}
function getConversations(userId) {
  // Get latest message per conversation partner
  return db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar_url, u.belt,
      m.content as last_message, m.created_at as last_time, m.sender_id,
      (SELECT COUNT(*) FROM messages WHERE sender_id=u.id AND receiver_id=? AND is_read=0) as unread
    FROM (
      SELECT CASE WHEN sender_id=? THEN receiver_id ELSE sender_id END as other_id,
        MAX(created_at) as max_time
      FROM messages WHERE sender_id=? OR receiver_id=?
      GROUP BY other_id
    ) conv
    JOIN users u ON u.id=conv.other_id
    JOIN messages m ON m.created_at=conv.max_time AND ((m.sender_id=? AND m.receiver_id=u.id) OR (m.sender_id=u.id AND m.receiver_id=?))
    ORDER BY conv.max_time DESC
  `).all(userId, userId, userId, userId, userId, userId);
}
function markMessagesRead(userId, fromId) {
  db.prepare(`UPDATE messages SET is_read=1 WHERE sender_id=? AND receiver_id=? AND is_read=0`).run(fromId, userId);
}
function getUnreadMessageCount(userId) {
  return db.prepare(`SELECT COUNT(*) as c FROM messages WHERE receiver_id=? AND is_read=0`).get(userId).c;
}

// ═══ TECHNIQUES ═══
function getApprovedTechniques() { return db.prepare(`SELECT * FROM techniques WHERE status='approved' ORDER BY category,name`).all(); }
function getAllTechniques() { return db.prepare('SELECT * FROM techniques ORDER BY created_at DESC').all(); }
function getAllSubmissions() { return db.prepare(`SELECT * FROM techniques WHERE submitted_by!='system' ORDER BY created_at DESC`).all(); }
function getSubmissionsByUser(u) { return db.prepare(`SELECT * FROM techniques WHERE submitted_by=? ORDER BY created_at DESC`).all(u); }
function submitTechnique({ name, category, description, submitted_by }) {
  const ex = db.prepare(`SELECT id,status FROM techniques WHERE LOWER(name)=LOWER(?)`).get(name);
  if (ex) return { id: ex.id, alreadyExists: true, status: ex.status };
  const r = db.prepare(`INSERT INTO techniques(name,category,description,submitted_by,status) VALUES(?,?,?,?,'pending')`).run(name, category, description||'', submitted_by||'Anonymous');
  return { id: r.lastInsertRowid, alreadyExists: false, status: 'pending' };
}
function addTechniqueDirect({ name, category, description }) {
  const ex = db.prepare(`SELECT id FROM techniques WHERE LOWER(name)=LOWER(?)`).get(name);
  if (ex) return { error: 'Already exists' };
  const r = db.prepare(`INSERT INTO techniques(name,category,description,submitted_by,status) VALUES(?,?,?,'admin','approved')`).run(name, category, description||'');
  return { id: r.lastInsertRowid };
}
function approveSubmission(id) { db.prepare(`UPDATE techniques SET status='approved',rejection_reason='' WHERE id=?`).run(id); }
function rejectSubmission(id, reason) { db.prepare(`UPDATE techniques SET status='rejected',rejection_reason=? WHERE id=?`).run(reason||'', id); }
function deleteTechnique(id) { db.prepare('DELETE FROM techniques WHERE id=?').run(id); }

// ═══ ADMIN ═══
function getAdminStats() {
  return {
    totalUsers: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
    totalPosts: db.prepare('SELECT COUNT(*) as c FROM posts').get().c,
    totalSessions: db.prepare(`SELECT COUNT(*) as c FROM posts WHERE is_session=1`).get().c,
    totalTechniques: db.prepare(`SELECT COUNT(*) as c FROM techniques WHERE status='approved'`).get().c,
    pendingSubmissions: db.prepare(`SELECT COUNT(*) as c FROM techniques WHERE status='pending'`).get().c,
    totalMinutes: db.prepare('SELECT COALESCE(SUM(session_duration),0) as s FROM posts WHERE is_session=1').get().s||0,
    totalFriendships: db.prepare(`SELECT COUNT(*) as c FROM friendships WHERE status='accepted'`).get().c,
    totalMessages: db.prepare('SELECT COUNT(*) as c FROM messages').get().c,
  };
}

module.exports = {
  registerUser, loginUser, getUserByToken, logoutToken,
  getPublicProfile, updateProfile, searchUsers,
  sendFriendRequest, respondFriendRequest, removeFriend, getFriends, getPendingRequests, getFriendshipStatus, getFriendIds,
  createPost, updatePost, deletePost, getPost, getFeed, getUserPosts, getUserSessions, getExplore, searchPosts,
  toggleLike, getPostLikes, addComment, getPostComments, deleteComment, toggleCommentLike,
  getNotifications, getUnreadCount, markNotificationsRead,
  sendMessage, getMessages, getConversations, markMessagesRead, getUnreadMessageCount,
  getApprovedTechniques, getAllTechniques, submitTechnique, addTechniqueDirect, getAllSubmissions, getSubmissionsByUser,
  approveSubmission, rejectSubmission, deleteTechnique,
  getAdminStats,
};
