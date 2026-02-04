// Check weight values in Google Sheets
const SERVER_URL = 'http://localhost:3001';

fetch(`${SERVER_URL}/api/gsheets/get`)
    .then(res => res.json())
    .then(data => {
        const records = data.data || [];

        console.log('=== WEIGHT ANALYSIS ===\n');
        console.log('First 10 records:\n');

        records.slice(0, 10).forEach((r, i) => {
            console.log(`${i + 1}. ${r.trackingNumber}`);
            console.log(`   weight: ${r.weight}`);
            console.log(`   All numeric fields:`, Object.keys(r).filter(k => typeof r[k] === 'number'));
        });

        // Find unique weight values
        const weights = records.map(r => r.weight).filter(w => w != null);
        const uniqueWeights = [...new Set(weights)].sort((a, b) => a - b);

        console.log('\n=== UNIQUE WEIGHT VALUES ===');
        console.log(`Total unique: ${uniqueWeights.length}`);
        console.log('First 20:', uniqueWeights.slice(0, 20));

        // Check if all weights are < 1 (might be in kg already, wrongly labeled)
        const allSmall = weights.every(w => w < 1);
        console.log(`\nAll weights < 1? ${allSmall}`);

        if (allSmall) {
            console.log('→ Weights might already be in kg (0.001 = 1 gram)');
            console.log('→ Or need to be multiplied by 1000 to convert to grams');
        }
    })
    .catch(err => console.error('Error:', err.message));
