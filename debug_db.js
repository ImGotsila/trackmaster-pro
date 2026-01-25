const db = require('./server/database');

db.all("SELECT count(*) as count FROM rts_master", [], (err, rows) => {
    if (err) console.error(err);
    else console.log("Total records in rts_master:", rows[0].count);
});

db.all("SELECT monthYear, count(*) as count FROM rts_master GROUP BY monthYear", [], (err, rows) => {
    if (err) console.error(err);
    else {
        console.log("Records by Month:");
        console.table(rows);
    }
});
