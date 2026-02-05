import React, { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { useSettings } from '../context/SettingsContext';
import { TrendingUp, TrendingDown, BarChart3, Download, Calendar, DollarSign, Package, Percent } from 'lucide-react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const TrendAnalysisPage: React.FC = () => {
    const { filteredShipments } = useData();
    const { settings } = useSettings();
    const codFeePercent = settings.cod_fee || 0;

    const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(
        new Set(['quantity', 'cost', 'cod', 'profit', 'roi'])
    );

    // Calculate batch statistics
    const batchStats = useMemo(() => {
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

        return Array.from(batchMap.values())
            .sort((a, b) => {
                if (a.date !== b.date) return a.date.localeCompare(b.date);
                return a.time.localeCompare(b.time);
            })
            .map(batch => {
                const codFees = batch.cod * (codFeePercent / 100);
                const profit = batch.cod - batch.cost - codFees;
                const roi = batch.cost > 0 ? (profit / batch.cost) * 100 : 0;
                return {
                    ...batch,
                    profit,
                    roi,
                    label: `${batch.date} ${batch.time}`
                };
            });
    }, [filteredShipments, codFeePercent]);

    // Calculate trends and statistics
    const trendStats = useMemo(() => {
        if (batchStats.length < 2) {
            return {
                quantityTrend: 0,
                costTrend: 0,
                codTrend: 0,
                profitTrend: 0,
                roiTrend: 0,
                avgQuantity: 0,
                avgCost: 0,
                avgCOD: 0,
                avgProfit: 0,
                avgROI: 0
            };
        }

        const recent = batchStats.slice(-5); // Last 5 batches
        const older = batchStats.slice(0, Math.min(5, batchStats.length - 5)); // First 5 batches

        const avgRecent = {
            quantity: recent.reduce((sum, b) => sum + b.count, 0) / recent.length,
            cost: recent.reduce((sum, b) => sum + b.cost, 0) / recent.length,
            cod: recent.reduce((sum, b) => sum + b.cod, 0) / recent.length,
            profit: recent.reduce((sum, b) => sum + b.profit, 0) / recent.length,
            roi: recent.reduce((sum, b) => sum + b.roi, 0) / recent.length
        };

        const avgOlder = older.length > 0 ? {
            quantity: older.reduce((sum, b) => sum + b.count, 0) / older.length,
            cost: older.reduce((sum, b) => sum + b.cost, 0) / older.length,
            cod: older.reduce((sum, b) => sum + b.cod, 0) / older.length,
            profit: older.reduce((sum, b) => sum + b.profit, 0) / older.length,
            roi: older.reduce((sum, b) => sum + b.roi, 0) / older.length
        } : avgRecent;

        return {
            quantityTrend: avgOlder.quantity > 0 ? ((avgRecent.quantity - avgOlder.quantity) / avgOlder.quantity) * 100 : 0,
            costTrend: avgOlder.cost > 0 ? ((avgRecent.cost - avgOlder.cost) / avgOlder.cost) * 100 : 0,
            codTrend: avgOlder.cod > 0 ? ((avgRecent.cod - avgOlder.cod) / avgOlder.cod) * 100 : 0,
            profitTrend: avgOlder.profit !== 0 ? ((avgRecent.profit - avgOlder.profit) / Math.abs(avgOlder.profit)) * 100 : 0,
            roiTrend: avgRecent.roi - avgOlder.roi,
            avgQuantity: batchStats.reduce((sum, b) => sum + b.count, 0) / batchStats.length,
            avgCost: batchStats.reduce((sum, b) => sum + b.cost, 0) / batchStats.length,
            avgCOD: batchStats.reduce((sum, b) => sum + b.cod, 0) / batchStats.length,
            avgProfit: batchStats.reduce((sum, b) => sum + b.profit, 0) / batchStats.length,
            avgROI: batchStats.reduce((sum, b) => sum + b.roi, 0) / batchStats.length
        };
    }, [batchStats]);

    // Chart data
    const chartData = useMemo(() => {
        const labels = batchStats.map(b => b.label);

        const datasets = [];

        if (selectedMetrics.has('quantity')) {
            datasets.push({
                label: 'จำนวน (Quantity)',
                data: batchStats.map(b => b.count),
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.3,
                yAxisID: 'y',
                pointRadius: 4,
                pointHoverRadius: 6
            });
        }

        if (selectedMetrics.has('cost')) {
            datasets.push({
                label: 'ต้นทุน (Cost)',
                data: batchStats.map(b => b.cost),
                borderColor: 'rgb(239, 68, 68)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                tension: 0.3,
                yAxisID: 'y1',
                pointRadius: 4,
                pointHoverRadius: 6
            });
        }

        if (selectedMetrics.has('cod')) {
            datasets.push({
                label: 'ยอดเก็บเงิน (COD)',
                data: batchStats.map(b => b.cod),
                borderColor: 'rgb(16, 185, 129)',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.3,
                yAxisID: 'y1',
                pointRadius: 4,
                pointHoverRadius: 6
            });
        }

        if (selectedMetrics.has('profit')) {
            datasets.push({
                label: 'กำไร (Profit)',
                data: batchStats.map(b => b.profit),
                borderColor: 'rgb(124, 58, 237)',
                backgroundColor: 'rgba(124, 58, 237, 0.1)',
                tension: 0.3,
                yAxisID: 'y1',
                pointRadius: 4,
                pointHoverRadius: 6
            });
        }

        if (selectedMetrics.has('roi')) {
            datasets.push({
                label: 'ROI (%)',
                data: batchStats.map(b => b.roi),
                borderColor: 'rgb(245, 158, 11)',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                tension: 0.3,
                yAxisID: 'y2',
                pointRadius: 4,
                pointHoverRadius: 6
            });
        }

        return { labels, datasets };
    }, [batchStats, selectedMetrics]);

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index' as const,
            intersect: false,
        },
        plugins: {
            legend: {
                position: 'top' as const,
                labels: {
                    usePointStyle: true,
                    padding: 15,
                    font: {
                        size: 12,
                        weight: 'bold' as const
                    }
                }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                titleFont: {
                    size: 14,
                    weight: 'bold' as const
                },
                bodyFont: {
                    size: 13
                },
                callbacks: {
                    label: function (context: any) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (label.includes('ROI')) {
                            label += context.parsed.y.toFixed(1) + '%';
                        } else if (label.includes('จำนวน')) {
                            label += context.parsed.y.toLocaleString();
                        } else {
                            label += '฿' + context.parsed.y.toLocaleString();
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: {
                    display: false
                },
                ticks: {
                    maxRotation: 45,
                    minRotation: 45,
                    font: {
                        size: 10
                    }
                }
            },
            y: {
                type: 'linear' as const,
                display: selectedMetrics.has('quantity'),
                position: 'left' as const,
                title: {
                    display: true,
                    text: 'จำนวน (Quantity)',
                    color: 'rgb(59, 130, 246)',
                    font: {
                        size: 12,
                        weight: 'bold' as const
                    }
                },
                ticks: {
                    color: 'rgb(59, 130, 246)'
                },
                grid: {
                    drawOnChartArea: true,
                }
            },
            y1: {
                type: 'linear' as const,
                display: selectedMetrics.has('cost') || selectedMetrics.has('cod') || selectedMetrics.has('profit'),
                position: 'right' as const,
                title: {
                    display: true,
                    text: 'มูลค่า (฿)',
                    color: 'rgb(100, 116, 139)',
                    font: {
                        size: 12,
                        weight: 'bold' as const
                    }
                },
                ticks: {
                    color: 'rgb(100, 116, 139)',
                    callback: function (value: any) {
                        return '฿' + value.toLocaleString();
                    }
                },
                grid: {
                    drawOnChartArea: false,
                }
            },
            y2: {
                type: 'linear' as const,
                display: selectedMetrics.has('roi'),
                position: 'right' as const,
                suggestedMin: 0,
                suggestedMax: 200,
                title: {
                    display: true,
                    text: 'ROI (%)',
                    color: 'rgb(245, 158, 11)',
                    font: {
                        size: 12,
                        weight: 'bold' as const
                    }
                },
                ticks: {
                    color: 'rgb(245, 158, 11)',
                    callback: function (value: any) {
                        return value + '%';
                    }
                },
                grid: {
                    drawOnChartArea: false,
                }
            }
        }
    };

    const toggleMetric = (metric: string) => {
        const newMetrics = new Set(selectedMetrics);
        if (newMetrics.has(metric)) {
            newMetrics.delete(metric);
        } else {
            newMetrics.add(metric);
        }
        setSelectedMetrics(newMetrics);
    };

    const exportData = () => {
        const headers = ['วัน-เวลา', 'จำนวน', 'ต้นทุน (Cost)', 'ยอดเก็บเงิน (COD)', 'กำไร (Profit)', 'ROI (%)'];
        const rows = batchStats.map(batch => [
            batch.label,
            batch.count,
            batch.cost.toFixed(2),
            batch.cod.toFixed(2),
            batch.profit.toFixed(2),
            batch.roi.toFixed(2)
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `trend-analysis-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center space-x-3">
                    <BarChart3 className="w-8 h-8 text-indigo-600" />
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">วิเคราะห์แนวโน้ม (Trend Analysis)</h1>
                        <p className="text-sm text-slate-500 mt-1">ติดตามความเคลื่อนไหวและแนวโน้มของธุรกิจ</p>
                    </div>
                </div>
                <button
                    onClick={exportData}
                    className="btn-primary flex items-center gap-2"
                >
                    <Download className="w-4 h-4" />
                    Export CSV
                </button>
            </div>

            {/* Data Points Indicator */}
            <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {batchStats.length} รอบการนำเข้า
                </span>
            </div>

            {/* Trend Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Quantity Trend */}
                <div className="card p-4 bg-blue-50/50 border-blue-100">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">จำนวน</span>
                        <Package className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex items-end gap-2">
                        <span className="text-xl font-bold text-blue-600">
                            {trendStats.avgQuantity.toFixed(0)}
                        </span>
                        <span className="text-xs text-slate-500 mb-0.5">เฉลี่ย</span>
                    </div>
                    <div className={`flex items-center gap-1 mt-1 text-xs font-bold ${trendStats.quantityTrend >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                        {trendStats.quantityTrend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(trendStats.quantityTrend).toFixed(1)}%
                    </div>
                </div>

                {/* Cost Trend */}
                <div className="card p-4 bg-rose-50/50 border-rose-100">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ต้นทุน</span>
                        <DollarSign className="w-4 h-4 text-rose-600" />
                    </div>
                    <div className="flex items-end gap-2">
                        <span className="text-xl font-bold text-rose-600">
                            ฿{trendStats.avgCost.toFixed(0)}
                        </span>
                        <span className="text-xs text-slate-500 mb-0.5">เฉลี่ย</span>
                    </div>
                    <div className={`flex items-center gap-1 mt-1 text-xs font-bold ${trendStats.costTrend <= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                        {trendStats.costTrend <= 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                        {Math.abs(trendStats.costTrend).toFixed(1)}%
                    </div>
                </div>

                {/* COD Trend */}
                <div className="card p-4 bg-emerald-50/50 border-emerald-100">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ยอด COD</span>
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex items-end gap-2">
                        <span className="text-xl font-bold text-emerald-600">
                            ฿{trendStats.avgCOD.toFixed(0)}
                        </span>
                        <span className="text-xs text-slate-500 mb-0.5">เฉลี่ย</span>
                    </div>
                    <div className={`flex items-center gap-1 mt-1 text-xs font-bold ${trendStats.codTrend >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                        {trendStats.codTrend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(trendStats.codTrend).toFixed(1)}%
                    </div>
                </div>

                {/* Profit Trend */}
                <div className="card p-4 bg-violet-50/50 border-violet-100">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">กำไร</span>
                        <TrendingUp className="w-4 h-4 text-violet-600" />
                    </div>
                    <div className="flex items-end gap-2">
                        <span className="text-xl font-bold text-violet-600">
                            ฿{trendStats.avgProfit.toFixed(0)}
                        </span>
                        <span className="text-xs text-slate-500 mb-0.5">เฉลี่ย</span>
                    </div>
                    <div className={`flex items-center gap-1 mt-1 text-xs font-bold ${trendStats.profitTrend >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                        {trendStats.profitTrend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(trendStats.profitTrend).toFixed(1)}%
                    </div>
                </div>

                {/* ROI Trend */}
                <div className="card p-4 bg-amber-50/50 border-amber-100">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ROI</span>
                        <Percent className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="flex items-end gap-2">
                        <span className="text-xl font-bold text-amber-600">
                            {trendStats.avgROI.toFixed(1)}%
                        </span>
                        <span className="text-xs text-slate-500 mb-0.5">เฉลี่ย</span>
                    </div>
                    <div className={`flex items-center gap-1 mt-1 text-xs font-bold ${trendStats.roiTrend >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                        {trendStats.roiTrend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {trendStats.roiTrend >= 0 ? '+' : ''}{trendStats.roiTrend.toFixed(1)} pts
                    </div>
                </div>
            </div>

            {/* Metric Selector */}
            <div className="card p-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo-500" />
                    เลือกตัวชี้วัดที่ต้องการแสดง
                </h3>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => toggleMetric('quantity')}
                        className={`px-4 py-2 rounded-lg border-2 transition-all font-semibold text-sm ${selectedMetrics.has('quantity')
                            ? 'bg-blue-100 border-blue-500 text-blue-700'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                            }`}
                    >
                        <Package className="w-4 h-4 inline mr-2" />
                        จำนวน (Quantity)
                    </button>
                    <button
                        onClick={() => toggleMetric('cost')}
                        className={`px-4 py-2 rounded-lg border-2 transition-all font-semibold text-sm ${selectedMetrics.has('cost')
                            ? 'bg-rose-100 border-rose-500 text-rose-700'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-rose-300'
                            }`}
                    >
                        <DollarSign className="w-4 h-4 inline mr-2" />
                        ต้นทุน (Cost)
                    </button>
                    <button
                        onClick={() => toggleMetric('cod')}
                        className={`px-4 py-2 rounded-lg border-2 transition-all font-semibold text-sm ${selectedMetrics.has('cod')
                            ? 'bg-emerald-100 border-emerald-500 text-emerald-700'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300'
                            }`}
                    >
                        <DollarSign className="w-4 h-4 inline mr-2" />
                        ยอดเก็บเงิน (COD)
                    </button>
                    <button
                        onClick={() => toggleMetric('profit')}
                        className={`px-4 py-2 rounded-lg border-2 transition-all font-semibold text-sm ${selectedMetrics.has('profit')
                            ? 'bg-violet-100 border-violet-500 text-violet-700'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-violet-300'
                            }`}
                    >
                        <TrendingUp className="w-4 h-4 inline mr-2" />
                        กำไร (Profit)
                    </button>
                    <button
                        onClick={() => toggleMetric('roi')}
                        className={`px-4 py-2 rounded-lg border-2 transition-all font-semibold text-sm ${selectedMetrics.has('roi')
                            ? 'bg-amber-100 border-amber-500 text-amber-700'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300'
                            }`}
                    >
                        <Percent className="w-4 h-4 inline mr-2" />
                        ROI (%)
                    </button>
                </div>
            </div>

            {/* Chart */}
            <div className="card p-6">
                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo-500" />
                    กราฟแนวโน้ม (Trend Chart)
                </h3>
                {batchStats.length > 0 ? (
                    <div style={{ height: '500px' }}>
                        <Line data={chartData} options={chartOptions} />
                    </div>
                ) : (
                    <div className="text-center py-20 text-slate-400">
                        <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="font-semibold">ไม่มีข้อมูลสำหรับแสดงกราฟ</p>
                        <p className="text-sm mt-1">กรุณานำเข้าข้อมูลการจัดส่งเพื่อดูแนวโน้ม</p>
                    </div>
                )}
            </div>

            {/* Data Table */}
            <div className="card">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-indigo-500" />
                        ตารางข้อมูลแนวโน้ม
                    </h3>
                </div>
                <div className="p-0 overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider sticky top-0">
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
                            {batchStats.map((batch, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-5 py-3">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-700 text-sm">{batch.date}</span>
                                            <span className="text-xs text-slate-500 font-mono">{batch.time}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3 text-right font-medium text-blue-600">
                                        {batch.count}
                                    </td>
                                    <td className="px-5 py-3 text-right font-medium text-rose-600">
                                        ฿{batch.cost.toLocaleString()}
                                    </td>
                                    <td className="px-5 py-3 text-right font-medium text-emerald-600">
                                        ฿{batch.cod.toLocaleString()}
                                    </td>
                                    <td className="px-5 py-3 text-right font-bold text-violet-600">
                                        ฿{batch.profit.toLocaleString()}
                                    </td>
                                    <td className="px-5 py-3 text-right font-medium">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${batch.roi > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                            {batch.roi.toFixed(1)}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {batchStats.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-5 py-10 text-center text-slate-400">ไม่มีข้อมูล</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TrendAnalysisPage;
