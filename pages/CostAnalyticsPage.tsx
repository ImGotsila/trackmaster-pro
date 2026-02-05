import React, { useMemo, useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { thaiProvinces } from '../data/thaiProvinces';
import { isRemoteArea } from '../data/remoteZipCodes';
import { getAddressByZipCode } from '../services/AddressService';
import { Map as MapIcon, Info, TrendingUp, DollarSign, Search, RefreshCw, MapPin, Filter, ArrowUpRight, Target, Wallet, Globe, Mountain } from 'lucide-react';
import Pagination from '../components/Pagination';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';

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
                map.setView([point.lat, point.lng], 10, { animate: true });
            }
        }
    }, [selectedZip, data, map]);

    return null;
};

const CostAnalyticsPage: React.FC = () => {
    const { filteredShipments } = useData();
    const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
    const [provinceData, setProvinceData] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [currentZoom, setCurrentZoom] = useState(6);
    const [costFilter, setCostFilter] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [showRemoteOnly, setShowRemoteOnly] = useState(false);
    const [selectedRegion, setSelectedRegion] = useState<string>('All');

    const ITEMS_PER_PAGE = 20;

    // Compute analytics client-side
    const computeAnalytics = async () => {
        const stats = new Map<string, {
            zipCode: string;
            province: string;
            region: string;
            district: string;
            count: number;
            totalCost: number;
            totalWeight: number;
            avgCost: number;
            codCount?: number;
            transferCount?: number;
            isRemote: boolean;
            remoteSurcharge: number;
        }>();
        const total = filteredShipments.length;
        const CHUNK_SIZE = 500; // Increased chunk size

        // Pre-compute province map for faster region lookup
        const provinceMap = new Map(thaiProvinces.map(p => [p.provinceThai, p.region || 'Unknown']));
        // Fallback or secondary lookup if needed
        const provinceEngMap = new Map(thaiProvinces.map(p => [p.province, p.region || 'Unknown']));


        for (let i = 0; i < total; i += CHUNK_SIZE) {
            const chunk = filteredShipments.slice(i, Math.min(i + CHUNK_SIZE, total));
            // await new Promise(resolve => setTimeout(resolve, 0)); // Non-blocking

            chunk.forEach(s => {
                if (!s.zipCode) return;

                const zipKey = s.zipCode;
                let existing = stats.get(zipKey);

                const weight = s.weight || 0;
                const isCOD = (s.codAmount || 0) > 0;

                if (existing) {
                    existing.count++;
                    existing.totalCost += (s.shippingCost || 0);
                    existing.totalWeight += weight;
                    existing.avgCost = existing.totalCost / existing.count;
                    if (isCOD) existing.codCount = (existing.codCount || 0) + 1;
                    else existing.transferCount = (existing.transferCount || 0) + 1;

                    // Remote Logic
                    if (existing.isRemote) {
                        existing.remoteSurcharge += 20; // +20 per shipment
                        existing.totalCost += 20; // Include surcharge in total cost? Usually yes.
                    }

                } else {
                    // First time seeing this zip
                    const addresses = getAddressByZipCode(s.zipCode);
                    const addressInfo = addresses[0] || { province: 'Unknown', amphoe: 'Unknown', district: 'Unknown' };
                    // Try to limit address calls if possible or cache them if slow. 
                    // AddressService is synchronous local lookup so it should be fast.

                    const isRemote = isRemoteArea(zipKey);
                    const surcharge = isRemote ? 20 : 0;

                    // Resolve Region
                    let region = 'Unknown';
                    // Try Thai Name
                    if (provinceMap.has(addressInfo.province)) region = provinceMap.get(addressInfo.province)!;
                    else if (provinceEngMap.has(addressInfo.province)) region = provinceEngMap.get(addressInfo.province)!;

                    // Fallback to searching thaiProvinces array (slower)
                    if (region === 'Unknown') {
                        const found = thaiProvinces.find(p => addressInfo.province.includes(p.provinceThai));
                        if (found?.region) region = found.region;
                    }


                    stats.set(zipKey, {
                        zipCode: s.zipCode,
                        province: addressInfo.province,
                        region: region,
                        district: addressInfo.amphoe || addressInfo.district || 'ไม่ระบุ',
                        count: 1,
                        totalCost: (s.shippingCost || 0) + surcharge,
                        totalWeight: weight,
                        avgCost: (s.shippingCost || 0) + surcharge,
                        codCount: isCOD ? 1 : 0,
                        transferCount: isCOD ? 0 : 1,
                        isRemote: isRemote,
                        remoteSurcharge: surcharge
                    });
                }
            });
        }

        return Array.from(stats.values()).sort((a, b) => b.avgCost - a.avgCost);
    };

    const getUniqueCoordinates = (zipCode: string, baseProvince: string) => {
        // ... (Same logic, simple lookup)
        const cleanedProvince = baseProvince?.trim();
        const provinceInfo = thaiProvinces.find(p =>
            p.provinceThai === cleanedProvince ||
            p.province === cleanedProvince ||
            (cleanedProvince && p.provinceThai.includes(cleanedProvince)) ||
            (cleanedProvince && cleanedProvince.includes(p.provinceThai))
        );
        const baseLat = provinceInfo?.lat || 13.7563;
        const baseLng = provinceInfo?.lng || 100.5018;
        // Slight jitter for separate zips in same province
        const seed = parseInt(zipCode) || zipCode.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        const angle = (seed * 137.5) % 360;
        const radius = 0.05 + ((seed * 23) % 100) / 100 * 0.2;

        return {
            lat: baseLat + Math.cos(angle * (Math.PI / 180)) * radius,
            lng: baseLng + Math.sin(angle * (Math.PI / 180)) * radius
        };
    };

    // Color scaling
    const getCostColor = (data: any) => {
        if (data.isRemote) return '#ef4444'; // Red for Remote
        const avg = data.avgCost;
        if (avg > 80) return '#7c3aed';
        if (avg > 50) return '#f97316';
        if (avg > 30) return '#059669';
        return '#10b981';
    };

    useEffect(() => {
        if (filteredShipments.length > 0) {
            const runAnalysis = async () => {
                setIsLoading(true);
                try {
                    const data = await computeAnalytics();
                    const mappedData = data.map((item: any) => {
                        const coords = getUniqueCoordinates(item.zipCode, item.province);
                        const avgCost = item.totalCost / Math.max(1, item.count);
                        const avgWeight = (item.totalWeight || 0) / Math.max(1, item.count);
                        const costPerKg = (item.totalWeight > 0) ? (item.totalCost / item.totalWeight) : 0;
                        return { ...item, ...coords, avgCost, avgWeight, costPerKg };
                    });
                    setProvinceData(mappedData.filter((p: any) => p.count > 0));
                    setCurrentPage(1);
                } catch (e) {
                    console.error(e);
                } finally {
                    setIsLoading(false);
                }
            };
            runAnalysis();
        } else {
            setProvinceData([]);
        }
    }, [filteredShipments]);


    // --- Derived Data for Charts ---
    const chartData = useMemo(() => {
        // 1. Regional Breakdown
        const regionalStats: Record<string, { region: string, cost: number, count: number, remoteSurcharge: number }> = {};

        // 2. Remote vs Normal
        let totalNormal = 0;
        let totalRemote = 0;
        let totalSurcharge = 0;

        provinceData.forEach(p => {
            // Regional
            const region = p.region || 'Unknown';
            if (!regionalStats[region]) regionalStats[region] = { region, cost: 0, count: 0, remoteSurcharge: 0 };
            regionalStats[region].cost += p.totalCost;
            regionalStats[region].count += p.count;
            regionalStats[region].remoteSurcharge += p.remoteSurcharge;

            // Remote
            if (p.isRemote) {
                totalRemote += p.count;
                totalSurcharge += p.remoteSurcharge;
            } else {
                totalNormal += p.count;
            }
        });

        const regionChart = Object.values(regionalStats).sort((a, b) => b.cost - a.cost);
        const remoteChart = [
            { name: 'Normal Area', value: totalNormal, color: '#10b981' },
            { name: 'Remote Area (+20฿)', value: totalRemote, color: '#ef4444' }
        ];

        return { regionChart, remoteChart, totalSurcharge, totalRemote };
    }, [provinceData]);

    const filteredMapData = provinceData.filter(p =>
        (!searchTerm || p.zipCode.includes(searchTerm)) &&
        p.avgCost >= costFilter &&
        (!showRemoteOnly || p.isRemote) &&
        (selectedRegion === 'All' || p.region === selectedRegion)
    );

    const maxAvgCost = Math.max(...provinceData.map(p => p.avgCost), 1);

    return (
        <div className="space-y-6 animate-fade-in h-[calc(100vh-100px)] flex flex-col">
            {/* Header */}
            <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between pb-2 border-b border-slate-200 shrink-0 gap-4">
                <div className="flex items-center space-x-3">
                    <div className="bg-indigo-600 p-2 rounded-lg text-white">
                        <Globe className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            Cost & Regional Analysis
                        </h1>
                        <p className="text-sm text-slate-500">
                            วิเคราะห์ต้นทุนขนส่ง แยกตามภูมิภาคและพื้นที่ห่างไกล (Remote Area +20฿)
                        </p>
                    </div>
                </div>

                {/* Global Stats */}
                <div className="flex gap-4">
                    <div className="bg-rose-50 px-4 py-2 rounded-xl border border-rose-100 flex items-center gap-3">
                        <div className="bg-rose-100 p-2 rounded-lg text-rose-600">
                            <Mountain className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-rose-400 uppercase">Remote Surcharge</p>
                            <p className="text-xl font-black text-rose-600">฿{chartData.totalSurcharge.toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 hidden md:flex items-center gap-3">
                        <div className="bg-white p-2 rounded-lg text-slate-600 shadow-sm">
                            <Target className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase">Remote Count</p>
                            <p className="text-xl font-black text-slate-700">{chartData.totalRemote.toLocaleString()}</p>
                        </div>
                    </div>
                </div>


                <div className="flex gap-2 items-center flex-wrap">
                    {/* Region Filter */}
                    <select
                        value={selectedRegion}
                        onChange={(e) => setSelectedRegion(e.target.value)}
                        className="bg-white border border-slate-200 text-sm font-bold text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="All">ทุกภูมิภาค (Regions)</option>
                        <option value="Central">Central (กลาง)</option>
                        <option value="Bangkok">Bangkok (กทม.)</option> {/* Usually Central but maybe distinct? Let's stick to mappped regions */}
                        <option value="North">North (เหนือ)</option>
                        <option value="Northeast">Northeast (อีสาน)</option>
                        <option value="South">South (ใต้)</option>
                        <option value="East">East (ตะวันออก)</option>
                        <option value="West">West (ตก)</option>
                    </select>

                    <button
                        onClick={() => setShowRemoteOnly(!showRemoteOnly)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${showRemoteOnly ? 'bg-rose-600 border-rose-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                        <Mountain className="w-4 h-4" />
                        <span className="text-sm font-bold">พื้นที่ห่างไกล</span>
                    </button>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="รหัสปณ..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none w-32 focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>
            </div>

            {/* Main Content: Split View (Map + Charts) */}
            <div className="flex-1 flex flex-col xl:flex-row gap-6 min-h-0 overflow-hidden xl:overflow-visible">

                {/* LEFT: Charts & List */}
                <div className="w-full xl:w-1/3 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2">
                    {/* Regional Bar Chart */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm shrink-0 h-64">
                        <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-indigo-500" />
                            ส่วนแบ่งยอดส่งตามภูมิภาค
                        </h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData.regionChart} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="region" type="category" width={80} tick={{ fontSize: 10 }} />
                                <RechartsTooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]}>
                                    {chartData.regionChart.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#6366f1' : '#818cf8'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Remote vs Normal Pie */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm shrink-0 h-48 flex">
                        <div className="flex-1">
                            <h3 className="text-sm font-bold text-slate-700 mb-2">พื้นที่ปกติ vs ห่างไกล</h3>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={chartData.remoteChart}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={40}
                                        outerRadius={60}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {chartData.remoteChart.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="w-1/3 flex flex-col justify-center gap-2 text-xs">
                            {chartData.remoteChart.map(item => (
                                <div key={item.name} className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                    <span className="text-slate-500">{item.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* List View */}
                    <div className="flex-1 flex flex-col gap-2 min-h-[300px]">
                        <h3 className="font-bold text-slate-700 sticky top-0 bg-slate-50 py-2">รายละเอียดพื้นที่ ({filteredMapData.length})</h3>
                        {filteredMapData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((data, idx) => (
                            <div
                                key={idx}
                                onClick={() => setSelectedProvince(data.zipCode)}
                                className={`p-3 rounded-xl border transition-all cursor-pointer group ${selectedProvince === data.zipCode ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 hover:bg-white hover:shadow-md'}`}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-800 text-lg">{data.zipCode}</span>
                                            {data.isRemote && <span className="text-[10px] bg-rose-100 text-rose-600 px-1.5 rounded font-bold">REMOTE</span>}
                                        </div>
                                        <p className="text-xs text-slate-500">{data.province} ({data.region})</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-sm font-black text-slate-800 block">฿{data.avgCost.toFixed(0)}</span>
                                        <span className="text-[10px] text-slate-400 font-bold">{data.count} Orders</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        <Pagination
                            currentPage={currentPage}
                            totalPages={Math.ceil(filteredMapData.length / ITEMS_PER_PAGE)}
                            onPageChange={setCurrentPage}
                            itemsPerPage={ITEMS_PER_PAGE}
                            totalItems={filteredMapData.length}
                            compact
                        />
                    </div>
                </div>

                {/* RIGHT: Map */}
                <div className="flex-1 bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden relative z-0 h-[500px] xl:h-auto shadow-inner">
                    <MapContainer center={[13.7563, 100.5018]} zoom={6} style={{ height: '100%', width: '100%' }}>
                        <MapController selectedZip={selectedProvince} data={provinceData} onZoomChange={setCurrentZoom} />
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                        {filteredMapData.map((data, idx) => (
                            <CircleMarker
                                key={idx}
                                center={[data.lat, data.lng]}
                                pathOptions={{
                                    color: data.isRemote ? '#ef4444' : getCostColor(data),
                                    fillColor: data.isRemote ? '#ef4444' : getCostColor(data),
                                    fillOpacity: data.isRemote ? 0.8 : 0.6,
                                    weight: selectedProvince === data.zipCode ? 3 : 1
                                }}
                                radius={(data.isRemote ? 6 : 3) + (Math.sqrt(data.count) * 0.5)}
                                eventHandlers={{ click: () => setSelectedProvince(data.zipCode) }}
                            >
                                <Tooltip direction="top">
                                    <div className="text-center">
                                        <b className={data.isRemote ? "text-rose-600" : "text-indigo-700"}>{data.zipCode}</b>
                                        {data.isRemote && <span className="block text-[10px] text-rose-500 font-bold text-center">(Remote)</span>}
                                        <br />
                                        <span className="text-xs font-bold">฿{Math.round(data.avgCost)}</span>
                                    </div>
                                </Tooltip>
                            </CircleMarker>
                        ))}
                    </MapContainer>

                    <div className="absolute bottom-4 left-4 z-[400] bg-white/95 backdrop-blur px-4 py-3 rounded-xl border border-slate-200 shadow-xl">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider">Map Legend</p>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#ef4444] shadow-sm ring-2 ring-rose-100"></div><span className="text-xs font-bold text-slate-700">Remote Area (+20฿)</span></div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#7c3aed]"></div><span className="text-xs font-medium text-slate-600">High Cost ({'>'}80฿)</span></div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#10b981]"></div><span className="text-xs font-medium text-slate-600">Standard</span></div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default CostAnalyticsPage;
