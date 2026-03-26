const request = require('supertest');
const { app } = require('../../server/app');
const { createUser } = require('../helpers');

describe('Rooms API', () => {
  let whiteToken, whiteUserId, blackToken, blackUserId;

  beforeEach(async () => {
    const white = await createUser('whiteuser', 'password123');
    whiteToken = white.token;
    whiteUserId = white.user.id;

    const black = await createUser('blackuser', 'password123');
    blackToken = black.token;
    blackUserId = black.user.id;
  });

  describe('POST /api/rooms', () => {
    test('Creates a new room', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${whiteToken}`);

      expect(res.status).toBe(200);
      expect(res.body.roomId).toBeDefined();
      expect(res.body.joinUrl).toBeDefined();
      expect(res.body.status).toBe('waiting');
    });

    test('Join URL has correct format', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${whiteToken}`);

      expect(res.body.joinUrl).toMatch(/^\/game\/.+/);
    });

    test('Requires authentication', async () => {
      const res = await request(app)
        .post('/api/rooms');

      expect(res.status).toBe(401);
    });

    test('Room creator becomes white player', async () => {
      const createRes = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${whiteToken}`);

      const roomId = createRes.body.roomId;

      const getRes = await request(app)
        .get(`/api/rooms/${roomId}`)
        .set('Authorization', `Bearer ${whiteToken}`);

      expect(getRes.body.whitePlayer.id).toBe(whiteUserId);
      expect(getRes.body.myColor).toBe('white');
      expect(getRes.body.blackPlayer).toBeNull();
    });
  });

  describe('GET /api/rooms/:id', () => {
    let roomId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${whiteToken}`);
      roomId = res.body.roomId;
    });

    test('Returns room details', async () => {
      const res = await request(app)
        .get(`/api/rooms/${roomId}`)
        .set('Authorization', `Bearer ${whiteToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(roomId);
      expect(res.body.status).toBe('waiting');
      expect(res.body.currentTurn).toBe('white');
      expect(res.body.boardState).toBeDefined();
    });

    test('Returns move history', async () => {
      const res = await request(app)
        .get(`/api/rooms/${roomId}`)
        .set('Authorization', `Bearer ${whiteToken}`);

      expect(res.body.moves).toBeDefined();
      expect(Array.isArray(res.body.moves)).toBe(true);
    });

    test('Assigns correct myColor to white player', async () => {
      const res = await request(app)
        .get(`/api/rooms/${roomId}`)
        .set('Authorization', `Bearer ${whiteToken}`);

      expect(res.body.myColor).toBe('white');
    });

    test('Returns 404 for non-existent room', async () => {
      const res = await request(app)
        .get(`/api/rooms/nonexistent`)
        .set('Authorization', `Bearer ${whiteToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Room not found');
    });

    test('Requires authentication', async () => {
      const res = await request(app)
        .get(`/api/rooms/${roomId}`);

      expect(res.status).toBe(401);
    });

    test('Non-participant sees myColor as null', async () => {
      const res = await request(app)
        .get(`/api/rooms/${roomId}`)
        .set('Authorization', `Bearer ${blackToken}`);

      expect(res.body.myColor).toBeNull();
    });
  });

  describe('POST /api/rooms/:id/join', () => {
    let roomId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${whiteToken}`);
      roomId = res.body.roomId;
    });

    test('Black player can join room', async () => {
      const res = await request(app)
        .post(`/api/rooms/${roomId}/join`)
        .set('Authorization', `Bearer ${blackToken}`);

      expect(res.status).toBe(200);
      expect(res.body.color).toBe('black');
      expect(res.body.status).toBe('active');
    });

    test('Room status becomes active after black joins', async () => {
      await request(app)
        .post(`/api/rooms/${roomId}/join`)
        .set('Authorization', `Bearer ${blackToken}`);

      const getRes = await request(app)
        .get(`/api/rooms/${roomId}`)
        .set('Authorization', `Bearer ${whiteToken}`);

      expect(getRes.body.status).toBe('active');
    });

    test('Join is idempotent for existing players', async () => {
      // White player joins as white
      const res1 = await request(app)
        .post(`/api/rooms/${roomId}/join`)
        .set('Authorization', `Bearer ${whiteToken}`);

      expect(res1.status).toBe(200);
      expect(res1.body.color).toBe('white');
      expect(res1.body.status).toBe('waiting');
    });

    test('Rejects third player from joining', async () => {
      await request(app)
        .post(`/api/rooms/${roomId}/join`)
        .set('Authorization', `Bearer ${blackToken}`);

      const thirdUser = await createUser('thirduser', 'password123');
      const res = await request(app)
        .post(`/api/rooms/${roomId}/join`)
        .set('Authorization', `Bearer ${thirdUser.token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Room is full');
    });

    test('Returns 404 for non-existent room', async () => {
      const res = await request(app)
        .post(`/api/rooms/nonexistent/join`)
        .set('Authorization', `Bearer ${blackToken}`);

      expect(res.status).toBe(404);
    });

    test('Requires authentication', async () => {
      const res = await request(app)
        .post(`/api/rooms/${roomId}/join`);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/rooms', () => {
    test('Returns list of user\'s rooms', async () => {
      // Create a room as white
      await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${whiteToken}`);

      const res = await request(app)
        .get('/api/rooms')
        .set('Authorization', `Bearer ${whiteToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.rooms)).toBe(true);
      expect(res.body.rooms.length).toBeGreaterThan(0);
    });

    test('Only returns rooms user participated in', async () => {
      // White creates a room
      await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${whiteToken}`);

      // Black queries
      const res = await request(app)
        .get('/api/rooms')
        .set('Authorization', `Bearer ${blackToken}`);

      expect(res.body.rooms.length).toBe(0);
    });

    test('Returns empty array if no rooms', async () => {
      const res = await request(app)
        .get('/api/rooms')
        .set('Authorization', `Bearer ${whiteToken}`);

      expect(res.body.rooms).toEqual([]);
    });

    test('Requires authentication', async () => {
      const res = await request(app)
        .get('/api/rooms');

      expect(res.status).toBe(401);
    });
  });
});
