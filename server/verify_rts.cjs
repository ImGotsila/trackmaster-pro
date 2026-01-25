
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database is in the same directory as this script (server/trackmaster.db)
const dbPath = path.resolve(__dirname, 'trackmaster.db');
const db = new sqlite3.Database(dbPath);

console.log(`Checking database at: ${dbPath}`);

db.serialize(() => {
    // Check total count
    db.get("SELECT COUNT(*) as count FROM rts_master", (err, row) => {
        if (err) {
            console.error("Error querying RTS count:", err.message);
        } else {
            console.log(`Total RTS Records: ${row.count}`);
        }
    });

    db.all("SELECT id, facebookName, customerAddress, customerPhone, finalStatus, notes, monthYear FROM rts_master WHERE notes IS NOT NULL AND notes != '' LIMIT 5", (err, rows) => {
        if (err) {
            console.error("Error querying details:", err.message);
        } else {
            console.log("\nSample Records with Address & Notes:");
            if (rows.length === 0) console.log(" (No records with notes found)");
            rows.forEach(r => {
                const addr = r.customerAddress ? r.customerAddress.substring(0, 30) + "..." : "(No Address)";
                console.log(`- [${r.id}] ${r.facebookName}\n  Addr: ${addr}\n  Month: ${r.monthYear}, Phone: ${r.customerPhone} -> Notes: "${r.notes}"`);
            });
        }
    });
});

db.close();
