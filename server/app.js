const express = require('express');
const http = require('http');
const path = require('path');
const routes = require('./routes');
const { setupWebSocket } = require('./websocket');

const app = express();
const server = http.createServer(app);

app.use(require('cors')({ origin: true, credentials: true }));
app.use(express.json());
app.use(require('cookie-parser')());

app.use('/api', routes);

// Serve built React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get(/./, (req, res) =>
    res.sendFile(path.join(__dirname, '../client/build/index.html'))
  );
}

setupWebSocket(server);

module.exports = { app, server };
