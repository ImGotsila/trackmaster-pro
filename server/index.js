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

// API: Run Full Analysis (Trigger analyze_shipping.cjs)
app.post('/api/analytics/run', (req, res) => {
    console.log('🚀 Triggering manual analysis...');
    const scriptPath = path.join(__dirname, 'analyze_shipping.cjs');

    // Use node executable from environment or default 'node'
    require('child_process').exec(`node "${scriptPath}"`, {
        env: { ...process.env } // Ensure env vars like DB_PATH are passed
    }, (error, stdout, stderr) => {
        if (error) {
            console.error(`Analysis exec error: ${error}`);
            return res.status(500).json({ error: error.message, details: stderr });
        }
        console.log(`Analysis stdout: ${stdout}`);
        if (stderr) console.error(`Analysis stderr: ${stderr}`);

        res.json({ success: true, message: 'Analysis complete', log: stdout });
    });
});

// API: Run Full Analysis (Trigger analyze_shipping.cjs)
app.post('/api/analytics/run', (req, res) => {
    console.log('🚀 Triggering manual analysis...');
    const scriptPath = path.join(__dirname, 'analyze_shipping.cjs');

    // Use node executable from environment or default 'node'
    require('child_process').exec(`node "${scriptPath}"`, {
        env: { ...process.env } // Ensure env vars like DB_PATH are passed
    }, (error, stdout, stderr) => {
        if (error) {
            console.error(`Analysis exec error: ${error}`);
            return res.status(500).json({ error: error.message, details: stderr });
        }
        console.log(`Analysis stdout: ${stdout}`);
        if (stderr) console.error(`Analysis stderr: ${stderr}`);

        res.json({ success: true, message: 'Analysis complete', log: stdout });
    });
});

