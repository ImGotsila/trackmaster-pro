const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.resolve('/app/data/trackmaster.db');
const db = new sqlite3.Database(dbPath);

const PORT = process.env.PORT || 3001;
const SERVER_URL = process.env.VITE_API_BASE_URL || `http://127.0.0.1:${PORT}`;

console.log('🔄 Fetching fresh data from Google Sheets via server...');

// Step 1: Fetch fresh data from Google Sheets through server API
fetch(`${SERVER_URL}/api/gsheets/get`)
    .then(res => {
        if (!res.ok) throw new Error(`Sheets fetch failed: ${res.status}`);
        return res.json();
    })
    .then(gsData => {
        const rows = gsData.data || [];
        console.log(`✅ Fetched ${rows.length} records from Sheets`);

        if (rows.length === 0) {
            throw new Error('No data received from Google Sheets');
        }

        console.log('💾 Saving to database...');

        // Step 2: Clear old data and save fresh data (OPTIMIZED)
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            db.run('DELETE FROM shipments', (err) => {
                if (err) {
                    console.error('Error clearing old data:', err);
                    db.run('ROLLBACK');
                    return;
                }

                const stmt = db.prepare(`
                    INSERT OR REPLACE INTO shipments 
                    (id, trackingNumber, shippingCost, codAmount, raw_data, customerName, timestamp)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `);

                let savedCount = 0;
                rows.forEach(row => {
                    // Use importDate (actual shipment date) not timestamp (import time)
                    const shipmentDate = row.importDate ? new Date(row.importDate).getTime() : Date.now();

                    const rawData = JSON.stringify({
                        weight: row.weight,
                        phone: row.phoneNumber  // Sheets uses phoneNumber, not customerPhone
                    });

                    stmt.run(
                        row.id || row.shipmentId,
                        row.trackingNumber,
                        row.shippingCost,
                        row.codAmount,
                        rawData,
                        row.customerName,
                        shipmentDate  // Use importDate
                    );
                    savedCount++;
                });

                stmt.finalize(() => {
                    db.run('COMMIT', () => {
                        console.log(`✅ Saved ${savedCount} records to database`);
                        console.log('📊 Starting analysis...\n');

                        // Step 3: Now run analysis on fresh data
                        runAnalysis();
                    });
                });
            });
        });
    })
    .catch(error => {
        console.error('❌ Error fetching from Google Sheets:', error.message);
        console.log('\n⚠️ Falling back to existing database data...\n');
        runAnalysis();
    });

