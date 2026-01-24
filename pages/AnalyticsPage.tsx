import React, { useMemo, useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { thaiProvinces } from '../data/thaiProvinces';
import { getAddressByZipCode } from '../services/AddressService';
import { Map as MapIcon, Info, TrendingUp, DollarSign } from 'lucide-react';

const AnalyticsPage: React.FC = () => {
    const { shipments } = useData();
    const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
    const [provinceData, setProvinceData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, status: '' });

    // Compute analytics client-side (ASYNC with chunks for better performance)
    const computeAnalytics = async () => {
        const stats = new Map<string, { zipCode: string; province: string; count: number; totalCOD: number; totalCost: number }>();
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

                const provinceName = addresses[0].province;
                const zipKey = s.zipCode;

                const existing = stats.get(zipKey);
                if (existing) {
                    existing.count++;
                    existing.totalCOD += (s.codAmount || 0);
                    existing.totalCost += (s.shippingCost || 0);
                } else {
                    stats.set(zipKey, {
                        zipCode: s.zipCode,
                        province: provinceName,
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

    // Fetch Analytics from Server (JSON file) - SEQUENTIAL WORKFLOW
    const fetchAnalytics = async () => {
        setIsLoading(true);
        setProgress({ current: 0, total: 100, status: 'กำลังโหลดข้อมูลจาก Server...' });

        try {
            const res = await fetch('/api/analytics/geo');

            if (!res.ok) {
                throw new Error(`Server responded with ${res.status}`);
            }

            const data = await res.json();

            setProgress({ current: 50, total: 100, status: 'กำลังประมวลผลพิกัด...' });

            // Map data to coordinates
            const mappedData = data.map((item: any) => {
                const provinceInfo = thaiProvinces.find(p => p.province === item.province);
                return {
                    ...item,
                    lat: provinceInfo?.lat || 13.7563,
                    lng: provinceInfo?.lng || 100.5018
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
                    const provinceInfo = thaiProvinces.find(p => p.province === item.province);
                    return {
                        ...item,
                        lat: provinceInfo?.lat || 13.7563,
                        lng: provinceInfo?.lng || 100.5018
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
                    <button
                        onClick={handleSave}
                        disabled={isSyncing}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-white transition-all ${isSyncing ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg'
                            }`}
                    >
                        <TrendingUp className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'กำลังบันทึก...' : 'บันทึกข้อมูล Analytics'}
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
                                    click: () => setSelectedProvince(data.zipCode || data.province)
                                }}
                            >
                                <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                                    <div className="text-center">
                                        <b className="text-base text-indigo-700">{data.zipCode || data.province}</b><br />
                                        <span className="text-xs text-slate-500">{data.province}</span><br />
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
                        อันดับรหัสไปรษณีย์ (Top Zip Codes)
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                        {provinceData.map((data, idx) => (
                            <div
                                key={idx}
                                onClick={() => setSelectedProvince(data.zipCode || data.province)}
                                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${selectedProvince === (data.zipCode || data.province)
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
                                        <div>
                                            <span className="font-bold text-slate-700 text-sm block">{data.zipCode}</span>
                                            <span className="text-xs text-slate-400">{data.province}</span>
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
