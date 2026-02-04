// API Endpoint for generating analysis report with custom parameters
// Called from dashboard with user's filter settings

module.exports = function (app, db) {
    app.get('/api/analytics/generate-report', (req, res) => {
        // Get parameters from query (from dashboard)
        const minDiff = parseFloat(req.query.minDiff) || 0;
        const profitThreshold = parseFloat(req.query.profitThreshold) || 0;
        const costRatioThreshold = parseFloat(req.query.costRatioThreshold) || 50;

        console.log(`📊 Generating report with: minDiff=${minDiff}, profitThreshold=${profitThreshold}, costRatio=${costRatioThreshold}`);

        db.all("SELECT id, trackingNumber, shippingCost, codAmount, raw_data, customerName, timestamp FROM shipments", (err, rows) => {
            if (err) {
                console.error('DB Error:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            const data = [];
            let errorCount = 0;
            let ignoredCount = 0;

            rows.forEach(row => {
                // FILTER: Ignore non-COD orders
                if (!row.codAmount || row.codAmount <= 0) {
                    ignoredCount++;
                    return;
                }

                let weight = null;
                let phone = null;
                if (row.raw_data) {
                    try {
                        const parsed = JSON.parse(row.raw_data);
                        weight = parsed.weight;
                        phone = parsed.phone;
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
                        phone: phone,
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

            // Detect anomalies using DASHBOARD SETTINGS
            const anomalies = [];

            data.forEach(item => {
                const expected = standardCosts[item.weight] || 0;
                const diff = item.cost - expected;

                let anomalyType = [];
                if (diff > minDiff) anomalyType.push('High Cost');
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

            console.log(`🚨 Found ${anomalies.length} anomalies`);

            // Generate CSV
            const headers = 'ID,Tracking,Customer,Phone,Weight(kg),Cost,COD,Profit,%Cost,Expected,Diff,AnomalyType,Date\n';
            const csvRows = anomalies.map(a =>
                `${a.id},${a.tracking},"${a.name}",${a.phone || ''},${a.weight},${a.cost},${a.cod},${a.profit},${a.costPercent},${a.expected},${a.diff},"${a.anomalyType}",${a.date}`
            ).join('\n');

            // Send as downloadable CSV
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="shipping_anomalies_${new Date().toISOString().split('T')[0]}.csv"`);
            res.send('\uFEFF' + headers + csvRows); // BOM for Excel UTF-8
        });
    });
};
