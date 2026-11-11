const request = require('supertest');
const { app } = require('../../server/app');
const { createActiveRoom } = require('../helpers');

const asPlayer = (req, token) => (token ? req.set('X-Player-Token', token) : req);

describe('Rooms API', () => {
  describe('POST /api/rooms', () => {
    test('Creates a room and returns the creator\'s token', async () => {
      const res = await request(app).post('/api/rooms');
      expect(res.status).toBe(200);
      expect(res.body.roomId).toBeDefined();
      expect(res.body.joinUrl).toBe(`/game/${res.body.roomId}`);
      expect(res.body.status).toBe('waiting');
      expect(['white', 'black']).toContain(res.body.color);
      expect(res.body.token).toBeDefined();
    });

    test('Creator can choose white; the other seat stays open', async () => {
      const created = (await request(app).post('/api/rooms').send({ color: 'white' })).body;
      expect(created.color).toBe('white');
      const res = await asPlayer(request(app).get(`/api/rooms/${created.roomId}`), created.token);
      expect(res.body.myColor).toBe('white');
      expect(res.body).toMatchObject({ whiteJoined: true, blackJoined: false, currentTurn: 'white', moves: [] });
    });

    test('Creator can choose black; white still moves first', async () => {
      const created = (await request(app).post('/api/rooms').send({ color: 'black' })).body;
      expect(created.color).toBe('black');
      const res = await asPlayer(request(app).get(`/api/rooms/${created.roomId}`), created.token);
      expect(res.body.myColor).toBe('black');
      expect(res.body).toMatchObject({ whiteJoined: false, blackJoined: true, currentTurn: 'white' });
    });

    test('Defaults to random and ends up with either color', async () => {
      const colors = new Set();
      for (let i = 0; i < 30 && colors.size < 2; i++) {
        const res = await request(app).post('/api/rooms');
        expect(['white', 'black']).toContain(res.body.color);
        colors.add(res.body.color);
      }
      expect(colors.size).toBe(2);
    });

    test('Rejects an unknown color', async () => {
      const res = await request(app).post('/api/rooms').send({ color: 'purple' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/rooms/:id', () => {
    test('404 for unknown or malformed ids', async () => {
      expect((await request(app).get('/api/rooms/00000000-0000-0000-0000-000000000000')).status).toBe(404);
      expect((await request(app).get('/api/rooms/not-a-uuid')).status).toBe(404);
    });

    test('Visitors without a valid token have no color', async () => {
      const room = await createActiveRoom();
      expect((await request(app).get(`/api/rooms/${room.id}`)).body.myColor).toBeNull();
      expect((await asPlayer(request(app).get(`/api/rooms/${room.id}`), 'wrong')).body.myColor).toBeNull();
    });

    test('Does not leak the players\' tokens', async () => {
      const room = await createActiveRoom();
      const res = await asPlayer(request(app).get(`/api/rooms/${room.id}`), room.whiteToken);
      expect(JSON.stringify(res.body)).not.toContain(room.whiteToken);
      expect(JSON.stringify(res.body)).not.toContain(room.blackToken);
    });

    test('Each token resolves to its own color', async () => {
      const room = await createActiveRoom();
      expect((await asPlayer(request(app).get(`/api/rooms/${room.id}`), room.whiteToken)).body.myColor).toBe('white');
      expect((await asPlayer(request(app).get(`/api/rooms/${room.id}`), room.blackToken)).body.myColor).toBe('black');
    });

    test('Includes castling rights', async () => {
      const room = await createActiveRoom({ castlingRights: { whiteKingMoved: true } });
      const res = await request(app).get(`/api/rooms/${room.id}`);
      expect(res.body.castlingRights.whiteKingMoved).toBe(true);
      expect(res.body.castlingRights.blackKingMoved).toBe(false);
    });
  });

  describe('POST /api/rooms/:id/join', () => {
    test.each(['white', 'black'])('Creator plays %s: the first visitor gets the other seat and the game starts', async (mine) => {
      const created = (await request(app).post('/api/rooms').send({ color: mine })).body;
      const theirs = mine === 'white' ? 'black' : 'white';
      const res = await request(app).post(`/api/rooms/${created.roomId}/join`);
      expect(res.body.color).toBe(theirs);
      expect(res.body.status).toBe('active');
      expect(res.body.token).toBeDefined();
      expect(res.body.token).not.toBe(created.token);

      const room = await asPlayer(request(app).get(`/api/rooms/${created.roomId}`), res.body.token);
      expect(room.body.myColor).toBe(theirs);
      expect(room.body.status).toBe('active');
    });

    test('Rejoining with a token keeps the same seat and issues no new token', async () => {
      const created = (await request(app).post('/api/rooms')).body;
      const res = await asPlayer(request(app).post(`/api/rooms/${created.roomId}/join`), created.token);
      expect(res.body.color).toBe(created.color);
      expect(res.body.token).toBeUndefined();

      const black = (await request(app).post(`/api/rooms/${created.roomId}/join`)).body;
      const again = await asPlayer(request(app).post(`/api/rooms/${created.roomId}/join`), black.token);
      expect(again.body.color).toBe(created.color === 'white' ? 'black' : 'white');
    });

    test('Third visitor is a spectator', async () => {
      const created = (await request(app).post('/api/rooms')).body;
      await request(app).post(`/api/rooms/${created.roomId}/join`);
      const res = await request(app).post(`/api/rooms/${created.roomId}/join`);
      expect(res.status).toBe(200);
      expect(res.body.color).toBe('spectator');
      expect(res.body.token).toBeUndefined();
    });

    test('Only one of two simultaneous visitors gets the seat', async () => {
      const created = (await request(app).post('/api/rooms')).body;
      const results = await Promise.all([
        request(app).post(`/api/rooms/${created.roomId}/join`),
        request(app).post(`/api/rooms/${created.roomId}/join`),
      ]);
      const colors = results.map(r => r.body.color).sort();
      expect(colors).toEqual([created.color === 'white' ? 'black' : 'white', 'spectator'].sort());
    });

    test('404 for unknown room', async () => {
      const res = await request(app).post('/api/rooms/00000000-0000-0000-0000-000000000000/join');
      expect(res.status).toBe(404);
    });
  });
});
