// Test if range filters work
const testData = [
    { weight: 15, codAmount: 100, profit: -50, cost: 150 },
    { weight: 10, codAmount: 200, profit: 50, cost: 150 }
];

const testFilters = {
    'min_weight': '12',
    'max_cod': '150'
};

console.log('Testing range filters...');
testData.forEach((item, i) => {
    console.log(`\nItem ${i}:`, item);

    // Test min_weight
    const minWeight = parseFloat(testFilters.min_weight);
    const passesMin = item.weight >= minWeight;
    console.log(`  min_weight (${minWeight}): ${item.weight} >= ${minWeight} = ${passesMin}`);

    // Test max_cod  
    const maxCod = parseFloat(testFilters.max_cod);
    const passesMax = item.codAmount <= maxCod;
    console.log(`  max_cod (${maxCod}): ${item.codAmount} <= ${maxCod} = ${passesMax}`);

    console.log(`  RESULT: ${passesMin && passesMax ? 'PASS' : 'FAIL'}`);
});
