const request = require('supertest');
const app = require('../server');

let token1, token2, userId1, userId2;

describe('TATAMI API', () => {
  // ── AUTH ──
  describe('Auth', () => {
    test('POST /api/auth/register - creates user', async () => {
      const res = await request(app).post('/api/auth/register').send({
        username: 'testuser1', email: 'test1@test.com', password: 'test123', display_name: 'Test User 1'
      });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
      expect(res.body.id).toBeTruthy();
      token1 = res.body.token;
      userId1 = res.body.id;
    });

    test('POST /api/auth/register - creates second user', async () => {
      const res = await request(app).post('/api/auth/register').send({
        username: 'testuser2', email: 'test2@test.com', password: 'test123', display_name: 'Test User 2'
      });
      expect(res.status).toBe(200);
      token2 = res.body.token;
      userId2 = res.body.id;
    });

    test('POST /api/auth/register - rejects duplicate username', async () => {
      const res = await request(app).post('/api/auth/register').send({
        username: 'testuser1', email: 'other@test.com', password: 'test123'
      });
      expect(res.status).toBe(409);
    });

    test('POST /api/auth/login - success', async () => {
      const res = await request(app).post('/api/auth/login').send({ login: 'testuser1', password: 'test123' });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
    });

    test('POST /api/auth/login - wrong password', async () => {
      const res = await request(app).post('/api/auth/login').send({ login: 'testuser1', password: 'wrong' });
      expect(res.status).toBe(401);
    });

    test('GET /api/auth/me - returns user', async () => {
      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token1}`);
      expect(res.status).toBe(200);
      expect(res.body.username).toBe('testuser1');
    });

    test('GET /api/auth/me - rejects no token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });

  // ── PROFILE ──
  describe('Profile', () => {
    test('PUT /api/profile - updates profile', async () => {
      const res = await request(app).put('/api/profile').set('Authorization', `Bearer ${token1}`).send({
        display_name: 'Updated Name', belt: 'blue', stripes: 2, gym: 'Test Gym'
      });
      expect(res.status).toBe(200);
    });

    test('GET /api/profile/:id - returns profile', async () => {
      const res = await request(app).get(`/api/profile/${userId1}`).set('Authorization', `Bearer ${token1}`);
      expect(res.status).toBe(200);
      expect(res.body.display_name).toBe('Updated Name');
      expect(res.body.belt).toBe('blue');
      expect(res.body.is_self).toBe(true);
    });

    test('GET /api/users/search - finds users', async () => {
      const res = await request(app).get('/api/users/search?q=testuser').set('Authorization', `Bearer ${token1}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  // ── FRIENDS ──
  describe('Friends', () => {
    let friendshipId;

    test('POST /api/friends/request - sends request', async () => {
      const res = await request(app).post('/api/friends/request').set('Authorization', `Bearer ${token1}`).send({ user_id: userId2 });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    test('GET /api/friends/pending - shows pending request', async () => {
      const res = await request(app).get('/api/friends/pending').set('Authorization', `Bearer ${token2}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      friendshipId = res.body[0].friendship_id;
    });

    test('POST /api/friends/respond - accepts request', async () => {
      const res = await request(app).post('/api/friends/respond').set('Authorization', `Bearer ${token2}`).send({ friendship_id: friendshipId, accept: true });
      expect(res.status).toBe(200);
    });

    test('GET /api/friends - shows friends', async () => {
      const res = await request(app).get('/api/friends').set('Authorization', `Bearer ${token1}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].username).toBe('testuser2');
    });
  });

  // ── SESSIONS ──
  describe('Sessions', () => {
    let sessionId;

    test('POST /api/sessions - creates session', async () => {
      const res = await request(app).post('/api/sessions').set('Authorization', `Bearer ${token1}`).send({
        date: '2024-01-15', duration: 90, sparring: 5, drills: 20,
        notes: 'Great session', techniques: ['Armbar', 'Triangle'], submissions_log: [{ technique: 'Armbar', role: 'gave' }],
        is_public: 1
      });
      expect(res.status).toBe(200);
      sessionId = res.body.id;
    });

    test('GET /api/sessions - returns user sessions', async () => {
      const res = await request(app).get('/api/sessions').set('Authorization', `Bearer ${token1}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].techniques).toContain('Armbar');
    });

    test('PUT /api/sessions/:id - updates session', async () => {
      const res = await request(app).put(`/api/sessions/${sessionId}`).set('Authorization', `Bearer ${token1}`).send({
        date: '2024-01-15', duration: 100, sparring: 6, drills: 25, notes: 'Updated', techniques: ['Armbar'], submissions_log: [], is_public: 0
      });
      expect(res.status).toBe(200);
    });

    test('GET /api/sessions?user_id= - friend sees only public', async () => {
      const res = await request(app).get(`/api/sessions?user_id=${userId1}`).set('Authorization', `Bearer ${token2}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(0); // session is now private
    });

    test('DELETE /api/sessions/:id - deletes', async () => {
      // Recreate for other tests
      const c = await request(app).post('/api/sessions').set('Authorization', `Bearer ${token1}`).send({ date: '2024-01-20', duration: 60, is_public: 1 });
      const res = await request(app).delete(`/api/sessions/${sessionId}`).set('Authorization', `Bearer ${token1}`);
      expect(res.status).toBe(200);
    });
  });

  // ── POSTS ──
  describe('Posts', () => {
    let postId;

    test('POST /api/posts - creates post', async () => {
      const res = await request(app).post('/api/posts').set('Authorization', `Bearer ${token1}`).send({
        content: 'Just had an amazing roll! @testuser2', tagged_users: [userId2], is_public: 1
      });
      expect(res.status).toBe(200);
      postId = res.body.id;
    });

    test('GET /api/feed - shows posts', async () => {
      const res = await request(app).get('/api/feed').set('Authorization', `Bearer ${token1}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
    });

    test('GET /api/feed - friend sees the post', async () => {
      const res = await request(app).get('/api/feed').set('Authorization', `Bearer ${token2}`);
      expect(res.status).toBe(200);
      expect(res.body.some(p => p.id === postId)).toBe(true);
    });

    test('POST /api/posts/:id/like - toggles like', async () => {
      const res = await request(app).post(`/api/posts/${postId}/like`).set('Authorization', `Bearer ${token2}`);
      expect(res.status).toBe(200);
      expect(res.body.liked).toBe(true);
    });

    test('POST /api/posts/:id/like - unlike', async () => {
      const res = await request(app).post(`/api/posts/${postId}/like`).set('Authorization', `Bearer ${token2}`);
      expect(res.status).toBe(200);
      expect(res.body.liked).toBe(false);
    });

    test('POST /api/posts/:id/comments - adds comment', async () => {
      const res = await request(app).post(`/api/posts/${postId}/comments`).set('Authorization', `Bearer ${token2}`).send({ content: 'Oss! Nice one!' });
      expect(res.status).toBe(200);
      expect(res.body.id).toBeTruthy();
    });

    test('GET /api/posts/:id/comments - returns comments', async () => {
      const res = await request(app).get(`/api/posts/${postId}/comments`).set('Authorization', `Bearer ${token1}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].content).toBe('Oss! Nice one!');
    });

    test('GET /api/posts/user/:id - returns user posts', async () => {
      const res = await request(app).get(`/api/posts/user/${userId1}`).set('Authorization', `Bearer ${token1}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  // ── NOTIFICATIONS ──
  describe('Notifications', () => {
    test('GET /api/notifications - returns notifications', async () => {
      const res = await request(app).get('/api/notifications').set('Authorization', `Bearer ${token1}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
    });

    test('GET /api/notifications/unread-count - returns count', async () => {
      const res = await request(app).get('/api/notifications/unread-count').set('Authorization', `Bearer ${token1}`);
      expect(res.status).toBe(200);
      expect(typeof res.body.count).toBe('number');
    });

    test('POST /api/notifications/mark-read - marks all read', async () => {
      const res = await request(app).post('/api/notifications/mark-read').set('Authorization', `Bearer ${token1}`);
      expect(res.status).toBe(200);
      const check = await request(app).get('/api/notifications/unread-count').set('Authorization', `Bearer ${token1}`);
      expect(check.body.count).toBe(0);
    });
  });

  // ── TECHNIQUES ──
  describe('Techniques', () => {
    test('GET /api/techniques - returns library', async () => {
      const res = await request(app).get('/api/techniques');
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(50);
    });

    test('POST /api/techniques/submit - submits technique', async () => {
      const res = await request(app).post('/api/techniques/submit').set('Authorization', `Bearer ${token1}`).send({
        name: 'Buggy Choke', category: 'submission', description: 'Bottom half guard choke'
      });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('pending');
    });
  });

  // ── ADMIN ──
  describe('Admin', () => {
    test('GET /api/admin/stats - returns stats', async () => {
      const res = await request(app).get('/api/admin/stats').set('x-admin-token', 'tatami-admin-2024');
      expect(res.status).toBe(200);
      expect(res.body.totalUsers).toBe(2);
    });

    test('GET /api/admin/stats - rejects bad token', async () => {
      const res = await request(app).get('/api/admin/stats').set('x-admin-token', 'wrong');
      expect(res.status).toBe(401);
    });
  });

  // ── HEALTH ──
  test('GET /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
