const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const publicPath = path.join(__dirname, 'public');
console.log(`Serving static files from: ${publicPath}`);
app.use(express.static(publicPath));

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'database.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error('Database connection error:', err.message);
  else console.log('Database connected successfully');
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS links (id TEXT PRIMARY KEY)`);
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id TEXT,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => { if (err) console.error('Table creation error:', err.message); });
});

// Existing routes (/health, /, /create-link, /send-message, /messages/:linkId, /send/:linkId) remain the same

// Catch-all route for index.html
app.get('*', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'index.html');
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error(`File not found: ${filePath}`, err.message);
      return res.status(404).send('index.html not found');
    }
    res.sendFile(filePath);
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`Server running on port ${port}`));

process.on('SIGINT', () => {
  db.close((err) => {
    if (err) console.error('Database close error:', err.message);
    console.log('Database connection closed.');
    process.exit(0);
  });
});
