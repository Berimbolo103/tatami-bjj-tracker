// Load .env in development
try { require('dotenv').config(); } catch (_) {}

const express    = require('express');
const path       = require('path');
const db         = require('./database/db');

const app   = express();
const PORT  = process.env.PORT || 3000;
const ENV   = process.env.NODE_ENV || 'development';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'tatami-admin-2024';

// ── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED = (process.env.ALLOWED_ORIGINS || '*')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  const allowed = ALLOWED.includes('*') || ALLOWED.includes(origin);
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-admin-token');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function requireAdmin(req, res, next) {
  if (req.headers['x-admin-token'] !== ADMIN_TOKEN)
    return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ── HEALTH ───────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: ENV, timestamp: new Date().toISOString() });
});

// ── PROFILE ──────────────────────────────────────────────────────────────────
app.get('/api/profile', (req, res) => res.json(db.getProfile()));
app.put('/api/profile', (req, res) => {
  const { name, gym, belt, stripes, start_date, height, weight, limb_length, flexibility } = req.body;
  db.saveProfile({ name:name||'',gym:gym||'',belt:belt||'white',stripes:stripes||0,start_date:start_date||'',height:height||'',weight:weight||'',limb_length:limb_length||'',flexibility:flexibility||'' });
  res.json({ ok: true });
});

// ── TECHNIQUES ────────────────────────────────────────────────────────────────
app.get('/api/techniques', (req, res) => res.json(db.getApprovedTechniques()));
app.post('/api/techniques/submit', (req, res) => {
  const { name, category, description, submitted_by } = req.body;
  if (!name || !category) return res.status(400).json({ error: 'Name and category are required' });
  const result = db.submitTechnique({ name, category, description, submitted_by });
  if (result.alreadyExists)
    return res.status(409).json({ error: `"${name}" already exists with status: ${result.status}`, status: result.status });
  res.json({ id: result.id, status: 'pending' });
});
app.get('/api/techniques/my-submissions', (req, res) => {
  const { submitted_by } = req.query;
  res.json(submitted_by ? db.getSubmissionsByUser(submitted_by) : []);
});

// ── SESSIONS ─────────────────────────────────────────────────────────────────
app.get('/api/sessions', (req, res) => res.json(db.getSessions()));
app.post('/api/sessions', (req, res) => { const id = db.createSession(req.body); res.json({ id }); });
app.put('/api/sessions/:id', (req, res) => { db.updateSession(req.params.id, req.body); res.json({ ok: true }); });
app.delete('/api/sessions/:id', (req, res) => { db.deleteSession(req.params.id); res.json({ ok: true }); });

// ── ADMIN ─────────────────────────────────────────────────────────────────────
app.get('/api/admin/stats',       requireAdmin, (req, res) => res.json(db.getAdminStats()));
app.get('/api/admin/submissions', requireAdmin, (req, res) => res.json(db.getAllSubmissions()));
app.get('/api/admin/techniques',  requireAdmin, (req, res) => res.json(db.getAllTechniques()));
app.get('/api/admin/sessions',    requireAdmin, (req, res) => res.json(db.getSessions()));
app.put('/api/admin/submissions/:id/approve', requireAdmin, (req, res) => { db.approveSubmission(req.params.id); res.json({ ok: true }); });
app.put('/api/admin/submissions/:id/reject',  requireAdmin, (req, res) => { db.rejectSubmission(req.params.id, req.body.reason||''); res.json({ ok: true }); });
app.delete('/api/admin/techniques/:id',       requireAdmin, (req, res) => { db.deleteTechnique(req.params.id); res.json({ ok: true }); });

// ── CATCH-ALL SPA ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log('\n  ╔══════════════════════════════════════╗');
  console.log(`  ║   TATAMI BJJ Tracker — ${ENV.padEnd(12)}║`);
  console.log('  ╚══════════════════════════════════════╝');
  console.log(`\n  🥋  App:    http://localhost:${PORT}`);
  console.log(`  🔐  Admin:  http://localhost:${PORT}/admin.html`);
  console.log(`  🔑  Token:  ${ADMIN_TOKEN}`);
  console.log(`  💾  DB:     ${process.env.DB_DIR || './database'}/tatami.db\n`);
});

module.exports = app;
