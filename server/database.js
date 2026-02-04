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
        status TEXT,
        customerName TEXT,
        actionType TEXT,
        productCode TEXT,
        notes TEXT,
        photoUrl TEXT,
        newTrackingNumber TEXT,
        timestamp INTEGER NOT NULL,
        reportedBy TEXT
    )`, (err) => {
        if (!err) {
            // Migration: Check if newTrackingNumber column exists safely
            db.all("PRAGMA table_info(rts_reports)", (pragmaErr, columns) => {
                if (!pragmaErr && columns) {
                    const hasColumn = columns.some(col => col.name === 'newTrackingNumber');
                    if (!hasColumn) {
                        db.run("ALTER TABLE rts_reports ADD COLUMN newTrackingNumber TEXT", (alterErr) => {
                            if (alterErr) console.error("Migration warning:", alterErr.message);
                            else console.log("Migration: Added newTrackingNumber to rts_reports");
                        });
                    }

                    const hasProductCode = columns.some(col => col.name === 'productCode');
                    if (!hasProductCode) {
                        db.run("ALTER TABLE rts_reports ADD COLUMN productCode TEXT", (alterErr) => {
                            if (alterErr) console.error("Migration warning (productCode):", alterErr.message);
                            else console.log("Migration: Added productCode to rts_reports");
                        });
                    }
                }
            });
        }
    });

    // RTS Master Table (Spreadsheet Style)
    db.run(`CREATE TABLE IF NOT EXISTS rts_master (
        id TEXT PRIMARY KEY,
        shipmentId TEXT,
        dateCode TEXT,
        facebookName TEXT,
        customerName TEXT,
        customerAddress TEXT,
        customerPhone TEXT,
        pageCode TEXT,
        originalCod REAL DEFAULT 0,
        originalTt REAL DEFAULT 0,
        resendCod REAL DEFAULT 0,
        resendTt REAL DEFAULT 0,
        totalAmount REAL DEFAULT 0,
        followUpStatus TEXT,
        finalStatus TEXT,
        returnDate TEXT,
        monthYear TEXT,
        notes TEXT,
        product TEXT,
        isMatched BOOLEAN DEFAULT 0,
        updatedAt INTEGER
    )`, (err) => {
        if (!err) {
            // Migration: Check if product column exists
            db.all("PRAGMA table_info(rts_master)", (pragmaErr, columns) => {
                if (!pragmaErr && columns) {
                    const hasProduct = columns.some(col => col.name === 'product');
                    if (!hasProduct) {
                        db.run("ALTER TABLE rts_master ADD COLUMN product TEXT", (alterErr) => {
                            if (alterErr) console.error("Migration warning (rts_master product):", alterErr.message);
                            else console.log("Migration: Added product to rts_master");
                        });
                    }
                }
            });
        }
    });

    db.run(`CREATE TABLE IF NOT EXISTS analytics_data (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        data TEXT,
        timestamp INTEGER
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS verified_weight_anomalies (
        id TEXT PRIMARY KEY,
        trackingNumber TEXT UNIQUE,
        customerName TEXT,
        phoneNumber TEXT,
        weight REAL,
        normalWeight REAL,
        codAmount REAL,
        shippingCost REAL,
        expectedCost REAL,
        diff REAL,
        profit REAL,
        percentCost REAL,
        status TEXT,
        notes TEXT,
        timestamp INTEGER
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS cod_weight_rules (
        id TEXT PRIMARY KEY,
        codAmount REAL UNIQUE NOT NULL,
        minWeight REAL DEFAULT 0,
        maxWeight REAL DEFAULT 0,
        isActive BOOLEAN DEFAULT 1,
        updatedAt INTEGER
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        sku TEXT UNIQUE,
        name TEXT,
        type TEXT,
        size_code TEXT,
        width_cm REAL,
        height_cm REAL,
        width_inch REAL,
        height_inch REAL,
        conditions TEXT,
        updated_at INTEGER
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

    // Seed Standard Product Sizes
    db.get(`SELECT COUNT(*) as count FROM products`, (err, row) => {
        if (!err && row.count === 0) {
            const now = Date.now();
            const seeds = [
                { sku: 'SIZE-A0', name: 'Standard A0', type: 'Standard', size_code: 'A0', w_cm: 84.1, h_cm: 118.9, w_in: 33.1, h_in: 46.8 },
                { sku: 'SIZE-A1', name: 'Standard A1', type: 'Standard', size_code: 'A1', w_cm: 59.4, h_cm: 84.1, w_in: 23.4, h_in: 33.1 },
                { sku: 'SIZE-A2', name: 'Standard A2', type: 'Standard', size_code: 'A2', w_cm: 42.0, h_cm: 59.4, w_in: 16.5, h_in: 23.4 },
                { sku: 'SIZE-A3', name: 'Standard A3', type: 'Standard', size_code: 'A3', w_cm: 29.7, h_cm: 42.0, w_in: 11.7, h_in: 16.5 },
                { sku: 'SIZE-A4', name: 'Standard A4', type: 'Standard', size_code: 'A4', w_cm: 21.0, h_cm: 29.7, w_in: 8.3, h_in: 11.7 }
            ];

            const stmt = db.prepare(`INSERT INTO products (id, sku, name, type, size_code, width_cm, height_cm, width_inch, height_inch, conditions, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            seeds.forEach(s => {
                stmt.run(`seed-${s.size_code}`, s.sku, s.name, s.type, s.size_code, s.w_cm, s.h_cm, s.w_in, s.h_in, 'Standard Size', now);
            });
            stmt.finalize();
        }
    });
});

module.exports = db;
