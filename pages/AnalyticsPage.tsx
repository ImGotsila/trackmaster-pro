import React, { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { thaiProvinces } from '../data/thaiProvinces';
import { getAddressByZipCode } from '../services/AddressService';
import { Map as MapIcon, Info, TrendingUp, DollarSign } from 'lucide-react';

const AnalyticsPage: React.FC = () => {
    const { shipments } = useData();
    const [selectedProvince, setSelectedProvince] = useState<string | null>(null);

    // Aggregate data by Province
    const provinceData = useMemo(() => {
        const stats = new Map<string, { count: number; totalCOD: number; shippingCost: number }>();

        shipments.forEach(s => {
            if (!s.zipCode) return;

            // Resolve Province from ZipCode
            const addresses = getAddressByZipCode(s.zipCode);
            if (addresses.length === 0) return;

            // Use the first resolved province (usually primary)
            // Normalize vague names if necessary, but library usually consistent
            const provinceName = addresses[0].province;

            const existing = stats.get(provinceName);
            if (existing) {
                existing.count++;
                existing.totalCOD += (s.codAmount || 0);
                existing.shippingCost += (s.shippingCost || 0);
            } else {
                stats.set(provinceName, {
                    count: 1,
                    totalCOD: (s.codAmount || 0),
                    shippingCost: (s.shippingCost || 0)
                });
            }
        });

        // Map stats to coordinates
        return thaiProvinces.map(p => {
            const stat = stats.get(p.province) || { count: 0, totalCOD: 0, shippingCost: 0 };
            return {
                ...p,
                ...stat
            };
        }).filter(p => p.count > 0).sort((a, b) => b.count - a.count);

    }, [shipments]);

    // Calculate max count for dynamic scaling
    const maxCount = Math.max(...provinceData.map(p => p.count), 1);

    return (
        <div className="space-y-6 animate-fade-in h-[calc(100vh-100px)] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 shrink-0">
                <div className="flex items-center space-x-3">
                    <MapIcon className="w-8 h-8 text-indigo-600" />
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">วิเคราะห์พื้นที่ (Geo Analytics)</h1>
                        <p className="text-sm text-slate-500">แผนที่แสดงความหนาแน่นของการจัดส่งสินค้าทั่วประเทศไทย</p>
                    </div>
                </div>
                <div className="flex gap-4 text-sm font-semibold text-slate-600">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                        <span>Volume สูง</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-indigo-200"></div>
                        <span>Volume ต่ำ</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">

                {/* Map Container */}
                <div className="flex-1 bg-slate-50 rounded-2xl shadow-inner border border-slate-200 overflow-hidden relative z-0">
                    <MapContainer
                        center={[13.7563, 100.5018]}
                        zoom={6}
                        style={{ height: '100%', width: '100%' }}
                        scrollWheelZoom={true}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        {provinceData.map((data, idx) => (
                            <CircleMarker
                                key={idx}
                                center={[data.lat, data.lng]}
                                pathOptions={{
                                    color: '#4f46e5',
                                    fillColor: '#6366f1',
                                    fillOpacity: 0.6,
                                    weight: 1
                                }}
                                radius={5 + (data.count / maxCount) * 40} // Dynamic radius: 5px to 45px
                                eventHandlers={{
                                    click: () => setSelectedProvince(data.province)
                                }}
                            >
                                <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                                    <div className="text-center">
                                        <b className="text-base text-indigo-700">{data.province}</b><br />
                                        <span className="text-slate-600 font-semibold">{data.count} Orders</span>
                                    </div>
                                </Tooltip>
                            </CircleMarker>
                        ))}
                    </MapContainer>

                    {/* Floating Summary Card */}
                    <div className="absolute top-4 right-4 z-[400] bg-white/90 backdrop-blur rounded-xl shadow-lg p-4 border border-slate-100 max-w-[200px]">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-2">ข้อมูลรวมทั้งหมด</p>
                        <h3 className="text-2xl font-bold text-slate-800">{provinceData.reduce((sum, p) => sum + p.count, 0)}</h3>
                        <p className="text-xs text-slate-500 font-medium">รายการจัดส่ง</p>
                        <div className="mt-3 pt-3 border-t border-slate-200">
                            <h3 className="text-lg font-bold text-emerald-600">฿{provinceData.reduce((sum, p) => sum + p.totalCOD, 0).toLocaleString()}</h3>
                            <p className="text-xs text-slate-500 font-medium">ยอก COD รวม</p>
                        </div>
                    </div>
                </div>

                {/* Sidebar Stats */}
                <div className="w-full lg:w-80 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col shrink-0 overflow-hidden h-[300px] lg:h-auto">
                    <div className="p-4 bg-slate-50 border-b border-slate-100 font-bold text-slate-700 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-indigo-500" />
                        อันดับจังหวัด (Top Provinces)
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                        {provinceData.map((data, idx) => (
                            <div
                                key={idx}
                                onClick={() => setSelectedProvince(data.province)}
                                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${selectedProvince === data.province
                                    ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                                    : 'bg-white border-slate-100 hover:bg-slate-50'
                                    }`}
                            >
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${idx < 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                                            }`}>
                                            {idx + 1}
                                        </span>
                                        <span className="font-bold text-slate-700 text-sm">{data.province}</span>
                                    </div>
                                    <div className="text-xs text-emerald-600 font-semibold mt-1 ml-7">
                                        ฿{data.totalCOD.toLocaleString()}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-lg font-bold text-indigo-600 block">{data.count}</span>
                                    <span className="text-[10px] text-slate-400 uppercase font-bold">Orders</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AnalyticsPage;
