export interface ProvinceCoordinate {
    province: string;
    lat: number;
    lng: number;
}

export const thaiProvinces: ProvinceCoordinate[] = [
    { province: "กรุงเทพมหานคร", lat: 13.7563, lng: 100.5018 },
    { province: "Samut Prakan", lat: 13.5991, lng: 100.5966 }, // สมุทรปราการ
    { province: "Nonthaburi", lat: 13.8591, lng: 100.5217 }, // นนทบุรี
    { province: "Pathum Thani", lat: 14.0208, lng: 100.5250 }, // ปทุมธานี
    { province: "Phra Nakhon Si Ayutthaya", lat: 14.3532, lng: 100.5684 }, // พระนครศรีอยุธยา
    { province: "Ang Thong", lat: 14.5896, lng: 100.4550 }, // อ่างทอง
    { province: "Lopburi", lat: 14.7995, lng: 100.6534 }, // ลพบุรี
    { province: "Sing Buri", lat: 14.8919, lng: 100.3956 }, // สิงห์บุรี
    { province: "Chai Nat", lat: 15.1852, lng: 100.1251 }, // ชัยนาท
    { province: "Saraburi", lat: 14.5289, lng: 100.9101 }, // สระบุรี
    { province: "Chon Buri", lat: 13.3611, lng: 100.9847 }, // ชลบุรี
    { province: "Rayong", lat: 12.6812, lng: 101.2816 }, // ระยอง
    { province: "Chanthaburi", lat: 12.6114, lng: 102.1039 }, // จันทบุรี
    { province: "Trat", lat: 12.2428, lng: 102.5175 }, // ตราด
    { province: "Chachoengsao", lat: 13.6904, lng: 101.0780 }, // ฉะเชิงเทรา
    { province: "Prachin Buri", lat: 14.0620, lng: 101.3783 }, // ปราจีนบุรี
    { province: "Nakhon Nayok", lat: 14.2069, lng: 101.2131 }, // นครนายก
    { province: "Sa Kaeo", lat: 13.8050, lng: 102.0722 }, // สระแก้ว
    { province: "Nakhon Ratchasima", lat: 14.9751, lng: 102.1000 }, // นครราชสีมา
    { province: "Buri Ram", lat: 14.9930, lng: 103.1029 }, // บุรีรัมย์
    { province: "Surin", lat: 14.8824, lng: 103.4930 }, // สุรินทร์
    { province: "Si Sa Ket", lat: 15.1186, lng: 104.3220 }, // ศรีสะเกษ
    { province: "Ubon Ratchathani", lat: 15.2448, lng: 104.8473 }, // อุบลราชธานี
    { province: "Yasothon", lat: 15.7924, lng: 104.1451 }, // ยโสธร
    { province: "Chaiyaphum", lat: 15.8063, lng: 102.0315 }, // ชัยภูมิ
    { province: "Amnat Charoen", lat: 15.8657, lng: 104.6258 }, // อำนาจเจริญ
    { province: "Bueng Kan", lat: 18.3633, lng: 103.6555 }, // บึงกาฬ
    { province: "Nong Bua Lam Phu", lat: 17.2044, lng: 102.4407 }, // หนองบัวลำภู
    { province: "Khon Kaen", lat: 16.4322, lng: 102.8236 }, // ขอนแก่น
    { province: "Udon Thani", lat: 17.4156, lng: 102.7872 }, // อุดรธานี
    { province: "Loei", lat: 17.4860, lng: 101.7223 }, // เลย
    { province: "Nong Khai", lat: 17.8785, lng: 102.7413 }, // หนองคาย
    { province: "Maha Sarakham", lat: 16.1852, lng: 103.3007 }, // มหาสารคาม
    { province: "Roi Et", lat: 16.0538, lng: 103.6520 }, // ร้อยเอ็ด
    { province: "Kalasin", lat: 16.4293, lng: 103.5065 }, // กาฬสินธุ์
    { province: "Sakon Nakhon", lat: 17.1622, lng: 104.1487 }, // สกลนคร
    { province: "Nakhon Phanom", lat: 17.3994, lng: 104.7951 }, // นครพนม
    { province: "Mukdahan", lat: 16.5434, lng: 104.7235 }, // มุกดาหาร
    { province: "Chiang Mai", lat: 18.7904, lng: 98.9847 }, // เชียงใหม่
    { province: "Lamphun", lat: 18.5758, lng: 99.0087 }, // ลำพูน
    { province: "Lampang", lat: 18.2888, lng: 99.4928 }, // ลำปาง
    { province: "Uttaradit", lat: 17.6201, lng: 100.0993 }, // อุตรดิตถ์
    { province: "Phrae", lat: 18.1446, lng: 100.1403 }, // แพร่
    { province: "Nan", lat: 18.7832, lng: 100.7783 }, // น่าน
    { province: "Phayao", lat: 19.1662, lng: 99.9016 }, // พะเยา
    { province: "Chiang Rai", lat: 19.9105, lng: 99.8406 }, // เชียงราย
    { province: "Mae Hong Son", lat: 19.3020, lng: 97.9654 }, // แม่ฮ่องสอน
    { province: "Nakhon Sawan", lat: 15.7001, lng: 100.1378 }, // นครสวรรค์
    { province: "Uthai Thani", lat: 15.3835, lng: 100.0246 }, // อุทัยธานี
    { province: "Kamphaeng Phet", lat: 16.4828, lng: 99.5227 }, // กำแพงเพชร
    { province: "Tak", lat: 16.8837, lng: 99.1172 }, // ตาก
    { province: "Sukhothai", lat: 17.0099, lng: 99.8264 }, // สุโขทัย
    { province: "Phitsanulok", lat: 16.8211, lng: 100.2659 }, // พิษณุโลก
    { province: "Phichit", lat: 16.4418, lng: 100.3503 }, // พิจิตร
    { province: "Phetchabun", lat: 16.4190, lng: 101.1567 }, // เพชรบูรณ์
    { province: "Ratchaburi", lat: 13.5284, lng: 99.8134 }, // ราชบุรี
    { province: "Kanchanaburi", lat: 14.0230, lng: 99.5328 }, // กาญจนบุรี
    { province: "Suphan Buri", lat: 14.4715, lng: 100.1169 }, // สุพรรณบุรี
    { province: "Nakhon Pathom", lat: 13.8188, lng: 100.0373 }, // นครปฐม
    { province: "Samut Sakhon", lat: 13.5475, lng: 100.2736 }, // สมุทรสาคร
    { province: "Samut Songkhram", lat: 13.4098, lng: 100.0023 }, // สมุทรสงคราม
    { province: "Phetchaburi", lat: 13.1129, lng: 99.9392 }, // เพชรบุรี
    { province: "Prachuap Khiri Khan", lat: 11.8124, lng: 99.7956 }, // ประจวบคีรีขันธ์
    { province: "Nakhon Si Thammarat", lat: 8.4116, lng: 99.9677 }, // นครศรีธรรมราช
    { province: "Krabi", lat: 8.0855, lng: 98.9063 }, // กระบี่
    { province: "Phangnga", lat: 8.4509, lng: 98.5298 }, // พังงา
    { province: "Phuket", lat: 7.9519, lng: 98.3381 }, // ภูเก็ต
    { province: "Surat Thani", lat: 9.1382, lng: 99.3182 }, // สุราษฎร์ธานี
    { province: "Ranong", lat: 9.9529, lng: 98.6348 }, // ระนอง
    { province: "Chumphon", lat: 10.4930, lng: 99.1800 }, // ชุมพร
    { province: "Songkhla", lat: 7.1819, lng: 100.6127 }, // สงขลา
    { province: "Satun", lat: 6.6491, lng: 100.0674 }, // สตูล
    { province: "Trang", lat: 7.5645, lng: 99.6239 }, // ตรัง
    { province: "Phatthalung", lat: 7.6171, lng: 100.0768 }, // พัทลุง
    { province: "Pattani", lat: 6.8696, lng: 101.2503 }, // ปัตตานี
    { province: "Yala", lat: 6.5411, lng: 101.2804 }, // ยะลา
    { province: "Narathiwat", lat: 6.4255, lng: 101.8253 } // นราธิวาส
];
