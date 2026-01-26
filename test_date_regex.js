
const testFilenames = [
    '22-01-2569-1.xlsx',
    '1-1-2569.xlsx',
    '05.05.2570.xlsx',
    'invalid-name.xlsx'
];

testFilenames.forEach(filename => {
    console.log(`Testing: ${filename}`);
    const dateMatch = filename.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);

    if (dateMatch) {
        let day = parseInt(dateMatch[1]);
        let month = parseInt(dateMatch[2]);
        let year = parseInt(dateMatch[3]);

        if (year > 2400) year -= 543;

        try {
            const newDate = new Date(year, month - 1, day);
            const yyyy = newDate.getFullYear();
            const mm = String(newDate.getMonth() + 1).padStart(2, '0');
            const dd = String(newDate.getDate()).padStart(2, '0');
            console.log(`  -> Extracted: ${yyyy}-${mm}-${dd}`);
        } catch (e) {
            console.log('  -> Date Error');
        }
    } else {
        console.log('  -> No Date Found');
    }
    console.log('---');
});
