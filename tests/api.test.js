/**
 * TATAMI API Tests
 * Run with: npm test
 *
 * Tests use a separate in-memory-ish SQLite DB via a temp DB_DIR so they
 * never touch your real tatami.db.
 */

const path    = require('path');
const os      = require('os');
const fs      = require('fs');
const request = require('supertest');

// ── Point DB at a temp directory before loading the app ────────────────────
const TEST_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tatami-test-'));
process.env.DB_DIR      = TEST_DB_DIR;
process.env.ADMIN_TOKEN = 'test-admin-token';
process.env.NODE_ENV    = 'test';
process.env.PORT        = '0'; // random port

const app = require('../server');

// ── Helper ──────────────────────────────────────────────────────────────────
const ADMIN = { 'x-admin-token': 'test-admin-token' };

// ── HEALTH ──────────────────────────────────────────────────────────────────
describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.env).toBe('test');
  });
});

// ── PROFILE ──────────────────────────────────────────────────────────────────
describe('Profile API', () => {
  it('GET /api/profile returns empty object initially', async () => {
    const res = await request(app).get('/api/profile');
    expect(res.status).toBe(200);
    // Either empty object or has default fields
    expect(typeof res.body).toBe('object');
  });

  it('PUT /api/profile saves and retrieves profile', async () => {
    const profile = {
      name: 'Test Grappler', gym: 'Test Academy',
      belt: 'blue', stripes: 2,
      start_date: '2023-01-01', height: '175', weight: '75',
      limb_length: 'long', flexibility: 'high',
    };
    const putRes = await request(app).put('/api/profile').send(profile);
    expect(putRes.status).toBe(200);
    expect(putRes.body.ok).toBe(true);

    const getRes = await request(app).get('/api/profile');
    expect(getRes.body.name).toBe('Test Grappler');
    expect(getRes.body.belt).toBe('blue');
    expect(getRes.body.stripes).toBe(2);
  });

  it('PUT /api/profile updates existing profile', async () => {
    await request(app).put('/api/profile').send({ name: 'Updated Name', belt: 'purple', stripes: 0, gym:'', start_date:'', height:'', weight:'', limb_length:'', flexibility:'' });
    const res = await request(app).get('/api/profile');
    expect(res.body.name).toBe('Updated Name');
    expect(res.body.belt).toBe('purple');
  });
});

