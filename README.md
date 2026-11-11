# King Fall — Anonymous Online Chess

Two-player chess in the browser. No accounts: create a game, pick your colour
(White / Black / Random), and share the link. Whoever opens it first takes the
other seat; everyone after that is a spectator. Supports castling, draw offers,
resignation and optional Web Push notifications when your opponent moves.

Stack: Node/Express + WebSocket, React, PostgreSQL. Ships as a single
self-contained Docker image (`hookfang/chess`) with the database built in.

---

## 1. Run it (one container, nothing to configure)

The image bundles the server **and** its PostgreSQL database. On first start it
creates the database, generates the Web Push (VAPID) keys and a self-signed TLS
certificate, and serves everything through nginx on HTTPS port 443. Only 443 is
exposed; the app and database are not reachable from outside.

```bash
docker run -d --name chess -p 443:443 -v chess-data:/data --restart unless-stopped hookfang/chess:latest
```

Open <https://localhost> (your browser will warn about the self-signed certificate; see section 2), click **Create Game**, and send the invite link to
your opponent.

Or with Compose (`docker-compose.yml` is included):

```bash
docker compose up -d
```

The `/data` volume holds the database, the generated keys and the certificate, so games and
notification subscriptions survive restarts and upgrades. Delete the volume to
start completely fresh.

```bash
docker logs -f chess                                  # logs
docker stop chess                                     # stop (data kept)
docker rm -f chess && docker volume rm chess-data     # remove everything
```

### Optional settings (`-e NAME=value`)

| Variable | Default | Description |
|---|---|---|
| `TLS_DOMAIN` | `localhost` | Hostname or IP put in the self-signed certificate (first start only) |
| `VAPID_SUBJECT` | `mailto:admin@example.com` | Contact for push services; set to your own email/URL |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | auto-generated | Provide both to use your own keys |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | embedded DB | Set `DB_HOST` to use an external PostgreSQL instead of the built-in one |

Generated keys are stored in `/data/config.env` (keep the volume private — it
contains the push private key).

## 2. HTTPS and the self-signed certificate

On first start the container runs `openssl` to create a self-signed certificate
in `/data/certs` (valid 825 days, covering `localhost`, `127.0.0.1` and
`TLS_DOMAIN`) and nginx uses it. Running on a server? Set the name people will use:

```bash
docker run -d --name chess -p 443:443 -e TLS_DOMAIN=chess.example.com -v chess-data:/data hookfang/chess:latest
```

- **Browser warning:** a self-signed certificate is not trusted, so browsers show
  a warning you must click through. Chrome/Brave also refuse to register the
  service worker on an untrusted certificate, which means **push notifications
  will not work with the self-signed cert**. The game itself works fine.
- **Trusted certificate (needed for push):** put your real `server.crt` (full
  chain) and `server.key` into the volume's `certs` folder and restart; they are
  used as is and never overwritten. To force a new self-signed certificate
  (e.g. after changing `TLS_DOMAIN`), delete the files and restart:

  ```bash
  docker exec chess rm /data/certs/server.crt /data/certs/server.key && docker restart chess
  ```

  Alternatively keep the self-signed cert and put a TLS-terminating proxy such
  as Cloudflare or Caddy in front.
- Push needs a trusted HTTPS origin (or plain `http://localhost` when running
  without Docker). Clearing browser site data loses your seat (the seat token
  lives in the browser's `localStorage`).

## 3. Back up the data

```bash
docker run --rm -v chess-data:/data -v "$PWD":/backup alpine tar czf /backup/chess-data.tgz -C /data .
```

Restore by extracting the archive into a fresh `chess-data` volume the same way.

---

## 4. Publishing the image to a registry

### Manually (Docker Hub)

```bash
docker login                                   # once

docker build -t hookfang/chess:latest .
docker push hookfang/chess:latest
```

Replace `hookfang` with your Docker Hub username (and update the `image:` line in
`docker-compose.yml` to match). Build for both Intel and ARM servers with:

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -t hookfang/chess:latest --push .
```

Other registries: tag with the registry host, e.g. `ghcr.io/<user>/chess:latest`
(`docker login ghcr.io` first).

### Automatically (GitHub Actions)

`.github/workflows/ci.yml` runs the tests and, on pushes to `main`/`master`,
builds and pushes `<DOCKERHUB_USERNAME>/chess:latest`. Setup (Docker Hub access token and
the `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` repository secrets) is described in
[GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md).

---

## 5. Upgrading

```bash
docker pull hookfang/chess:latest
docker rm -f chess
docker run -d --name chess -p 443:443 -v chess-data:/data --restart unless-stopped hookfang/chess:latest
```

(With Compose: `docker compose pull && docker compose up -d`.) The `/data`
volume is reused, and schema changes are applied automatically on start. Note: upgrading from the
old account-based version resets existing games and users (the tables are
recreated for the anonymous model).

---

## 6. Local development (without Docker for the app)

```bash
cp .env.example .env     # adjust if your Postgres differs
npm run setup            # installs dependencies and builds the client
npm run dev              # server with auto-reload on :3001
```

Needs a local PostgreSQL with database `chessdb` and user `chess` / `chesspass`.
Hot-reload client: `cd client && npm start`.

Tests:

```bash
npm test                                      # Jest (needs Postgres DB chessdb_test)
cd client && npm run build && npm run e2e     # Playwright, two real browsers
```

## Troubleshooting

- **Container is unhealthy right after start** — the first start initialises the database and can take 10-20 seconds; check `docker logs chess`.
- **"Registration failed - push service error"** — the browser couldn't reach its
  push service. Brave: enable *Use Google services for push messaging* in
  `brave://settings/privacy`; also check that `fcm.googleapis.com` isn't blocked.
- **Port 443 in use** — use e.g. `-p 8443:443` and open `https://localhost:8443`.
