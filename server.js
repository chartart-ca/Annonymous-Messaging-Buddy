const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const app = express();
app.use(express.json());

// Initialize SQLite database (in-memory for now; use Render's PostgreSQL for persistence)
const db = new sqlite3.Database(':memory:', (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
  } else {
    console.log('Database connected successfully');
  }
});
db.serialize(() => {
  db.run(`CREATE TABLE links (id TEXT PRIMARY KEY)`);
  db.run(`CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, link_id TEXT, message TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
});

// Create a new anonymous link
app.post('/create-link', (req, res) => {
  const linkId = uuidv4();
  db.run(`INSERT INTO links (id) VALUES (?)`, [linkId], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to create link' });
    }
    res.json({ link: linkId });
  });
});

// Send an anonymous message
app.post('/send-message', (req, res) => {
  const { linkId, message } = req.body;
  db.get(`SELECT id FROM links WHERE id = ?`, [linkId], (err, row) => {
    if (err || !row) {
      return res.status(404).json({ error: 'Invalid link' });
    }
    db.run(`INSERT INTO messages (link_id, message) VALUES (?, ?)`, [linkId, message], (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to send message' });
      }
      res.json({ success: true });
    });
  });
});

// Get messages for a link (only show messages from last 3 days)
app.get('/messages/:linkId', (req, res) => {
  const { linkId } = req.params;
  db.get(`SELECT id FROM links WHERE id = ?`, [linkId], (err, row) => {
    if (err || !row) {
      return res.status(404).json({ error: 'Invalid link' });
    }
    db.all(`SELECT message, created_at FROM messages WHERE link_id = ? AND created_at >= datetime('now', '-3 days')`, [linkId], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch messages' });
      }
      res.json({ messages: rows });
    });
  });
});

// Serve the send message page (optional, handled by frontend routing)
app.get('/send/:linkId', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
