const { server } = require('./app');
const { initDB } = require('./db');

const PORT = process.env.PORT || 3001;

initDB().then(() => {
  server.listen(PORT, () => console.log(`Chess server on port ${PORT}`));
}).catch(err => { console.error(err); process.exit(1); });
