const request = require('supertest');
const { pool } = require('../../server/db');
const { app } = require('../../server/app');
const { createActiveRoom } = require('../helpers');

const sub = { endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } };
const post = (room, token, body = sub) => {
  const req = request(app).post(`/api/rooms/${room.id}/push`);
  return (token ? req.set('X-Player-Token', token) : req).send(body);
};
const count = async () => (await pool.query('SELECT 1 FROM push_subscriptions')).rowCount;

describe('Push API', () => {
  test('vapid public key is public', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pubkey';
    const res = await request(app).get('/api/push/vapid-public-key');
    expect(res.status).toBe(200);
    expect(res.body.publicKey).toBe('pubkey');
  });

  test('subscribing needs a player token for that room', async () => {
    const room = await createActiveRoom();
    expect((await post(room, null)).status).toBe(403);
    expect((await post(room, 'wrong-token')).status).toBe(403);
    expect(await count()).toBe(0);
  });

  test('a token from another room does not work', async () => {
    const room = await createActiveRoom();
    const otherRoom = await createActiveRoom();
    expect((await post(room, otherRoom.whiteToken)).status).toBe(403);
  });

  test('rejects malformed subscriptions and unknown rooms', async () => {
    const room = await createActiveRoom();
    expect((await post(room, room.whiteToken, { endpoint: 'x' })).status).toBe(400);
    const res = await request(app).post('/api/rooms/00000000-0000-0000-0000-000000000000/push')
      .set('X-Player-Token', room.whiteToken).send(sub);
    expect(res.status).toBe(404);
  });

  test('subscribe stores the player\'s color and is idempotent per endpoint', async () => {
    const room = await createActiveRoom();
    expect((await post(room, room.blackToken)).status).toBe(200);
    expect((await post(room, room.blackToken)).status).toBe(200);
    const { rows } = await pool.query('SELECT room_id, color FROM push_subscriptions');
    expect(rows).toEqual([{ room_id: room.id, color: 'black' }]);
  });
});
