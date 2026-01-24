const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

const uploadBaseDir = process.env.DB_PATH ? path.dirname(process.env.DB_PATH) : __dirname;
const uploadDir = path.join(uploadBaseDir, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Configure Multer for photo uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
    }
});
const upload = multer({ storage });

// Serve uploaded photos
app.use('/uploads', express.static(uploadDir));

// API: Get History Logs
app.get('/api/history', (req, res) => {
    const limit = req.query.limit || 100;
    db.all(`SELECT * FROM history_logs ORDER BY timestamp DESC LIMIT ?`, [limit], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// API: Add History Log
app.post('/api/history', (req, res) => {
    const { id, action, details, status, timestamp } = req.body;
    const stmt = db.prepare(`INSERT INTO history_logs (id, action, timestamp, details, status) VALUES (?, ?, ?, ?, ?)`);

    stmt.run(id, action, timestamp, details, status, function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ success: true, id: this.lastID });
    });
    stmt.finalize();
});

// --- GOOGLE SHEETS PROXY API ---
const GS_URL = process.env.VITE_GOOGLE_SHEETS_SCRIPT_URL;

app.get('/api/gsheets/get', async (req, res) => {
    if (!GS_URL) return res.status(500).json({ error: 'GAS URL not configured on server' });
    try {
        const response = await fetch(`${GS_URL}?action=get`);
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('Proxy GET error:', err);
        res.status(502).json({ error: 'Failed to fetch from Google Sheets', details: err.message });
    }
});

app.post('/api/gsheets/save', async (req, res) => {
    if (!GS_URL) return res.status(500).json({ error: 'GAS URL not configured on server' });
    try {
        const response = await fetch(`${GS_URL}?action=save`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('Proxy SAVE error:', err);
        res.status(502).json({ error: 'Failed to save to Google Sheets', details: err.message });
    }
});

app.post('/api/gsheets/delete', async (req, res) => {
    if (!GS_URL) return res.status(500).json({ error: 'GAS URL not configured on server' });
    try {
        const response = await fetch(`${GS_URL}?action=delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('Proxy DELETE error:', err);
        res.status(502).json({ error: 'Failed to delete from Google Sheets', details: err.message });
    }
});

// API: Save Analytics (JSON File)
const analyticsPath = path.join(process.env.DB_PATH ? path.dirname(process.env.DB_PATH) : __dirname, 'analytics.json');

app.post('/api/analytics/save', (req, res) => {
    const data = req.body;
    try {
        fs.writeFileSync(analyticsPath, JSON.stringify(data, null, 2));
        res.json({ success: true, path: analyticsPath });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Get Analytics (JSON File)
app.get('/api/analytics/geo', (req, res) => {
    try {
        if (fs.existsSync(analyticsPath)) {
            const data = JSON.parse(fs.readFileSync(analyticsPath, 'utf8'));
            res.json(data);
        } else {
            res.json([]);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ADMIN & AUTH API ---

// API: Login (Simple for now, will enhance with hashing/JWT if needed)
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ? AND password = ?`, [username, password], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });

        const { password: _, ...userWithoutPassword } = user;
        res.json({ success: true, user: userWithoutPassword });
    });
});

// API: Get Settings
app.get('/api/settings', (req, res) => {
    db.all(`SELECT * FROM settings`, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const settings = {};
        rows.forEach(row => { settings[row.key] = row.value; });
        res.json(settings);
    });
});

// API: Update Setting
app.post('/api/settings', (req, res) => {
    const { key, value } = req.body;
    db.run(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, value.toString()], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

// API: Manage Users
app.get('/api/users', (req, res) => {
    db.all(`SELECT id, username, role, permissions FROM users`, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/users', (req, res) => {
    const { id, username, password, role } = req.body;
    db.run(`INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)`,
        [id || Date.now().toString(), username, password, role || 'user'], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

app.delete('/api/users/:id', (req, res) => {
    db.run(`DELETE FROM users WHERE id = ?`, [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- RTS & QUALITY CHECK API ---

// API: Save RTS Report
app.post('/api/rts', upload.single('photo'), (req, res) => {
    const {
        trackingNumber,
        status,
        customerName,
        actionType,
        notes,
        reportedBy
    } = req.body;

    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const id = uuidv4();
    const timestamp = Date.now();

    const stmt = db.prepare(`INSERT INTO rts_reports (id, trackingNumber, status, customerName, actionType, notes, photoUrl, timestamp, reportedBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    stmt.run(id, trackingNumber, status, customerName, actionType, notes, photoUrl, timestamp, reportedBy, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID, photoUrl });

        // Also log to history
        db.run(`INSERT INTO history_logs (id, action, timestamp, details, status) VALUES (?, ?, ?, ?, ?)`,
            [uuidv4(), 'rts_report', timestamp, `Reported RTS for ${trackingNumber}: ${status}`, 'success']);
    });
    stmt.finalize();
});

// API: Get RTS History
app.get('/api/rts', (req, res) => {
    db.all(`SELECT * FROM rts_reports ORDER BY timestamp DESC LIMIT 100`, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// API: Get RTS for specific tracking
app.get('/api/rts/:trackingNumber', (req, res) => {
    db.all(`SELECT * FROM rts_reports WHERE trackingNumber = ? ORDER BY timestamp DESC`, [req.params.trackingNumber], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Serve Frontend (Production)
// In Docker, we will copy 'dist' to 'public' or similar
const staticPath = path.join(__dirname, '../dist');
app.use(express.static(staticPath));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'TrackMaster API is running' });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});

// Fallback for SPA routing (if serving frontend locally)
app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API endpoints available at http://localhost:${PORT}/api`);
});
