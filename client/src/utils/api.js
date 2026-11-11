const BASE = '/api';

// Players are anonymous. The only credential is a per-room token handed out when
// a seat is taken, sent as X-Player-Token. Spectators send none.
export async function apiRequest(path, options = {}, playerToken = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (playerToken) headers['X-Player-Token'] = playerToken;
  const res = await fetch(BASE + path, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export function getWsUrl(roomId, playerToken) {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const token = playerToken ? `&token=${encodeURIComponent(playerToken)}` : '';
  return `${proto}//${window.location.host}/ws?room=${roomId}${token}`;
}
