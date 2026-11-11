const webpush = require('web-push');
const { pool } = require('./db');

let configured = false;

function configure() {
  if (configured) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) return false;
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    configured = true;
  } catch (err) {
    console.error('Invalid VAPID configuration, push disabled:', err.message);
    return false;
  }
  return true;
}

// Sends a notification to every subscription registered for one side of a room. Never throws.
// Subscriptions the push service reports as gone (404/410) are deleted.
async function sendPushToPlayer(roomId, color, payload) {
  if (!roomId || !color || !configure()) return;
  try {
    const { rows } = await pool.query(
      'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE room_id = $1 AND color = $2',
      [roomId, color]
    );
    const body = JSON.stringify(payload);
    await Promise.all(rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          body
        );
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [row.id]);
        } else {
          console.error('Push send failed:', err.statusCode || err.message);
        }
      }
    }));
  } catch (err) {
    console.error('sendPushToPlayer error:', err.message);
  }
}

module.exports = { sendPushToPlayer };
