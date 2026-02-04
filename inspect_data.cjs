const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('server/trackmaster.db');

console.log("Connecting to database...");

db.serialize(() => {
    db.get("SELECT * FROM shipments LIMIT 1", (err, row) => {
        if (err) {
            console.error("Error fetching row:", err);
        } else {
            if (!row) {
                console.log("No shipments found.");
            } else {
                console.log("Sample Shipment columns:", Object.keys(row));
                console.log("Cost:", row.shippingCost);
                if (row.raw_data) {
                    try {
                        const parsed = JSON.parse(row.raw_data);
                        console.log("Parsed raw_data keys:", Object.keys(parsed));
                        // Look for weight-related keys
                        console.log("Weight candidates:");
                        console.log("- weight:", parsed.weight);
                        console.log("- width:", parsed.width);
                        console.log("- height:", parsed.height);
                        console.log("- length:", parsed.length);
                        console.log("- size:", parsed.size);
                        console.log("Full raw_data:", JSON.stringify(parsed, null, 2));
                    } catch (e) {
                        console.log("raw_data is not JSON", row.raw_data);
                    }
                } else {
                    console.log("No raw_data field");
                }
            }
        }
    });
});

db.close();
