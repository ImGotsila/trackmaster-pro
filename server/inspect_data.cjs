const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to the database in the same directory
const dbPath = path.resolve(__dirname, 'trackmaster.db');
const db = new sqlite3.Database(dbPath);

console.log(`Connecting to database at ${dbPath}...`);

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
                        // Also check common misspellings or other fields
                        console.log("- weight (kg):", parsed['weight(kg)']);
                        console.log("- weight_kg:", parsed.weight_kg);

                        console.log("Full raw_data:", JSON.stringify(parsed, null, 2));
                    } catch (e) {
                        console.log("raw_data is not JSON");
                    }
                } else {
                    console.log("No raw_data field");
                }
            }
        }
    });
});

db.close();
