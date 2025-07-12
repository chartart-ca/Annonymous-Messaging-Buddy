const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

// Initialize Express app
const app = express();
app.use(express.json());

// Log static file path for debugging
const publicPath = path.join(__dirname, 'public');
console.log(`Serving static files from: ${publicPath}`);
app.use(express.static(publicPath));

// Configure database file path
const DB_PATH = process.env.DB_PATH || '/opt/render/database.db';

// Initialize SQLite database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Database connection error:', err.message, err.stack);
  } else {
    console.log('Database connected successfully');
  }
});

// Create necessary database tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS links (
    id TEXT PRIMARY KEY
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id TEXT,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) console.error('Table creation error:', err.message, err.stack);
  });
});

// Health check endpoint
app.get('/health', (req, res) => res.status(200).send('OK'));

// Serve index.html for the root route
app.get('/', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'index.html');
  console.log(`Attempting to serve: ${filePath}`);
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error(`File not found: ${filePath}`, err.message, err.stack);
      return res.status(404).send('index.html not found');
    }
    res.sendFile(filePath);
  });
});

// Create a new anonymous link
app.post('/create-link', (req, res) => {
  const linkId = uuidv4();
  db.run(`INSERT INTO links (id) VALUES (?)`, [linkId], (err) => {
    if (err) {
      console.error('Error creating link:', err.message, err.stack);
      return res.status(500).json({ error: 'Failed to create link' });
    }
    res.json({ link: linkId });
  });
});

// Send an anonymous message
app.post('/send-message', (req, res) => {
  const { linkId, message } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Invalid message' });
  }
  db.get(`SELECT id FROM links WHERE id = ?`, [linkId], (err, row) => {
    if (err) {
      console.error('Error checking link:', err.message, err.stack);
      return res.status(500).json({ error: 'Server error' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Invalid link' });
    }
    db.run(`INSERT INTO messages (link_id, message) VALUES (?, ?)`, [linkId, message], (err) => {
      if (err) {
        console.error('Error sending message:', err.message, err.stack);
        return res.status(500).json({ error: 'Failed to send message' });
      }
      res.json({ success: true });
    });
  });
});

// Get messages
app.get('/messages/:linkId', (req, res) => {
  const { linkId } = req.params;
  db.get(`SELECT id FROM links WHERE id = ?`, [linkId], (err, row) => {
    if (err) {
      console.error('Error checking link existence:', err.message, err.stack);
      return res.status(500).json({ error: 'Server error' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Invalid link' });
    }
    db.all(`SELECT message, created_at FROM messages WHERE link_id = ? AND created_at >= datetime('now', '-3 days')`, [linkId], (err, rows) => {
      if (err) {
        console.error('Error fetching messages:', err.message, err.stack);
        return res.status(500).json({ error: 'Failed to fetch messages' });
      }
      res.json({ messages: rows });
    });
  });
});

// Serve the send message page
app.get('/send/:linkId', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'index.html');
  console.log(`Attempting to serve: ${filePath}`);
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error(`File not found: ${filePath}`, err.message, err.stack);
      return res.status(404).send('index.html not found');
    }
    res.sendFile(filePath);
  });
});

// Start server
const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`Server running on port ${port}`));

// Handle process termination
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Database close error:', err.message, err.stack);
    }
    console.log('Database connection closed.');
    process.exit(0);
  });
});
