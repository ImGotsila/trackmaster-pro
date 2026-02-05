
// COD Analysis grouped by Weight
// Finds mode COD and anomalies for each Weight group

module.exports = function (app, db) {
    app.get('/api/analytics/cod-analysis-by-weight', (req, res) => {
        const format = req.query.format || 'csv'; // 'csv' or 'json'
        console.log(`📊 Starting COD Analysis by Weight (Format: ${format})...`);

        // 1. Fetch valid shipments with COD > 0
        db.all("SELECT id, trackingNumber, shippingCost, codAmount, raw_data, customerName, phoneNumber, zipCode, importDate FROM shipments WHERE codAmount > 0", (err, rows) => {
            if (err) {
                console.error("DB Error:", err);
                return res.status(500).json({ error: 'Database error' });
            }

            // 2. Parse Data
            const data = [];
            rows.forEach(row => {
                let weight = null;
                let phone = row.phoneNumber;
                let zip = row.zipCode;

                // Parse weight from raw_data JSON
                if (row.raw_data) {
                    try {
                        const parsed = JSON.parse(row.raw_data);
                        weight = parseFloat(parsed.weight);

                        if (!phone) phone = parsed.phone || parsed.tel || parsed.phoneNumber;
                        if (!zip) zip = parsed.zip || parsed.zipcode || parsed.postcode;
                    } catch (e) { }
                }

                if (row.shippingCost != null && weight != null && !isNaN(weight) && row.codAmount != null) {
                    data.push({
                        id: row.id,
                        tracking: row.trackingNumber,
                        customer: row.customerName,
                        phone: phone || '',
                        zip: zip || '',
                        date: row.importDate,
                        cost: parseFloat(row.shippingCost),
                        cod: parseFloat(row.codAmount),
                        weight: weight
                    });
                }
            });

            console.log(`Analyzing ${data.length} orders by Weight...`);

            // 3. Group by Weight
            const weightGroups = {};
            data.forEach(item => {
                const w = item.weight;
                if (!weightGroups[w]) {
                    weightGroups[w] = {
                        cods: {},    // frequency map
                        costs: {},   // frequency map
                        orders: []
                    };
                }

                // Count frequencies
                const cod = item.cod;
                const cost = item.cost;

                weightGroups[w].cods[cod] = (weightGroups[w].cods[cod] || 0) + 1;
                weightGroups[w].costs[cost] = (weightGroups[w].costs[cost] || 0) + 1;
                weightGroups[w].orders.push(item);
            });

            // 4. Analyze each group
            const summary = [];

            Object.keys(weightGroups).sort((a, b) => parseFloat(a) - parseFloat(b)).forEach(weightKey => {
                const group = weightGroups[weightKey];
                const weight = parseFloat(weightKey);

                // Find Mode COD (Most common COD for this weight)
                let modeCod = null;
                let maxCodCount = 0;
                Object.keys(group.cods).forEach(c => {
                    if (group.cods[c] > maxCodCount) {
                        maxCodCount = group.cods[c];
                        modeCod = parseFloat(c);
                    }
                });

                // Find Mode Cost (Most common cost for this weight)
                let modeCost = null;
                let maxCostCount = 0;
                Object.keys(group.costs).forEach(c => {
                    if (group.costs[c] > maxCostCount) {
                        maxCostCount = group.costs[c];
                        modeCost = parseFloat(c);
                    }
                });

                // Calculate Statistics
                let matchCount = 0;
                let anomalyCount = 0;
                const outliers = [];

                group.orders.forEach(order => {
                    if (order.cod === modeCod) {
                        matchCount++;
                    } else {
                        anomalyCount++;
                        outliers.push({
                            ...order,
                            type: 'COD_MISMATCH',
                            expectedCod: modeCod,
                            diff: parseFloat((order.cod - modeCod).toFixed(2))
                        });
                    }
                });

                summary.push({
                    weight: weight,
                    modeCod: modeCod,
                    modeCost: modeCost,
                    totalOrders: group.orders.length,
                    matchCount: matchCount, // Orders matching mode COD
                    anomalyCount: anomalyCount, // Orders NOT matching mode COD
                    codDistribution: group.cods,
                    outliers: outliers
                });
            });

            // 5. Return Response
            if (format === 'json') {
                return res.json({
                    summary: summary,
                    totalAnalyzed: data.length
                });
            }

            // CSV Export
            let csv = 'Weight Analysis Summary\n';
            csv += 'Weight,Mode COD,Mode Cost,Total,Match,Anomaly\n';
            summary.forEach(s => {
                csv += `${s.weight},${s.modeCod},${s.modeCost},${s.totalOrders},${s.matchCount},${s.anomalyCount}\n`;
            });

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="weight_cod_analysis.csv"`);
            res.send('\uFEFF' + csv);
        });
    });
};
