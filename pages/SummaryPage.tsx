import React, { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { TrendingUp, MapPin, Users, DollarSign, Package, Award } from 'lucide-react';

const SummaryPage: React.FC = () => {
    const { shipments } = useData();

    const stats = useMemo(() => {
        // 1. Total Shipping Cost & COD
        const totalShippingCost = shipments.reduce((sum, s) => sum + (s.shippingCost || 0), 0);
        const totalCOD = shipments.reduce((sum, s) => sum + (s.codAmount || 0), 0);

        // 2. Top Areas (Zip Code)
        const zipMap = new Map<string, number>();
        shipments.forEach(s => {
            if (s.zipCode) {
                zipMap.set(s.zipCode, (zipMap.get(s.zipCode) || 0) + 1);
            }
        });

        const topAreas = Array.from(zipMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([zip, count]) => ({ zip, count }));

        // 3. Top Repeat Customers (Phone Number)
        // We group by phone, but keep name for display (take first name found)
        const customerMap = new Map<string, { count: number; name: string }>();
        shipments.forEach(s => {
            if (s.phoneNumber) {
                const existing = customerMap.get(s.phoneNumber);
                if (existing) {
                    existing.count++;
                } else {
                    customerMap.set(s.phoneNumber, { count: 1, name: s.customerName });
                }
            }
        });

        const topCustomers = Array.from(customerMap.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 10)
            .map(([phone, data]) => ({ phone, ...data }));

        return { totalShippingCost, totalCOD, topAreas, topCustomers };
    }, [shipments]);

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center space-x-3 pb-2 border-b border-slate-200">
                <TrendingUp className="w-8 h-8 text-indigo-600" />
                <h1 className="text-2xl font-bold text-slate-800">สรุปข้อมูล (Summary)</h1>
            </div>

            {/* Main Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Total Cost Card */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <DollarSign className="w-24 h-24 text-rose-600" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">ยอดค่าส่งรวม (Cost)</p>
                        <h3 className="text-3xl font-bold text-rose-600 tracking-tight">
                            ฿{stats.totalShippingCost.toLocaleString()}
                        </h3>
                    </div>
                </div>

                {/* Total COD Card */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <DollarSign className="w-24 h-24 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">ยอดเก็บเงินปลายทาง (COD)</p>
                        <h3 className="text-3xl font-bold text-emerald-600 tracking-tight">
                            ฿{stats.totalCOD.toLocaleString()}
                        </h3>
                    </div>
                </div>

                {/* Profit Card */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp className="w-24 h-24 text-indigo-600" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">กำไรโดยประมาณ (Profit)</p>
                        <h3 className="text-3xl font-bold text-indigo-600 tracking-tight">
                            ฿{(stats.totalCOD - stats.totalShippingCost).toLocaleString()}
                        </h3>
                    </div>
                </div>

                {/* Cost Percentage Card */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Award className="w-24 h-24 text-slate-400" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">อัตราส่วนต้นทุน (%)</p>
                        <div className="flex items-end gap-2">
                            <h3 className={`text-3xl font-bold tracking-tight ${(stats.totalShippingCost / (stats.totalCOD || 1)) * 100 > 30 ? 'text-rose-500' : 'text-emerald-500'
                                }`}>
                                {stats.totalCOD > 0 ? ((stats.totalShippingCost / stats.totalCOD) * 100).toFixed(1) : 0}%
                            </h3>
                            <span className="text-xs font-medium text-slate-400 mb-1">ของยอดขาย</span>
                        </div>
                    </div>
                    <div className="mt-4 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full ${(stats.totalShippingCost / (stats.totalCOD || 1)) * 100 > 30 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(((stats.totalShippingCost / (stats.totalCOD || 1)) * 100), 100)}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* Lists Container */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Top Areas */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-indigo-500" />
                            พื้นที่ส่งของสูงสุด (Top Areas)
                        </h3>
                    </div>
                    <div className="p-0 overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-3 font-semibold text-center w-16">#</th>
                                    <th className="px-5 py-3 font-semibold">รหัสไปรษณีย์</th>
                                    <th className="px-5 py-3 font-semibold text-right">จำนวน (ชิ้น)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {stats.topAreas.map((area, idx) => (
                                    <tr key={area.zip} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-3 text-center text-slate-400 font-mono text-xs">{idx + 1}</td>
                                        <td className="px-5 py-3 font-bold text-slate-700 font-mono text-sm">
                                            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">
                                                {area.zip}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-right font-medium text-slate-600 relative">
                                            <div className="flex items-center justify-end gap-3">
                                                <span>{area.count.toLocaleString()}</span>
                                                {/* Simple bar visual */}
                                                <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                                                    <div
                                                        className="h-full bg-indigo-500 rounded-full"
                                                        style={{ width: `${(area.count / stats.topAreas[0].count) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {stats.topAreas.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-5 py-10 text-center text-slate-400">ไม่มีข้อมูล</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Top Customers */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <Users className="w-5 h-5 text-indigo-500" />
                            ลูกค้าประจำ (Top Customers)
                        </h3>
                    </div>
                    <div className="p-0 overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-3 font-semibold text-center w-16">#</th>
                                    <th className="px-5 py-3 font-semibold">ชื่อลูกค้า / เบอร์โทร</th>
                                    <th className="px-5 py-3 font-semibold text-right">จำนวน (ครั้ง)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {stats.topCustomers.map((cust, idx) => (
                                    <tr key={cust.phone} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-3 text-center text-slate-400 font-mono text-xs">
                                            {idx < 3 ? (
                                                <Award className={`w-5 h-5 mx-auto ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-slate-400' : 'text-amber-700'}`} />
                                            ) : (
                                                idx + 1
                                            )}
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700 text-sm truncate max-w-[150px]">{cust.name || '-'}</span>
                                                <span className="text-xs text-slate-500 font-mono">{cust.phone}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3 text-right font-medium text-slate-600">
                                            <span className="inline-block px-2 py-0.5 bg-slate-100 rounded-full text-xs font-bold text-slate-600">
                                                {cust.count.toLocaleString()}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {stats.topCustomers.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-5 py-10 text-center text-slate-400">ไม่มีข้อมูล</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default SummaryPage;
