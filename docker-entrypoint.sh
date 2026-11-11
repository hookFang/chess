#!/bin/sh
# Single-container entrypoint: prepares config, runs an embedded PostgreSQL
# (unless DB_HOST points at an external one), then runs the chess server.
set -e

DATA_DIR="${DATA_DIR:-/data}"
PGDATA="$DATA_DIR/postgres"
CONF="$DATA_DIR/config.env"
mkdir -p "$DATA_DIR"

# --- 1. Generate config on first start (VAPID keys for Web Push) -------------
if [ ! -f "$CONF" ] && { [ -z "${VAPID_PUBLIC_KEY:-}" ] || [ -z "${VAPID_PRIVATE_KEY:-}" ]; }; then
  echo "First start: generating VAPID keys into $CONF"
  node -e "const k=require('web-push').generateVAPIDKeys();console.log('VAPID_PUBLIC_KEY='+k.publicKey);console.log('VAPID_PRIVATE_KEY='+k.privateKey)" > "$CONF"
  chmod 600 "$CONF"
fi
if [ -f "$CONF" ]; then
  for k in VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY; do
    eval "[ -n \"\${$k:-}\" ]" || export "$k=$(sed -n "s/^$k=//p" "$CONF")"
  done
fi
export VAPID_SUBJECT="${VAPID_SUBJECT:-mailto:admin@example.com}"

# --- 2. Self-signed TLS certificate (first start only) -------------------------
# To use your own certificate, put server.crt / server.key in /data/certs.
CERT_DIR="$DATA_DIR/certs"
TLS_DOMAIN="${TLS_DOMAIN:-localhost}"
if [ ! -f "$CERT_DIR/server.crt" ] || [ ! -f "$CERT_DIR/server.key" ]; then
  echo "Generating self-signed certificate for $TLS_DOMAIN in $CERT_DIR"
  mkdir -p "$CERT_DIR"
  SAN="DNS:localhost,IP:127.0.0.1"
  if echo "$TLS_DOMAIN" | grep -Eq '^[0-9.]+$'; then SAN="$SAN,IP:$TLS_DOMAIN"
  elif [ "$TLS_DOMAIN" != "localhost" ]; then SAN="$SAN,DNS:$TLS_DOMAIN"; fi
  openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
    -keyout "$CERT_DIR/server.key" -out "$CERT_DIR/server.crt" \
    -subj "/CN=$TLS_DOMAIN" -addext "subjectAltName=$SAN" 2>/dev/null
  chmod 600 "$CERT_DIR/server.key"
fi

# --- 3. Embedded PostgreSQL ---------------------------------------------------
PG_PID=""
if [ -z "${DB_HOST:-}" ]; then
  export DB_HOST=127.0.0.1 DB_PORT=5432
  export DB_NAME="${DB_NAME:-chessdb}" DB_USER="${DB_USER:-chess}"
  PGBIN="$(dirname "$(ls /usr/libexec/postgresql*/initdb | head -n1)")"

  mkdir -p "$PGDATA"
  chown -R postgres:postgres "$PGDATA"
  chmod 700 "$PGDATA"
  if [ ! -s "$PGDATA/PG_VERSION" ]; then
    echo "Initialising database in $PGDATA"
    su-exec postgres "$PGBIN/initdb" -D "$PGDATA" -U postgres -E UTF8 --auth=trust >/dev/null
  fi

  # Listens on loopback only, so trust auth is not reachable from outside the container.
  su-exec postgres "$PGBIN/postgres" -D "$PGDATA" \
    -c listen_addresses=127.0.0.1 -c unix_socket_directories=/tmp &
  PG_PID=$!

  i=0
  until pg_isready -q -U postgres -h 127.0.0.1 -p 5432; do
    i=$((i + 1)); [ "$i" -gt 60 ] && { echo "PostgreSQL did not start" >&2; exit 1; }
    sleep 1
  done

  psql -q -h 127.0.0.1 -U postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 \
    || psql -q -h 127.0.0.1 -U postgres -c "CREATE ROLE \"$DB_USER\" LOGIN"
  psql -q -h 127.0.0.1 -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
    || psql -q -h 127.0.0.1 -U postgres -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\""
fi

# --- 4. Run the server behind nginx, stop everything cleanly on exit -----------------------
NODE_PID=""
NGINX_PID=""
cleanup() {
  set +e
  if [ -n "$NGINX_PID" ]; then kill -QUIT "$NGINX_PID" 2>/dev/null; wait "$NGINX_PID" 2>/dev/null; NGINX_PID=""; fi
  if [ -n "$NODE_PID" ]; then kill -TERM "$NODE_PID" 2>/dev/null; wait "$NODE_PID" 2>/dev/null; NODE_PID=""; fi
  if [ -n "$PG_PID" ]; then kill -INT "$PG_PID" 2>/dev/null; wait "$PG_PID" 2>/dev/null; PG_PID=""; fi
}
trap 'cleanup; exit 0' TERM INT

PORT=3001 su-exec chess node server/index.js &
NODE_PID=$!
nginx -g 'daemon off;' &
NGINX_PID=$!
CODE=0
wait "$NODE_PID" || CODE=$?
NODE_PID=""
cleanup
exit "$CODE"
