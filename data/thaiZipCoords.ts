export interface ZipCoord {
    lat: number;
    lng: number;
    name: string; // District/Amphoe Name
    province: string;
}

// A collection of Major Thai Districts and their coordinates
// This improves accuracy beyond just Province Centers
export const thaiZipCoords: Record<string, ZipCoord> = {
    // --- Bangkok (10xxx) ---
    "10100": { lat: 13.7589, lng: 100.5307, name: "Pomprap Sattruphai", province: "Bangkok" }, // Mueang
    "10110": { lat: 13.7314, lng: 100.5750, name: "Watthana", province: "Bangkok" },
    "10120": { lat: 13.7058, lng: 100.5284, name: "Sathon", province: "Bangkok" },
    "10140": { lat: 13.6826, lng: 100.5042, name: "Thung Khru", province: "Bangkok" },
    "10150": { lat: 13.6934, lng: 100.4485, name: "Bang Khun Thian", province: "Bangkok" },
    "10160": { lat: 13.7093, lng: 100.3704, name: "Nong Khaem", province: "Bangkok" },
    "10170": { lat: 13.7786, lng: 100.3845, name: "Taling Chan", province: "Bangkok" },
    "10210": { lat: 13.8821, lng: 100.5694, name: "Lak Si", province: "Bangkok" },
    "10220": { lat: 13.8565, lng: 100.6136, name: "Sai Mai", province: "Bangkok" },
    "10230": { lat: 13.8183, lng: 100.6558, name: "Khan Na Yao", province: "Bangkok" },
    "10240": { lat: 13.7801, lng: 100.6692, name: "Bang Kapi", province: "Bangkok" },
    "10250": { lat: 13.7346, lng: 100.6384, name: "Suan Luang", province: "Bangkok" },
    "10260": { lat: 13.6738, lng: 100.6171, name: "Bang Na", province: "Bangkok" },
    "10310": { lat: 13.7833, lng: 100.6000, name: "Lat Phrao", province: "Bangkok" },
    "10330": { lat: 13.7432, lng: 100.5330, name: "Pathum Wan", province: "Bangkok" },
    "10400": { lat: 13.7745, lng: 100.5401, name: "Phaya Thai", province: "Bangkok" },
    "10500": { lat: 13.7258, lng: 100.5215, name: "Bang Rak", province: "Bangkok" },
    "10510": { lat: 13.6062, lng: 100.5739, name: "Min Buri", province: "Bangkok" }, // Adjusted
    "10520": { lat: 13.7302, lng: 100.7583, name: "Lat Krabang", province: "Bangkok" },
    "10530": { lat: 13.8446, lng: 100.7163, name: "Nong Chok", province: "Bangkok" },
    "10540": { lat: 13.5855, lng: 100.6974, name: "Bang Phli", province: "Samut Prakan" }, // Common crossover

    // --- Major Tourist/Economy Nodes ---
    "20150": { lat: 12.9278, lng: 100.8787, name: "Pattaya / Bang Lamung", province: "Chon Buri" },
    "20180": { lat: 12.7225, lng: 100.8906, name: "Sattahip", province: "Chon Buri" },
    "90110": { lat: 7.0084, lng: 100.4764, name: "Hat Yai", province: "Songkhla" },
    "77110": { lat: 12.5683, lng: 99.9576, name: "Hua Hin", province: "Prachuap Khiri Khan" },
    "84320": { lat: 9.5126, lng: 100.0588, name: "Ko Samui", province: "Surat Thani" },
    "83150": { lat: 7.8885, lng: 98.2934, name: "Patong", province: "Phuket" },
    "83100": { lat: 8.0055, lng: 98.3183, name: "Thalang", province: "Phuket" }, // Near Airport
    "30130": { lat: 14.7075, lng: 101.4172, name: "Pak Chong", province: "Nakhon Ratchasima" },
    "50200": { lat: 18.9142, lng: 99.0066, name: "San Sai", province: "Chiang Mai" },
    "50300": { lat: 18.6946, lng: 98.9221, name: "Hang Dong", province: "Chiang Mai" },

    // --- Province Mueang Centers (Top 30 by Pop) ---
    "10270": { lat: 13.5991, lng: 100.5966, name: "Mueang Samut Prakan", province: "Samut Prakan" },
    "11000": { lat: 13.8591, lng: 100.5217, name: "Mueang Nonthaburi", province: "Nonthaburi" },
    "12000": { lat: 14.0208, lng: 100.5250, name: "Mueang Pathum Thani", province: "Pathum Thani" },
    "13000": { lat: 14.3532, lng: 100.5684, name: "Mueang Ayutthaya", province: "Ayutthaya" },
    "20000": { lat: 13.3611, lng: 100.9847, name: "Mueang Chon Buri", province: "Chon Buri" },
    "30000": { lat: 14.9751, lng: 102.1000, name: "Mueang Korat", province: "Nakhon Ratchasima" },
    "40000": { lat: 16.4322, lng: 102.8236, name: "Mueang Khon Kaen", province: "Khon Kaen" },
    "50000": { lat: 18.7904, lng: 98.9847, name: "Mueang Chiang Mai", province: "Chiang Mai" },
    "90000": { lat: 7.1819, lng: 100.6127, name: "Mueang Songkhla", province: "Songkhla" },
    "83000": { lat: 7.9519, lng: 98.3381, name: "Mueang Phuket", province: "Phuket" },
    "21000": { lat: 12.6812, lng: 101.2816, name: "Mueang Rayong", province: "Rayong" },
    "60000": { lat: 15.7001, lng: 100.1378, name: "Mueang Nakhon Sawan", province: "Nakhon Sawan" },
    "41000": { lat: 17.4156, lng: 102.7872, name: "Mueang Udon Thani", province: "Udon Thani" },
    "31000": { lat: 14.9930, lng: 103.1029, name: "Mueang Buri Ram", province: "Buri Ram" },
    "32000": { lat: 14.8824, lng: 103.4930, name: "Mueang Surin", province: "Surin" },
    "33000": { lat: 15.1186, lng: 104.3220, name: "Mueang Sisaket", province: "Si Sa Ket" },
    "34000": { lat: 15.2448, lng: 104.8473, name: "Mueang Ubon", province: "Ubon Ratchathani" },
    "65000": { lat: 16.8211, lng: 100.2659, name: "Mueang Phitsanulok", province: "Phitsanulok" },
    "73000": { lat: 13.8188, lng: 100.0373, name: "Mueang Nakhon Pathom", province: "Nakhon Pathom" },
    "74000": { lat: 13.5475, lng: 100.2736, name: "Mueang Samut Sakhon", province: "Samut Sakhon" },
    "84000": { lat: 9.1382, lng: 99.3182, name: "Mueang Surat Thani", province: "Surat Thani" },
    "80000": { lat: 8.4116, lng: 99.9677, name: "Mueang Nakhon Si", province: "Nakhon Si Thammarat" },
    "57000": { lat: 19.9105, lng: 99.8406, name: "Mueang Chiang Rai", province: "Chiang Rai" },
    "81000": { lat: 8.0855, lng: 98.9063, name: "Mueang Krabi", province: "Krabi" },
    "76000": { lat: 13.1129, lng: 99.9392, name: "Mueang Phetchaburi", province: "Phetchaburi" },
    "70000": { lat: 13.5284, lng: 99.8134, name: "Mueang Ratchaburi", province: "Ratchaburi" },
    "19000": { lat: 14.5289, lng: 100.9101, name: "Mueang Saraburi", province: "Saraburi" },
    "18000": { lat: 15.1852, lng: 100.1251, name: "Mueang Chainat", province: "Chainat" }
};
