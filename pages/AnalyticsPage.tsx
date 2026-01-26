import React, { useMemo, useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { thaiProvinces } from '../data/thaiProvinces';
import { computeAnalytics, AnalyticsStats } from '../services/AnalyticsService';
import { Map as MapIcon, Info, TrendingUp, DollarSign, Search, RefreshCw, MapPin, Filter, ArrowUpRight, Target, Maximize2, Minimize2 } from 'lucide-react';
import Pagination from '../components/Pagination';

// Enhanced MapController with safety against 'undefined _leaflet_pos'
const MapController: React.FC<{
    selectedZip: string | null,
    data: AnalyticsStats[],
    onZoomChange: (zoom: number) => void
}> = ({ selectedZip, data, onZoomChange }) => {
    const map = useMap();

    useMapEvents({
        zoomend: () => {
            if (map && (map as any)._container) {
                onZoomChange(map.getZoom());
            }
        }
    });

    useEffect(() => {
        if (selectedZip && data.length > 0 && map && (map as any)._container) {
            const point = data.find(p => p.zipCode === selectedZip);
            if (point && point.lat && point.lng) {
                const timer = setTimeout(() => {
                    try {
                        map.setView([point.lat!, point.lng!], 12, { animate: true });
                    } catch (e) {
                        console.warn("Leaflet setView error avoided", e);
                    }
                }, 50);
                return () => clearTimeout(timer);
            }
        }
    }, [selectedZip, data, map]);

    return null;
};

// Helper to fix Leaflet gray area issue when container size changes
const InvalidateSizeController: React.FC<{ trigger: any }> = ({ trigger }) => {
    const map = useMap();
    useEffect(() => {
        setTimeout(() => {
            map.invalidateSize();
        }, 300); // Wait for transition/animation
    }, [trigger, map]);
    return null;
};

const AnalyticsPage: React.FC = () => {
    const { filteredShipments, startDate, endDate } = useData();
    const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
    const [provinceData, setProvinceData] = useState<AnalyticsStats[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, status: '' });
    const [currentZoom, setCurrentZoom] = useState(6);
    const [minOrders, setMinOrders] = useState(0);
    const [isMapFullScreen, setIsMapFullScreen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    // Track chosen coordinate for auto-zoom
    const [focusPoint, setFocusPoint] = useState<{ lat: number, lng: number } | null>(null);


    // Generate unique coordinates for each zip code (Robust Spread v2.3)
    const getUniqueCoordinates = (zipCode: string, baseProvince: string) => {
        const cleanedProvince = baseProvince?.trim();
        // Match by Thai name or English name from the new thaiProvinces structure
        const provinceInfo = thaiProvinces.find(p =>
            p.provinceThai === cleanedProvince ||
            p.province === cleanedProvince ||
            (cleanedProvince && p.provinceThai.includes(cleanedProvince)) ||
            (cleanedProvince && cleanedProvince.includes(p.provinceThai))
        );
        const baseLat = provinceInfo?.lat || 13.7563;
        const baseLng = provinceInfo?.lng || 100.5018;

        // Use zipCode as deterministic seed
        const seed = parseInt(zipCode) || zipCode.split('').reduce((a, b) => a + b.charCodeAt(0), 0);

        // Spread radius: 0.1 - 0.4 degrees (~10-45km)
        const angle = (seed * 137.5) % 360;
        const radius = 0.1 + ((seed * 23) % 100) / 100 * 0.35;

        const offsetLat = Math.cos(angle * (Math.PI / 180)) * radius;
        const offsetLng = Math.sin(angle * (Math.PI / 180)) * radius;

        return {
            lat: baseLat + offsetLat,
            lng: baseLng + offsetLng,
            isMatched: !!provinceInfo
        };
    };

    // New Color Scaling Logic based on Volume (v4.0)
    const getHeatColor = (count: number, max: number) => {
        const ratio = count / max;
        if (ratio > 0.8) return '#ef4444'; // Red (Critical)
        if (ratio > 0.5) return '#f97316'; // Orange (High)
        if (ratio > 0.2) return '#6366f1'; // Indigo (Medium)
        if (ratio > 0.05) return '#818cf8'; // Light Indigo (Low)
        return '#cbd5e1'; // Gray (Minimal)
    };

    const getHeatFillColor = (count: number, max: number) => {
        const ratio = count / max;
        if (ratio > 0.8) return '#f87171';
        if (ratio > 0.5) return '#fb923c';
        if (ratio > 0.2) return '#818cf8';
        if (ratio > 0.05) return '#a5b4fc';
        return '#f1f5f9';
    };

    const isDemoMode = window.location.hostname.includes('github.io');

    // Calculate dynamic radius based on zoom and volume
    const getDynamicRadius = (count: number) => {
        // Base size from math
        const baseSize = 3 + Math.sqrt(count) * 2;
        // Zoom multiplier: bigger when zoomed in, smaller when out
        const zoomFactor = Math.pow(currentZoom / 6, 1.5);
        return Math.max(2, baseSize * zoomFactor);
    };

    // Fetch Analytics from Server (JSON file) - SEQUENTIAL WORKFLOW
    const fetchAnalytics = async () => {
        setIsLoading(true);
        setProgress({ current: 0, total: 100, status: 'กำลังโหลดข้อมูลจาก Server...' });

        try {
            if (isDemoMode) {
                console.log("Demo Mode: Skipping server fetch");
                throw new Error("Demo Mode");
            }
            // Add cache buster to ensure fresh data
            const res = await fetch(`/api/analytics?t=${Date.now()}`);

            if (!res.ok) {
                throw new Error(`Server responded with ${res.status}`);
            }

            let data = await res.json();
            if (!data || !Array.isArray(data)) data = [];

            setProgress({ current: 50, total: 100, status: 'กำลังจัดตำแหน่งพึงพิกัด...' });

            // Map data to coordinates with UNIQUE distribution
            const mappedData = data.map((item: any) => {
                const coords = getUniqueCoordinates(item.zipCode, item.province);
                return {
                    ...item,
                    ...coords
                };
            });

            setProgress({ current: 100, total: 100, status: 'โหลดข้อมูลสำเร็จ' });
            setProvinceData(mappedData.filter((p: any) => p.count > 0));

            // Clear progress after 1 second
            setTimeout(() => {
                setProgress({ current: 0, total: 0, status: '' });
            }, 1000);

        } catch (err) {
            console.error("Failed to fetch analytics:", err);

            // Fallback: Compute from current shipments
            setProgress({ current: 0, total: 100, status: 'ไม่พบข้อมูลบน Server - กำลังคำนวณใหม่...' });

            try {
                const computed = await computeAnalytics(filteredShipments, setProgress);
                const mappedData = computed.map((item: any) => {
                    const coords = getUniqueCoordinates(item.zipCode, item.province);
                    return {
                        ...item,
                        ...coords
                    };
                });
                setProvinceData(mappedData.filter((p: any) => p.count > 0));

                setTimeout(() => {
                    setProgress({ current: 0, total: 0, status: '' });
                }, 1000);
            } catch (computeErr) {
                console.error("Computation error:", computeErr);
                setProgress({ current: 0, total: 0, status: '' });
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (filteredShipments.length === 0) {
            alert('ไม่มีข้อมูลให้บันทึก');
            return;
        }
        setIsSyncing(true);
        try {
            setProgress({ current: 0, total: 100, status: 'เริ่มต้นการบันทึก...' });
            const analytics = await computeAnalytics(filteredShipments, setProgress);

            if (isDemoMode) {
                setProgress({ current: 100, total: 100, status: 'บันทึกข้อมูลจำลองสำเร็จ' });
            } else {
                setProgress({ current: 90, total: 100, status: 'กำลังบันทึกลง Server...' });
                await fetch('/api/analytics', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(analytics)
                });
            }

            await fetchAnalytics();
            alert(`✅ บันทึกข้อมูลสำเร็จ! (${analytics.length} พื้นที่)`);
        } catch (err) {
            alert('❌ บันทึกล้มเหลว');
        } finally {
            setIsSyncing(false);
            setProgress({ current: 0, total: 0, status: '' });
        }
    };

    useEffect(() => {
        if (filteredShipments.length > 0) {
            const runAnalysis = async () => {
                if (filteredShipments.length > 500) setIsLoading(true);
                try {
                    const computed = await computeAnalytics(filteredShipments, setProgress);
                    const mappedData = computed.map((item: any) => ({
                        ...item,
                        ...getUniqueCoordinates(item.zipCode, item.province)
                    }));
                    setProvinceData(mappedData.filter((p: any) => p.count > 0));
                    setCurrentPage(1);
                } catch (e) {
                    console.error("Auto-calc error", e);
                } finally {
                    setIsLoading(false);
                    setProgress({ current: 0, total: 0, status: '' });
                }
            };
            runAnalysis();
        } else {
            setProvinceData([]);
        }
    }, [filteredShipments]);

    // Calculate max count for dynamic scaling
    const maxCount = Math.max(...provinceData.map(p => p.count), 1);

    return (
        <div className="animate-fade-in lg:h-[calc(100vh-120px)] flex flex-col h-[calc(100vh-120px)] overflow-hidden">

            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-2 border-b border-slate-200 shrink-0 gap-4 mb-4">
                <div className="flex items-center space-x-3">
                    <MapIcon className="w-8 h-8 text-indigo-600" />
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            วิเคราะห์พิกัดรายย่อย <span className="text-xs bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full font-mono animate-bounce">v4.4 (PAGINATED)</span>
                        </h1>
                        {startDate && endDate && (
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">ช่วงเวลา: {startDate} - {endDate}</p>
                        )}
                    </div>
                </div>
                <div className="flex gap-2 items-center flex-wrap w-full md:w-auto">
                    <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                        <select
                            value={minOrders}
                            onChange={(e) => setMinOrders(Number(e.target.value))}
                            className="bg-transparent text-xs font-bold text-indigo-600 focus:outline-none"
                        >
                            <option value={0}>ทั้งหมด</option>
                            <option value={50}>50+</option>
                            <option value={100}>100+</option>
                        </select>
                    </div>
                    <div className="relative flex-1 md:flex-none">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="ค้นหา..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none w-full md:w-44 shadow-sm"
                        />
                    </div>
                    <button
                        onClick={fetchAnalytics}
                        className="p-2 rounded-lg bg-white border border-emerald-500 text-emerald-600"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 md:flex-none px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold"
                    >
                        Save
                    </button>
                </div>
            </div>

            {/* Progress Bar */}
            {(isSyncing || progress.total > 0) && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 shrink-0 mb-4">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-slate-500">{progress.status}</span>
                        <span className="text-[10px] font-mono text-indigo-600">
                            {progress.total > 0 ? `${Math.round((progress.current / progress.total) * 100)}%` : ''}
                        </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                            className="bg-indigo-500 h-full transition-all duration-300"
                            style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                        />
                    </div>
                </div>
            )}

            <div className={`flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-hidden ${isMapFullScreen ? 'static' : ''}`}>

                {/* Map Container - Full Screen Support */}
                <div className={`w-full lg:flex-1 bg-slate-50 rounded-2xl shadow-inner border border-slate-200 overflow-hidden relative z-0 shrink-0 transition-all duration-300 ${isMapFullScreen
                    ? 'fixed inset-4 z-[1000] h-[calc(100vh-120px)] md:h-[calc(100vh-32px)] md:inset-8 pb-4'
                    : 'h-[280px] lg:h-auto'
                    }`}>

                    {/* Full Screen Toggle Button */}
                    <button
                        onClick={() => setIsMapFullScreen(!isMapFullScreen)}
                        className="absolute top-4 right-4 z-[500] p-2.5 bg-white/90 backdrop-blur border border-slate-200 rounded-xl shadow-lg text-slate-600 hover:text-indigo-600 active:scale-95 transition-all"
                        title={isMapFullScreen ? "เลิกเต็มหน้าจอ" : "เต็มหน้าจอ"}
                    >
                        {isMapFullScreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                    </button>

                    <MapContainer
                        center={[13.7563, 100.5018]}
                        zoom={6}
                        style={{ height: '100%', width: '100%' }}
                        scrollWheelZoom={true}
                    >
                        <InvalidateSizeController trigger={isMapFullScreen} />
                        {/* Auto-zoom helper component */}
                        <MapController selectedZip={selectedProvince} data={provinceData} onZoomChange={setCurrentZoom} />

                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />

                        {provinceData.length === 0 && !isLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-[1000]">
                                <div className="text-center p-8">
                                    <MapIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                                    <h3 className="text-xl font-bold text-slate-600 mb-2">ยังไม่มีข้อมูล Analytics</h3>
                                    <p className="text-slate-500">กดปุ่ม "อัปเดต" เพื่อเริ่มต้น</p>
                                </div>
                            </div>
                        )}

                        {/* Circles Logic remains same... */}
                        {provinceData
                            .filter(p => (!searchTerm || p.zipCode.includes(searchTerm) || p.district.includes(searchTerm) || p.province.includes(searchTerm)) && p.count >= minOrders)
                            .map((data, idx) => (
                                <CircleMarker
                                    key={idx}
                                    center={[data.lat, data.lng]}
                                    pathOptions={{
                                        color: !data.isMatched ? '#94a3b8' : (selectedProvince === data.zipCode ? '#ef4444' : getHeatColor(data.count, maxCount)),
                                        fillColor: !data.isMatched ? '#cbd5e1' : (selectedProvince === data.zipCode ? '#f87171' : getHeatFillColor(data.count, maxCount)),
                                        fillOpacity: 0.6,
                                        weight: selectedProvince === data.zipCode ? 3 : 1
                                    }}
                                    radius={getDynamicRadius(data.count)}
                                    eventHandlers={{
                                        click: () => {
                                            setSelectedProvince(data.zipCode);
                                            setFocusPoint({ lat: data.lat, lng: data.lng });
                                        }
                                    }}
                                >
                                    <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                                        <div className="text-center">
                                            <b className="text-sm text-indigo-700">{data.zipCode}</b><br />
                                            <span className="text-[10px] font-bold text-slate-800">อ.{data.district}</span><br />
                                            <span className="text-[10px] text-slate-500">{data.count} Orders</span>
                                        </div>
                                    </Tooltip>
                                    <Popup>
                                        <div className="p-2 min-w-[150px]">
                                            <div className="flex items-center gap-2 mb-2 pb-2 border-b">
                                                <MapPin className="w-4 h-4 text-indigo-500" />
                                                <span className="font-bold text-slate-800">{data.zipCode}</span>
                                            </div>
                                            <div className="space-y-1 text-sm">
                                                <p className="flex justify-between">
                                                    <span className="text-slate-500">พื้นที่:</span>
                                                    <span className="font-medium text-slate-700">อ.{data.district}</span>
                                                </p>
                                                <p className="flex justify-between pt-1 border-t mt-1">
                                                    <span className="text-slate-500">จำนวน:</span>
                                                    <span className="font-bold text-indigo-600">{data.count}</span>
                                                </p>
                                                <div className="flex justify-between text-xs text-slate-500 pt-1">
                                                    <span>COD: {data.codCount}</span>
                                                    <span>Paid: {data.transferCount}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </Popup>
                                </CircleMarker>
                            ))}
                    </MapContainer>

                    {/* Floating Summary Card (Desktop Only) */}
                    <div className="hidden md:block absolute top-4 right-4 z-[400] bg-white/95 border border-slate-200 backdrop-blur rounded-2xl shadow-xl p-5 space-y-4 max-w-[240px]">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">ยอดออร์เดอร์รวม</p>
                            <div className="flex items-baseline gap-2">
                                <h3 className="text-3xl font-black text-slate-800 tracking-tighter">
                                    {provinceData.reduce((sum, p) => sum + p.count, 0).toLocaleString()}
                                </h3>
                                <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-1.5 rounded">รายการ</span>
                            </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">ยอด COD รวม</p>
                            <h3 className="text-xl font-bold text-emerald-600 tracking-tight">
                                ฿{provinceData.reduce((sum, p) => sum + p.totalCOD, 0).toLocaleString()}
                            </h3>
                        </div>
                    </div>
                </div>

                {/* Sidebar Stats - Scrollable Area */}
                <div className="w-full lg:w-96 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col shrink-0 overflow-hidden min-h-0 h-full">
                    {/* Compact Summary for Mobile (Fixed inside sidebar top) */}
                    <div className="md:hidden p-3 bg-indigo-50/50 border-b border-indigo-100 flex justify-between items-center shrink-0">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ออร์เดอร์รวม</span>
                            <span className="text-lg font-black text-slate-800">{provinceData.reduce((sum, p) => sum + p.count, 0).toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col text-right">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ยอด COD</span>
                            <span className="text-lg font-black text-emerald-600">฿{provinceData.reduce((sum, p) => sum + p.totalCOD, 0).toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-indigo-500" />
                            <h2 className="text-xs font-bold text-slate-800">Top Zip Codes</h2>
                        </div>
                        <span className="text-[10px] bg-white border px-2 py-0.5 rounded-full font-bold text-slate-500 shadow-sm">
                            {provinceData.length} เขต
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 mb-2">
                        {provinceData
                            .filter(p => (!searchTerm || p.zipCode.includes(searchTerm) || p.district.includes(searchTerm)) && p.count >= minOrders)
                            .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                            .map((data, idx) => {
                                const globalIdx = (currentPage - 1) * ITEMS_PER_PAGE + idx;
                                return (
                                    <div
                                        key={idx}
                                        onClick={() => {
                                            setSelectedProvince(data.zipCode);
                                            setFocusPoint({ lat: data.lat, lng: data.lng });
                                        }}
                                        className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer group ${selectedProvince === data.zipCode
                                            ? 'bg-indigo-50 border-indigo-200 shadow-md ring-1 ring-indigo-200 scale-[1.02]'
                                            : 'bg-white border-slate-100 hover:border-indigo-100 hover:bg-slate-50/50 hover:shadow-sm'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shadow-sm transition-colors ${globalIdx < 3
                                                    ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                                                    }`}>
                                                    {globalIdx + 1}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-black text-slate-800 text-base">{data.zipCode}</span>
                                                        <Target className={`w-3 h-3 ${data.isMatched ? 'text-emerald-500' : 'text-slate-300'}`} />
                                                    </div>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-xs font-bold text-indigo-600">อ.{data.district}</span>
                                                        <span className="text-[10px] text-slate-400">({data.province})</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="flex items-baseline justify-end gap-1">
                                                    <span className="text-2xl font-black text-slate-800 tracking-tighter">{data.count}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">ออร์เดอร์</span>
                                                </div>
                                                <div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded inline-block">
                                                    ฿{data.totalCOD.toLocaleString()}
                                                </div>
                                                <div className="flex justify-end gap-1 mt-1">
                                                    {data.codCount > 0 && <span className="text-[8px] bg-slate-100 text-slate-500 px-1 rounded">COD {data.codCount}</span>}
                                                    {data.transferCount > 0 && <span className="text-[8px] bg-indigo-50 text-indigo-600 px-1 rounded">Paid {data.transferCount}</span>}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Progress mini bar */}
                                        <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden mt-3 opacity-60">
                                            <div
                                                className="bg-indigo-600 h-full rounded-full"
                                                style={{ width: `${(data.count / maxCount) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>

                    <Pagination
                        currentPage={currentPage}
                        totalPages={Math.ceil(provinceData.filter(p => (!searchTerm || p.zipCode.includes(searchTerm) || p.district.includes(searchTerm)) && p.count >= minOrders).length / ITEMS_PER_PAGE)}
                        onPageChange={setCurrentPage}
                        totalItems={provinceData.filter(p => (!searchTerm || p.zipCode.includes(searchTerm) || p.district.includes(searchTerm)) && p.count >= minOrders).length}
                        itemsPerPage={ITEMS_PER_PAGE}
                        compact={true}
                    />
                </div>

            </div>
        </div>
    );
};

export default AnalyticsPage;
