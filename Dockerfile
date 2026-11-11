# Stage 1: Build React client
FROM node:20-alpine AS client-builder

WORKDIR /app

COPY client/package.json ./client/
RUN cd client && npm install

COPY client ./client
RUN cd client && npm run build

# Stage 2: Production
FROM node:20-alpine

# Embedded PostgreSQL so the image is a single self-contained container
RUN apk add --no-cache postgresql16 postgresql16-client su-exec nginx openssl

WORKDIR /app

# Install only production dependencies
COPY package.json ./
RUN npm install --production

# Copy server code
COPY server ./server

# Copy built React client from builder stage
COPY --from=client-builder /app/client/build ./client/build

# The server runs as an unprivileged user; the entrypoint starts as root only to
# prepare /data and start PostgreSQL, then drops privileges for the app.
RUN addgroup -S chess && adduser -S chess -G chess
COPY nginx.conf /etc/nginx/nginx.conf
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production

# Database files and generated keys live here - mount a volume to keep them
VOLUME /data
# Only HTTPS is exposed; the Node server stays on 127.0.0.1:3001 behind nginx
EXPOSE 443

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD wget --quiet --tries=1 --spider --no-check-certificate https://localhost/ || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
