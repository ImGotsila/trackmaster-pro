import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell
} from 'recharts';
import { LayoutGrid, List, Scale, ArrowUp, ArrowDown, CheckCircle, AlertTriangle, ShieldAlert, ArrowRight, Settings, Save } from 'lucide-react';

// Interfaces matching new backend structure
interface Outlier {
    id: string;
    tracking: string;
    customer: string;
    phone?: string;
    zip?: string;
    date?: string;
    cost: number;
    cod: number;
    weight: number;
    type: 'OVERWEIGHT' | 'UNDERWEIGHT';
    expectedWeight: number;
    ruleMin?: number;
    ruleMax?: number;
    expectedCost: number;
    diff: number;
}

interface CodGroupSummary {
    cod: number;
    modeWeight: number;
    ruleApplied: boolean;
    minValidWeight: number;
    maxValidWeight: number;
    modeCost: number;
    totalOrders: number;
    normalCount: number;
    underWeightCount: number;
    overWeightCount: number;
    weightDistribution: { [key: string]: number };
    costDistribution: { [key: string]: number };
    outliers: Outlier[];
}

interface AnalysisData {
    summary: CodGroupSummary[];
    totalAnalyzed: number;
    allOutliers: Outlier[];
}

interface WeightRule {
    codAmount: number;
    minWeight: number;
    maxWeight: number;
}