// API: Get Shipping Cost Anomalies (Dynamic Analysis)
app.get('/api/analytics/shipping-anomalies', (req, res) => {
    const { startDate, endDate, minDiff, profitThreshold, costRatioThreshold, showAll } = req.query;

    // 1. Fetch Weight Rules
    db.all("SELECT * FROM cod_weight_rules WHERE isActive = 1", (err, rules) => {
        if (err) return res.status(500).json({ error: err.message });

        const ruleMap = {};
        if (rules) {
            rules.forEach(r => {
                ruleMap[r.codAmount] = r;
            });
        }

        // 2. Build Query
        let sql = `SELECT id, trackingNumber, shippingCost, codAmount, raw_data, customerName, phoneNumber, zipCode, importDate, timestamp FROM shipments WHERE codAmount > 0`;
        let params = [];

        // Filter by date (optimization: filter at DB level for date)
        if (startDate && endDate) {
            const startTs = new Date(startDate).getTime();
            const endTs = new Date(endDate).getTime() + 86399999;
            sql += " AND timestamp BETWEEN ? AND ?";
            params.push(startTs, endTs);
        }

        // 3. Fetch Shipments
        db.all(sql, params, (err, rows) => {
            if (err) {
                console.error('Database error fetching shipments:', err);
                return res.status(500).json({ error: err.message });
            }

            // 4. Group & Analyze
            const codGroups = {};
            const itemData = [];

            // A. Pre-process and Group
            rows.forEach(row => {
                if (row.shippingCost == null || row.codAmount == null) return;

                let weight = null;
                // Parse weight from raw_data
                if (row.raw_data) {
                    try {
                        const parsed = JSON.parse(row.raw_data);
                        weight = parseFloat(parsed.weight);

                        // Fallback for missing phone number
                        if (!row.phoneNumber) {
                            // Common fields in raw data: phone, tel, receiver_phone, etc.
                            // Assuming 'phone' or 'tel' based on standard schema, but checking multiple
                            row.phoneNumber = parsed.phone || parsed.tel || parsed.phoneNumber || parsed.receiver_phone || '';
                        }
                    } catch (e) { }
                }

                if (weight == null || isNaN(weight)) return;

                const item = {
                    id: row.id,
                    tracking: row.trackingNumber,
                    name: row.customerName,
                    phone: row.phoneNumber,
                    cost: parseFloat(row.shippingCost),
                    cod: parseFloat(row.codAmount),
                    weight: weight,
                    date: row.importDate,
                    timestamp: row.timestamp
                };

                itemData.push(item);

                // Add to groups for mode calculation
                if (!codGroups[item.cod]) {
                    codGroups[item.cod] = { weights: {} };
                }
                const w = item.weight;
                codGroups[item.cod].weights[w] = (codGroups[item.cod].weights[w] || 0) + 1;
            });

            // B. Determine Valid Ranges per COD Group
            const codRanges = {};
            Object.keys(codGroups).forEach(codKey => {
                const cod = parseFloat(codKey);
                const group = codGroups[codKey];

                // Check for custom rule first
                if (ruleMap[cod]) {
                    codRanges[cod] = {
                        min: ruleMap[cod].minWeight,
                        max: ruleMap[cod].maxWeight,
                        isRule: true
                    };
                } else {
                    // Auto-detect mode
                    let modeWeight = 0;
                    let maxCount = 0;
                    Object.keys(group.weights).forEach(w => {
                        if (group.weights[w] > maxCount) {
                            maxCount = group.weights[w];
                            modeWeight = parseFloat(w);
                        }
                    });

                    // Default logic: Mode +/- small buffer ? Or just Mode?
                    // Matching WeightAnalysisPage logic which likely highlights anything != mode if no rule
                    // But for "Anomalies List" usually we want strict deviation.
                    // Let's assume Valid = Mode Weight if no rule.
                    codRanges[cod] = {
                        min: modeWeight,
                        max: modeWeight,
                        isRule: false,
                        mode: modeWeight
                    };
                }
            });

            // C. Detect Anomalies
            const timestampThreshold = Date.now(); // For "New" flag if needed
            let allAnomalies = [];

            itemData.forEach(item => {
                const range = codRanges[item.cod];
                if (!range) return; // Should not happen

                const isWeightAnomaly = item.weight < range.min || item.weight > range.max;
                const profit = item.cod - item.cost;
                const costPercent = item.cod ? parseFloat(((item.cost / item.cod) * 100).toFixed(2)) : 0;

                // Calculate "Expected Cost" - rudimentary logic:
                // If weight is wrong, what *should* the cost be? Hard to know without Cost Rules.
                // But usually we just track deviations.
                // Let's define "Expected Cost" as the cost of the Mode Weight for now? 
                // Or mostly we care about Weight Anomalies causing profit loss.

                const diff = (item.weight - (range.isRule ? (item.weight > range.max ? range.max : range.min) : range.mode));
                // Diff here is Weight visual diff usually.
                // But the front end expects "diff" to be cost? 
                // Inspecting WeightAnalysisPage logic: "diff" there is cost diff? 
                // Wait, WeightAnalysisPage shows "Weight Check". 
                // ShippingAnomalyPage shows "Cost Anomalies".

                // CRITICAL CORRECTION:
                // Shipping Anomaly Page was originally about COST anomalies (expected cost vs actual).
                // Weight Analysis Page is about WEIGHT anomalies.
                // The user complained they don't match.
                // If I switch this to Weight Analysis logic, I might break "Cost Anomaly" logic if that's what they wanted.
                // BUT, the user explicitly said "Data doesn't match other page". "Other page" is likely Weight Analysis which we just fixed.
                // The user likely wants to see the SAME anomalies (Weight/profit based).

                // Let's filter based on the requested params

                let anomalyTypes = [];
                if (isWeightAnomaly) anomalyTypes.push(item.weight > range.max ? 'Overweight' : 'Underweight');

                // Apply Profit Threshold Filter
                if (profitThreshold && profit < parseFloat(profitThreshold)) {
                    anomalyTypes.push('Low Profit');
                }

                // Apply Cost Ratio Filter
                if (costRatioThreshold && costPercent > parseFloat(costRatioThreshold)) {
                    anomalyTypes.push('High Cost Ratio');
                }

                // If specific filters are set, only include if matching type or if it's a general anomaly
                // If "showAll" is false, we strictly return anomalies.
                // If "showAll" is true, we might return everything? Previously it returned "Shipping Anomalies" table which was ONLY anomalies.

                // The frontend defaults showAll=true but likely expects to filter locally or see only "Bad" things?
                // Actually the previous logic filtered `shipping_anomalies` table.
                // We should likely return items that match the "Anomaly" criteria defined by Weight Rules OR the explicit filters.

                const hasIssue = anomalyTypes.length > 0;

                if (hasIssue || showAll === 'true') {
                    allAnomalies.push({
                        id: item.id,
                        tracking: item.tracking,
                        name: item.name,
                        phone: item.phone,
                        cost: item.cost,
                        codAmount: item.cod,
                        profit: profit,
                        costPercent: costPercent,
                        weight: item.weight,
                        expectedCost: 0, // Placeholder, strict cost rules need a mapping
                        diff: isWeightAnomaly ? (item.weight - (item.weight > range.max ? range.max : range.min)) : 0, // Weight Diff
                        anomalyType: anomalyTypes.join(', ') || 'Normal',
                        date: item.date,
                        timestamp: item.timestamp
                    });
                }
            });

            // 5. Filter (Text Params), Sort, Paginate (in memory for consistency)

            // Apply text filters
            let filtered = allAnomalies.filter(item => {
                return Object.keys(req.query).every(key => {
                    if (!key.startsWith('filter_')) return true;
                    // Skip if empty
                    if (!req.query[key]) return true;

                    const field = key.replace('filter_', '');
                    const filterValue = req.query[key].toLowerCase();
                    const itemValue = item[field];
                    return itemValue != null && String(itemValue).toLowerCase().includes(filterValue);
                });
            });

            // Apply Numeric Filters (Strict)
            if (minDiff && parseFloat(minDiff) > 0) {
                // Assuming minDiff refers to Weight Diff absolute? or Profit?
                // Context: "Anomaly" page. usually diff=weight difference in other context.
                // Let's use Weight Diff absolute.
                const minD = parseFloat(minDiff);
                filtered = filtered.filter(a => Math.abs(a.diff) >= minD);
            }
            if (profitThreshold != null && profitThreshold !== '') {
                const pt = parseFloat(profitThreshold);
                filtered = filtered.filter(a => a.profit < pt);
            }
            if (costRatioThreshold && parseFloat(costRatioThreshold) > 0) {
                const cr = parseFloat(costRatioThreshold);
                filtered = filtered.filter(a => a.costPercent > cr);
            }


            // Apply sorting
            const sortBy = req.query.sortBy || 'date'; // Default to date desc
            const sortDir = req.query.sortDir === 'asc' ? 1 : -1;

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

            // Correct Anomaly Count: Only count actual anomalies (not Just valid records)
            // If showAll=true, 'allAnomalies' has everything. We need to count how many are actually 'Abnormal'.
            const actualAnomaliesCount = allAnomalies.filter(a =>
                a.anomalyType && a.anomalyType !== 'Normal'
            ).length;

            res.json({
                success: true,
                stats: {
                    totalScanned: rows.length,
                    validRecords: itemData.length,
                    anomaliesFound: actualAnomaliesCount, // CORRECTED: anomaliesFound is now strictly anomaly count
                    filteredCount: filtered.length,
                    totalRefundPotential: 0, // Complex to calc on fly without expected cost
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
require('./cod-analysis')(app, db);

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
