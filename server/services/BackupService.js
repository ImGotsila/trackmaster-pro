const fs = require('fs');
const path = require('path');
const db = require('../database');

class BackupService {
    constructor() {
        // Assume dbPath is accessible via database module or env
        // We'll resolve it similarly to database.js
        this.dbPath = process.env.DB_PATH || path.resolve(__dirname, '../trackmaster.db');
        this.backupDir = path.resolve(path.dirname(this.dbPath), 'backups');

        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }

    async createBackup() {
        return new Promise((resolve, reject) => {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFilename = `trackmaster-backup-${timestamp}.db`;
            const backupPath = path.join(this.backupDir, backupFilename);

            // SQLite Safely: It's best to use the VACUUM INTO command (SQLite 3.27+) or Online Backup API
            // But simple copying works if WAL mode is handled or if we accept risk.
            // Node sqlite3 doesn't expose backup API easily?
            // Let's try to use the 'VACUUM INTO' command which is transaction-safe.

            db.run(`VACUUM INTO ?`, [backupPath], (err) => {
                if (err) {
                    // Fallback to file copy if VACUUM INTO fails (e.g., older SQLite)
                    console.warn('VACUUM INTO failed, falling back to file copy:', err.message);
                    try {
                        fs.copyFileSync(this.dbPath, backupPath);
                        resolve({ success: true, method: 'copy', path: backupPath });
                    } catch (copyErr) {
                        reject(copyErr);
                    }
                } else {
                    resolve({ success: true, method: 'vacuum', path: backupPath });
                }
            });
        });
    }

    getBackups() {
        try {
            const files = fs.readdirSync(this.backupDir)
                .filter(file => file.endsWith('.db'))
                .map(file => {
                    const stats = fs.statSync(path.join(this.backupDir, file));
                    return {
                        filename: file,
                        path: path.join(this.backupDir, file),
                        size: stats.size,
                        created: stats.birthtime
                    };
                })
                .sort((a, b) => b.created - a.created); // Newest first
            return files;
        } catch (err) {
            console.error('Error listing backups:', err);
            return [];
        }
    }
}

module.exports = new BackupService();
