// Quick check: Does customerPhone data exist?
const Database = require('better-sqlite3');
const db = new Database('./trackmaster.db');

const rows = db.prepare(`
    SELECT customerPhone, COUNT(*) as count 
    FROM shipments 
    WHERE customerPhone IS NOT NULL AND customerPhone != ''
    GROUP BY customerPhone 
    LIMIT 5
`).all();

console.log('Sample phone numbers in database:', rows);

const total = db.prepare('SELECT COUNT(*) as total FROM shipments').get();
const withPhone = db.prepare('SELECT COUNT(*) as count FROM shipments WHERE customerPhone IS NOT NULL AND customerPhone != \'\'').get();

console.log(`\nTotal shipments: ${total.total}`);
console.log(`With phone numbers: ${withPhone.count}`);
console.log(`Without phone: ${total.total - withPhone.count}`);

db.close();
