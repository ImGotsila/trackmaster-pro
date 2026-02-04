const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');

const app = express();
// Load .env from root
const envPath = path.join(__dirname, '../.env');
const envResult = require('dotenv').config({ path: envPath });

if (envResult.error) {
    console.warn('Warning: Could not load .env file from', envPath);
} else {
    console.log('.env file loaded successfully from', envPath);
}

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// Root API Info
app.get('/api', (req, res) => {
    res.json({ status: 'ok', message: 'TrackMaster Pro API', version: '1.0.0' });
});

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
// --- GOOGLE SHEETS PROXY API ---
let GS_URL = process.env.VITE_GOOGLE_SHEETS_SCRIPT_URL;

// Auto-fix: Remove /u/1/ or similar specific-user paths from URL to make it universal
if (GS_URL) {
    GS_URL = GS_URL.replace(/\/u\/\d+\//, '/');
}

app.get('/api/gsheets/get', async (req, res) => {
    if (!GS_URL) {
        console.error('Proxy Error: VITE_GOOGLE_SHEETS_SCRIPT_URL is not defined in server environment');
        return res.status(500).json({ error: 'GAS URL not configured on server' });
    }
    try {
        console.log('Proxying GET to GAS:', GS_URL);

        // Add 60s timeout for large datasets
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);

        const response = await fetch(`${GS_URL}?action=get`, { signal: controller.signal });
        clearTimeout(timeout);

        console.log('GAS response status:', response.status);

        if (!response.ok) {
            throw new Error(`GAS responded with ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`[Proxy] Received ${data?.data?.length || 0} items from GAS`);
        res.json(data);
    } catch (err) {
        console.error('Proxy GET error:', err);
        if (err.name === 'AbortError') {
            res.status(504).json({ error: 'Timeout fetching from Google Sheets (60s limit)' });
        } else {
            res.status(502).json({ error: 'Failed to fetch from Google Sheets', details: err.message });
        }
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

// --- WEIGHT RULES API ---
app.get('/api/weight-rules', (req, res) => {
    db.all('SELECT * FROM cod_weight_rules WHERE isActive = 1', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/weight-rules', (req, res) => {
    const { codAmount, minWeight, maxWeight } = req.body;
    const id = `rule-${codAmount}`;
    const timestamp = Date.now();

    db.run(`INSERT INTO cod_weight_rules (id, codAmount, minWeight, maxWeight, isActive, updatedAt)
            VALUES (?, ?, ?, ?, 1, ?)
            ON CONFLICT(codAmount) DO UPDATE SET
            minWeight = excluded.minWeight,
            maxWeight = excluded.maxWeight,
            updatedAt = excluded.updatedAt,
            isActive = 1`,
        [id, codAmount, minWeight, maxWeight, timestamp],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: id });
        });
});

// --- ANALYTICS DATABASE STORAGE ---
app.post('/api/analytics', (req, res) => {
    const data = JSON.stringify(req.body);
    const timestamp = Date.now();

    db.run(`INSERT INTO analytics_data (id, type, data, timestamp) 
            VALUES (?, ?, ?, ?)`,
        [uuidv4(), 'daily_summary', data, timestamp],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

app.get('/api/analytics', (req, res) => {
    db.get(`SELECT data FROM analytics_data ORDER BY timestamp DESC LIMIT 1`, (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.json(null);
        try {
            res.json(JSON.parse(row.data));
        } catch (e) {
            res.status(500).json({ error: 'Data corruption' });
        }
    });
});

// Alias for Cost Analytics Page
app.get('/api/analytics/geo', (req, res) => {
    db.get(`SELECT data FROM analytics_data ORDER BY timestamp DESC LIMIT 1`, (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.json(null);
        try {
            res.json(JSON.parse(row.data));
        } catch (e) {
            res.status(500).json({ error: 'Data corruption' });
        }
    });
});

// API: Get Shipping Cost Anomalies (From Database)
app.get('/api/analytics/shipping-anomalies', (req, res) => {
    const { startDate, endDate, minDiff, profitThreshold, costRatioThreshold, showAll } = req.query;

    // Query from pre-analyzed shipping_anomalies table
    let sql = `SELECT * FROM shipping_anomalies`;
    let params = [];
    let whereClauses = [];

    // Filter by date if provided
    if (startDate && endDate) {
        const startTs = new Date(startDate).getTime();
        const endTs = new Date(endDate).getTime() + 86399999;
        whereClauses.push("timestamp BETWEEN ? AND ?");
        params.push(startTs, endTs);
    }

    // Filter by minimum difference
    if (minDiff && parseFloat(minDiff) > 0) {
        whereClauses.push("diff >= ?");
        params.push(parseFloat(minDiff));
    }

    // Filter by profit threshold
    if (profitThreshold != null && profitThreshold !== '') {
        whereClauses.push("profit < ?");
        params.push(parseFloat(profitThreshold));
    }

    // Filter by cost ratio threshold  
    if (costRatioThreshold && parseFloat(costRatioThreshold) > 0) {
        whereClauses.push("costPercent > ?");
        params.push(parseFloat(costRatioThreshold));
    }

    if (whereClauses.length > 0) {
        sql += " WHERE " + whereClauses.join(" AND ");
    }

    console.log("Fetching anomalies with SQL:", sql, params);

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('Database error fetching shipping anomalies:', err);
            return res.status(500).json({ error: err.message });
        }

        // Transform to match frontend format
        const anomalies = rows.map(row => ({
            id: row.id,
            tracking: row.trackingNumber,
            name: row.customerName,
            phone: row.phoneNumber,
            cost: row.shippingCost,
            codAmount: row.codAmount,
            profit: row.profit,
            costPercent: row.costPercent,
            weight: row.weight,
            expectedCost: row.expectedCost,
            diff: row.diff,
            anomalyType: row.anomalyType,
            date: row.importDate,
            timestamp: row.timestamp
        }));

        // Apply text filters
        let filtered = anomalies.filter(item => {
            return Object.keys(req.query).every(key => {
                if (!key.startsWith('filter_')) return true;
                const field = key.replace('filter_', '');
                const filterValue = req.query[key].toLowerCase();
                if (!filterValue) return true;
                const itemValue = item[field];
                return itemValue != null && String(itemValue).toLowerCase().includes(filterValue);
            });
        });

        // Apply sorting
        const sortBy = req.query.sortBy || 'profit';
        const sortDir = req.query.sortDir === 'desc' ? -1 : 1;

        filtered.sort((a, b) => {
            const valA = a[sortBy];
            const valB = b[sortBy];
            if (valA < valB) return -1 * sortDir;
            if (valA > valB) return 1 * sortDir;
            return 0;
        });

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const startIdx = (page - 1) * limit;
        const endIdx = startIdx + limit;
        const paginatedData = filtered.slice(startIdx, endIdx);

        res.json({
            success: true,
            stats: {
                totalScanned: rows.length,
                validRecords: rows.length,
                anomaliesFound: filtered.length,
                filteredCount: filtered.length,
                totalRefundPotential: filtered.reduce((sum, a) => sum + (a.diff > 0 ? a.diff : 0), 0),
                standardCosts: {}
            },
            data: paginatedData,
            pagination: {
                current: page,
                total: Math.ceil(filtered.length / limit),
                totalItems: filtered.length
            }
        });
    });
});
if (err) {
    console.error('Database error fetching shipping anomalies:', err);
    return res.status(500).json({ error: err.message });
}

const data = [];

// Extract valid data from database
rows.forEach(row => {
    let weight = null;
    let phone = null;

    if (row.raw_data) {
        try {
            const parsed = JSON.parse(row.raw_data);
            weight = parsed.weight;
            phone = parsed.phone || parsed.phoneNumber;  // Support both field names
        } catch (e) {
            console.warn(`Could not parse raw_data for shipment ${row.id}:`, e);
        }
    }

    if (row.shippingCost != null && weight != null) {
        const cod = row.codAmount || 0;
        if (cod <= 0) return; // Only COD orders

        const cost = parseFloat(row.shippingCost);
        const profit = cod - cost;
        const costPercent = cod > 0 ? (cost / cod) * 100 : 0;

        data.push({
            id: row.id,
            tracking: row.trackingNumber,
            name: row.customerName,
            phone: phone || '-',
            cost: cost,
            codAmount: cod,
            profit: profit,
            costPercent: parseFloat(costPercent.toFixed(2)),
            weight: parseFloat(weight),
            timestamp: row.timestamp,
            date: new Date(row.timestamp).toISOString().split('T')[0]
        });
    }
});

// 2. Calculate Mode Cost per Weight (The "Standard")
const weightGroups = {};
data.forEach(item => {
    if (!weightGroups[item.weight]) weightGroups[item.weight] = [];
    weightGroups[item.weight].push(item.cost);
});

const standardCosts = {};
Object.keys(weightGroups).forEach(w => {
    const costs = weightGroups[w];
    const frequency = {};
    let maxFreq = 0;
    let modeCost = costs[0];

    costs.forEach(c => {
        frequency[c] = (frequency[c] || 0) + 1;
        if (frequency[c] > maxFreq) {
            maxFreq = frequency[c];
            modeCost = c;
        }
    });
    standardCosts[w] = modeCost;
});

// 3. Identify Anomalies (Global Calculation)
const allResults = [];
let trueAnomalyCount = 0; // Track actual anomalies independent of showAll
const isShowAll = req.query.showAll === 'true';

// Dynamic Thresholds
const profitThreshold = parseFloat(req.query.profitThreshold) || 0; // Default 0
const costRatioThreshold = parseFloat(req.query.costRatioThreshold) || 20; // Default 20%

data.forEach(d => {
    const expected = standardCosts[d.weight]; // Mode cost for this weight
    const isCostMismatch = d.cost !== expected;
    const isNegativeProfit = d.profit < profitThreshold;
    const isHighRatio = d.costPercent > costRatioThreshold; // e.g. Shipping is > 50% of COD
    const isAnomaly = isNegativeProfit || isHighRatio || isCostMismatch;

    if (isAnomaly) trueAnomalyCount++;

    if (isShowAll || isAnomaly) {
        let type = 'normal';
        if (isNegativeProfit) type = 'negative_profit';
        else if (isHighRatio) type = 'high_ratio';
        else if (isCostMismatch) type = 'mismatch';

        allResults.push({
            ...d,
            expectedCost: expected,
            diff: d.cost - expected,
            anomalyType: type
        });
    }
});

// 4. Server-Side Filtering
console.log('[DEBUG] Query params:', req.query);
console.log('[DEBUG] Data before filter:', data.length, 'records');

let filtered = allResults.filter(item => {
    // 4.1 Check Range Filters (min_X, max_X)
    const rangeCheck = Object.keys(req.query).every(key => {
        if (key.startsWith('min_')) {
            const field = key.replace('min_', '');
            const val = parseFloat(req.query[key]);
            if (isNaN(val)) return true;
            return item[field] >= val;
        }
        if (key.startsWith('max_')) {
            const field = key.replace('max_', '');
            const val = parseFloat(req.query[key]);
            if (isNaN(val)) return true;
            return item[field] <= val;
        }
        return true;
    });
    if (!rangeCheck) return false;

    // 4.2 Check Text Filters (filter_X)
    const textCheck = Object.keys(req.query).every(key => {
        if (!key.startsWith('filter_')) return true;
        const field = key.replace('filter_', '');
        const filterValue = req.query[key].toLowerCase();
        if (!filterValue) return true;

        const itemValue = item[field];
        return itemValue != null && String(itemValue).toLowerCase().includes(filterValue);
    });
    if (!textCheck) return false;

    // 4.3 Check Minimum Difference Filter
    const minDiff = parseFloat(req.query.minDiff);
    if (!isNaN(minDiff) && minDiff > 0) {
        // Only show items where diff >= minDiff (overcharged amounts)
        if (item.diff < minDiff) return false;
    }

    return true;
});

// 5. Server-Side Sorting
const sortBy = req.query.sortBy || 'profit'; // Default to profit to show losses
const sortDir = req.query.sortDir === 'desc' ? -1 : 1;

filtered.sort((a, b) => {
    // Special sort for severity if default
    if (req.query.sortBy === undefined) {
        const scoreA = a.anomalyType === 'negative_profit' ? 2 : (a.anomalyType === 'high_ratio' ? 1 : 0);
        const scoreB = b.anomalyType === 'negative_profit' ? 2 : (b.anomalyType === 'high_ratio' ? 1 : 0);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return a.profit - b.profit;
    }

    const valA = a[sortBy];
    const valB = b[sortBy];
    if (valA < valB) return -1 * sortDir;
    if (valA > valB) return 1 * sortDir;
    return 0;
});

// 6. Stats Calculation (Filtered)
// User requested to ignore refund calculation for now (as +20 is often remote area fee)
const validRefunds = 0; // filtered.reduce((acc, curr) => acc + (curr.diff > 0 ? curr.diff : 0), 0);

// 7. Handle Export vs Pagination
if (req.query.export === 'true') {
    // Generate CSV
    const headers = "Tracking,Date,Customer,Weight,COD,Profit,%Cost,Charged,Expected,Diff,Status\n";
    const csvRows = filtered.map(a => {
        let status = 'Normal';
        if (a.anomalyType === 'negative_profit') status = 'CRITICAL LOSS';
        else if (a.anomalyType === 'high_ratio') status = 'High Cost %';
        else if (a.anomalyType === 'mismatch') status = 'Refund Request';

        return `"${a.tracking}","${a.date}","${a.name}",${a.weight},${a.codAmount},${a.profit},${a.costPercent}%,${a.cost},${a.expectedCost},${a.diff},"${status}"`;
    }).join("\n");

    res.header('Content-Type', 'text/csv');
    res.attachment(`shipping_analysis_${new Date().toISOString().split('T')[0]}.csv`);
    return res.send(headers + csvRows);
}

// Pagination
const page = parseInt(req.query.page) || 1;
const limit = parseInt(req.query.limit) || 50;
const startIndex = (page - 1) * limit;
const endIndex = startIndex + limit;
const paginatedResults = filtered.slice(startIndex, endIndex);

res.json({
    success: true,
    stats: {
        totalScanned: rows.length,
        validRecords: data.length,
        anomaliesFound: trueAnomalyCount, // Use the correct filtered count
        filteredCount: filtered.length, // Count after filters applied
        totalRefundPotential: validRefunds,
        standardCosts
    },
    data: paginatedResults,
    pagination: {
        current: page,
        total: Math.ceil(filtered.length / limit),
        totalItems: filtered.length
    },
    standardCosts
});
    });
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

// --- PRODUCTS API --- (NEW)
app.get('/api/products', (req, res) => {
    db.all(`SELECT * FROM products ORDER BY updated_at DESC`, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/products', (req, res) => {
    const { sku, name, type, size_code, width_cm, height_cm, width_inch, height_inch, conditions } = req.body;
    const id = uuidv4();
    const now = Date.now();

    const stmt = db.prepare(`INSERT INTO products (id, sku, name, type, size_code, width_cm, height_cm, width_inch, height_inch, conditions, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    stmt.run(id, sku, name, type, size_code, width_cm, height_cm, width_inch, height_inch, conditions, now, function (err) {
        if (err) {
            // Check for unique constraint violation (SKU)
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'SKU already exists' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, id });
    });
    stmt.finalize();
});

app.put('/api/products/:id', (req, res) => {
    const { sku, name, type, size_code, width_cm, height_cm, width_inch, height_inch, conditions } = req.body;
    const now = Date.now();
    const id = req.params.id;

    const stmt = db.prepare(`UPDATE products SET sku=?, name=?, type=?, size_code=?, width_cm=?, height_cm=?, width_inch=?, height_inch=?, conditions=?, updated_at=? WHERE id=?`);
    stmt.run(sku, name, type, size_code, width_cm, height_cm, width_inch, height_inch, conditions, now, id, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
    stmt.finalize();
});

app.delete('/api/products/:id', (req, res) => {
    db.run(`DELETE FROM products WHERE id = ?`, [req.params.id], (err) => {
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
        productCode,
        notes,
        reportedBy,
        newTrackingNumber
    } = req.body;

    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const id = uuidv4();
    const timestamp = Date.now();

    const stmt = db.prepare(`INSERT INTO rts_reports (id, trackingNumber, status, customerName, actionType, productCode, notes, photoUrl, newTrackingNumber, timestamp, reportedBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    stmt.run(id, trackingNumber, status, customerName, actionType, productCode, notes, photoUrl, newTrackingNumber, timestamp, reportedBy, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID, photoUrl });

        // Also log to history
        db.run(`INSERT INTO history_logs (id, action, timestamp, details, status) VALUES (?, ?, ?, ?, ?)`,
            [uuidv4(), 'rts_report', timestamp, `Reported RTS for ${trackingNumber} (${actionType}): ${status}`, 'success']);
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

// --- RTS MASTER API (Spreadsheet Style) ---

// API: Get RTS Master Records (Filtered by Month)
app.get('/api/rts/master', (req, res) => {
    const { month } = req.query;
    let sql = "SELECT * FROM rts_master";
    let params = [];

    if (month && month !== 'all') {
        sql += " WHERE monthYear = ?";
        params.push(month);
    }

    sql += " ORDER BY updatedAt DESC, id ASC";

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('[RTS] Fetch Error:', err);
            return res.status(500).json({ error: err.message });
        }
        console.log(`[RTS] Found ${rows.length} records`);
        res.json(rows);
    });
});

// API: Import/Upsert RTS Master Records
app.post('/api/rts/import', (req, res) => {
    const { records, monthYear } = req.body;
    if (!records || !Array.isArray(records)) {
        return res.status(400).json({ error: 'Invalid records format' });
    }

    const timestamp = Date.now();
    let successCount = 0;

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        const stmt = db.prepare(`INSERT INTO rts_master (
            id, shipmentId, dateCode, facebookName, customerName, customerAddress, customerPhone, 
            pageCode, originalCod, originalTt, resendCod, resendTt, totalAmount, 
            followUpStatus, finalStatus, monthYear, notes, product, isMatched, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET 
            shipmentId=excluded.shipmentId,
            facebookName=excluded.facebookName,
            customerAddress=excluded.customerAddress,
            customerPhone=excluded.customerPhone,
            pageCode=excluded.pageCode,
            originalCod=excluded.originalCod,
            originalTt=excluded.originalTt,
            resendCod=excluded.resendCod,
            resendTt=excluded.resendTt,
            totalAmount=excluded.totalAmount,
            followUpStatus=excluded.followUpStatus,
            finalStatus=excluded.finalStatus,
            monthYear=excluded.monthYear,
            notes=excluded.notes,
            product=excluded.product,
            updatedAt=excluded.updatedAt,
            isMatched=excluded.isMatched
        `);

        records.forEach(r => {
            stmt.run(
                r.id, r.shipmentId || null, r.dateCode, r.facebookName, r.customerName, r.customerAddress, r.customerPhone,
                r.pageCode, r.originalCod || 0, r.originalTt || 0, r.resendCod || 0, r.resendTt || 0, r.totalAmount || 0,
                r.followUpStatus, r.finalStatus, monthYear, r.notes, r.product || '', r.isMatched ? 1 : 0, timestamp
            );
            successCount++;
        });

        stmt.finalize((err) => {
            if (err) {
                console.error("Import Error:", err);
                db.run("ROLLBACK");
                return res.status(500).json({ error: err.message });
            }
            db.run("COMMIT");
            res.json({ success: true, count: successCount });
        });
    });
});

// API: Manual Add RTS Record
app.post('/api/rts/manual', (req, res) => {
    const { id, facebookName, customerPhone, product, notes, monthYear } = req.body;

    if (!id || !facebookName) {
        return res.status(400).json({ error: 'ID and Name are required' });
    }

    const timestamp = Date.now();
    // Simple insert, defaulting other fields
    const sql = `INSERT INTO rts_master (
        id, facebookName, customerPhone, product, notes, monthYear, 
        finalStatus, followUpStatus, updatedAt, isMatched
    ) VALUES (?, ?, ?, ?, ?, ?, 'รอการแก้ไข', '-', ?, 0)`;

    db.run(sql, [id, facebookName, customerPhone || '', product || '', notes || '', monthYear || '', timestamp], function (err) {
        if (err) {
            console.error("Manual Add Error:", err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, id: id });
    });
});

// API: Update RTS Master Record (Inline Edit)
app.patch('/api/rts/master/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const allowed = ['followUpStatus', 'finalStatus', 'resendCod', 'resendTt', 'notes', 'isMatched', 'customerName', 'product'];

    const fields = Object.keys(updates).filter(k => allowed.includes(k));
    if (fields.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    const setClause = fields.map(k => `${k} = ?`).join(', ');
    const values = fields.map(k => updates[k]);
    values.push(Date.now(), id);

    db.run(`UPDATE rts_master SET ${setClause}, updatedAt = ? WHERE id = ?`, values, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
    });
});

// API: Delete RTS Record
app.delete('/api/rts/master/:id', (req, res) => {
    db.run(`DELETE FROM rts_master WHERE id = ?`, [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// API: Upload & Check RTS Import File (Server-Side Processing)
const xlsx = require('xlsx');
app.post('/api/rts/upload-check', upload.single('file'), (req, res) => {
    console.log('[RTS] Upload check requested');
    if (!req.file) {
        console.error('[RTS] No file uploaded');
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        console.log(`[RTS] File uploaded: ${req.file.path} (${req.file.size} bytes)`);

        let wb;
        try {
            // Force Codepage 874 (Thai/Windows-874) for legacy CSVs
            wb = xlsx.readFile(req.file.path, { type: 'file', codepage: 874 });
        } catch (readErr) {
            console.error('[RTS] XLSX Read Error:', readErr);
            throw new Error(`Failed to read Excel file: ${readErr.message}`);
        }

        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = xlsx.utils.sheet_to_json(ws, { header: 1 });
        console.log(`[RTS] Sheet parsed, rows: ${jsonData.length}`);

        // Clean up uploaded file
        try { fs.unlinkSync(req.file.path); } catch (e) { console.warn('Failed to delete temp file', e); }

        const parsed = [];
        // Header detection
        let headerRowIndex = jsonData.findIndex(row => row && row.some(cell => typeof cell === 'string' && cell.includes('วันที่')));
        if (headerRowIndex === -1) headerRowIndex = 0; // Fallback to 0 if not found

        // Fetch all shipments for matching
        console.log('[RTS] Fetching shipments for matching...');
        db.all("SELECT id, phoneNumber, customerName FROM shipments", (err, shipments) => {
            if (err) {
                console.error('[RTS] DB Error:', err);
                return res.status(500).json({ error: "DB Error: " + err.message });
            }
            console.log(`[RTS] Found ${shipments.length} shipments to match against`);

            // Build lookup map for speed
            const phoneMap = new Map();
            shipments.forEach(s => {
                if (s.phoneNumber) {
                    const clean = s.phoneNumber.replace(/\D/g, '');
                    if (clean.length > 6) {
                        const suffix = clean.slice(-7);
                        if (!phoneMap.has(suffix)) phoneMap.set(suffix, []);
                        phoneMap.get(suffix).push(s);
                    }
                }
            });

            for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (!row || row.length === 0) continue;

                const rawId = row[0];
                const rawName = row[1];
                const idWithDate = rawId ? rawId.toString() : `UNKNOWN-${i}`;
                const rawPhone = row[3] ? row[3].toString() : '';

                // --- FILTER: Strict Data Quality ---
                // 1. Skip if ID is missing
                if (!rawId || rawId.toString().trim() === '') continue;
                // 2. Skip if Name (Facebook) is missing
                if (!rawName || rawName.toString().trim() === '') continue;
                // 3. Skip if header or no phone
                if (rawPhone.includes('เบอร์โทร') || rawPhone.includes('telephone')) continue;
                if (!rawPhone || rawPhone.trim() === '' || rawPhone.replace(/\D/g, '').length < 8) {
                    continue; // Skip invalid row
                }

                // --- ROBUST PHONE LOGIC (BACKEND) ---
                const cleanDigits = rawPhone.replace(/\D/g, ' ');
                let candidates = cleanDigits.split(' ').filter(s => s.length >= 9 && s.length <= 10);

                // Regex Fallback
                const regex = /0\d{8,9}/g;
                const regexMatches = rawPhone.replace(/\D/g, '').match(regex);
                if (regexMatches) candidates = [...new Set([...candidates, ...regexMatches])];

                // Check for missing leading 0
                candidates = candidates.map(c => {
                    if (c.length === 9 && !c.startsWith('0')) return '0' + c;
                    return c;
                });
                const tightStr = rawPhone.replace(/\D/g, '');
                if (tightStr.length === 9 && !tightStr.startsWith('0')) {
                    candidates.push('0' + tightStr);
                }

                let matchedShipment = null;
                let finalPhone = candidates[0] || rawPhone;

                // Match against DB
                for (const cand of candidates) {
                    const suffix = cand.slice(-7);
                    if (phoneMap.has(suffix)) {
                        const potential = phoneMap.get(suffix);
                        const exact = potential.find(s => s.phoneNumber.replace(/\D/g, '').includes(cand) || ('0' + s.phoneNumber.replace(/\D/g, '')).includes(cand));
                        matchedShipment = exact || potential[0];
                        finalPhone = cand;
                        if (matchedShipment) break;
                    }
                }

                parsed.push({
                    id: idWithDate,
                    shipmentId: matchedShipment ? matchedShipment.id : null,
                    dateCode: idWithDate.split('-')[0] || '01',
                    facebookName: row[1]?.toString() || '',
                    customerName: matchedShipment ? matchedShipment.customerName : 'Unknown', // Use DB name if matched
                    customerAddress: row[2]?.toString() || '',
                    customerPhone: finalPhone,
                    resendCod: parseFloat(row[4]) || 0,
                    resendTt: parseFloat(row[5]) || 0,
                    originalCod: parseFloat(row[6]) || 0,
                    originalTt: parseFloat(row[7]) || 0,
                    totalAmount: 0,
                    followUpStatus: row[9]?.toString() || '-',
                    finalStatus: row[10]?.toString() || 'รอการแก้ไข',
                    pageCode: row[11]?.toString() || '-',
                    monthYear: '',
                    notes: row[12]?.toString() || '',
                    isMatched: !!matchedShipment
                });
            }

            console.log(`[RTS] Processed ${parsed.length} records. Sending response...`);
            res.json({ success: true, records: parsed });
        });

    } catch (e) {
        if (req.file) try { fs.unlinkSync(req.file.path); } catch (ex) { }
        console.error("[RTS] Parse Critical Error:", e);
        res.status(500).json({ error: "File Parse Critical Error: " + e.message });
    }
});

// Serve Frontend (Production)
// In Docker, we will copy 'dist' to 'public' or similar
const staticPath = path.join(__dirname, '../dist');
app.use(express.static(staticPath));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'TrackMaster API is running' });
});

// --- SYNC & BACKUP SERVICES ---
const syncService = require('./services/SyncService');
const backupService = require('./services/BackupService');

// API: Trigger Sync from Google Sheets
app.post('/api/sync/sheets', async (req, res) => {
    try {
        const result = await syncService.syncFromSheets();
        res.json({ success: true, ...result });
    } catch (err) {
        console.error('Sync Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Trigger Database Backup
app.post('/api/backup', async (req, res) => {
    try {
        const result = await backupService.createBackup();
        res.json(result);
    } catch (err) {
        console.error('Backup Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: List Backups
app.get('/api/backups', (req, res) => {
    const backups = backupService.getBackups();
    res.json(backups);
});

// --- VERIFIED WEIGHT ANOMALIES API ---

// API: Save Verified Anomaly
app.post('/api/weight-verification', (req, res) => {
    const data = req.body;
    const id = uuidv4();
    const timestamp = Date.now();

    const stmt = db.prepare(`INSERT INTO verified_weight_anomalies (
        id, trackingNumber, customerName, phoneNumber, weight, normalWeight, 
        codAmount, shippingCost, expectedCost, diff, profit, percentCost, 
        status, notes, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(trackingNumber) DO UPDATE SET
        weight=excluded.weight,
        status=excluded.status,
        notes=excluded.notes,
        timestamp=excluded.timestamp
    `);

    stmt.run(
        id, data.trackingNumber, data.customerName, data.phoneNumber, data.weight, data.normalWeight,
        data.codAmount, data.shippingCost, data.expectedCost, data.diff, data.profit, data.percentCost,
        data.status || 'Verified', data.notes, timestamp,
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID || id });
        }
    );
    stmt.finalize();
});

// API: Get Verified Anomalies
app.get('/api/weight-verification', (req, res) => {
    db.all("SELECT * FROM verified_weight_anomalies ORDER BY timestamp DESC", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// API: Delete Verified Anomaly
app.delete('/api/weight-verification/:id', (req, res) => {
    db.run("DELETE FROM verified_weight_anomalies WHERE id = ?", [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Register report generation endpoint (BEFORE app.listen)
require('./generate-report')(app, db);
require('./weight-analysis')(app, db);

// 404 handler for API routes (MUST BE LAST API ROUTE)
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});



// Fallback for SPA routing (if serving frontend locally)
app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
});

// Start server
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API endpoints available at http://localhost:${PORT}/api`);
});

module.exports = server;
