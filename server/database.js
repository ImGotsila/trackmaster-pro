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

    db.run(`CREATE TABLE IF NOT EXISTS shipments (
        id TEXT PRIMARY KEY,
        trackingNumber TEXT,
        courier TEXT,
        status TEXT,
        customerName TEXT,
        phoneNumber TEXT,
        zipCode TEXT,
        codAmount REAL,
        shippingCost REAL,
        importDate TEXT,
        importTime TEXT,
        timestamp INTEGER,
        raw_data TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        permissions TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS rts_reports (
        id TEXT PRIMARY KEY,
        trackingNumber TEXT NOT NULL,
        status TEXT NOT NULL,
        customerName TEXT,
        actionType TEXT, -- resend_original, new_production, cancelled
        notes TEXT,
        photoUrl TEXT,
        newTrackingNumber TEXT,
        timestamp INTEGER NOT NULL,
        reportedBy TEXT
    )`);

    // Seed Initial Data
    db.get(`SELECT COUNT(*) as count FROM users`, (err, row) => {
        if (!err && row.count === 0) {
            db.run(`INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)`,
                ['admin-init', 'admin', 'admin1234', 'admin']);
        }
    });

    db.get(`SELECT COUNT(*) as count FROM settings WHERE key = 'cod_fee'`, (err, row) => {
        if (!err && row.count === 0) {
            db.run(`INSERT INTO settings (key, value) VALUES (?, ?)`, ['cod_fee', '3']);
        }
    });
});

module.exports = db;
