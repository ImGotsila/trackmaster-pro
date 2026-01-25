const fs = require('fs');
const path = require('path');

const rawData = fs.readFileSync(path.join(__dirname, 'sample_data.txt'), 'utf8');

// Function to parse Excel-like copy-paste with multi-line quoted cells
function parseExcelClip(data) {
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let inQuote = false;

    for (let i = 0; i < data.length; i++) {
        const char = data[i];
        const nextChar = data[i + 1];

        if (inQuote) {
            if (char === '"' && nextChar === '"') {
                currentCell += '"';
                i++; // skip next quote
            } else if (char === '"') {
                inQuote = false;
            } else {
                currentCell += char;
            }
        } else {
            if (char === '"') {
                inQuote = true;
            } else if (char === '\t') {
                currentRow.push(currentCell.trim());
                currentCell = '';
            } else if (char === '\n' || char === '\r') {
                if (currentCell || currentRow.length > 0) {
                    // Handle CRLF
                    if (char === '\r' && nextChar === '\n') i++;
                    currentRow.push(currentCell.trim());
                    rows.push(currentRow);
                    currentRow = [];
                    currentCell = '';
                }
            } else {
                currentCell += char;
            }
        }
    }
    if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
    }
    return rows;
}

const rows = parseExcelClip(rawData);
console.log(`Parsed ${rows.length} rows.`);

rows.forEach((row, idx) => {
    // We expect Tracking Number to be in one of the columns, likely near the end
    const tracking = row.find(col => /JN\d{9,12}TH/.test(col));
    const productCode = row.find(col => /^[A-Z]\d+[A-Z]\d+$/.test(col));
    // The big block of text usually contains name/address
    const bigBlock = row.find(col => col.length > 30);

    // Extract Phone
    let phone = '';
    if (bigBlock) {
        const phoneMatch = bigBlock.match(/0\d{9}/);
        if (phoneMatch) phone = phoneMatch[0];
    }

    // Extract Name (First line of big block?)
    let name = '';
    if (bigBlock) {
        const lines = bigBlock.split('\n').map(l => l.trim()).filter(l => l);
        // Usually line 2 or 3 if line 1 is ID
        // Filter out "#70" or "💢"
        const nameLine = lines.find(l => !l.startsWith('#') && !l.startsWith('💢') && !l.includes('COD') && l.length > 3);
        name = nameLine || 'Unknown';
    }

    console.log(`[${idx + 1}] Tracking: ${tracking} | Product: ${productCode} | Name: ${name} | Phone: ${phone}`);
});
