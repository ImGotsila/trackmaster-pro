// Check if phone numbers are saved in database
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'trackmaster.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT id, trackingNumber, customerName, raw_data, timestamp FROM shipments LIMIT 5", (err, rows) => {
    if (err) {
        console.error('Error:', err);
        db.close();
        return;
    }

    console.log(`Total records to check: ${rows.length}\n`);

    rows.forEach((row, i) => {
        console.log(`Record ${i + 1}:`);
        console.log('  Tracking:', row.trackingNumber);
        console.log('  Customer:', row.customerName);
        console.log('  Date:', new Date(row.timestamp).toISOString().split('T')[0]);

        if (row.raw_data) {
            try {
                const parsed = JSON.parse(row.raw_data);
                console.log('  Raw Data:', parsed);
                console.log('  Phone:', parsed.phone || '(missing)');
                console.log('  Weight:', parsed.weight || '(missing)');
            } catch (e) {
                console.log('  Raw Data: (parse error)');
            }
        }
        console.log('');
    });

    db.close();
});
