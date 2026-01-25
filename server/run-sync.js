const syncService = require('./services/SyncService');
const path = require('path');
const dotenv = require('dotenv');

// Load env
const envPath = path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

console.log("Starting manual sync...");
syncService.syncFromSheets()
    .then(result => {
        console.log("Sync Complete:", result);
        process.exit(0);
    })
    .catch(err => {
        console.error("Sync Failed:", err);
        process.exit(1);
    });
