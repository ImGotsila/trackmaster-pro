
const parseExcelClip = (data) => {
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
                i++;
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
};

const parseRowSmart = (parts) => {
    // Helper to simulate React state or just return object
    const shipment = {};

    // Strategy 1: Find columns by Regex
    const tracking = parts.find(p => /^(JN|SP|TH|Kerry|Flash)\d{8,16}[A-Z]*$/i.test(p) || (p.startsWith('JN') && p.endsWith('TH')));
    if (!tracking) {
        // Fallback: Check for any long alphanumeric string if no prefix match
        const potential = parts.find(p => /^[A-Z0-9]{10,15}$/.test(p));
        // if (!potential) return null; // Logic in app returns null, but let's see
        shipment.trackingNumber = potential;
    } else {
        shipment.trackingNumber = tracking;
    }

    // Phone
    let phone = '';
    const bioColumn = parts.find(p => p.length > 20 && p.includes('\n')); // Likely address block

    // Try precise phone column first
    const phoneCol = parts.find(p => /^0\d{9}$/.test(p.replace(/[^0-9]/g, '')));
    if (phoneCol) {
        phone = phoneCol.replace(/[^0-9]/g, '');
    } else if (bioColumn) {
        const match = bioColumn.match(/0\d{8,9}/);
        if (match) phone = match[0];
    } else {
        // Search all parts
        for (const p of parts) {
            const match = p.match(/0\d{8,9}/);
            if (match) { phone = match[0]; break; }
        }
    }
    if (phone.length === 9) phone = '0' + phone;
    shipment.phoneNumber = phone;

    // Name
    if (bioColumn) {
        const lines = bioColumn.split('\n').map(l => l.trim()).filter(l => l);
        // Heuristic: Name is line that is NOT an ID, NOT empty, NOT Phone
        const nameLine = lines.find(l =>
            !l.startsWith('#') &&
            !l.startsWith('💢') &&
            !l.includes('COD') &&
            !l.match(/^A\dB\d/) &&
            l.length > 2
        );
        shipment.customerName = nameLine || 'ไม่ระบุชื่อ';
    } else {
        const nameCandidate = parts.find(p =>
            p !== shipment.trackingNumber &&
            !p.includes(phone) &&
            p.length > 2 && p.length < 50 &&
            !/^\d+$/.test(p) &&
            !/^(COD|TT)/i.test(p)
        );
        shipment.customerName = nameCandidate || 'ไม่ระบุชื่อ';
    }

    // Product Code (e.g. A2B1) - REMOVED
    // const productCode = parts.find(p => /^[A-Z]\d+[A-Z]\d+$/.test(p));

    // ZipCode (Real)
    const zip = parts.find(p => /^\d{5}$/.test(p));
    if (zip) {
        shipment.zipCode = zip;
    } else if (bioColumn) {
        // Try to extract ZipCode from address block
        const zipMatch = bioColumn.match(/\b\d{5}\b/);
        if (zipMatch) {
            shipment.zipCode = zipMatch[0];
        }
    }

    return shipment;
};

const fs = require('fs');
const sampleData = fs.readFileSync('sample_data.txt', 'utf8');

const rows = parseExcelClip(sampleData);
console.log(`Parsed ${rows.length} rows.`);

rows.forEach((row, i) => {
    console.log(`\nRow ${i + 1}:`);
    const result = parseRowSmart(row);
    console.log("Result:", result);
});
