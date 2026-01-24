const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../node_modules/thai-address-database/database');
const targetDir = path.resolve(__dirname, '../public/data');

if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

// List all files in srcDir
if (fs.existsSync(srcDir)) {
    const files = fs.readdirSync(srcDir);
    console.log(`Files in ${srcDir}:`, files);
    files.forEach(file => {
        if (file.endsWith('.json')) {
            fs.copyFileSync(path.join(srcDir, file), path.join(targetDir, file));
            console.log(`Copied ${file} to ${targetDir}`);
        }
    });
} else {
    console.error(`Directory not found: ${srcDir}`);
}
