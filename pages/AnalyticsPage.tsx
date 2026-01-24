import React, { useMemo, useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { thaiProvinces } from '../data/thaiProvinces';
import { getAddressByZipCode } from '../services/AddressService';
import { Map as MapIcon, Info, TrendingUp, DollarSign, Search, RefreshCw, MapPin } from 'lucide-react';

// Helper component to control map zoom/pan
const MapController: React.FC<{ selectedZip: string | null, data: any[] }> = ({ selectedZip, data }) => {
    const map = useMap();

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

const AnalyticsPage: React.FC = () => {
    const { shipments } = useData();
    const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
    const [provinceData, setProvinceData] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, status: '' });

    // Track chosen coordinate for auto-zoom
    const [focusPoint, setFocusPoint] = useState<{ lat: number, lng: number } | null>(null);

    // Compute analytics client-side (ASYNC with chunks for better performance)
    const computeAnalytics = async () => {
        const stats = new Map<string, {
            zipCode: string;
            province: string;
            district: string;
            subdistrict: string;
            count: number;
            totalCOD: number;
            totalCost: number
        }>();
        const total = shipments.length;
        const CHUNK_SIZE = 100; // Process 100 items at a time

        setProgress({ current: 0, total, status: 'กำลังเริ่มต้นการวิเคราะห์...' });

        // Process in chunks to avoid blocking UI
        for (let i = 0; i < total; i += CHUNK_SIZE) {
            const chunk = shipments.slice(i, Math.min(i + CHUNK_SIZE, total));

            // Use setTimeout to yield to browser
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
                    existing.totalCOD += (s.codAmount || 0);
                    existing.totalCost += (s.shippingCost || 0);
                } else {
                    stats.set(zipKey, {
                        zipCode: s.zipCode,
                        province: addressInfo.province,
                        district: addressInfo.amphoe || addressInfo.district || 'ไม่ระบุ',
                        subdistrict: addressInfo.district || 'ไม่ระบุ',
                        count: 1,
                        totalCOD: (s.codAmount || 0),
                        totalCost: (s.shippingCost || 0)
                    });
                }
            });

            // Update progress after each chunk
            const current = Math.min(i + CHUNK_SIZE, total);
            setProgress({
                current,
                total,
                status: `กำลังวิเคราะห์... (${current}/${total})`
            });
        }

        setProgress({ current: total, total, status: 'การวิเคราะห์เสร็จสมบูรณ์' });

        return Array.from(stats.values()).sort((a, b) => b.count - a.count);
    };

    // Generate unique coordinates for each zip code (Deterministic spread)
    const getUniqueCoordinates = (zipCode: string, baseProvince: string) => {
        const provinceInfo = thaiProvinces.find(p => p.province === baseProvince);
        const baseLat = provinceInfo?.lat || 13.7563;
        const baseLng = provinceInfo?.lng || 100.5018;

        // Use zipCode string to generate a deterministic "seed"
        const seed = zipCode.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

        // Drastic Spread: ~80-150km (0.8 - 1.5 degrees)
        const angle = (seed * 137.5) % 360;
        const radius = 0.25 + ((seed * 53) % 100) / 100 * 1.2;

        const offsetLat = Math.cos(angle * (Math.PI / 180)) * radius;
        const offsetLng = Math.sin(angle * (Math.PI / 180)) * radius;

        return {
            lat: baseLat + offsetLat,
            lng: baseLng + offsetLng
        };
    };

    // Fetch Analytics from Server (JSON file) - SEQUENTIAL WORKFLOW
    const fetchAnalytics = async () => {
        setIsLoading(true);
        setProgress({ current: 0, total: 100, status: 'กำลังโหลดข้อมูลจาก Server...' });

        try {
            // Add cache buster to ensure fresh data
            const res = await fetch(`/api/analytics/geo?t=${Date.now()}`);

            if (!res.ok) {
                throw new Error(`Server responded with ${res.status}`);
            }

            const data = await res.json();

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
                const computed = await computeAnalytics();
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

    // Save analytics to server as JSON - IMPROVED SEQUENTIAL WORKFLOW
    const handleSave = async () => {
        if (shipments.length === 0) {
            alert('ไม่มีข้อมูลให้บันทึก');
            return;
        }

        setIsSyncing(true);

        try {
            // Step 1: Initialize
            setProgress({ current: 0, total: 100, status: 'เริ่มต้นการบันทึก...' });
            await new Promise(resolve => setTimeout(resolve, 300));

            // Step 2: Compute analytics (10-80%)
            setProgress({ current: 10, total: 100, status: 'กำลังคำนวณข้อมูล Analytics...' });
            const analytics = await computeAnalytics();

            if (!analytics || analytics.length === 0) {
                throw new Error('ไม่สามารถคำนวณข้อมูลได้');
            }

            // Step 3: Prepare data for server (80-85%)
            setProgress({ current: 80, total: 100, status: 'กำลังเตรียมข้อมูลสำหรับบันทึก...' });
            await new Promise(resolve => setTimeout(resolve, 200));

            // Step 4: Save to server (85-95%)
            setProgress({ current: 85, total: 100, status: 'กำลังบันทึกลง Server...' });
            const res = await fetch('/api/analytics/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(analytics)
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`Server error: ${res.status} - ${errorText}`);
            }

            const result = await res.json();
            console.log('Save result:', result);

            // Step 5: Refresh data (95-98%)
            setProgress({ current: 95, total: 100, status: 'กำลังโหลดข้อมูลใหม่...' });
            await fetchAnalytics();

            // Step 6: Complete (98-100%)
            setProgress({ current: 100, total: 100, status: 'บันทึกสำเร็จ!' });

            // Auto-hide progress after 2 seconds
            setTimeout(() => {
                setProgress({ current: 0, total: 0, status: '' });
            }, 2000);

            alert(`✅ บันทึกข้อมูลสำเร็จ!\n\nจำนวนรหัสไปรษณีย์: ${analytics.length} รายการ`);

        } catch (err) {
            console.error("Save error:", err);
            setProgress({ current: 0, total: 0, status: '' });

            const errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
            alert(`❌ บันทึกล้มเหลว\n\n${errorMessage}\n\nกรุณาลองใหม่อีกครั้ง`);
        } finally {
            setIsSyncing(false);
        }
    };

    // Initial Load - DISABLED for performance
    // useEffect(() => {
    //     fetchAnalytics();
    // }, []);

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
                        <p className="text-sm text-slate-500">
                            ข้อมูลจาก Server (บันทึกเป็น JSON)
                        </p>
                    </div>
                </div>
                <div className="flex gap-4 items-center">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="ค้นหารหัส หรือ อำเภอ..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64 shadow-sm"
                        />
                    </div>
                    <button
                        onClick={fetchAnalytics}
                        disabled={isLoading}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all border-2 ${isLoading
                                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-white border-emerald-500 text-emerald-600 hover:bg-emerald-50 shadow-sm'
                            }`}
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        {isLoading ? 'กำลังรีเฟรช...' : 'รีเฟรช'}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSyncing || shipments.length === 0}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-white transition-all ${isSyncing || shipments.length === 0 ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg'
                            }`}
                    >
                        <TrendingUp className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'ประมวลผลใหม่...' : 'คำนวณ & บันทึก'}
                    </button>
                    <div className="flex gap-4 text-sm font-semibold text-slate-600 border-l pl-4 border-slate-300">
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
            </div>

            {/* Progress Bar */}
            {(isSyncing || progress.total > 0) && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-slate-700">{progress.status}</span>
                        <span className="text-sm font-mono text-indigo-600">
                            {progress.total > 0 ? `${Math.round((progress.current / progress.total) * 100)}%` : ''}
                        </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                        <div
                            className="bg-gradient-to-r from-indigo-500 to-violet-600 h-3 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                        >
                            <div className="h-full w-full bg-white/20 animate-pulse"></div>
                        </div>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                        {progress.current > 0 && progress.total > 0 && (
                            <span>ประมวลผลแล้ว {progress.current.toLocaleString()} / {progress.total.toLocaleString()} รายการ</span>
                        )}
                    </div>
                </div>
            )}

            <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">

                {/* Map Container */}
                <div className="flex-1 bg-slate-50 rounded-2xl shadow-inner border border-slate-200 overflow-hidden relative z-0">
                    <MapContainer
                        center={[13.7563, 100.5018]}
                        zoom={6}
                        style={{ height: '100%', width: '100%' }}
                        scrollWheelZoom={true}
                    >
                        {/* Auto-zoom helper component */}
                        <MapController selectedZip={selectedProvince} data={provinceData} />

                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />

                        {provinceData.length === 0 && !isLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-[1000]">
                                <div className="text-center p-8">
                                    <MapIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                                    <h3 className="text-xl font-bold text-slate-600 mb-2">ยังไม่มีข้อมูล Analytics</h3>
                                    <p className="text-slate-500">กดปุ่ม "โหลดข้อมูล" หรือ "คำนวณ & บันทึก" เพื่อเริ่มต้น</p>
                                </div>
                            </div>
                        )}

                        {provinceData
                            .filter(p => !searchTerm || p.zipCode.includes(searchTerm) || p.district.includes(searchTerm) || p.province.includes(searchTerm))
                            .map((data, idx) => (
                                <CircleMarker
                                    key={idx}
                                    center={[data.lat, data.lng]}
                                    pathOptions={{
                                        color: selectedProvince === data.zipCode ? '#ef4444' : '#4338ca',
                                        fillColor: selectedProvince === data.zipCode ? '#f87171' : '#6366f1',
                                        fillOpacity: 0.5,
                                        weight: selectedProvince === data.zipCode ? 3 : 2
                                    }}
                                    radius={4 + (data.count / maxCount) * 20}
                                    eventHandlers={{
                                        click: () => {
                                            setSelectedProvince(data.zipCode);
                                            setFocusPoint({ lat: data.lat, lng: data.lng });
                                        }
                                    }}
                                >
                                    <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                                        <div className="text-center">
                                            <b className="text-base text-indigo-700">{data.zipCode}</b><br />
                                            <span className="text-xs font-bold text-slate-800">อ.{data.district}</span><br />
                                            <span className="text-xs text-slate-500">{data.province}</span><br />
                                            <span className="text-slate-600 font-semibold">{data.count} Orders</span>
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
                                                <p className="flex justify-between">
                                                    <span className="text-slate-500">จังหวัด:</span>
                                                    <span className="font-medium text-slate-700">{data.province}</span>
                                                </p>
                                                <p className="flex justify-between pt-1 border-t mt-1">
                                                    <span className="text-slate-500">จำนวน:</span>
                                                    <span className="font-bold text-indigo-600">{data.count} รายการ</span>
                                                </p>
                                                <p className="flex justify-between">
                                                    <span className="text-slate-500">ยอด COD:</span>
                                                    <span className="font-bold text-emerald-600">฿{data.totalCOD.toLocaleString()}</span>
                                                </p>
                                            </div>
                                        </div>
                                    </Popup>
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
                        อันดับรหัสไปรษณีย์ (Top Zip Codes)
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                        {provinceData
                            .filter(p => !searchTerm || p.zipCode.includes(searchTerm) || p.district.includes(searchTerm))
                            .map((data, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => {
                                        setSelectedProvince(data.zipCode);
                                        setFocusPoint({ lat: data.lat, lng: data.lng });
                                    }}
                                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${selectedProvince === data.zipCode
                                        ? 'bg-indigo-50 border-indigo-200 shadow-sm ring-1 ring-indigo-200'
                                        : 'bg-white border-slate-100 hover:bg-slate-50'
                                        }`}
                                >
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${idx < 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                {idx + 1}
                                            </span>
                                            <div>
                                                <span className="font-bold text-slate-700 text-sm block">{data.zipCode}</span>
                                                <span className="text-xs text-indigo-600 font-medium">อ.{data.district}</span>
                                                <span className="text-xs text-slate-400 ml-1">{data.province}</span>
                                            </div>
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
