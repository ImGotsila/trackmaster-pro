const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../data/trackmaster.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Starting COD migration...');
console.log(`📁 Database: ${dbPath}`);

// Helper: Parse amount (supports 1-7 digits with comma separators and ฿ symbol)
const parseAmount = (str) => {
    if (!str) return 0;
    // Remove ฿, commas, spaces, and parse
    const cleaned = str.replace(/[฿,\s]/g, '').trim();
    const value = parseFloat(cleaned);
    // Validate: must be positive number, 1-7 digits (up to 9,999,999)
    if (isNaN(value) || value < 0 || value > 9999999) return 0;
    return value;
};

// Get all shipments with raw_data
db.all(`SELECT id, raw_data, codAmount FROM shipments WHERE raw_data IS NOT NULL`, [], (err, rows) => {
    if (err) {
        console.error('❌ Error fetching shipments:', err);
        db.close();
        return;
    }

    console.log(`📦 Found ${rows.length} shipments with raw_data`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    const updateStmt = db.prepare(`UPDATE shipments SET codAmount = ? WHERE id = ?`);

    rows.forEach((row, index) => {
        try {
            const rawData = JSON.parse(row.raw_data);

            // Try to parse COD from raw_data
            let newCOD = 0;

            // Check if raw_data has COD field
            if (rawData.codAmount) {
                newCOD = parseAmount(String(rawData.codAmount));
            } else if (rawData.cod) {
                newCOD = parseAmount(String(rawData.cod));
            } else if (rawData.COD) {
                newCOD = parseAmount(String(rawData.COD));
            }

            // Update if COD changed
            if (newCOD > 0 && newCOD !== row.codAmount) {
                updateStmt.run(newCOD, row.id, (updateErr) => {
                    if (updateErr) {
                        console.error(`❌ Error updating ${row.id}:`, updateErr);
                        errors++;
                    } else {
                        updated++;
                        if (updated % 100 === 0) {
                            console.log(`⏳ Updated ${updated} records...`);
                        }
                    }
                });
            } else {
                skipped++;
            }

        } catch (parseErr) {
            console.error(`⚠️ Error parsing raw_data for ${row.id}:`, parseErr.message);
            errors++;
        }
    });

    updateStmt.finalize(() => {
        console.log('\n✅ Migration complete!');
        console.log(`📊 Updated: ${updated}`);
        console.log(`⏭️  Skipped: ${skipped}`);
        console.log(`❌ Errors: ${errors}`);
        db.close();
    });
});
