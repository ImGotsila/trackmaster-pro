const fs = require('fs');
const path = require('path');
const db = require('../database');

class SyncService {
    constructor() {
        this.gsUrl = process.env.VITE_GOOGLE_SHEETS_SCRIPT_URL;
    }

    async syncFromSheets() {
        if (!this.gsUrl) {
            throw new Error('VITE_GOOGLE_SHEETS_SCRIPT_URL is not defined in environment variables');
        }

        console.log('Starting sync from Google Sheets...');

        // 1. Fetch data from GAS
        const response = await fetch(`${this.gsUrl}?action=get`);
        if (!response.ok) {
            throw new Error(`Failed to fetch from GAS: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        if (result.status !== 'success' || !Array.isArray(result.data)) {
            throw new Error('Invalid data format received from GAS');
        }

        const shipments = result.data;
        console.log(`Fetched ${shipments.length} records from Sheets. Updating database...`);

        // 2. Upsert into SQLite
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run("BEGIN TRANSACTION");

                const stmt = db.prepare(`
                    INSERT INTO shipments (
                        id, trackingNumber, courier, status, customerName, phoneNumber, 
                        zipCode, codAmount, shippingCost, importDate, timestamp, raw_data
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        trackingNumber = excluded.trackingNumber,
                        courier = excluded.courier,
                        status = excluded.status,
                        customerName = excluded.customerName,
                        phoneNumber = excluded.phoneNumber,
                        zipCode = excluded.zipCode,
                        codAmount = excluded.codAmount,
                        shippingCost = excluded.shippingCost,
                        importDate = excluded.importDate,
                        timestamp = excluded.timestamp,
                        raw_data = excluded.raw_data
                `);

                let processed = 0;
                let errors = 0;

                shipments.forEach(item => {
                    // Map GAS item to DB schema
                    // GAS item: { id: 'row-X', trackingNumber, ... }
                    // We use 'row-X' (or better, trackingNumber) as unique ID if possible, 
                    // but the DB schema currently says 'id' is TEXT PRIMARY KEY. 
                    // Let's use the 'trackingNumber' as the stable ID if available, OR the GAS ID.
                    // Actually, 'rts_reports' uses uuid. 'shipments' table structure is flexible.
                    // For syncing, using trackingNumber as a unique key is risky if duplicates exist.
                    // But the GAS script cleans duplicates? 
                    // Let's rely on the GAS 'id' (row-based) which is somewhat stable unless rows move.
                    // BETTER: Use trackingNumber as the logical key for "Shipment". 
                    // BUT: 'id' in shipments table is PRIMARY KEY. 

                    // Strategy: Use trackingNumber as ID if valid, otherwise fallback.
                    const id = item.trackingNumber || item.id;

                    const params = [
                        id,
                        item.trackingNumber,
                        item.courier || 'Thailand Post',
                        item.status,
                        item.customerName,
                        item.phoneNumber,
                        item.zipCode,
                        item.codAmount || 0,
                        item.shippingCost || 0,
                        item.importDate,
                        item.timestamp || Date.now(),
                        JSON.stringify(item) // raw_data
                    ];

                    stmt.run(params, (err) => {
                        if (err) {
                            console.error('Error inserting row:', item.trackingNumber, err.message);
                            errors++;
                        } else {
                            processed++;
                        }
                    });
                });

                stmt.finalize();

                db.run("COMMIT", (err) => {
                    if (err) {
                        db.run("ROLLBACK");
                        return reject(err);
                    }
                    resolve({ processed, errors, total: shipments.length });
                });
            });
        });
    }
}

module.exports = new SyncService();