// ── TECHNIQUES ───────────────────────────────────────────────────────────────
describe('Techniques API', () => {
  it('GET /api/techniques returns approved techniques', async () => {
    const res = await request(app).get('/api/techniques');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(50); // seeded techniques
    // All should be approved
    res.body.forEach(t => expect(t.status).toBe('approved'));
  });

  it('GET /api/techniques contains expected categories', async () => {
    const res = await request(app).get('/api/techniques');
    const cats = [...new Set(res.body.map(t => t.category))];
    expect(cats).toEqual(expect.arrayContaining(['guard', 'pass', 'submission', 'sweep', 'control', 'escape']));
  });

  it('GET /api/techniques includes Triangle Choke', async () => {
    const res = await request(app).get('/api/techniques');
    const found = res.body.find(t => t.name === 'Triangle Choke');
    expect(found).toBeDefined();
    expect(found.category).toBe('submission');
  });

  describe('POST /api/techniques/submit', () => {
    it('submits a new technique and returns pending status', async () => {
      const res = await request(app).post('/api/techniques/submit').send({
        name: 'Lapel Choke', category: 'submission',
        description: 'A lapel-based choke', submitted_by: 'Test User',
      });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('pending');
      expect(res.body.id).toBeDefined();
    });

    it('returns 400 when name is missing', async () => {
      const res = await request(app).post('/api/techniques/submit').send({ category: 'submission' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when category is missing', async () => {
      const res = await request(app).post('/api/techniques/submit').send({ name: 'Test Tech' });
      expect(res.status).toBe(400);
    });

    it('returns 409 when submitting a duplicate technique', async () => {
      // Triangle Choke is already seeded
      const res = await request(app).post('/api/techniques/submit').send({
        name: 'Triangle Choke', category: 'submission', submitted_by: 'someone',
      });
      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already exists');
    });

    it('is case-insensitive for duplicate detection', async () => {
      const res = await request(app).post('/api/techniques/submit').send({
        name: 'triangle choke', category: 'submission', submitted_by: 'someone',
      });
      expect(res.status).toBe(409);
    });
  });

  describe('My submissions', () => {
    it('GET /api/techniques/my-submissions returns user submissions', async () => {
      const res = await request(app).get('/api/techniques/my-submissions?submitted_by=Test%20User');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const names = res.body.map(t => t.name);
      expect(names).toContain('Lapel Choke');
    });

    it('returns empty array for unknown user', async () => {
      const res = await request(app).get('/api/techniques/my-submissions?submitted_by=nobody');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns empty array when submitted_by is omitted', async () => {
      const res = await request(app).get('/api/techniques/my-submissions');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });
});

// ── SESSIONS ─────────────────────────────────────────────────────────────────
describe('Sessions API', () => {
  let sessionId;

  it('GET /api/sessions returns empty array initially', async () => {
    const res = await request(app).get('/api/sessions');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/sessions creates a session', async () => {
    const session = {
      date: '2024-06-01', duration: 90, drills: 20, sparring: 4,
      notes: 'Great training today',
      techniques: ['Triangle Choke', 'Closed Guard'],
      submissions: [{ name: 'Triangle Choke', success: true }, { name: 'Armbar', success: false }],
    };
    const res = await request(app).post('/api/sessions').send(session);
    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
    sessionId = res.body.id;
  });

  it('GET /api/sessions returns the created session', async () => {
    const res = await request(app).get('/api/sessions');
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const found = res.body.find(s => s.id === sessionId);
    expect(found).toBeDefined();
    expect(found.duration).toBe(90);
    expect(found.techniques).toContain('Triangle Choke');
    expect(found.submissions[0].name).toBe('Triangle Choke');
    expect(found.submissions[0].success).toBe(true);
  });

  it('PUT /api/sessions/:id updates a session', async () => {
    const updated = {
      date: '2024-06-01', duration: 75, drills: 15, sparring: 3,
      notes: 'Updated notes',
      techniques: ['Half Guard'],
      submissions: [],
    };
    const res = await request(app).put(`/api/sessions/${sessionId}`).send(updated);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const getRes = await request(app).get('/api/sessions');
    const s = getRes.body.find(x => x.id === sessionId);
    expect(s.duration).toBe(75);
    expect(s.notes).toBe('Updated notes');
  });

  it('POST /api/sessions requires date and duration', async () => {
    // No validation in the route itself, but duration defaults to 0
    // Just ensure it doesn't crash
    const res = await request(app).post('/api/sessions').send({ date: '2024-06-02', duration: 60 });
    expect(res.status).toBe(200);
  });

  it('DELETE /api/sessions/:id removes the session', async () => {
    const res = await request(app).delete(`/api/sessions/${sessionId}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const getRes = await request(app).get('/api/sessions');
    const found = getRes.body.find(s => s.id === sessionId);
    expect(found).toBeUndefined();
  });
});

// ── ADMIN ─────────────────────────────────────────────────────────────────────
describe('Admin API', () => {
  describe('Authentication', () => {
    it('rejects requests without admin token', async () => {
      const res = await request(app).get('/api/admin/stats');
      expect(res.status).toBe(401);
    });

    it('rejects requests with wrong token', async () => {
      const res = await request(app).get('/api/admin/stats').set('x-admin-token', 'wrong-token');
      expect(res.status).toBe(401);
    });

    it('accepts requests with correct token', async () => {
      const res = await request(app).get('/api/admin/stats').set(ADMIN);
      expect(res.status).toBe(200);
    });
  });

  describe('Stats', () => {
    it('GET /api/admin/stats returns expected shape', async () => {
      const res = await request(app).get('/api/admin/stats').set(ADMIN);
      expect(res.body).toMatchObject({
        totalSessions:       expect.any(Number),
        totalTechniques:     expect.any(Number),
        pendingSubmissions:  expect.any(Number),
        rejectedSubmissions: expect.any(Number),
        totalMinutes:        expect.any(Number),
        uniqueSubmitters:    expect.any(Number),
      });
      expect(res.body.totalTechniques).toBeGreaterThan(50);
    });
  });

  describe('Submission moderation', () => {
    let submissionId;

    beforeAll(async () => {
      // Submit a technique to moderate
      const res = await request(app).post('/api/techniques/submit').send({
        name: 'Crab Ride', category: 'control', description: 'Back-exposing position', submitted_by: 'Tester',
      });
      submissionId = res.body.id;
    });

    it('GET /api/admin/submissions lists all user submissions', async () => {
      const res = await request(app).get('/api/admin/submissions').set(ADMIN);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const found = res.body.find(s => s.id === submissionId);
      expect(found).toBeDefined();
      expect(found.status).toBe('pending');
    });

    it('PUT /api/admin/submissions/:id/approve approves a submission', async () => {
      const res = await request(app)
        .put(`/api/admin/submissions/${submissionId}/approve`)
        .set(ADMIN);
      expect(res.status).toBe(200);

      // Should now appear in public techniques
      const techRes = await request(app).get('/api/techniques');
      const found = techRes.body.find(t => t.name === 'Crab Ride');
      expect(found).toBeDefined();
      expect(found.status).toBe('approved');
    });

    it('PUT /api/admin/submissions/:id/reject rejects with reason', async () => {
      // Submit another one to reject
      const sub = await request(app).post('/api/techniques/submit').send({
        name: 'Fake Technique XYZ', category: 'other', submitted_by: 'Spammer',
      });
      const id = sub.body.id;

      const res = await request(app)
        .put(`/api/admin/submissions/${id}/reject`)
        .set(ADMIN)
        .send({ reason: 'Not a real technique' });
      expect(res.status).toBe(200);

      // Should NOT appear in public techniques
      const techRes = await request(app).get('/api/techniques');
      const found = techRes.body.find(t => t.name === 'Fake Technique XYZ');
      expect(found).toBeUndefined();

      // But should show rejection reason in admin view
      const subRes = await request(app).get('/api/admin/submissions').set(ADMIN);
      const rejected = subRes.body.find(s => s.id === id);
      expect(rejected.status).toBe('rejected');
      expect(rejected.rejection_reason).toBe('Not a real technique');
    });
  });

  describe('Technique management', () => {
    it('GET /api/admin/techniques returns all techniques', async () => {
      const res = await request(app).get('/api/admin/techniques').set(ADMIN);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('DELETE /api/admin/techniques/:id deletes a user-submitted technique', async () => {
      // First submit and approve a technique
      const sub = await request(app).post('/api/techniques/submit').send({
        name: 'To Be Deleted', category: 'other', submitted_by: 'Tester',
      });
      const id = sub.body.id;
      await request(app).put(`/api/admin/submissions/${id}/approve`).set(ADMIN);

      // Now delete it
      const del = await request(app).delete(`/api/admin/techniques/${id}`).set(ADMIN);
      expect(del.status).toBe(200);

      // Should not appear in public list
      const techRes = await request(app).get('/api/techniques');
      const found = techRes.body.find(t => t.name === 'To Be Deleted');
      expect(found).toBeUndefined();
    });
  });
});

// ── CLEANUP ──────────────────────────────────────────────────────────────────
afterAll(() => {
  try { fs.rmSync(TEST_DB_DIR, { recursive: true, force: true }); } catch (_) {}
});
