
const xlsx = require('xlsx');
const fs = require('fs');

const FILE_PATH = 's:\\trackmaster-pro\\สินค้าตีกลับ.xlsx';

try {
    console.log(`Reading file: ${FILE_PATH}`);
    if (!fs.existsSync(FILE_PATH)) {
        console.error('File not found!');
        process.exit(1);
    }

    const wb = xlsx.readFile(FILE_PATH);
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];

    // Read as array of arrays
    const data = xlsx.utils.sheet_to_json(ws, { header: 1 });

    console.log(`Total rows: ${data.length}`);

    // Print first 5 rows to see structure
    for (let i = 0; i < 5; i++) {
        console.log(`Row ${i}:`, JSON.stringify(data[i]));
    }

    // Find header row verification
    const headerRowIndex = data.findIndex(row => row && row.some(cell => typeof cell === 'string' && cell.includes('วันที่')));
    console.log(`Header found at index: ${headerRowIndex}`);

    if (headerRowIndex !== -1) {
        console.log('Header Row:', data[headerRowIndex]);
    }

} catch (error) {
    console.error('Error:', error);
}
