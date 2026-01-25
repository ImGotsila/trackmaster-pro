
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'server/database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.get("SELECT COUNT(*) as count FROM rts_master", (err, row) => {
        if (err) {
            console.error("Error querying DB:", err);
        } else {
            console.log(`Total RTS Records in DB: ${row.count}`);
        }
    });

    db.all("SELECT * FROM rts_master ORDER BY id DESC LIMIT 5", (err, rows) => {
        if (err) {
            console.error("Error fetching recent:", err);
        } else {
            console.log("Recent 5 records:");
            console.log(JSON.stringify(rows, null, 2));
        }
    });
});

db.close();