function runAnalysis() {
    db.all("SELECT id, trackingNumber, shippingCost, codAmount, raw_data, customerName, timestamp FROM shipments", (err, rows) => {
        if (err) {
            console.error('DB Error:', err);
            db.close();
            return;
        }

        console.log(`Scanned ${rows.length} shipments.`);

        const data = [];
        let errorCount = 0;
        let ignoredCount = 0;

        rows.forEach(row => {
            // FILTER: Ignore non-COD orders (Transfer/Paid)
            if (!row.codAmount || row.codAmount <= 0) {
                ignoredCount++;
                return;
            }

            let weight = null;
            if (row.raw_data) {
                try {
                    const parsed = JSON.parse(row.raw_data);
                    weight = parsed.weight;
                } catch (e) {
                    errorCount++;
                }
            }

            if (row.shippingCost != null) {
                const cost = parseFloat(row.shippingCost);
                const cod = parseFloat(row.codAmount);
                const profit = cod - cost;
                const costPercent = (cost / cod) * 100;

                data.push({
                    id: row.id,
                    tracking: row.trackingNumber,
                    name: row.customerName,
                    cost: cost,
                    cod: cod,
                    profit: profit,
                    costPercent: parseFloat(costPercent.toFixed(2)),
                    weight: parseFloat(weight),
                    timestamp: row.timestamp,
                    date: new Date(row.timestamp).toISOString().split('T')[0]
                });
            }
        });

        console.log(`Ignored ${ignoredCount} non-COD orders.`);
        console.log(`Errors parsing: ${errorCount}`);
        console.log(`Valid COD orders: ${data.length}`);

        // Calculate mode cost per weight
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

        // Detect anomalies
        const anomalies = [];
        const profitThreshold = -50;
        const costRatioThreshold = 150;

        data.forEach(item => {
            const expected = standardCosts[item.weight] || 0;
            const diff = item.cost - expected;

            let anomalyType = [];
            if (diff > 10) anomalyType.push('High Cost');
            if (item.profit < profitThreshold) anomalyType.push('Negative Profit');
            if (item.costPercent > costRatioThreshold) anomalyType.push('High Cost Ratio');

            if (anomalyType.length > 0) {
                anomalies.push({
                    ...item,
                    expected,
                    diff,
                    anomalyType: anomalyType.join(', ')
                });
            }
        });

        console.log(`\n🚨 Found ${anomalies.length} anomalies.`);

        // Write CSV
        const csvPath = path.resolve(__dirname, 'abnormal_shipping.csv');
        const headers = 'ID,Tracking,Customer,Weight(kg),Cost,COD,Profit,%Cost,Expected,Diff,AnomalyType,Date\n';
        const csvRows = anomalies.map(a =>
            `${a.id},${a.tracking},"${a.name}",${a.weight},${a.cost},${a.cod},${a.profit},${a.costPercent},${a.expected},${a.diff},"${a.anomalyType}",${a.date}`
        ).join('\n');

        fs.writeFileSync(csvPath, headers + csvRows);
        console.log(`✅ CSV written to: ${csvPath}`);

        // Write markdown report
        const mdPath = path.resolve(__dirname, 'analysis_report_content.md');
        let mdContent = `# Shipping Cost Anomaly Report\n\n`;
        mdContent += `**Generated:** ${new Date().toISOString()}\n\n`;
        mdContent += `**Total Shipments Scanned:** ${rows.length}\n`;
        mdContent += `**COD Orders Analyzed:** ${data.length}\n`;
        mdContent += `**Anomalies Found:** ${anomalies.length}\n\n`;
        mdContent += `---\n\n`;
        mdContent += `## Anomalies\n\n`;
        mdContent += `| Tracking | Customer | Weight | Cost | Expected | Diff | Type | Date |\n`;
        mdContent += `|----------|----------|--------|------|----------|------|------|------|\n`;

        anomalies.slice(0, 50).forEach(a => {
            mdContent += `| ${a.tracking} | ${a.name} | ${a.weight}kg | ฿${a.cost} | ฿${a.expected} | ฿${a.diff} | ${a.anomalyType} | ${a.date} |\n`;
        });

        fs.writeFileSync(mdPath, mdContent);
        console.log(`✅ Report written to: ${mdPath}`);

        // Save anomalies to database
        console.log(`💾 Saving ${anomalies.length} anomalies to database...`);
        db.run(`DELETE FROM shipping_anomalies`, (err) => {
            if (err) {
                console.error('Error clearing anomalies:', err);
                db.close();
                return;
            }

            const stmt = db.prepare(`INSERT INTO shipping_anomalies 
                (id, trackingNumber, customerName, phoneNumber, weight, shippingCost, codAmount, profit, costPercent, expectedCost, diff, anomalyType, importDate, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

            let savedCount = 0;
            anomalies.forEach(a => {
                stmt.run(
                    a.id,
                    a.tracking,
                    a.name,
                    a.phone || '',
                    a.weight,
                    a.cost,
                    a.cod,
                    a.profit,
                    a.costPercent,
                    a.expected,
                    a.diff,
                    a.anomalyType,
                    a.date,
                    Date.now(),
                    (err) => {
                        if (err) console.error('Insert error:', err);
                        else savedCount++;
                    }
                );
            });

            stmt.finalize(() => {
                console.log(`✅ Saved ${savedCount} anomalies to database`);
                db.close();
                console.log('\n✅ Analysis complete!');
            });
        });
    });
}
