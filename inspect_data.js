const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('server/trackmaster.db');

db.serialize(() => {
    db.get("SELECT * FROM shipments LIMIT 1", (err, row) => {
        if (err) {
            console.error(err);
        } else {
            console.log("Sample Shipment:", JSON.stringify(row, null, 2));
            if (row && row.raw_data) {
                try {
                    console.log("Parsed raw_data:", JSON.stringify(JSON.parse(row.raw_data), null, 2));
                } catch (e) {
                    console.log("raw_data is not JSON");
                }
            }
        }
    });
});

db.close();
