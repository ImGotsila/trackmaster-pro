const db = require('./server/database.js');

console.log("Checking RTS Master records...");

setTimeout(() => {
    db.all("SELECT count(*) as count FROM rts_master", [], (err, rows) => {
        if (err) console.error("Query Error:", err);
        else console.log("Total records in rts_master:", rows[0].count);
    });

    db.all("SELECT monthYear, count(*) as count FROM rts_master GROUP BY monthYear", [], (err, rows) => {
        if (err) console.error("Query Error:", err);
        else {
            if (rows.length === 0) console.log("No records found in any month.");
            else {
                console.log("Records by Month:");
                console.table(rows);
            }
        }
    });
}, 1000); // Wait for DB connection
