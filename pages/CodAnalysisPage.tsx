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
import { LayoutGrid, List, Scale, ArrowUp, ArrowDown, CheckCircle, AlertTriangle, ShieldAlert, ArrowRight, Settings, Save, Banknote } from 'lucide-react';

// Interfaces matching new backend structure (CodAnalysis)
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
    type: 'COD_MISMATCH';
    expectedCod: number;
    diff: number;
}

interface WeightGroupSummary {
    weight: number;
    modeCod: number;
    modeCost: number;
    totalOrders: number;
    matchCount: number;
    anomalyCount: number;
    codDistribution: { [key: string]: number };
    outliers: Outlier[];
}

interface AnalysisData {
    summary: WeightGroupSummary[];
    totalAnalyzed: number;
}

// Helper component for Sortable Table
const SortableTable = ({ data, columns }: { data: any[], columns: any[] }) => {
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
    const [filters, setFilters] = useState<{ [key: string]: string }>({});

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const processedData = React.useMemo(() => {
        let result = [...data];
        Object.keys(filters).forEach(key => {
            if (filters[key]) {
                const lowerVal = filters[key].toLowerCase();
                result = result.filter(item =>
                    String(item[key]).toLowerCase().includes(lowerVal)
                );
            }
        });
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

const CodAnalysisPage: React.FC = () => {
    const location = useLocation();

    const [data, setData] = useState<AnalysisData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedWeight, setSelectedWeight] = useState<number | null>(null);
    const [viewMode, setViewMode] = useState<'summary' | 'detail'>('summary');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/analytics/cod-analysis-by-weight?format=json');
            if (!response.ok) throw new Error('Server error');

            const result = await response.json();
            if (!result || !result.summary) throw new Error('Invalid data');
            setData(result);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="flex justify-center items-center h-screen bg-slate-50">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600 mx-auto mb-4"></div>
                <p className="text-gray-500 font-medium">Analyzing Weight & COD Patterns...</p>
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

    const activeGroup = selectedWeight !== null
        ? data.summary.find(g => g.weight === selectedWeight)
        : null;

    return (
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Banknote className="w-8 h-8 text-emerald-600" />
                        COD Analysis by Weight
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Analyzed <span className="font-bold text-slate-900">{data.totalAnalyzed.toLocaleString()}</span> shipments.
                        Grouped by Weight.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => { setSelectedWeight(null); setViewMode('summary'); }}
                        className={`px-4 py-2 rounded-lg font-bold transition-all ${viewMode === 'summary'
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                            }`}
                    >
                        Overview
                    </button>
                    {activeGroup && (
                        <button
                            className="px-4 py-2 rounded-lg font-bold bg-emerald-600 text-white shadow-lg shadow-emerald-200"
                        >
                            {activeGroup.weight} kg Breakdown
                        </button>
                    )}
                </div>
            </div>

            {/* Overview Mode */}
            {viewMode === 'summary' && (
                <div className="space-y-6">
                    {/* Weight Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {data.summary.map(group => (
                            <div
                                key={group.weight}
                                onClick={() => { setSelectedWeight(group.weight); setViewMode('detail'); }}
                                className="rounded-xl p-5 border shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden bg-white border-slate-200"
                            >
                                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Scale className="w-16 h-16 text-emerald-600" />
                                </div>

                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Weight Class</div>
                                        <div className="text-2xl font-black text-slate-800">{group.weight} kg</div>
                                    </div>
                                    <div className="px-2 py-1 bg-slate-100 rounded text-xs font-bold text-slate-500">
                                        {group.totalOrders} Orders
                                    </div>
                                </div>

                                <div className="space-y-3 relative z-10">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500">Common COD</span>
                                        <span className="font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                                            ฿{group.modeCod}
                                        </span>
                                    </div>

                                    {/* Mini Bar Chart */}
                                    <div className="flex h-2 rounded-full overflow-hidden bg-slate-100">
                                        <div
                                            style={{ width: `${(group.matchCount / group.totalOrders) * 100}%` }}
                                            className="bg-emerald-500"
                                            title={`Matched: ${group.matchCount}`}
                                        />
                                        <div
                                            style={{ width: `${(group.anomalyCount / group.totalOrders) * 100}%` }}
                                            className="bg-rose-500"
                                            title={`Diff: ${group.anomalyCount}`}
                                        />
                                    </div>

                                    <div className="flex justify-between text-xs font-medium pt-1">
                                        <span className="text-emerald-600 flex items-center gap-1">
                                            <CheckCircle className="w-3 h-3" /> {group.matchCount}
                                        </span>
                                        <span className="text-rose-600 flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" /> {group.anomalyCount}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Chart Overview */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-800 mb-6">COD Mismatches by Weight Group</h2>
                        <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={data.summary}
                                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="weight" tickFormatter={(val) => `${val}kg`} />
                                    <YAxis />
                                    <Tooltip
                                        cursor={{ fill: '#f8fafc' }}
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                                const d = payload[0].payload;
                                                return (
                                                    <div className="bg-white p-3 shadow-xl rounded-xl border border-slate-100 text-sm">
                                                        <p className="font-bold border-b pb-2 mb-2">Weight: {d.weight} kg</p>
                                                        <div className="space-y-1">
                                                            <p className="text-emerald-600">Matched COD (฿{d.modeCod}): {d.matchCount}</p>
                                                            <p className="text-rose-500">Mismatched: {d.anomalyCount}</p>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Legend />
                                    <Bar name="Matched Mode COD" dataKey="matchCount" stackId="a" fill="#10b981" />
                                    <Bar name="Mismatched COD" dataKey="anomalyCount" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} />
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
                        className="text-emerald-600 font-medium hover:underline flex items-center gap-1 mb-2"
                    >
                        ← Back to Overview
                    </button>

                    <div className="bg-white p-6 rounded-xl border border-emerald-100 shadow-sm bg-gradient-to-r from-emerald-50 to-white">
                        <div className="flex flex-col lg:flex-row justify-between gap-6">
                            <div>
                                <h2 className="text-3xl font-black text-slate-800 mb-1">{activeGroup.weight} kg</h2>
                                <div className="text-slate-500 font-medium">Analysis of {activeGroup.totalOrders} shipments</div>
                            </div>
                            <div className="flex gap-8 items-end">
                                <div>
                                    <div className="text-xs font-bold uppercase text-slate-400 mb-1">Mode COD</div>
                                    <div className="text-2xl font-bold text-emerald-600">฿{activeGroup.modeCod}</div>
                                </div>
                                <div>
                                    <div className="text-xs font-bold uppercase text-slate-400 mb-1">Mismatches</div>
                                    <div className="text-2xl font-bold text-rose-500">{activeGroup.anomalyCount}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* COD Distribution Chart */}
                        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="font-bold text-slate-800 mb-4">COD Amount Distribution</h3>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={Object.entries(activeGroup.codDistribution)
                                            .map(([cod, count]) => ({ cod: parseFloat(cod), count: count }))
                                            .sort((a, b) => a.cod - b.cod)
                                        }
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="cod" tickFormatter={(val) => `฿${val}`} />
                                        <YAxis />
                                        <Tooltip />
                                        <Bar dataKey="count">
                                            {Object.entries(activeGroup.codDistribution)
                                                .map(([cod, count]) => ({ cod: parseFloat(cod), count: count }))
                                                .sort((a, b) => a.cod - b.cod)
                                                .map((entry, index) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={entry.cod === activeGroup.modeCod ? '#10b981' : '#f43f5e'}
                                                    />
                                                ))
                                            }
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Stats Panel */}
                        <div className="space-y-4">
                            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                <h4 className="font-bold text-emerald-800 flex items-center gap-2 mb-2">
                                    <CheckCircle className="w-4 h-4" /> Matched Mode ({activeGroup.matchCount})
                                </h4>
                                <p className="text-xs text-emerald-700 leading-relaxed">
                                    Orders with standard COD (฿{activeGroup.modeCod}).
                                </p>
                            </div>
                            <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
                                <h4 className="font-bold text-rose-800 flex items-center gap-2 mb-2">
                                    <AlertTriangle className="w-4 h-4" /> Mismatch ({activeGroup.anomalyCount})
                                </h4>
                                <p className="text-xs text-rose-700 leading-relaxed">
                                    Orders with unexpected COD amounts.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Anomalies Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">Mismatch Details</h3>
                            <button
                                onClick={() => {
                                    const csvContent = "data:text/csv;charset=utf-8,"
                                        + "Tracking,Customer,Phone,Weight,COD,Mode COD,Diff\n"
                                        + activeGroup.outliers.map(e => `${e.tracking},"${e.customer}","${e.phone || ''}",${e.weight},${e.cod},${e.expectedCod},${e.diff}`).join("\n");
                                    const encodedUri = encodeURI(csvContent);
                                    window.open(encodedUri);
                                }}
                                className="text-xs bg-white border px-3 py-1 rounded text-slate-600 hover:text-emerald-600 font-medium"
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
                                { key: 'weight', label: 'Weight', className: 'text-right font-bold', render: (row: Outlier) => `${row.weight} kg` },
                                { key: 'cod', label: 'Actual COD', className: 'text-right font-bold text-rose-600', render: (row: Outlier) => `฿${row.cod}` },
                                { key: 'expectedCod', label: 'Mode COD', className: 'text-right text-emerald-600', render: (row: Outlier) => `฿${row.expectedCod}` },
                                {
                                    key: 'diff', label: 'Diff', className: 'text-center', render: (row: Outlier) => (
                                        <span className={`font-bold ${row.diff > 0 ? 'text-rose-500' : 'text-amber-500'}`}>
                                            {row.diff > 0 ? '+' : ''}{row.diff}
                                        </span>
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

export default CodAnalysisPage;
