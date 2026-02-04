// Diagnostic script to check Google Sheets data
// Node.js v18+ has native fetch

const GS_URL = 'https://script.google.com/macros/s/AKfycbyrIkqtH-8MzIBSLrk8bEucnGgEjF0tXXBlv7cY2wO27MRLWGPNxq7JCBz_0TwNPT9MHw/exec';

async function diagnoseSheets() {
    console.log('Fetching data from Google Sheets...\n');

    try {
        const response = await fetch(`${GS_URL}?action=get`);
        const data = await response.json();

        console.log('Total records:', data.data?.length || 0);

        if (data.data && data.data.length > 0) {
            // Show first record structure
            console.log('\n=== FIRST RECORD ===');
            console.log(JSON.stringify(data.data[0], null, 2));

            // Check field names
            console.log('\n=== AVAILABLE FIELDS ===');
            console.log(Object.keys(data.data[0]));

            // Check phone numbers
            const withPhone = data.data.filter(r => r.customerPhone && r.customerPhone !== '');
            console.log('\n=== PHONE NUMBERS ===');
            console.log('Records with phone:', withPhone.length);
            console.log('Records without phone:', data.data.length - withPhone.length);
            if (withPhone.length > 0) {
                console.log('Sample phone:', withPhone[0].customerPhone);
            }

            // Check dates
            console.log('\n=== DATES ===');
            const sample = data.data[0];
            console.log('timestamp field:', sample.timestamp);
            console.log('Date object:', new Date(sample.timestamp));
            console.log('ISO format:', new Date(sample.timestamp).toISOString());
            console.log('Date only:', new Date(sample.timestamp).toISOString().split('T')[0]);

            // Check required fields
            console.log('\n=== REQUIRED FIELDS CHECK ===');
            const required = ['trackingNumber', 'shippingCost', 'codAmount', 'weight', 'customerName', 'timestamp'];
            required.forEach(field => {
                const missing = data.data.filter(r => !r[field] || r[field] === null || r[field] === '');
                console.log(`${field}: ${data.data.length - missing.length}/${data.data.length} have values`);
            });

            // Show 3 sample records with all relevant fields
            console.log('\n=== SAMPLE RECORDS (first 3) ===');
            data.data.slice(0, 3).forEach((r, i) => {
                console.log(`\nRecord ${i + 1}:`);
                console.log('  Tracking:', r.trackingNumber);
                console.log('  Date:', new Date(r.timestamp).toISOString().split('T')[0]);
                console.log('  Customer:', r.customerName);
                console.log('  Phone:', r.customerPhone || '(missing)');
                console.log('  Weight:', r.weight);
                console.log('  COD:', r.codAmount);
                console.log('  Shipping Cost:', r.shippingCost);
            });

        } else {
            console.log('No data returned from Sheets!');
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

diagnoseSheets();
