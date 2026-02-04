const db = require('./database');

db.serialize(() => {
    db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='verified_weight_anomalies'", (err, rows) => {
        if (err) {
            console.error("Error:", err);
        } else {
            console.log("Table check result:", rows);
            if (rows.length > 0) {
                console.log("✅ Table 'verified_weight_anomalies' exists.");
            } else {
                console.log("❌ Table 'verified_weight_anomalies' does NOT exist.");
                console.log("Server needs restart/init.");
            }
        }
    });
});
