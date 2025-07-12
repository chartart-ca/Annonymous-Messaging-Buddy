const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = express();
app.use(express.json());
app.use(cors()); // Enable CORS (though not strictly needed for same-origin)

// Serve static files (e.g., index.html)
app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Catch all unmatched routes and serve index.html for client-side routing
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Initialize or load database (in-memory with file backup)
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
    return res.status(500).send('Internal Server Error');
  }
  console.log('Database connected successfully');
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS links (id TEXT PRIMARY KEY)`);
    db.run(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, link_id TEXT, message TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  });
});

// Create a new anonymous link
app.post('/create-link', (req, res) => {
  const linkId = uuidv4();
  db.run(`INSERT INTO links (id) VALUES (?)`, [linkId], (err) => {
    if (err) {
      console.error('Error creating link:', err.message);
      return res.status(500).json({ error: 'Failed to create link' });
    }
    console.log(`Created link: ${linkId}`);
    res.json({ link: linkId });
  });
});

// Send an anonymous message
app.post('/send-message', (req, res) => {
  const { linkId, message } = req.body;
  if (!linkId || !message) {
    return res.status(400).json({ error: 'Missing linkId or message' });
  }
  db.get(`SELECT id FROM links WHERE id = ?`, [linkId], (err, row) => {
    if (err) {
      console.error('Database error:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Invalid link' });
    }
    db.run(`INSERT INTO messages (link_id, message) VALUES (?, ?)`, [linkId, message], (err) => {
      if (err) {
        console.error('Error sending message:', err.message);
        return res.status(500).json({ error: 'Failed to send message' });
      }
      console.log(`Message sent for link ${linkId}`);
      res.json({ success: true });
    });
  });
});

// Get messages for a link (only show messages from last 3 days)
app.get('/messages/:linkId', (req, res) => {
  const { linkId } = req.params;
  db.get(`SELECT id FROM links WHERE id = ?`, [linkId], (err, row) => {
    if (err) {
      console.error('Database error:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Invalid link' });
    }
    db.all(`SELECT message, created_at FROM messages WHERE link_id = ? AND created_at >= datetime('now', '-3 days')`, [linkId], (err, rows) => {
      if (err) {
        console.error('Error fetching messages:', err.message);
        return res.status(500).json({ error: 'Failed to fetch messages' });
      }
      console.log(`Fetched ${rows.length} messages for link ${linkId}`);
      res.json({ messages: rows });
    });
  });
});

// Serve the send message page (handled by frontend routing)
app.get('/send/:linkId', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => console.log(`Server running on port ${port}`));
