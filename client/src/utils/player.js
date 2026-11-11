// A player's seat in a game is proven by a secret token kept in this browser,
// one per game. Clearing site data means losing the seat.
const key = (roomId) => `chess_room_${roomId}`;

export function getRoomToken(roomId) {
  try { return localStorage.getItem(key(roomId)); } catch { return null; }
}

export function setRoomToken(roomId, token) {
  try { localStorage.setItem(key(roomId), token); } catch { /* storage unavailable */ }
}
