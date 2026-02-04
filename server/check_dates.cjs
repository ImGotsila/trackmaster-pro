// Check all date-related fields in Google Sheets
const SERVER_URL = 'http://localhost:3001';

fetch(`${SERVER_URL}/api/gsheets/get`)
    .then(res => res.json())
    .then(data => {
        const records = data.data || [];
        console.log('Checking date fields in first 3 records:\n');

        records.slice(0, 3).forEach((r, i) => {
            console.log(`Record ${i + 1}: ${r.trackingNumber}`);
            console.log('  All fields:', Object.keys(r));
            console.log('\n  Date-related fields:');

            // Check all fields that might be dates
            Object.keys(r).forEach(key => {
                const value = r[key];
                // Check if it looks like a date
                if (key.toLowerCase().includes('date') ||
                    key.toLowerCase().includes('time') ||
                    key === 'timestamp' ||
                    (typeof value === 'number' && value > 1000000000)) {

                    console.log(`  ${key}:`, value);

                    // Try to parse as date
                    if (typeof value === 'number') {
                        console.log(`    → ${new Date(value).toISOString().split('T')[0]}`);
                    } else if (typeof value === 'string') {
                        const parsed = new Date(value);
                        if (!isNaN(parsed.getTime())) {
                            console.log(`    → ${parsed.toISOString().split('T')[0]}`);
                        }
                    }
                }
            });
            console.log('');
        });

        // Show the LAST field in the record
        const firstRecord = records[0];
        const allKeys = Object.keys(firstRecord);
        const lastKey = allKeys[allKeys.length - 1];
        console.log(`\n=== LAST COLUMN (field) in Sheet ===`);
        console.log(`Field name: "${lastKey}"`);
        console.log(`Sample value:`, firstRecord[lastKey]);
        if (typeof firstRecord[lastKey] === 'number') {
            console.log(`As date: ${new Date(firstRecord[lastKey]).toISOString()}`);
        }
    })
    .catch(err => console.error('Error:', err.message));