// Helper component for Sortable Table
const SortableTable = ({ data, columns }: { data: any[], columns: any[] }) => {
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
    const [filters, setFilters] = useState<{ [key: string]: string }>({});

    // Handle Sorting
    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Handle Filtering
    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    // Applied Logic
    const processedData = React.useMemo(() => {
        let result = [...data];

        // 1. Filter
        Object.keys(filters).forEach(key => {
            if (filters[key]) {
                const lowerVal = filters[key].toLowerCase();
                result = result.filter(item =>
                    String(item[key]).toLowerCase().includes(lowerVal)
                );
            }
        });

        // 2. Sort
        if (sortConfig) {
            result.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
                if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [data, filters, sortConfig]);

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold">
                    <tr>
                        {columns.map(col => (
                            <th key={col.key} className="px-6 py-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort(col.key)}>
                                <div className="flex items-center gap-1">
                                    {col.label}
                                    {sortConfig?.key === col.key && (
                                        sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                    )}
                                </div>
                            </th>
                        ))}
                    </tr>
                    {/* Filter Row */}
                    <tr className="bg-slate-50 border-b">
                        {columns.map(col => (
                            <th key={`filter-${col.key}`} className="px-2 py-2">
                                <input
                                    type="text"
                                    placeholder={`Filter ${col.label}...`}
                                    className="w-full text-xs p-1 border rounded font-normal bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                                    value={filters[col.key] || ''}
                                    onChange={e => handleFilterChange(col.key, e.target.value)}
                                    onClick={e => e.stopPropagation()}
                                />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {processedData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                            {columns.map(col => (
                                <td key={col.key} className={`px-6 py-3 ${col.className || ''}`}>
                                    {col.render ? col.render(row) : row[col.key]}
                                </td>
                            ))}
                        </tr>
                    ))}
                    {processedData.length === 0 && (
                        <tr>
                            <td colSpan={columns.length} className="px-6 py-8 text-center text-slate-400">
                                No matching records found
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

const WeightAnalysisPage: React.FC = () => {
    const location = useLocation();
    const isListMode = location.pathname === '/weight-anomalies-list';

    const [data, setData] = useState<AnalysisData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedCod, setSelectedCod] = useState<number | null>(null);
    const [viewMode, setViewMode] = useState<'summary' | 'detail'>('summary');

    // Rule Editing State
    const [editMin, setEditMin] = useState<string>('');
    const [editMax, setEditMax] = useState<string>('');
    const [savingRule, setSavingRule] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    // Load rule values when opening detail view
    useEffect(() => {
        if (selectedCod !== null && data) {
            const group = data.summary.find(g => g.cod === selectedCod);
            if (group) {
                setEditMin((group.minValidWeight ?? '').toString());
                setEditMax((group.maxValidWeight ?? '').toString());
            }
        }
    }, [selectedCod, data]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/analytics/weight-cost-analysis?format=json');
            if (!response.ok) throw new Error('Server error');

            const result = await response.json();
            if (!result || !result.summary) throw new Error('Invalid data');

            // Flatten all outliers
            let allOutliers: Outlier[] = [];
            result.summary.forEach((g: CodGroupSummary) => {
                if (g.outliers && g.outliers.length > 0) {
                    allOutliers = [...allOutliers, ...g.outliers];
                }
            });

            setData({ ...result, allOutliers });
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveRule = async () => {
        if (selectedCod === null) return;
        setSavingRule(true);
        try {
            const response = await fetch('/api/weight-rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    codAmount: selectedCod,
                    minWeight: parseFloat(editMin),
                    maxWeight: parseFloat(editMax)
                })
            });

            if (response.ok) {
                // Refresh data to reflect rule changes
                await fetchData();
                alert('Rule updated successfully!');
            } else {
                const errText = await response.text();
                try {
                    const errJson = JSON.parse(errText);
                    alert(`Failed to save rule: ${errJson.error || errText}`);
                } catch (e) {
                    alert(`Failed to save rule: ${errText}`);
                }
            }
        } catch (e: any) {
            console.error(e);
            alert(`Error saving rule: ${e.message}`);
        } finally {
            setSavingRule(false);
        }
    };

    const handleVerify = async (row: Outlier) => {
        if (!confirm(`Verify and move ${row.tracking} to verified list?`)) return;

        try {
            const res = await fetch('/api/weight-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trackingNumber: row.tracking,
                    customerName: row.customer,
                    phoneNumber: row.phone,
                    weight: row.weight,
                    normalWeight: row.expectedWeight, // Use mode as baseline/reference
                    codAmount: row.cod,
                    shippingCost: row.cost,
                    expectedCost: row.expectedCost,
                    diff: row.diff,
                    profit: parseFloat((row.cod - row.cost).toString()),
                    percentCost: parseFloat(((row.cost / row.cod) * 100).toFixed(2)),
                    status: 'Verified',
                    notes: `Verified from Weight Analysis.`
                })
            });

            if (res.ok) {
                alert('Verified successfully!');
            } else {
                const errText = await res.text();
                alert(`Failed to verify: ${res.status} ${res.statusText}\n${errText}`);
            }
        } catch (e: any) {
            console.error(e);
            alert(`Error verifying: ${e.message}`);
        }
    };

    if (loading) return (
        <div className="flex justify-center items-center h-screen bg-slate-50">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600 mx-auto mb-4"></div>
                <p className="text-gray-500 font-medium">Analyzing COD & Weight Patterns...</p>
            </div>
        </div>
    );

    if (!data) return (
        <div className="p-8 text-center bg-red-50 text-red-600 rounded-xl m-8 border border-red-200">
            <h2 className="text-xl font-bold mb-2">Analysis Failed</h2>
            <p>Please ensure the server is running correctly.</p>
            <button onClick={fetchData} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg">Retry</button>
        </div>
    );

    const activeGroup = selectedCod !== null
        ? data.summary.find(g => g.cod === selectedCod)
        : null;

    return (
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        {isListMode ? <List className="w-8 h-8 text-indigo-600" /> : <Scale className="w-8 h-8 text-indigo-600" />}
                        {isListMode ? 'All Weight Anomalies' : 'Weight Analysis by COD'}
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Analyzed <span className="font-bold text-slate-900">{data.totalAnalyzed.toLocaleString()}</span> shipments.
                        {isListMode ? ' Showing all detected anomalies.' : ' Grouped by COD amount.'}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => { setSelectedCod(null); setViewMode('summary'); }}
                        className={`px-4 py-2 rounded-lg font-bold transition-all ${viewMode === 'summary'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                            }`}
                    >
                        Overview
                    </button>
                    {activeGroup && (
                        <button
                            className="px-4 py-2 rounded-lg font-bold bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                        >
                            COD {activeGroup.cod} Breakdown
                        </button>
                    )}
                </div>
            </div>


            {/* Global Outliers Table - Only show in List Mode */}
            {viewMode === 'summary' && isListMode && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-8">
                    <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">All Anomalies</h2>
                            <p className="text-xs text-slate-500">List of all orders with weight deviations across all COD groups</p>
                        </div>
                        <div className="text-sm font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-100">
                            {data.allOutliers ? data.allOutliers.length : 0} Issues Found
                        </div>
                    </div>

                    {data.allOutliers && data.allOutliers.length > 0 ? (
                        <SortableTable
                            data={data.allOutliers}
                            columns={[
                                { key: 'tracking', label: 'Tracking', className: 'font-mono text-indigo-600 font-medium' },
                                { key: 'date', label: 'Date', className: 'text-slate-500 whitespace-nowrap' },
                                { key: 'customer', label: 'Customer', className: 'font-bold text-slate-700' },
                                { key: 'phone', label: 'Phone', className: 'text-slate-500 font-mono' },
                                { key: 'weight', label: 'Weight', className: 'text-right font-bold', render: (row: Outlier) => `${row.weight} kg` },
                                { key: 'cod', label: 'COD', className: 'text-right font-bold text-emerald-600', render: (row: Outlier) => `฿${row.cod}` },
                                {
                                    key: 'profit',
                                    label: 'Profit',
                                    className: 'text-right font-bold text-indigo-600',
                                    render: (row: Outlier) => `฿${(row.cod - row.cost).toLocaleString()}`
                                },
                                {
                                    key: 'percentCost',
                                    label: '% Cost',
                                    className: 'text-right text-xs',
                                    render: (row: Outlier) => <span className="bg-slate-100 px-2 py-1 rounded text-slate-600 font-medium">{((row.cost / row.cod) * 100).toFixed(1)}%</span>
                                },
                                { key: 'cost', label: 'Charged', className: 'text-right text-rose-600 font-medium', render: (row: Outlier) => `฿${row.cost}` },
                                { key: 'expectedCost', label: 'Expected', className: 'text-right text-slate-400', render: (row: Outlier) => `฿${row.expectedCost}` },
                                {
                                    key: 'diff', label: 'Diff', className: 'text-center', render: (row: Outlier) => (
                                        <span className={`font-bold ${row.diff > 0 ? 'text-rose-500' : 'text-amber-500'}`}>
                                            {row.diff > 0 ? '+' : ''}{row.diff}
                                        </span>
                                    )
                                },
                                {
                                    key: 'type', label: 'Verify', className: 'text-center', render: (row: Outlier) => (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleVerify(row); }}
                                            className="text-slate-400 hover:text-emerald-600 transition-colors tooltip"
                                            title="Verify & Save"
                                        >
                                            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-200 hover:bg-emerald-50 hover:border-emerald-200">
                                                <ArrowDown className="w-4 h-4 transform -rotate-90" />
                                            </div>
                                        </button>
                                    )
                                }
                            ]}
                        />
                    ) : (
                        <div className="p-12 text-center text-slate-400">
                            <CheckCircle className="w-12 h-12 mx-auto mb-2 text-emerald-200" />
                            <p>No anomalies found in any group! Perfect!</p>
                        </div>
                    )}
                </div>
            )}

            {/* Overview Mode */}
            {viewMode === 'summary' && !isListMode && (
                <div className="space-y-6">
                    {/* COD Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {data.summary.map(group => (
                            <div
                                key={group.cod}
                                onClick={() => { setSelectedCod(group.cod); setViewMode('detail'); }}
                                className={`rounded-xl p-5 border shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden ${group.ruleApplied ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200'
                                    }`}
                            >
                                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Scale className="w-16 h-16 text-indigo-600" />
                                </div>

                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">COD Amount</div>
                                        <div className="text-2xl font-black text-slate-800">฿{group.cod}</div>
                                    </div>
                                    <div className="px-2 py-1 bg-slate-100 rounded text-xs font-bold text-slate-500">
                                        {group.totalOrders} Orders
                                    </div>
                                </div>

                                <div className="space-y-3 relative z-10">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500">{group.ruleApplied ? 'Custom Rule' : 'Normal Weight'}</span>
                                        <span className={`font-bold px-2 py-0.5 rounded ${group.ruleApplied ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-50 text-emerald-600'
                                            }`}>
                                            {group.ruleApplied
                                                ? `${group.minValidWeight}-${group.maxValidWeight} kg`
                                                : `${group.modeWeight} kg`
                                            }
                                        </span>
                                    </div>

                                    {/* Mini Bar Chart */}
                                    <div className="flex h-2 rounded-full overflow-hidden bg-slate-100">
                                        <div
                                            style={{ width: `${(group.underWeightCount / group.totalOrders) * 100}%` }}
                                            className="bg-amber-400"
                                            title={`Under: ${group.underWeightCount}`}
                                        />
                                        <div
                                            style={{ width: `${(group.normalCount / group.totalOrders) * 100}%` }}
                                            className="bg-emerald-500"
                                            title={`Normal: ${group.normalCount}`}
                                        />
                                        <div
                                            style={{ width: `${(group.overWeightCount / group.totalOrders) * 100}%` }}
                                            className="bg-rose-500"
                                            title={`Over: ${group.overWeightCount}`}
                                        />
                                    </div>

                                    <div className="flex justify-between text-xs font-medium pt-1">
                                        <span className="text-amber-600 flex items-center gap-1">
                                            <ArrowDown className="w-3 h-3" /> {group.underWeightCount}
                                        </span>
                                        <span className="text-emerald-600 flex items-center gap-1">
                                            <CheckCircle className="w-3 h-3" /> {group.normalCount}
                                        </span>
                                        <span className="text-rose-600 flex items-center gap-1">
                                            <ArrowUp className="w-3 h-3" /> {group.overWeightCount}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Chart Overview */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-800 mb-6">Weight Deviations by COD Group</h2>
                        <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={data.summary}
                                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="cod" tickFormatter={(val) => `฿${val}`} />
                                    <YAxis />
                                    <Tooltip
                                        cursor={{ fill: '#f8fafc' }}
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                                const d = payload[0].payload;
                                                return (
                                                    <div className="bg-white p-3 shadow-xl rounded-xl border border-slate-100 text-sm">
                                                        <p className="font-bold border-b pb-2 mb-2">COD: ฿{d.cod}</p>
                                                        <div className="space-y-1">
                                                            <p className="text-emerald-600">Normal: {d.normalCount}</p>
                                                            <p className="text-amber-500">Under: {d.underWeightCount}</p>
                                                            <p className="text-rose-500">Over: {d.overWeightCount}</p>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Legend />
                                    <Bar name="Underweight" dataKey="underWeightCount" stackId="a" fill="#fbbf24" />
                                    <Bar name="Normal" dataKey="normalCount" stackId="a" fill="#10b981" />
                                    <Bar name="Overweight" dataKey="overWeightCount" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* Detail Mode */}
            {viewMode === 'detail' && activeGroup && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <button
                        onClick={() => setViewMode('summary')}
                        className="text-indigo-600 font-medium hover:underline flex items-center gap-1 mb-2"
                    >
                        ← Back to Overview
                    </button>

                    {/* Header + Rule Settings */}
                    <div className="bg-white p-6 rounded-xl border border-indigo-100 shadow-sm bg-gradient-to-r from-indigo-50 to-white">
                        <div className="flex flex-col lg:flex-row justify-between gap-6">
                            <div>
                                <h2 className="text-3xl font-black text-slate-800 mb-1">COD ฿{activeGroup.cod}</h2>
                                <div className="text-slate-500 font-medium">Analysis of {activeGroup.totalOrders} shipments</div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-6 items-end">
                                {/* Rule Editor */}
                                <div className="bg-white/80 p-3 rounded-lg border border-indigo-100 flex items-end gap-2 shadow-sm">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
                                            Valid Weight Range (Kg)
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                value={editMin}
                                                onChange={e => setEditMin(e.target.value)}
                                                className="w-20 px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                step="0.1"
                                                placeholder="Min"
                                            />
                                            <span className="text-gray-400">-</span>
                                            <input
                                                type="number"
                                                value={editMax}
                                                onChange={e => setEditMax(e.target.value)}
                                                className="w-20 px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                step="0.1"
                                                placeholder="Max"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleSaveRule}
                                        disabled={savingRule}
                                        className="h-[30px] px-3 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-1 text-sm font-medium transition-colors"
                                    >
                                        <Save className="w-4 h-4" /> Save
                                    </button>
                                </div>

                                <div className="flex gap-8">
                                    <div className="hidden md:block">
                                        <div className="text-xs font-bold uppercase text-slate-400 mb-1">Weighted Mode</div>
                                        <div className="text-2xl font-bold text-slate-700">{activeGroup.modeWeight} kg</div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold uppercase text-slate-400 mb-1">Anomalies</div>
                                        <div className="text-2xl font-bold text-rose-500">
                                            {activeGroup.underWeightCount + activeGroup.overWeightCount}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Weight Distribution Chart */}
                        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="font-bold text-slate-800 mb-4">Weight Distribution</h3>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={Object.entries(activeGroup.weightDistribution)
                                            .map(([w, c]) => ({ weight: parseFloat(w), count: c }))
                                            .sort((a, b) => a.weight - b.weight)
                                        }
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="weight" label={{ value: 'Weight (kg)', position: 'insideBottom', offset: -5 }} />
                                        <YAxis />
                                        <Tooltip />
                                        <Bar dataKey="count">
                                            {Object.entries(activeGroup.weightDistribution)
                                                .map(([w, c]) => ({ weight: parseFloat(w), count: c }))
                                                .sort((a, b) => a.weight - b.weight)
                                                .map((entry, index) => {
                                                    const isActive = entry.weight >= activeGroup.minValidWeight && entry.weight <= activeGroup.maxValidWeight;
                                                    return (
                                                        <Cell
                                                            key={`cell-${index}`}
                                                            fill={isActive ? '#10b981' : (entry.weight < activeGroup.minValidWeight ? '#fbbf24' : '#f43f5e')}
                                                        />
                                                    );
                                                })
                                            }
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex justify-center gap-4 mt-4 text-xs font-medium">
                                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-amber-400 rounded-sm"></span> Underweight</span>
                                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-500 rounded-sm"></span> Valid Range</span>
                                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-rose-500 rounded-sm"></span> Overweight</span>
                            </div>
                        </div>

                        {/* Stats Panel */}
                        <div className="space-y-4">
                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                                <h4 className="font-bold text-amber-800 flex items-center gap-2 mb-2">
                                    <ArrowDown className="w-4 h-4" /> Underweight ({activeGroup.underWeightCount})
                                </h4>
                                <p className="text-xs text-amber-700 leading-relaxed">
                                    Orders lighter than {activeGroup.minValidWeight}kg.
                                </p>
                            </div>
                            <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
                                <h4 className="font-bold text-rose-800 flex items-center gap-2 mb-2">
                                    <ArrowUp className="w-4 h-4" /> Overweight ({activeGroup.overWeightCount})
                                </h4>
                                <p className="text-xs text-rose-700 leading-relaxed">
                                    Orders heavier than {activeGroup.maxValidWeight}kg.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Anomalies Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">Anomaly Details</h3>
                            <button
                                onClick={() => {
                                    /* Export Logic Here if needed */
                                    const csvContent = "data:text/csv;charset=utf-8,"
                                        + "Tracking,Customer,Phone,Zip,Weight,Normal,Diff,Type\n"
                                        + activeGroup.outliers.map(e => `${e.tracking},"${e.customer}","${e.phone || ''}","${e.zip || ''}",${e.weight},${activeGroup.modeWeight},${e.diff},${e.type}`).join("\n");
                                    const encodedUri = encodeURI(csvContent);
                                    window.open(encodedUri);
                                }}
                                className="text-xs bg-white border px-3 py-1 rounded text-slate-600 hover:text-indigo-600 font-medium"
                            >
                                Export CSV
                            </button>
                        </div>

                        <SortableTable
                            data={activeGroup.outliers}
                            columns={[
                                { key: 'tracking', label: 'Tracking', className: 'font-mono text-indigo-600 font-medium' },
                                { key: 'date', label: 'Date', className: 'text-slate-500 whitespace-nowrap' },
                                { key: 'customer', label: 'Customer', className: 'font-bold text-slate-700' },
                                { key: 'phone', label: 'Phone', className: 'text-slate-500 font-mono' },
                                { key: 'weight', label: 'Weight', className: 'text-right font-bold', render: (row: Outlier) => `${row.weight} kg` },
                                { key: 'cod', label: 'COD', className: 'text-right font-bold text-emerald-600', render: (row: Outlier) => `฿${row.cod}` },
                                { key: 'profit', label: 'Profit', className: 'text-right font-bold text-indigo-600', render: (row: Outlier) => `฿${(row.cod - row.cost).toLocaleString()}` },
                                {
                                    key: 'percentCost',
                                    label: '% Cost',
                                    className: 'text-right text-xs',
                                    render: (row: Outlier) => <span className="bg-slate-100 px-2 py-1 rounded text-slate-600 font-medium">{((row.cost / row.cod) * 100).toFixed(1)}%</span>
                                },
                                { key: 'cost', label: 'Charged', className: 'text-right text-rose-600 font-medium', render: (row: Outlier) => `฿${row.cost}` },
                                { key: 'expectedCost', label: 'Expected', className: 'text-right text-slate-400', render: (row: Outlier) => `฿${row.expectedCost}` },
                                {
                                    key: 'diff', label: 'Diff', className: 'text-center', render: (row: Outlier) => (
                                        <span className={`font-bold ${row.diff > 0 ? 'text-rose-500' : 'text-amber-500'}`}>
                                            {row.diff > 0 ? '+' : ''}{row.diff}
                                        </span>
                                    )
                                },
                                {
                                    key: 'type', label: 'Verify', className: 'text-center', render: (row: Outlier) => (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleVerify(row); }}
                                            className="text-slate-400 hover:text-emerald-600 transition-colors tooltip"
                                            title="Verify & Save"
                                        >
                                            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-200 hover:bg-emerald-50 hover:border-emerald-200">
                                                <ArrowDown className="w-4 h-4 transform -rotate-90" />
                                            </div>
                                        </button>
                                    )
                                }
                            ]}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default WeightAnalysisPage;
