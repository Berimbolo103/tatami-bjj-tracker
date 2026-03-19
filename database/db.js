try { require('dotenv').config(); } catch (_) {}

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const DB_DIR = process.env.DB_DIR || path.join(__dirname);
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(path.join(DB_DIR, 'tatami.db'));
db.pragma('journal_mode = WAL');

// ── SCHEMA ───────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT DEFAULT '',
    gym TEXT DEFAULT '',
    belt TEXT DEFAULT 'white',
    stripes INTEGER DEFAULT 0,
    start_date TEXT DEFAULT '',
    height TEXT DEFAULT '',
    weight TEXT DEFAULT '',
    limb_length TEXT DEFAULT '',
    flexibility TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS techniques (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT DEFAULT '',
    submitted_by TEXT DEFAULT 'system',
    status TEXT DEFAULT 'approved',
    rejection_reason TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_techniques_name_lower
    ON techniques(LOWER(name));

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    duration INTEGER NOT NULL DEFAULT 0,
    drills INTEGER DEFAULT 0,
    sparring INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    techniques TEXT DEFAULT '[]',
    submissions TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ── SEED ─────────────────────────────────────────────────────────────────────
const SEED = [
  {name:'Closed Guard',category:'guard'},{name:'Half Guard',category:'guard'},{name:'Deep Half Guard',category:'guard'},
  {name:'Butterfly Guard',category:'guard'},{name:'De La Riva Guard',category:'guard'},{name:'Reverse De La Riva',category:'guard'},
  {name:'X Guard',category:'guard'},{name:'Single Leg X',category:'guard'},{name:'Lasso Guard',category:'guard'},
  {name:'Spider Guard',category:'guard'},{name:'Worm Guard',category:'guard'},{name:'Rubber Guard',category:'guard'},
  {name:'Z Guard',category:'guard'},{name:'K Guard',category:'guard'},
  {name:'Torreando Pass',category:'pass'},{name:'Over Under Pass',category:'pass'},{name:'Leg Drag',category:'pass'},
  {name:'Headquarters',category:'pass'},{name:'Knee Slice',category:'pass'},{name:'Smash Pass',category:'pass'},
  {name:'Bullfighter Pass',category:'pass'},{name:'Double Under Pass',category:'pass'},{name:'X Pass',category:'pass'},
  {name:'Back Step',category:'pass'},{name:'Long Step',category:'pass'},{name:'Pressure Pass',category:'pass'},
  {name:'Triangle Choke',category:'submission'},{name:'Rear Naked Choke',category:'submission'},
  {name:'Armbar',category:'submission'},{name:'Kimura',category:'submission'},{name:'Guillotine',category:'submission'},
  {name:'Heel Hook',category:'submission'},{name:'Straight Ankle Lock',category:'submission'},
  {name:'Kneebar',category:'submission'},{name:'Omoplata',category:'submission'},{name:'Gogoplata',category:'submission'},
  {name:'Bow and Arrow',category:'submission'},{name:'Cross Collar Choke',category:'submission'},
  {name:'Baseball Bat Choke',category:'submission'},{name:'Darce Choke',category:'submission'},
  {name:'Anaconda Choke',category:'submission'},{name:'North South Choke',category:'submission'},
  {name:'Clock Choke',category:'submission'},{name:'Ezekiel',category:'submission'},
  {name:'Wristlock',category:'submission'},{name:'Calf Slicer',category:'submission'},{name:'Toe Hold',category:'submission'},
  {name:'Hip Bump Sweep',category:'sweep'},{name:'Scissor Sweep',category:'sweep'},{name:'Flower Sweep',category:'sweep'},
  {name:'Balloon Sweep',category:'sweep'},{name:'Butterfly Sweep',category:'sweep'},{name:'X Guard Sweep',category:'sweep'},
  {name:'Sickle Sweep',category:'sweep'},{name:'Tripod Sweep',category:'sweep'},{name:'Berimbolo',category:'sweep'},
  {name:'Kiss of Dragon',category:'sweep'},{name:'Lumberjack Sweep',category:'sweep'},
  {name:'Single Leg',category:'takedown'},{name:'Double Leg',category:'takedown'},{name:'Body Lock',category:'takedown'},
  {name:'Judo Hip Throw',category:'takedown'},{name:'Osoto Gari',category:'takedown'},{name:'Seoi Nage',category:'takedown'},
  {name:'Ankle Pick',category:'takedown'},{name:'Foot Sweep',category:'takedown'},{name:'Guard Pull',category:'takedown'},
  {name:'Back Control',category:'control'},{name:'Mount',category:'control'},{name:'Side Control',category:'control'},
  {name:'Knee on Belly',category:'control'},{name:'North South',category:'control'},{name:'Crucifix',category:'control'},
  {name:'Body Triangle',category:'control'},
  {name:'Bridge and Roll',category:'escape'},{name:'Elbow Knee Escape',category:'escape'},{name:'Guard Recovery',category:'escape'},
  {name:'Back Step Escape',category:'escape'},{name:'Hip Escape',category:'escape'},{name:'Granby Roll',category:'escape'},
];

const insertTech = db.prepare(
  `INSERT OR IGNORE INTO techniques (name, category, status, submitted_by) VALUES (@name, @category, 'approved', 'system')`
);
db.transaction(() => SEED.forEach(t => insertTech.run(t)))();

// ── PROFILE ──────────────────────────────────────────────────────────────────
function getProfile() { return db.prepare('SELECT * FROM profile WHERE id=1').get() || {}; }
function saveProfile(data) {
  const exists = db.prepare('SELECT id FROM profile WHERE id=1').get();
  if (exists) {
    db.prepare(`UPDATE profile SET name=@name,gym=@gym,belt=@belt,stripes=@stripes,start_date=@start_date,height=@height,weight=@weight,limb_length=@limb_length,flexibility=@flexibility WHERE id=1`).run(data);
  } else {
    db.prepare(`INSERT INTO profile(id,name,gym,belt,stripes,start_date,height,weight,limb_length,flexibility) VALUES(1,@name,@gym,@belt,@stripes,@start_date,@height,@weight,@limb_length,@flexibility)`).run(data);
  }
}

// ── TECHNIQUES ───────────────────────────────────────────────────────────────
function getApprovedTechniques() { return db.prepare(`SELECT * FROM techniques WHERE status='approved' ORDER BY category,name`).all(); }
function getAllTechniques()       { return db.prepare('SELECT * FROM techniques ORDER BY created_at DESC').all(); }
function getAllSubmissions()      { return db.prepare(`SELECT * FROM techniques WHERE submitted_by!='system' ORDER BY created_at DESC`).all(); }
function getSubmissionsByUser(u) { return db.prepare(`SELECT * FROM techniques WHERE submitted_by=? ORDER BY created_at DESC`).all(u); }

function submitTechnique({ name, category, description, submitted_by }) {
  const existing = db.prepare(`SELECT id,status FROM techniques WHERE LOWER(name)=LOWER(?)`).get(name);
  if (existing) return { id: existing.id, alreadyExists: true, status: existing.status };
  const r = db.prepare(`INSERT INTO techniques(name,category,description,submitted_by,status) VALUES(?,?,?,?,'pending')`).run(name, category, description||'', submitted_by||'Anonymous');
  return { id: r.lastInsertRowid, alreadyExists: false, status: 'pending' };
}

function approveSubmission(id) { db.prepare(`UPDATE techniques SET status='approved',rejection_reason='' WHERE id=?`).run(id); }
function rejectSubmission(id, reason) { db.prepare(`UPDATE techniques SET status='rejected',rejection_reason=? WHERE id=?`).run(reason||'', id); }
function deleteTechnique(id) { db.prepare('DELETE FROM techniques WHERE id=?').run(id); }

// ── SESSIONS ─────────────────────────────────────────────────────────────────
function parseSessions(rows) {
  return rows.map(s => ({ ...s, techniques: JSON.parse(s.techniques||'[]'), submissions: JSON.parse(s.submissions||'[]') }));
}
function getSessions() { return parseSessions(db.prepare('SELECT * FROM sessions ORDER BY date DESC').all()); }
function createSession({ id, date, duration, drills, sparring, notes, techniques, submissions }) {
  const sid = id || `s_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  db.prepare(`INSERT INTO sessions(id,date,duration,drills,sparring,notes,techniques,submissions) VALUES(?,?,?,?,?,?,?,?)`)
    .run(sid, date, duration, drills||0, sparring||0, notes||'', JSON.stringify(techniques||[]), JSON.stringify(submissions||[]));
  return sid;
}
function updateSession(id, { date, duration, drills, sparring, notes, techniques, submissions }) {
  db.prepare(`UPDATE sessions SET date=?,duration=?,drills=?,sparring=?,notes=?,techniques=?,submissions=? WHERE id=?`)
    .run(date, duration, drills||0, sparring||0, notes||'', JSON.stringify(techniques||[]), JSON.stringify(submissions||[]), id);
}
function deleteSession(id) { db.prepare('DELETE FROM sessions WHERE id=?').run(id); }

// ── ADMIN STATS ───────────────────────────────────────────────────────────────
function getAdminStats() {
  return {
    totalSessions:       db.prepare('SELECT COUNT(*) as c FROM sessions').get().c,
    totalTechniques:     db.prepare(`SELECT COUNT(*) as c FROM techniques WHERE status='approved'`).get().c,
    pendingSubmissions:  db.prepare(`SELECT COUNT(*) as c FROM techniques WHERE status='pending'`).get().c,
    rejectedSubmissions: db.prepare(`SELECT COUNT(*) as c FROM techniques WHERE status='rejected'`).get().c,
    totalMinutes:        db.prepare('SELECT SUM(duration) as s FROM sessions').get().s || 0,
    uniqueSubmitters:    db.prepare(`SELECT COUNT(DISTINCT submitted_by) as c FROM techniques WHERE submitted_by!='system'`).get().c,
  };
}

module.exports = {
  getProfile, saveProfile,
  getApprovedTechniques, getAllTechniques, submitTechnique,
  getAllSubmissions, getSubmissionsByUser,
  approveSubmission, rejectSubmission, deleteTechnique,
  getSessions, createSession, updateSession, deleteSession,
  getAdminStats,
};
