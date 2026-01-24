import React, { useEffect, useState } from 'react';
import { getAddressByZipCode, AddressResult } from '../services/AddressService';
import { MapPin, X, Loader2, Navigation } from 'lucide-react';

interface AddressDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    zipCode: string;
}

const AddressDetailModal: React.FC<AddressDetailModalProps> = ({ isOpen, onClose, zipCode }) => {
    const [addresses, setAddresses] = useState<AddressResult[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && zipCode) {
            setLoading(true);
            // Simulate a small delay for better UX or if we swap to async later
            setTimeout(() => {
                const results = getAddressByZipCode(zipCode);
                // Filter to ensure exact match if the library does partial string matching
                const exactMatches = results.filter(r => r.zipcode === zipCode);
                // If no exact matches, show all (maybe user typed partial?) - but for this use case we usually click a full zip.
                // But let's fallback to results if exactMatches is empty, although for "10110" it should match.
                setAddresses(exactMatches.length > 0 ? exactMatches : results);
                setLoading(false);
            }, 300);
        }
    }, [isOpen, zipCode]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden animate-scale-up">

                {/* Header */}
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                            <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">ตรวจสอบรหัสไปรษณีย์</h3>
                            <p className="text-sm font-mono font-bold text-indigo-600 tracking-wider h-5">{zipCode}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-0 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin mb-2 text-indigo-500" />
                            <p className="text-sm">กำลังค้นหาข้อมูล...</p>
                        </div>
                    ) : addresses.length > 0 ? (
                        <div className="divide-y divide-slate-100">
                            <div className="bg-slate-50/50 px-4 py-2 text-xs font-bold text-slate-500 uppercase flex">
                                <span className="flex-1">ตำบล/แขวง</span>
                                <span className="flex-1">อำเภอ/เขต</span>
                                <span className="flex-1 text-right">จังหวัด</span>
                            </div>
                            {addresses.map((addr, idx) => (
                                <div key={idx} className="px-4 py-3 hover:bg-indigo-50/30 transition-colors flex items-center text-sm">
                                    <div className="flex-1 font-medium text-slate-700">{addr.district}</div>
                                    <div className="flex-1 text-slate-600">{addr.amphoe}</div>
                                    <div className="flex-1 text-right font-bold text-indigo-700">{addr.province}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <Navigation className="w-10 h-10 mb-3 opacity-20" />
                            <p className="font-semibold text-slate-600">ไม่พบข้อมูลพื้นที่</p>
                            <p className="text-xs mt-1">รหัสไปรษณีย์อาจไม่ถูกต้อง</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 text-center">
                    <p className="text-xs text-slate-400">
                        * ข้อมูลอ้างอิงจากฐานข้อมูลรหัสไปรษณีย์ไทย
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AddressDetailModal;
