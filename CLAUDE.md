# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow Rules

**Never commit or push code.** The developer reviews all changes manually and handles all git commits and pushes themselves.

## Commands

### Development
```bash
# Install all dependencies and build the client
npm run setup

# Run server (production mode, requires built client)
npm start

# Run server with auto-reload (development)
npm run dev

# Build React client only
npm run build:client
```

### Client development (hot-reload against running server)
```bash
cd client && npm start     # proxies /api/* and /ws to localhost:3001
```

### Docker
```bash
docker build -t chess .    # single self-contained image (server + embedded PostgreSQL)
docker run -p 8443:443 -v chess-data:/data chess   # https://localhost:8443 (self-signed)
```

### Verify modules load
```bash
node -e "require('./server/chess.js'); require('./server/routes.js'); console.log('OK')"
```

### Tests
```bash
npm test                      # Jest unit + integration (needs local Postgres, uses chessdb_test)
cd client && npm run build && npm run e2e   # Playwright, two real browsers (needs built client)
```

## Architecture

Single Express server (port 3001) serves three things: REST API at `/api/*`, WebSocket at `/ws`, and the built React app as static files from `client/build/`.

```
client/src  →  npm run build  →  client/build/  ←  Express static
                                                 ↑
                                         /api/* routes
                                         /ws  WebSocket
                                                 ↑
                                           PostgreSQL
```

### Two chess engines — keep them in sync

`server/chess.js` is the **authoritative** engine. Every move is validated server-side before being persisted.

`client/src/utils/chess.js` is an **exact mirror** used only for UI: highlighting legal moves when a piece is selected. If you change move generation logic in one, apply the same change to the other.

Both use identical board representation:
- 8×8 array `board[row][col]`, row 0 = rank 8 (black back rank), row 7 = rank 1 (white back rank)
- Piece codes: `wP wR wN wB wQ wK` / `bP bR bN bB bQ bK`
- Board state stored in DB as `JSON.stringify(board)`, or the string `"start"` for the initial position

### Real-time move flow

```
Client click → onMove() → WebSocket send {type:'move', from, to, piece}
  → server: validate turn → applyMove() → DB transaction (INSERT move + UPDATE room)
  → broadcast {type:'move', boardState, nextTurn, ...} to all clients in room
```

The in-memory `rooms` map in `websocket.js` (Map of roomId → Set of clientInfo) is reset on server restart. Clients reconnect automatically (3 s retry) and re-join the map on connection.

### WebSocket message contract

Client → Server: `move | resign | offer_draw | accept_draw | ping`

Server → Client: `connected | player_joined | move | game_over | player_left | draw_offered | pong | error`

The `move` broadcast includes the full `boardState` JSON so any reconnecting client can catch up without a separate API call.

### Anonymous players (no accounts)

There are no user accounts, sign-up, or game history. Someone creates a game (`POST /api/rooms`) and shares the `/game/:id` link; whoever opens it first takes the black seat, anyone after that is a spectator.

A seat is proven by a secret per-room token (`white_token` / `black_token` on `rooms`), returned when the seat is taken and kept in the browser's `localStorage` as `chess_room_<roomId>` (`client/src/utils/player.js`). HTTP sends it as the `X-Player-Token` header, the WebSocket as the optional `?token=` query param. No valid token = spectator. Clearing site data loses the seat.

### Castling

Castling rights are stored per room as six `*_moved` booleans (king, and each rook). `applyMove(board, from, to, promotion, castlingRights)` returns `isCastle` and `newCastlingRights`; a castle is sent as a normal two-square king move. Both engines must keep the same castling legality logic.

### Web push

`server/push.js` (`sendPushToPlayer(roomId, color, payload)`) notifies the opponent after a move and on game over via the `web-push` library. Subscriptions are stored per room + colour (`push_subscriptions`) via `POST /api/rooms/:id/push`. Needs `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`; without them push is silently skipped. The service worker is `client/public/sw.js`. Push requires HTTPS (or localhost).

### Docker image

One container runs nginx, the server and PostgreSQL. `docker-entrypoint.sh` generates a self-signed cert into `/data/certs` (unless `server.crt`/`server.key` already exist; `TLS_DOMAIN` sets the name), initialises the DB in `/data/postgres`, generates VAPID keys into `/data/config.env` on first start (unless `VAPID_*` env vars are given), then runs the app (unprivileged, `127.0.0.1:3001`) behind nginx (`nginx.conf`, TLS on 443, proxies `/ws` too). Only 443 is exposed. Setting `DB_HOST` skips the embedded DB and uses an external one.

## Environment variables

See `.env.example`. Defaults work for local dev with a running Postgres instance. The `DB_*` vars default to `localhost/chessdb/chess/chesspass`. The `VAPID_*` vars are only needed for push notifications when running outside Docker (generate with `npx web-push generate-vapid-keys`); the Docker image generates them on first start.
