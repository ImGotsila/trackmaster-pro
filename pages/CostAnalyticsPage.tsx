import React, { useMemo, useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { thaiProvinces } from '../data/thaiProvinces';
import { getAddressByZipCode } from '../services/AddressService';
import { Map as MapIcon, Info, TrendingUp, DollarSign, Search, RefreshCw, MapPin, Filter, ArrowUpRight, Target, Wallet } from 'lucide-react';

// Helper component to control map zoom/pan AND track zoom level
const MapController: React.FC<{
    selectedZip: string | null,
    data: any[],
    onZoomChange: (zoom: number) => void
}> = ({ selectedZip, data, onZoomChange }) => {
    const map = useMap();

    useMapEvents({
        zoomend: () => onZoomChange(map.getZoom())
    });

    useEffect(() => {
        if (selectedZip && data.length > 0) {
            const point = data.find(p => p.zipCode === selectedZip);
            if (point) {
                map.setView([point.lat, point.lng], 12, { animate: true });
            }
        }
    }, [selectedZip, data, map]);

    return null;
};

const CostAnalyticsPage: React.FC = () => {
    const { shipments } = useData();
    const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
    const [provinceData, setProvinceData] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, status: '' });
    const [currentZoom, setCurrentZoom] = useState(6);
    const [costFilter, setCostFilter] = useState(0);

    // Track chosen coordinate for auto-zoom
    const [focusPoint, setFocusPoint] = useState<{ lat: number, lng: number } | null>(null);

    // Compute analytics client-side
    const computeAnalytics = async () => {
        const stats = new Map<string, {
            zipCode: string;
            province: string;
            district: string;
            count: number;
            totalCost: number;
            avgCost: number;
        }>();
        const total = shipments.length;
        const CHUNK_SIZE = 150;

        setProgress({ current: 0, total, status: 'วิเคราะห์ข้อมูลค่าจัดส่ง...' });

        for (let i = 0; i < total; i += CHUNK_SIZE) {
            const chunk = shipments.slice(i, Math.min(i + CHUNK_SIZE, total));
            await new Promise(resolve => setTimeout(resolve, 0));

            chunk.forEach(s => {
                if (!s.zipCode) return;
                const addresses = getAddressByZipCode(s.zipCode);
                if (addresses.length === 0) return;

                const addressInfo = addresses[0];
                const zipKey = s.zipCode;

                const existing = stats.get(zipKey);
                if (existing) {
                    existing.count++;
                    existing.totalCost += (s.shippingCost || 0);
                    existing.avgCost = existing.totalCost / existing.count;
                } else {
                    stats.set(zipKey, {
                        zipCode: s.zipCode,
                        province: addressInfo.province,
                        district: addressInfo.amphoe || addressInfo.district || 'ไม่ระบุ',
                        count: 1,
                        totalCost: (s.shippingCost || 0),
                        avgCost: (s.shippingCost || 0)
                    });
                }
            });

            const current = Math.min(i + CHUNK_SIZE, total);
            setProgress({ current, total, status: `กำลังวิเคราะห์... (${current}/${total})` });
        }

        return Array.from(stats.values()).sort((a, b) => b.avgCost - a.avgCost);
    };

    const getUniqueCoordinates = (zipCode: string, baseProvince: string) => {
        const cleanedProvince = baseProvince?.trim();
        const provinceInfo = thaiProvinces.find(p =>
            p.provinceThai === cleanedProvince ||
            p.province === cleanedProvince ||
            (cleanedProvince && p.provinceThai.includes(cleanedProvince)) ||
            (cleanedProvince && cleanedProvince.includes(p.provinceThai))
        );
        const baseLat = provinceInfo?.lat || 13.7563;
        const baseLng = provinceInfo?.lng || 100.5018;
        const seed = parseInt(zipCode) || zipCode.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        const angle = (seed * 137.5) % 360;
        const radius = 0.1 + ((seed * 23) % 100) / 100 * 0.35;

        return {
            lat: baseLat + Math.cos(angle * (Math.PI / 180)) * radius,
            lng: baseLng + Math.sin(angle * (Math.PI / 180)) * radius,
            isMatched: !!provinceInfo
        };
    };

    // Color scaling by Average Cost
    const getCostColor = (avg: number, max: number) => {
        if (avg > 80) return '#7c3aed'; // Deep Purple (Expensive)
        if (avg > 50) return '#ef4444'; // Red
        if (avg > 40) return '#f97316'; // Orange
        if (avg > 30) return '#059669'; // Green (Standard)
        return '#10b981'; // Emerald (Cheap)
    };

    const fetchAnalyticsData = async () => {
        setIsLoading(true);
        try {
            // We use same API but re-map for cost focus
            const res = await fetch(`/api/analytics/geo?t=${Date.now()}`);
            let data = [];
            if (res.ok) {
                data = await res.json();
            } else {
                data = await computeAnalytics();
            }

            const mappedData = data.map((item: any) => {
                const coords = getUniqueCoordinates(item.zipCode, item.province);
                const avgCost = item.totalCost / Math.max(1, item.count);
                return { ...item, ...coords, avgCost };
            });

            setProvinceData(mappedData.filter((p: any) => p.count > 0));
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
            setProgress({ current: 0, total: 0, status: '' });
        }
    };

    useEffect(() => { fetchAnalyticsData(); }, []);

    const maxAvgCost = Math.max(...provinceData.map(p => p.avgCost), 1);

    return (
        <div className="space-y-6 animate-fade-in h-[calc(100vh-100px)] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 shrink-0">
                <div className="flex items-center space-x-3">
                    <div className="bg-indigo-600 p-2 rounded-lg text-white">
                        <DollarSign className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            วิเคราะห์ค่าจัดส่งตามพื้นที่ <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-mono">Heatmap</span>
                        </h1>
                        <p className="text-sm text-slate-500">
                            วิเคราะห์ความคุ้มค่าและต้นทุนค่าขนส่งรายรหัสไปรษณีย์
                        </p>
                    </div>
                </div>
                <div className="flex gap-4 items-center">
                    <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-lg border border-slate-200">
                        <Filter className="w-4 h-4 text-slate-500" />
                        <span className="text-xs font-bold text-slate-600">ค่าส่งเฉลี่ย {'>'}</span>
                        <select
                            value={costFilter}
                            onChange={(e) => setCostFilter(Number(e.target.value))}
                            className="bg-transparent text-sm font-bold text-indigo-600 focus:outline-none"
                        >
                            <option value={0}>ทั้งหมด</option>
                            <option value={40}>฿40+</option>
                            <option value={60}>฿60+</option>
                            <option value={80}>฿80+</option>
                        </select>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="ค้นหารหัสไปรษณีย์..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56 shadow-sm"
                        />
                    </div>
                    <button
                        onClick={fetchAnalyticsData}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold bg-white border-2 border-indigo-500 text-indigo-600 hover:bg-indigo-50 shadow-sm transition-all"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        {isLoading ? '...' : 'รีเฟรช'}
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
                <div className="flex-1 bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden relative">
                    <MapContainer center={[13.7563, 100.5018]} zoom={6} style={{ height: '100%', width: '100%' }}>
                        <MapController selectedZip={selectedProvince} data={provinceData} onZoomChange={setCurrentZoom} />
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                        {provinceData
                            .filter(p => (!searchTerm || p.zipCode.includes(searchTerm)) && p.avgCost >= costFilter)
                            .map((data, idx) => (
                                <CircleMarker
                                    key={idx}
                                    center={[data.lat, data.lng]}
                                    pathOptions={{
                                        color: selectedProvince === data.zipCode ? '#000' : getCostColor(data.avgCost, maxAvgCost),
                                        fillColor: getCostColor(data.avgCost, maxAvgCost),
                                        fillOpacity: 0.7,
                                        weight: selectedProvince === data.zipCode ? 3 : 1
                                    }}
                                    radius={(3 + Math.sqrt(data.count) * 1.5) * Math.pow(currentZoom / 6, 1.2)}
                                    eventHandlers={{ click: () => setSelectedProvince(data.zipCode) }}
                                >
                                    <Tooltip direction="top">
                                        <div className="text-center">
                                            <b className="text-indigo-700">{data.zipCode}</b><br />
                                            <span className="text-xs font-bold">ค่าส่งเฉลี่ย: ฿{Math.round(data.avgCost)}</span>
                                        </div>
                                    </Tooltip>
                                    <Popup>
                                        <div className="p-2">
                                            <h4 className="font-bold border-b pb-1 mb-2">{data.zipCode} (อ.{data.district})</h4>
                                            <div className="space-y-1 text-sm">
                                                <p className="flex justify-between gap-4"><span>จำนวนส่ง:</span><span className="font-bold">{data.count} ชิ้น</span></p>
                                                <p className="flex justify-between gap-4"><span>รวมค่าส่ง:</span><span className="font-bold text-indigo-600">฿{data.totalCost.toLocaleString()}</span></p>
                                                <p className="flex justify-between gap-4 border-t pt-1 mt-1"><span>ค่าส่งเฉลี่ย:</span><span className="font-bold text-rose-600">฿{Math.round(data.avgCost)}</span></p>
                                            </div>
                                        </div>
                                    </Popup>
                                </CircleMarker>
                            ))}
                    </MapContainer>

                    {/* Cost Legend */}
                    <div className="absolute bottom-4 left-4 z-[400] bg-white/90 p-3 rounded-xl border border-slate-200 shadow-lg space-y-2">
                        <p className="text-[10px] font-bold text-slate-500 uppercase">ระดับค่าจัดส่ง</p>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#7c3aed]"></div><span className="text-[10px] font-bold tracking-tight">สูงมาก (>฿80)</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#ef4444]"></div><span className="text-[10px] font-bold tracking-tight">สูง (฿50-80)</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#f97316]"></div><span className="text-[10px] font-bold tracking-tight">ปกติ (฿40-50)</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#10b981]"></div><span className="text-[10px] font-bold tracking-tight">ต่ำ (<฿40)</span></div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="w-full lg:w-96 bg-white rounded-2xl border border-slate-200 flex flex-col shrink-0 overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b font-bold text-slate-800 flex items-center justify-between">
                        <span>สรุปต้นทุนรายพื้นที่</span>
                        <Wallet className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
                        <div className="grid grid-cols-2 gap-3 mb-2">
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 mb-1 uppercase">ค่าส่งรวม</p>
                                <p className="text-lg font-black text-slate-800">฿{provinceData.reduce((sum, p) => sum + p.totalCost, 0).toLocaleString()}</p>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 mb-1 uppercase">เฉลี่ยต่อชิ้น</p>
                                <p className="text-lg font-black text-indigo-600">฿{Math.round(provinceData.reduce((sum, p) => sum + p.totalCost, 0) / Math.max(1, provinceData.reduce((sum, p) => sum + p.count, 0)))}</p>
                            </div>
                        </div>

                        {provinceData
                            .filter(p => !searchTerm || p.zipCode.includes(searchTerm))
                            .map((data, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => setSelectedProvince(data.zipCode)}
                                    className={`p-3 rounded-xl border transition-all cursor-pointer ${selectedProvince === data.zipCode ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 hover:bg-slate-50'}`}
                                >
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <span className="font-bold text-slate-800">{data.zipCode}</span>
                                            <p className="text-[10px] text-slate-500">อ.{data.district}, {data.province}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm font-black text-rose-600">฿{Math.round(data.avgCost)}</span>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">{data.count} ORDERS</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CostAnalyticsPage;
