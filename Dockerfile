# Stage 1: Build React client
FROM node:20-alpine AS client-builder

WORKDIR /app

COPY client/package.json ./client/
RUN cd client && npm install

COPY client ./client
RUN cd client && npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies
COPY package.json ./
RUN npm install --production

# Copy server code
COPY server ./server

# Copy built React client from builder stage
COPY --from=client-builder /app/client/build ./client/build

# Create non-root user
RUN addgroup -S chess && adduser -S chess -G chess
USER chess

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3001/api/auth/me || exit 1

CMD ["node", "server/index.js"]
