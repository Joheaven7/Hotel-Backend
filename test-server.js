console.log('Starting test...');
try {
  require('dotenv').config();
  console.log('Dotenv loaded');
  const express = require('express');
  console.log('Express loaded');
  console.log('Attempting to start server...');
  const app = express();
  const server = require('http').createServer(app);
  console.log('HTTP server created');
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    process.exit(0);
  });
  setTimeout(() => {
    console.log('Timeout reached, exiting');
    process.exit(0);
  }, 2000);
} catch(e) {
  console.error('Error:', e.message);
  console.error(e.stack);
  process.exit(1);
}
