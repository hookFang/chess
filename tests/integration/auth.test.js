const request = require('supertest');
const { app } = require('../../server/app');

describe('Auth API', () => {
  describe('POST /api/auth/register', () => {
    test('Registers user with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.id).toBeDefined();
      expect(res.body.user.username).toBe('testuser');
    });

    test('Username is stored lowercase', async () => {
      const res1 = await request(app)
        .post('/api/auth/register')
        .send({ username: 'TestUser', password: 'password123' });

      expect(res1.body.user.username).toBe('testuser');

      // Verify login with different case works
      const res2 = await request(app)
        .post('/api/auth/login')
        .send({ username: 'TESTUSER', password: 'password123' });

      expect(res2.status).toBe(200);
    });

    test('Rejects duplicate username', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ username: 'duplicate', password: 'password123' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'duplicate', password: 'password456' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Username already taken');
    });

    test('Username must be 3-50 characters', async () => {
      const res1 = await request(app)
        .post('/api/auth/register')
        .send({ username: 'ab', password: 'password123' });
      expect(res1.status).toBe(400);

      const res2 = await request(app)
        .post('/api/auth/register')
        .send({ username: 'a'.repeat(51), password: 'password123' });
      expect(res2.status).toBe(400);
    });

    test('Password must be at least 6 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'newuser', password: '12345' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Password must be at least 6');
    });

    test('Password is not returned in response', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'pwduser', password: 'password123' });

      expect(res.body).not.toHaveProperty('password');
      expect(res.body).not.toHaveProperty('password_hash');
    });

    test('Requires username and password', async () => {
      const res1 = await request(app)
        .post('/api/auth/register')
        .send({ password: 'password123' });
      expect(res1.status).toBe(400);

      const res2 = await request(app)
        .post('/api/auth/register')
        .send({ username: 'user123' });
      expect(res2.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ username: 'loginuser', password: 'correctpass' });
    });

    test('Logs in user with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'loginuser', password: 'correctpass' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.username).toBe('loginuser');
    });

    test('Rejects wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'loginuser', password: 'wrongpass' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    test('Rejects non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nonexistent', password: 'anypass' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    test('Login is case-insensitive for username', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'LOGINUSER', password: 'correctpass' });

      expect(res.status).toBe(200);
      expect(res.body.user.username).toBe('loginuser');
    });

    test('Requires username and password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'loginuser' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    let token;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'meuser', password: 'password123' });
      token = res.body.token;
    });

    test('Returns authenticated user', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.username).toBe('meuser');
      expect(res.body.user.id).toBeDefined();
    });

    test('Requires valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token');

      expect(res.status).toBe(401);
    });

    test('Rejects request without token', async () => {
      const res = await request(app)
        .get('/api/auth/me');

      expect(res.status).toBe(401);
    });

    test('Rejects invalid Bearer format', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Basic ${token}`);

      expect(res.status).toBe(401);
    });
  });
});
