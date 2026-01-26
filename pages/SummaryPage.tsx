import React, { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { TrendingUp, MapPin, Users, DollarSign, Package, Award, Calendar, Download, BarChart3, PieChart, Search, Percent } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import AddressDetailModal from '../components/AddressDetailModal';
import { getAddressByZipCode } from '../services/AddressService';

type TimeFilter = 'all' | 'today' | 'week' | 'month' | 'custom';

const SummaryPage: React.FC = () => {
    const { filteredShipments } = useData();
    const { settings } = useSettings();
    const codFeePercent = settings.cod_fee || 0;

    // Address Lookup State
    const [selectedZipCode, setSelectedZipCode] = useState<string>('');
    const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

    const handleZipClick = (zip: string) => {
        if (!zip) return;
        setSelectedZipCode(zip);
        setIsAddressModalOpen(true);
    };



    const stats = useMemo(() => {
        // 1. Total Shipping Cost & COD & Fees
        const totalShippingCost = filteredShipments.reduce((sum, s) => sum + (s.shippingCost || 0), 0);
        const totalCOD = filteredShipments.reduce((sum, s) => sum + (s.codAmount || 0), 0);
        const totalCodFees = totalCOD * (codFeePercent / 100);
        const profit = totalCOD - totalShippingCost - totalCodFees;
        const totalActualCost = totalShippingCost + totalCodFees;
        const costPercentage = totalCOD > 0 ? (totalActualCost / totalCOD) * 100 : 0;
        const roi = totalShippingCost > 0 ? ((profit / totalShippingCost) * 100) : 0;

        // 2. Average metrics and Counts
        const avgShippingCost = filteredShipments.length > 0 ? totalShippingCost / filteredShipments.length : 0;
        const avgCOD = filteredShipments.length > 0 ? totalCOD / filteredShipments.length : 0;

        const totalTransferCount = filteredShipments.filter(s => (s.codAmount || 0) === 0).length;
        const totalCodCount = filteredShipments.filter(s => (s.codAmount || 0) > 0).length;

        // 3. Top Areas (Zip Code)
        const zipMap = new Map<string, number>();
        filteredShipments.forEach(s => {
            if (s.zipCode) {
                zipMap.set(s.zipCode, (zipMap.get(s.zipCode) || 0) + 1);
            }
        });

        const topAreas = Array.from(zipMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([zip, count]) => {
                const addresses = getAddressByZipCode(zip);
                // Use the first result as representative, or handle multiple if needed
                const location = addresses.length > 0
                    ? `${addresses[0].amphoe}, ${addresses[0].province}`
                    : '-';
                return { zip, count, location };
            });

        // 4. Top Repeat Customers (Phone Number)
        const customerMap = new Map<string, { count: number; name: string; totalCOD: number }>();
        filteredShipments.forEach(s => {
            if (s.phoneNumber) {
                const existing = customerMap.get(s.phoneNumber);
                if (existing) {
                    existing.count++;
                    existing.totalCOD += (s.codAmount || 0);
                } else {
                    customerMap.set(s.phoneNumber, {
                        count: 1,
                        name: s.customerName,
                        totalCOD: s.codAmount || 0
                    });
                }
            }
        });

        const topCustomers = Array.from(customerMap.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 10)
            .map(([phone, data]) => ({ phone, ...data }));

        // 5. Status breakdown
        const statusMap = new Map<string, number>();
        filteredShipments.forEach(s => {
            statusMap.set(s.status, (statusMap.get(s.status) || 0) + 1);
        });

        // 6. Courier breakdown
        const courierMap = new Map<string, { count: number; cost: number }>();
        filteredShipments.forEach(s => {
            const existing = courierMap.get(s.courier);
            if (existing) {
                existing.count++;
                existing.cost += (s.shippingCost || 0);
            } else {
                courierMap.set(s.courier, { count: 1, cost: s.shippingCost || 0 });
            }
        });

        const courierStats = Array.from(courierMap.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .map(([courier, data]) => ({
                courier,
                count: data.count,
                cost: data.cost,
                avgCost: data.cost / data.count
            }));

        // 7. Batch breakdown (Date + Time)
        const batchMap = new Map<string, { count: number; cost: number; cod: number; date: string; time: string }>();
        filteredShipments.forEach(s => {
            const timeKey = `${s.importDate} ${s.importTime || '00:00'}`;
            const existing = batchMap.get(timeKey);
            if (existing) {
                existing.count++;
                existing.cost += (s.shippingCost || 0);
                existing.cod += (s.codAmount || 0);
            } else {
                batchMap.set(timeKey, {
                    count: 1,
                    cost: s.shippingCost || 0,
                    cod: s.codAmount || 0,
                    date: s.importDate,
                    time: s.importTime || '00:00'
                });
            }
        });

        const batchStats = Array.from(batchMap.values())
            .sort((a, b) => {
                if (a.date !== b.date) return b.date.localeCompare(a.date);
                return b.time.localeCompare(a.time);
            });

        return {
            totalShippingCost,
            totalCOD,
            profit,
            costPercentage,
            roi,
            avgShippingCost,
            avgCOD,
            topAreas,
            topCustomers,
            statusMap,
            courierStats,
            batchStats,
            totalCodFees,
            totalActualCost,
            totalOrders: filteredShipments.length,
            totalTransferCount,
            totalCodCount,
            estimatedTransferRevenue,
            avgTransferVal: settings.avg_transfer_value || 0
        };
    }, [filteredShipments, codFeePercent]);

    const exportToCSV = () => {
        const headers = ['รหัสติดตาม', 'ชื่อลูกค้า', 'เบอร์โทร', 'COD', 'ค่าส่ง', 'รหัสไปรษณีย์', 'สถานะ', 'ขนส่ง', 'วันที่', 'เวลา'];
        const rows = filteredShipments.map(s => [
            s.trackingNumber,
            s.customerName,
            s.phoneNumber,
            s.codAmount,
            s.shippingCost,
            s.zipCode,
            s.status,
            s.courier,
            s.importDate,
            s.importTime || '00:00'
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `summary-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center space-x-3">
                    <TrendingUp className="w-8 h-8 text-indigo-600" />
                    <h1 className="text-2xl font-bold text-slate-800">สรุปข้อมูล (Summary)</h1>
                </div>
                <button
                    onClick={exportToCSV}
                    className="btn-primary flex items-center gap-2"
                >
                    <Download className="w-4 h-4" />
                    Export CSV
                </button>
            </div>

            {/* Data Count Indicator */}
            <div className="flex flex-col md:flex-row justify-end items-end md:items-center gap-2">
                <div className="flex gap-2">
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 flex items-center gap-1">
                        COD: {stats.totalCodCount.toLocaleString()}
                    </span>
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 flex items-center gap-1">
                        Paid/Transfer: {stats.totalTransferCount.toLocaleString()}
                    </span>
                </div>
                <span className="text-sm font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                    รวมทั้งหมด {stats.totalOrders.toLocaleString()} รายการ
                </span>
            </div>

            {/* Main Stats Cards - Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Cost Card */}
                <div className="card p-6 relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <DollarSign className="w-16 h-16 text-rose-600" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">ยอดค่าส่งรวม (Cost)</p>
                        <h3 className="text-2xl font-bold text-rose-600 tracking-tight">
                            ฿{stats.totalShippingCost.toLocaleString()}
                        </h3>
                        <div className="flex justify-between items-center mt-1">
                            <p className="text-[10px] text-slate-400">เฉลี่ย ฿{stats.avgShippingCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} /ชิ้น</p>
                            <span className="text-[10px] font-bold text-slate-300">GROSS COST</span>
                        </div>
                    </div>
                </div>

                {/* COD Fee Card */}
                <div className="card p-6 relative group border-rose-100 bg-rose-50/20">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Percent className="w-16 h-16 text-rose-400" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">ค่าธรรมเนียม COD ({codFeePercent}%)</p>
                        <h3 className="text-2xl font-bold text-rose-500 tracking-tight">
                            ฿{stats.totalCodFees.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-1">
                            หักจากยอด COD สะสม
                        </p>
                    </div>
                </div>

                {/* Total COD Card */}
                <div className="card p-6 relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <DollarSign className="w-16 h-16 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">ยอดเก็บเงินปลายทาง (COD)</p>
                        <h3 className="text-2xl font-bold text-emerald-600 tracking-tight">
                            ฿{stats.totalCOD.toLocaleString()}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                            เฉลี่ย ฿{stats.avgCOD.toLocaleString(undefined, { maximumFractionDigits: 0 })} /ชิ้น
                        </p>
                    </div>
                </div>

                {/* Profit Card */}
                <div className="card p-6 relative group bg-indigo-50/30 border-indigo-100 shadow-indigo-100/50">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp className="w-16 h-16 text-indigo-600" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">กำไรสุทธิ (Net Profit)</p>
                        <h3 className="text-2xl font-bold text-indigo-600 tracking-tight">
                            ฿{stats.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-1 font-bold">
                            ROI: {stats.roi.toFixed(1)}% {stats.avgTransferVal > 0 && <span className="font-normal text-indigo-400">(รวมยอดโอนประมาณการ)</span>}
                        </p>
                        {stats.avgTransferVal > 0 && stats.estimatedTransferRevenue > 0 && (
                            <p className="text-[9px] text-slate-400 mt-0.5">
                                *รวมมูลค่าโอน ~฿{stats.estimatedTransferRevenue.toLocaleString()}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Row 2: Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Cost Percentage Card */}
                <div className="card p-6 relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <PieChart className="w-16 h-16 text-slate-400" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">อัตราส่วนต้นทุน (%)</p>
                        <div className="flex items-end gap-2">
                            <h3 className={`text-2xl font-bold tracking-tight ${stats.costPercentage > 30 ? 'text-rose-500' :
                                stats.costPercentage > 20 ? 'text-amber-500' : 'text-emerald-500'
                                }`}>
                                {stats.costPercentage.toFixed(1)}%
                            </h3>
                            <span className="text-xs font-medium text-slate-400 mb-1">ของยอดขาย</span>
                        </div>
                        <div className="mt-3 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full ${stats.costPercentage > 30 ? 'bg-rose-500' :
                                    stats.costPercentage > 20 ? 'bg-amber-500' : 'bg-emerald-500'
                                    }`}
                                style={{ width: `${Math.min(stats.costPercentage, 100)}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Courier Statistics */}
            <div className="card">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Package className="w-5 h-5 text-indigo-500" />
                        สถิติตามขนส่ง (Courier Stats)
                    </h3>
                </div>
                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {stats.courierStats.map((courier, idx) => (
                            <div key={idx} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-slate-700 text-sm">{courier.courier}</span>
                                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
                                        {courier.count} ชิ้น
                                    </span>
                                </div>
                                <div className="space-y-1 text-xs text-slate-600">
                                    <div className="flex justify-between">
                                        <span>ต้นทุนรวม:</span>
                                        <span className="font-semibold">฿{courier.cost.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>เฉลี่ย/ชิ้น:</span>
                                        <span className="font-semibold">฿{courier.avgCost.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Import Batches (Import Time) */}
            <div className="card">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-indigo-500" />
                        รอบการนำเข้า (Import Batches)
                    </h3>
                </div>
                <div className="p-0 overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                            <tr>
                                <th className="px-5 py-3 font-semibold">วัน-เวลา</th>
                                <th className="px-5 py-3 font-semibold text-right">จำนวน</th>
                                <th className="px-5 py-3 font-semibold text-right">ต้นทุน (Cost)</th>
                                <th className="px-5 py-3 font-semibold text-right">ยอดเก็บเงิน (COD)</th>
                                <th className="px-5 py-3 font-semibold text-right">กำไร (Profit)</th>
                                <th className="px-5 py-3 font-semibold text-right">ROI</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {stats.batchStats.map((batch, idx) => {
                                const profit = batch.cod - batch.cost;
                                const roi = batch.cost > 0 ? (profit / batch.cost) * 100 : 0;
                                return (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-3">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700 text-sm">{batch.date}</span>
                                                <span className="text-xs text-slate-500 font-mono">{batch.time}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3 text-right font-medium text-slate-600">
                                            {batch.count}
                                        </td>
                                        <td className="px-5 py-3 text-right font-medium text-rose-600">
                                            ฿{batch.cost.toLocaleString()}
                                        </td>
                                        <td className="px-5 py-3 text-right font-medium text-emerald-600">
                                            ฿{batch.cod.toLocaleString()}
                                        </td>
                                        <td className="px-5 py-3 text-right font-bold text-indigo-600">
                                            ฿{profit.toLocaleString()}
                                        </td>
                                        <td className="px-5 py-3 text-right font-medium">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${roi > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                {roi.toFixed(1)}%
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {stats.batchStats.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-5 py-10 text-center text-slate-400">ไม่มีข้อมูล</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Lists Container */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Top Areas */}
                <div className="card">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-indigo-500" />
                            พื้นที่ส่งของสูงสุด (Top Areas)
                        </h3>
                    </div>
                    <div className="p-0 overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-3 font-semibold text-center w-12">#</th>
                                    <th className="px-5 py-3 font-semibold w-24">รหัสไปรษณีย์</th>
                                    <th className="px-5 py-3 font-semibold">พื้นที่ (อำเภอ, จังหวัด)</th>
                                    <th className="px-5 py-3 font-semibold text-right">จำนวน (ชิ้น)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {stats.topAreas.map((area, idx) => (
                                    <tr key={area.zip} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-5 py-3 text-center text-slate-400 font-mono text-xs">{idx + 1}</td>
                                        <td className="px-5 py-3 font-bold text-slate-700 font-mono text-sm">
                                            <button
                                                onClick={() => handleZipClick(area.zip)}
                                                className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100 hover:bg-indigo-100 hover:scale-105 transition-all flex items-center gap-1"
                                                title="ดูรายละเอียดพื้นที่"
                                            >
                                                {area.zip}
                                                <Search className="w-3 h-3 opacity-50" />
                                            </button>
                                        </td>
                                        <td className="px-5 py-3 text-sm text-slate-600 truncate max-w-[150px]" title={area.location}>
                                            {area.location}
                                        </td>
                                        <td className="px-5 py-3 text-right font-medium text-slate-600 relative">
                                            <div className="flex items-center justify-end gap-3">
                                                <span>{area.count.toLocaleString()}</span>
                                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
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
                                        <td colSpan={4} className="px-5 py-10 text-center text-slate-400">ไม่มีข้อมูล</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Top Customers */}
                <div className="card">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <Users className="w-5 h-5 text-indigo-500" />
                            ลูกค้าประจำ (Top Customers)
                        </h3>
                    </div>
                    <div className="p-0 overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-3 font-semibold text-center w-16">#</th>
                                    <th className="px-5 py-3 font-semibold">ชื่อลูกค้า / เบอร์โทร</th>
                                    <th className="px-5 py-3 font-semibold text-right">จำนวน</th>
                                    <th className="px-5 py-3 font-semibold text-right">ยอด COD</th>
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
                                                {cust.count} ครั้ง
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-right font-semibold text-emerald-600 text-sm">
                                            ฿{cust.totalCOD.toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                                {stats.topCustomers.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-5 py-10 text-center text-slate-400">ไม่มีข้อมูล</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            <AddressDetailModal
                isOpen={isAddressModalOpen}
                onClose={() => setIsAddressModalOpen(false)}
                zipCode={selectedZipCode}
            />
        </div>
    );
};

export default SummaryPage;
