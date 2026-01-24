const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

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

// API: Sync Shipments (Bulk Upsert)
app.post('/api/shipments/sync', (req, res) => {
    const shipments = req.body;
    if (!Array.isArray(shipments)) {
        return res.status(400).json({ error: 'Body must be an array of shipments' });
    }

    // Using transaction for speed
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        // Simple approach: Clear all and insert new? Or Upsert?
        // User asked to "Analyze entire Db... save ... update". 
        // Sync implies matching state. Let's use INSERT OR REPLACE for existing IDs.
        const stmt = db.prepare(`INSERT OR REPLACE INTO shipments (
            id, trackingNumber, courier, status, customerName, phoneNumber, 
            zipCode, codAmount, shippingCost, importDate, importTime, timestamp, raw_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

        let errors = 0;
        shipments.forEach(s => {
            stmt.run(
                s.id, s.trackingNumber, s.courier, s.status, s.customerName, s.phoneNumber,
                s.zipCode, s.codAmount, s.shippingCost, s.importDate, s.importTime, s.timestamp,
                JSON.stringify(s), // Keep raw just in case
                function (err) { if (err) errors++; }
            );
        });

        stmt.finalize();
        db.run('COMMIT', (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, count: shipments.length, errors });
        });
    });
});

// API: Geo Analytics (Server-Side)
const { searchAddressByZipcode } = require('thai-address-database');
app.get('/api/analytics/geo', (req, res) => {
    // 1. Aggregate DB data by ZipCode
    // We do sum/count in SQL for speed
    db.all(`SELECT zipCode, COUNT(*) as count, SUM(codAmount) as totalCOD, SUM(shippingCost) as totalCost 
            FROM shipments 
            WHERE zipCode IS NOT NULL AND zipCode != '' 
            GROUP BY zipCode`, [], (err, rows) => {

        if (err) return res.status(500).json({ error: err.message });

        // 2. Map Zip -> Province in Node.js
        const provinceStats = new Map(); // Province -> { count, totalCOD, totalCost }

        rows.forEach(row => {
            try {
                // Check if ZipCode is valid
                const addresses = searchAddressByZipcode(String(row.zipCode));
                if (addresses && addresses.length > 0) {
                    const province = addresses[0].province;

                    const existing = provinceStats.get(province);
                    if (existing) {
                        existing.count += row.count;
                        existing.totalCOD += row.totalCOD;
                        existing.totalCost += row.totalCost;
                    } else {
                        provinceStats.set(province, {
                            province,
                            count: row.count,
                            totalCOD: row.totalCOD,
                            totalCost: row.totalCost
                        });
                    }
                }
            } catch (e) {
                // Ignore invalid zips
            }
        });

        const results = Array.from(provinceStats.values()).sort((a, b) => b.count - a.count);
        res.json(results);
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
