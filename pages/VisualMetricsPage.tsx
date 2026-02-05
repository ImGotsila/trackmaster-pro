import * as React from 'react';
import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useSettings } from '../context/SettingsContext';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
    LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis
} from 'recharts';
import { TrendingUp, BarChart3, PieChart as PieChartIcon, Activity, DollarSign, Package, MapPin, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

const VisualMetricsPage: React.FC = () => {
    const { filteredShipments } = useData();
    const { settings } = useSettings();
    const codFeePercent = settings.cod_fee || 0;

    // 1. Data Processing for Daily Trend (Area Chart)
    const dailyData = useMemo(() => {
        const map = new Map<string, { date: string, count: number, cod: number }>();

        // Get last 15 days of activity
        filteredShipments.forEach(s => {
            const date = s.importDate;
            const existing = map.get(date);
            if (existing) {
                existing.count++;
                existing.cod += (s.codAmount || 0);
            } else {
                map.set(date, { date, count: 1, cod: s.codAmount || 0 });
            }
        });

        return Array.from(map.values())
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [filteredShipments]);

    // 2. Courier Distribution (Pie Chart)
    const courierData = useMemo(() => {
        const map = new Map<string, number>();
        filteredShipments.forEach(s => {
            map.set(s.courier, (map.get(s.courier) || 0) + 1);
        });
        return Array.from(map.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [filteredShipments]);

    // 3. Top 10 Areas by Volume (Bar Chart)
    const areaData = useMemo(() => {
        const map = new Map<string, number>();
        filteredShipments.forEach(s => {
            if (s.zipCode) map.set(s.zipCode, (map.get(s.zipCode) || 0) + 1);
        });
        return Array.from(map.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([zip, count]) => ({ zip, count }));
    }, [filteredShipments]);

    // 4. Performance Metrics (Line Chart - Avg COD vs Avg Cost)
    const performanceData = useMemo(() => {
        const map = new Map<string, { date: string, totalCOD: number, totalCost: number, count: number }>();
        filteredShipments.forEach(s => {
            const date = s.importDate;
            const existing = map.get(date);
            if (existing) {
                existing.totalCOD += (s.codAmount || 0);
                existing.totalCost += (s.shippingCost || 0);
                existing.count++;
            } else {
                map.set(date, { date, totalCOD: s.codAmount || 0, totalCost: s.shippingCost || 0, count: 1 });
            }
        });

        return Array.from(map.values())
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map(d => {
                const avgCOD = d.totalCOD / d.count;
                const avgCost = d.totalCost / d.count;
                const avgFee = avgCOD * (codFeePercent / 100);
                return {
                    date: d.date,
                    avgCOD: Math.round(avgCOD),
                    avgNet: Math.round(avgCOD - avgCost - avgFee),
                    avgCost: Math.round(avgCost + avgFee)
                };
            });
    }, [filteredShipments, codFeePercent]);

    // 5. Weight Distribution (Bar Chart Data)
    const weightDistributionData = useMemo(() => {
        const ranges = [
            { label: '<1kg', min: 0, max: 1, count: 0 },
            { label: '1-3kg', min: 1, max: 3, count: 0 },
            { label: '3-10kg', min: 3, max: 10, count: 0 },
            { label: '10-20kg', min: 10, max: 20, count: 0 },
            { label: '>20kg', min: 20, max: 9999, count: 0 },
        ];

        filteredShipments.forEach(s => {
            const w = s.weight || 0;
            if (w === 0) return;
            const range = ranges.find(r => w >= r.min && w < r.max);
            if (range) range.count++;
        });

        return ranges.map(r => ({ range: r.label, count: r.count }));
    }, [filteredShipments]);

    // 6. Weight vs Cost (Scatter Data) - Sampled for performance
    const weightCostData = useMemo(() => {
        // Take up to 200 data points to avoid crashing the chart if too many
        const limit = 200;
        const step = Math.max(1, Math.floor(filteredShipments.length / limit));
        const data = [];

        for (let i = 0; i < filteredShipments.length; i += step) {
            const s = filteredShipments[i];
            if ((s.weight || 0) > 0 && (s.shippingCost || 0) > 0) {
                data.push({ weight: s.weight, cost: s.shippingCost });
            }
        }
        return data;
    }, [filteredShipments]);

    const totalCOD = filteredShipments.reduce((sum, s) => sum + (s.codAmount || 0), 0);
    const totalCost = filteredShipments.reduce((sum, s) => sum + (s.shippingCost || 0), 0);
    const avgCOD = filteredShipments.length > 0 ? totalCOD / filteredShipments.length : 0;

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center space-x-3">
                    <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-200">
                        <BarChart3 className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">วิเคราะห์ข้อมูลเชิงภาพ (Visual Statistics)</h1>
                        <p className="text-sm text-slate-500 font-medium text-indigo-600/70 uppercase tracking-wider">Dashboard v1.0 • Live Data Insights</p>
                    </div>
                </div>
            </div>

            {/* Top Summaries */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute -right-2 -top-2 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Package className="w-20 h-20 text-indigo-600" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">จำนวนส่งทั้งหมด</p>
                    <h3 className="text-3xl font-black text-slate-800 tracking-tighter">{filteredShipments.length.toLocaleString()}</h3>
                    <div className="flex items-center gap-1 mt-2 text-indigo-600 font-bold text-xs bg-indigo-50 w-fit px-2 py-0.5 rounded-full">
                        <Activity className="w-3 h-3" />
                        <span>Active Units</span>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute -right-2 -top-2 opacity-5 group-hover:opacity-10 transition-opacity">
                        <DollarSign className="w-20 h-20 text-emerald-600" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ยอด COD รวม</p>
                    <h3 className="text-3xl font-black text-emerald-600 tracking-tighter">฿{totalCOD.toLocaleString()}</h3>
                    <div className="flex items-center gap-1 mt-2 text-emerald-600 font-bold text-xs bg-emerald-50 w-fit px-2 py-0.5 rounded-full">
                        <ArrowUpRight className="w-3 h-3" />
                        <span>฿{Math.round(avgCOD).toLocaleString()} / Avg</span>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute -right-2 -top-2 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Activity className="w-20 h-20 text-rose-600" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ต้นทุนค่าส่ง + COD Fee</p>
                    <h3 className="text-3xl font-black text-rose-500 tracking-tighter">฿{(totalCost + (totalCOD * (codFeePercent / 100))).toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
                    <div className="flex items-center gap-1 mt-2 text-rose-600 font-bold text-xs bg-rose-50 w-fit px-2 py-0.5 rounded-full">
                        <ArrowDownRight className="w-3 h-3" />
                        <span>{(((totalCost + (totalCOD * (codFeePercent / 100))) / Math.max(1, totalCOD)) * 100).toFixed(1)}% All-in Cost</span>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute -right-2 -top-2 opacity-5 group-hover:opacity-10 transition-opacity">
                        <MapPin className="w-20 h-20 text-amber-600" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">พื้นที่ครอบคลุม</p>
                    <h3 className="text-3xl font-black text-amber-600 tracking-tighter">{new Set(filteredShipments.map(s => s.zipCode)).size}</h3>
                    <div className="flex items-center gap-1 mt-2 text-amber-600 font-bold text-xs bg-amber-50 w-fit px-2 py-0.5 rounded-full">
                        <TrendingUp className="w-3 h-3" />
                        <span>Zip Codes</span>
                    </div>
                </div>

                {/* 5. Payment Split (New) */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute -right-2 -top-2 opacity-5 group-hover:opacity-10 transition-opacity">
                        <DollarSign className="w-20 h-20 text-indigo-600" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">สัดส่วนยอดโอน / COD</p>
                    <div className="flex items-end gap-2">
                        <div className="flex-1">
                            <p className="text-xs font-bold text-slate-500">โอน/ส่งฟรี</p>
                            <h4 className="text-2xl font-black text-indigo-600">{filteredShipments.filter(s => (s.codAmount || 0) === 0).length.toLocaleString()}</h4>
                        </div>
                        <div className="h-8 w-px bg-slate-200"></div>
                        <div className="flex-1">
                            <p className="text-xs font-bold text-slate-500">COD (ปลายทาง)</p>
                            <h4 className="text-2xl font-black text-emerald-600">{filteredShipments.filter(s => (s.codAmount || 0) > 0).length.toLocaleString()}</h4>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 mt-2 text-indigo-600 font-bold text-xs bg-indigo-50 w-fit px-2 py-0.5 rounded-full">
                        <Activity className="w-3 h-3" />
                        <span>{(filteredShipments.filter(s => (s.codAmount || 0) === 0).length / Math.max(1, filteredShipments.length) * 100).toFixed(0)}% โอนเงิน</span>
                    </div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* 1. Daily Volume Trend (Area Chart) */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-black text-slate-700 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-indigo-500" />
                            แนวโน้มรายการจัดส่งรายวัน
                        </h3>
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-lg uppercase">Last 15 Days</span>
                    </div>
                    <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dailyData}>
                                <defs>
                                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} />
                                <RechartsTooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                />
                                <Area type="monotone" dataKey="count" name="จำนวน (ชิ้น)" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Courier Share (Pie Chart) */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-black text-slate-700 flex items-center gap-2">
                            <PieChartIcon className="w-4 h-4 text-emerald-500" />
                            สัดส่วนบริษัทขนส่ง
                        </h3>
                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg uppercase">Market Share</span>
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={courierData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={120}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {courierData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 3. Top 10 Areas (Bar Chart) */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-black text-slate-700 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-amber-500" />
                            10 อันดับพื้นที่ตามวอลลุ่ม
                        </h3>
                        <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-1 rounded-lg uppercase">Top Regions</span>
                    </div>
                    <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={areaData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="zip" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#475569' }} width={60} />
                                <RechartsTooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="count" name="จำนวนออร์เดอร์" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 4. Per Unit Performance (Line Chart) */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-black text-slate-700 flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-violet-500" />
                            ประสิทธิภาพรายชิ้น (Avg COD vs Cost)
                        </h3>
                        <span className="text-[10px] font-bold bg-violet-50 text-violet-600 px-2 py-1 rounded-lg uppercase">Efficiency Trend</span>
                    </div>
                    <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={performanceData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                <RechartsTooltip />
                                <Legend />
                                <Line type="stepAfter" dataKey="avgCOD" name="เฉลี่ย COD" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} />
                                <Line type="stepAfter" dataKey="avgNet" name="กำไรสุทธิเฉลี่ย (Net)" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} />
                                <Line type="stepAfter" dataKey="avgCost" name="ต้นทุน+Feeเฉลี่ย" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 2, fill: '#ef4444' }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 5. Weight Distribution (Bar Chart) */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-black text-slate-700 flex items-center gap-2">
                            <Package className="w-4 h-4 text-cyan-500" />
                            การกระจายตัวของน้ำหนัก
                        </h3>
                        <span className="text-[10px] font-bold bg-cyan-50 text-cyan-600 px-2 py-1 rounded-lg uppercase">Weight Dist.</span>
                    </div>
                    <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={weightDistributionData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="range" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} />
                                <RechartsTooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="count" name="จำนวนพัสดุ" fill="#06b6d4" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 6. Weight vs Cost Correlation (Scatter Chart) */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-black text-slate-700 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-pink-500" />
                            ความสัมพันธ์ น้ำหนัก vs ค่าส่ง
                        </h3>
                        <span className="text-[10px] font-bold bg-pink-50 text-pink-600 px-2 py-1 rounded-lg uppercase">Cost Correlation</span>
                    </div>
                    <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis type="number" dataKey="weight" name="น้ำหนัก" unit="kg" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                <YAxis type="number" dataKey="cost" name="ค่าส่ง" unit="฿" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: '12px' }} />
                                <Scatter name="Shipments" data={weightCostData} fill="#ec4899" fillOpacity={0.6} shape="circle" />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>

    );
};

export default VisualMetricsPage;
