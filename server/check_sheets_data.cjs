// Quick diagnostic to check raw Google Sheets data
const SERVER_URL = 'http://localhost:3001';

console.log('Fetching sample data from Google Sheets...\n');

fetch(`${SERVER_URL}/api/gsheets/get`)
    .then(res => res.json())
    .then(data => {
        const records = data.data || [];
        console.log(`Total records: ${records.length}\n`);

        if (records.length > 0) {
            console.log('=== FIRST 3 RECORDS ===\n');
            records.slice(0, 3).forEach((r, i) => {
                console.log(`Record ${i + 1}:`);
                console.log('  Fields available:', Object.keys(r));
                console.log('  ID:', r.id || r.shipmentId);
                console.log('  Tracking:', r.trackingNumber);
                console.log('  Customer:', r.customerName);
                console.log('  Phone:', r.customerPhone);
                console.log('  Weight:', r.weight);
                console.log('  Shipping Cost:', r.shippingCost);
                console.log('  COD Amount:', r.codAmount);
                console.log('  Timestamp:', r.timestamp);
                console.log('  Date:', new Date(r.timestamp).toISOString().split('T')[0]);
                console.log('');
            });

            // Check for current month data
            const now = new Date();
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const currentMonthRecords = records.filter(r => {
                const date = new Date(r.timestamp).toISOString().slice(0, 7);
                return date === currentMonth;
            });

            console.log(`\n=== DATA FRESHNESS ===`);
            console.log(`Current month (${currentMonth}): ${currentMonthRecords.length} records`);

            // Most recent record
            const sorted = records.sort((a, b) => b.timestamp - a.timestamp);
            const newest = sorted[0];
            console.log(`\nNewest record:`);
            console.log('  Date:', new Date(newest.timestamp).toISOString());
            console.log('  Tracking:', newest.trackingNumber);

            // Check phone numbers
            const withPhone = records.filter(r => r.customerPhone && r.customerPhone !== '');
            console.log(`\n=== PHONE NUMBERS ===`);
            console.log(`Records with phone: ${withPhone.length}/${records.length}`);
            if (withPhone.length > 0) {
                console.log(`Sample: ${withPhone[0].customerPhone}`);
            }
        }
    })
    .catch(err => console.error('Error:', err.message));
