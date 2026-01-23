const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Determine DB path (persistent data folder or local)
// In Docker, we will mount a volume to /app/data
const dbPath = process.env.DB_PATH || path.resolve(__dirname, 'trackmaster.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Could not connect to database', err);
    } else {
        console.log('Connected to SQLite database at', dbPath);
    }
});

// Initialize Tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS history_logs (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        details TEXT,
        status TEXT
    )`);
});

module.exports = db;
