// Weight Analysis grouped by COD Amount
// Finds mode weight and shipping cost for each COD amount

module.exports = function (app, db) {
    app.get('/api/analytics/weight-cost-analysis', (req, res) => {
        const format = req.query.format || 'csv'; // 'csv' or 'json'
        console.log(`📊 Starting Weight Analysis by COD (Format: ${format})...`);

        // 1. Fetch valid shipments with COD
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
                let address = '';

                // Parse weight from raw_data JSON
                if (row.raw_data) {
                    try {
                        const parsed = JSON.parse(row.raw_data);
                        weight = parseFloat(parsed.weight);

                        // Extract other fields if missing from DB columns
                        if (!phone) phone = parsed.phone || parsed.tel || parsed.phoneNumber;
                        if (!zip) zip = parsed.zip || parsed.zipcode || parsed.postcode;
                        if (parsed.address) address = parsed.address;
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

            console.log(`Analyzing ${data.length} orders by COD...`);

            // 3. Group by COD Amount
            const codGroups = {};
            data.forEach(item => {
                const cod = item.cod;
                if (!codGroups[cod]) {
                    codGroups[cod] = {
                        weights: {}, // frequency map
                        costs: {},   // frequency map
                        orders: []
                    };
                }

                // Count frequencies
                const w = item.weight;
                const c = item.cost;

                codGroups[cod].weights[w] = (codGroups[cod].weights[w] || 0) + 1;
                codGroups[cod].costs[c] = (codGroups[cod].costs[c] || 0) + 1;
                codGroups[cod].orders.push(item);
            });

            // 4. Analyze each group
            const summary = [];

            Object.keys(codGroups).sort((a, b) => parseFloat(a) - parseFloat(b)).forEach(codKey => {
                const group = codGroups[codKey];
                const cod = parseFloat(codKey);

                // Find Mode Weight
                let modeWeight = null;
                let maxWeightCount = 0;
                Object.keys(group.weights).forEach(w => {
                    if (group.weights[w] > maxWeightCount) {
                        maxWeightCount = group.weights[w];
                        modeWeight = parseFloat(w);
                    }
                });

                // Find Mode Cost (Expected cost for this COD)
                let modeCost = null;
                let maxCostCount = 0;
                Object.keys(group.costs).forEach(c => {
                    if (group.costs[c] > maxCostCount) {
                        maxCostCount = group.costs[c];
                        modeCost = parseFloat(c);
                    }
                });

                // Calculate Statistics
                let normalCount = 0;
                let underWeightCount = 0;
                let overWeightCount = 0;

                // Detailed outliers list for this group
                const outliers = [];

                group.orders.forEach(order => {
                    if (order.weight === modeWeight) {
                        normalCount++;
                    } else if (order.weight < modeWeight) {
                        underWeightCount++;
                        outliers.push({
                            ...order,
                            type: 'UNDERWEIGHT',
                            expectedWeight: modeWeight,
                            expectedCost: modeCost,
                            diff: parseFloat((order.weight - modeWeight).toFixed(3))
                        });
                    } else {
                        overWeightCount++;
                        outliers.push({
                            ...order,
                            type: 'OVERWEIGHT',
                            expectedWeight: modeWeight,
                            expectedCost: modeCost,
                            diff: parseFloat((order.weight - modeWeight).toFixed(3))
                        });
                    }
                });

                summary.push({
                    cod: cod,
                    modeWeight: modeWeight,
                    modeCost: modeCost,
                    totalOrders: group.orders.length,
                    normalCount: normalCount,
                    underWeightCount: underWeightCount,
                    overWeightCount: overWeightCount,
                    weightDistribution: group.weights,
                    costDistribution: group.costs,
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

            // CSV Export (Optional fallback)
            let csv = 'COD Summary Analysis\n';
            csv += 'COD,Mode Weight,Mode Cost,Total,Normal,Underweight,Overweight\n';
            summary.forEach(s => {
                csv += `${s.cod},${s.modeWeight},${s.modeCost},${s.totalOrders},${s.normalCount},${s.underWeightCount},${s.overWeightCount}\n`;
            });

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="cod_weight_analysis.csv"`);
            res.send('\uFEFF' + csv);
        });
    });
};
