jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

process.env.VAPID_PUBLIC_KEY = 'pub';
process.env.VAPID_PRIVATE_KEY = 'priv';
process.env.VAPID_SUBJECT = 'mailto:test@example.com';

const webpush = require('web-push');
const { pool } = require('../../server/db');
const { sendPushToPlayer } = require('../../server/push');
const { createActiveRoom } = require('../helpers');

async function addSub(roomId, color, endpoint) {
  await pool.query(
    'INSERT INTO push_subscriptions (room_id, color, endpoint, p256dh, auth) VALUES ($1, $2, $3, $4, $5)',
    [roomId, color, endpoint, 'p', 'a']
  );
}

describe('sendPushToPlayer', () => {
  beforeEach(() => webpush.sendNotification.mockReset());

  test('sends to each subscription of that side only', async () => {
    const room = await createActiveRoom();
    await addSub(room.id, 'white', 'https://push.example/1');
    await addSub(room.id, 'white', 'https://push.example/2');
    await addSub(room.id, 'black', 'https://push.example/other-side');
    webpush.sendNotification.mockResolvedValue({});

    await sendPushToPlayer(room.id, 'white', { title: 't', body: 'b', url: '/game/x' });

    expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
    const [sub, payload] = webpush.sendNotification.mock.calls[0];
    expect(sub.keys).toEqual({ p256dh: 'p', auth: 'a' });
    expect(JSON.parse(payload).title).toBe('t');
  });

  test('deletes a subscription on 410 and keeps it on other errors', async () => {
    const room = await createActiveRoom();
    await addSub(room.id, 'white', 'https://push.example/gone');
    await addSub(room.id, 'white', 'https://push.example/flaky');
    jest.spyOn(console, 'error').mockImplementation(() => {});
    webpush.sendNotification.mockImplementation(async (sub) => {
      if (sub.endpoint.endsWith('gone')) throw Object.assign(new Error('gone'), { statusCode: 410 });
      throw Object.assign(new Error('boom'), { statusCode: 500 });
    });

    await sendPushToPlayer(room.id, 'white', { title: 't' });

    const { rows } = await pool.query('SELECT endpoint FROM push_subscriptions WHERE room_id = $1', [room.id]);
    expect(rows.map(r => r.endpoint)).toEqual(['https://push.example/flaky']);
    console.error.mockRestore();
  });

  test('does nothing without a room/color or with no subscriptions', async () => {
    const room = await createActiveRoom();
    await sendPushToPlayer(null, 'white', {});
    await sendPushToPlayer(room.id, null, {});
    await sendPushToPlayer(room.id, 'white', {});
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });
});
