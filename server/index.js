const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

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
