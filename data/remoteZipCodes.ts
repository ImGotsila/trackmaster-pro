export const remoteZipCodes = [
    // --- Islands & Special Areas ---
    "20120", // Koh Sichang (Chon Buri)
    "23000", // Trat (Muang - some islands)
    "23120", // Koh Chang (Trat)
    "23170", // Koh Kood (Trat)
    "50240", // Chiang Mai (selected remote)
    "50250", // Chiang Mai (selected remote)
    "50260", // Chiang Mai (selected remote)
    "50270", // Chiang Mai (selected remote)
    "50310", // Chiang Mai (selected remote)
    "50350", // Chiang Mai (selected remote)
    "51160", // Lamphun (Li)
    "52160", // Lampang (Wang Nuea)
    "55xxx", // Nan (Many users consider Nan remote, listing specific ones ideally)
    "58xxx", // Mae Hong Son (Entire province often considered remote)
    "63xxx", // Tak (Border areas like Umphang)
    "81150", // Koh Lanta (Krabi)
    "84280", // Koh Phangan (Surat Thani)
    "84360", // Koh Tao (Surat Thani)
    "82160", // Phang Nga (Koh Yao)

    // --- 3 Southern Border Provinces (Often +Surcharge) ---
    // Pattani
    "94000", "94110", "94120", "94130", "94140", "94150", "94160", "94170", "94180", "94190", "94220", "94230",
    // Yala
    "95000", "95110", "95120", "95130", "95140", "95150", "95160", "95170",
    // Narathiwat
    "96000", "96110", "96120", "96130", "96140", "96150", "96160", "96170", "96180", "96190", "96210", "96220",

    // --- Mae Hong Son (All Zips) ---
    "58000", "58110", "58120", "58130", "58140", "58150", "58160",

    // --- Tak (Remote) ---
    "63170", // Umphang

    // --- Kanchanaburi (Remote) ---
    "71180", // Thong Pha Phum
    "71240", // Sangkhla Buri

    // --- Nan (Remote) ---
    "55xxx" // Placeholder for Nan remote logic if needed, but listing specific is better.
    // Real implementation would be exhaustive list.
];

export const isRemoteArea = (zipCode: string): boolean => {
    if (!zipCode) return false;

    // Check exact match
    if (remoteZipCodes.includes(zipCode)) return true;

    // Check ranges/wildcards if implemented
    // Mae Hong Son (All 58xxx)
    if (zipCode.startsWith("58")) return true;

    // Nan (Many remote, simplified here for 'mountainous')
    // if (zipCode.startsWith("55")) return true; 

    // Yala, Pattani, Narathiwat (All)
    if (zipCode.startsWith("94") || zipCode.startsWith("95") || zipCode.startsWith("96")) return true;

    return false;
};
