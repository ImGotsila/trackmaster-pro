import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';


// Define types for our anomaly data
interface Anomaly {
    id: string;
    tracking: string;
    name: string;
    phone?: string;
    cost: number;
    codAmount: number;
    profit: number;
    costPercent: number;
    weight: number;
    expectedCost: number;
    diff: number;
    date: string;
    timestamp: number;
    anomalyType?: 'negative_profit' | 'high_ratio' | 'mismatch' | 'normal';
}

interface Stats {
    totalScanned: number;
    validRecords: number;

    anomaliesFound: number;
    filteredCount: number;
    totalRefundPotential: number;
}

const ShippingAnomalyPage: React.FC = () => {
    const navigate = useNavigate();
    const { startDate, endDate } = useData();
    const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(false);
    const [minDiff, setMinDiff] = useState(0); // Changed from 20 to 0
    // Dynamic Analysis Settings
    const [profitThreshold, setProfitThreshold] = useState(0);
    const [costRatioThreshold, setCostRatioThreshold] = useState(20);

    // Local date state removed in favor of global context
    const [showAll, setShowAll] = useState(true); // Changed from false to true

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(50);

    // Detail Modal State
    const [selectedShipment, setSelectedShipment] = useState<Anomaly | null>(null);

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: keyof Anomaly; direction: 'asc' | 'desc' } | null>(null);

    // Filter State: Text filters and Range filters
    const [textFilters, setTextFilters] = useState<{ [key in keyof Anomaly]?: string }>({});
    const [rangeFilters, setRangeFilters] = useState<{ [key: string]: { min?: string; max?: string } }>({});


    // Pagination Metadata from Server
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    const fetchData = async () => {
        setLoading(true);
        const query = new URLSearchParams();
        if (startDate) query.append('startDate', startDate);
        if (endDate) query.append('endDate', endDate);
        if (showAll) query.append('showAll', 'true');

        // Add Analysis Settings
        query.append('minDiff', minDiff.toString());
        query.append('profitThreshold', profitThreshold.toString());
        query.append('costRatioThreshold', costRatioThreshold.toString());

        // Add Pagination
        query.append('page', currentPage.toString());
        query.append('limit', itemsPerPage.toString());

        // Add Sort
        if (sortConfig) {
            query.append('sortBy', sortConfig.key);
            query.append('sortDir', sortConfig.direction);
        }

        // Add Text Filters
        Object.entries(textFilters).forEach(([key, value]) => {
            if (value) query.append(`filter_${key}`, value);
        });

        // Add Range Filters
        Object.entries(rangeFilters).forEach(([key, val]) => {
            const range = val as { min?: string; max?: string };
            if (range.min) query.append(`min_${key}`, range.min);
            if (range.max) query.append(`max_${key}`, range.max);
        });

        try {
            // Use relative path to leverage Vite proxy / same-origin in prod
            const res = await fetch(`/api/analytics/shipping-anomalies?${query.toString()}`);
            if (!res.ok) throw new Error('API Request Failed');

            const data = await res.json();

            if (data.success) {
                // Support both new (server-side pagination) and old (client-side) formats
                const results = data.data || data.anomalies || [];
                setAnomalies(results);
                setStats(data.stats);

                if (data.pagination) {
                    setTotalPages(data.pagination.total);
                    setTotalItems(data.pagination.totalItems);
                } else {
                    // Fallback for old server 
                    setTotalPages(1);
                    setTotalItems(results.length);
                }
            }
        } catch (err) {
            console.error("Failed to fetch anomalies", err);
            // Fallback for dev if proxy missing
            if (window.location.hostname === 'localhost') {
                try {
                    const res = await fetch(`http://localhost:3001/api/analytics/shipping-anomalies?${query.toString()}`);
                    const data = await res.json();
                    if (data.success) {
                        setAnomalies(data.data);
                        setStats(data.stats);
                        setTotalPages(data.pagination.total);
                        setTotalItems(data.pagination.totalItems);
                    }
                } catch (e) { }
            }
        } finally {
            setLoading(false);
        }
    };

    const syncAndRefresh = async () => {
        setLoading(true);
        try {
            // Step 1: Fetch latest data from Google Sheets
            const gsResponse = await fetch('/api/gsheets/get');
            if (gsResponse.ok) {
                const gsData = await gsResponse.json();
                console.log(`Fetched ${gsData.data?.length || 0} records from Google Sheets`);

                // Step 2: Save to database
                if (gsData.data && gsData.data.length > 0) {
                    await fetch('/api/gsheets/save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ shipments: gsData.data })
                    });
                    console.log('Data synced to database');
                }
            }
        } catch (e) {
            console.error('Sync error:', e);
        }

        // Step 3: Refresh the anomaly dashboard
        await fetchData();
    };

    useEffect(() => {
        // Auto-refresh on: date changes, sorting, pagination
        // Manual refresh on: filters, analysis settings
        fetchData();
    }, [startDate, endDate, sortConfig, currentPage]);

    // Removed Client-Side Logic (filteredAnomalies logic) -> Handled by Server
    const currentItems = anomalies; // Directly use fetched data as it is already paginated

    const handleSort = (key: keyof Anomaly) => {
        // Toggle Logic
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleTextFilterChange = useCallback((key: keyof Anomaly, value: string) => {
        setTextFilters(prev => ({ ...prev, [key]: value }));
    }, []);

    const handleRangeFilterChange = useCallback((key: keyof Anomaly, type: 'min' | 'max', value: string) => {
        setRangeFilters(prev => ({
            ...prev,
            [key]: { ...prev[key as string], [type]: value }
        }));
    }, []);

    // Pagination Logic (Server Side)
    const goToPage = (pageNumber: number) => {
        if (pageNumber >= 1 && pageNumber <= totalPages) {
            setCurrentPage(pageNumber);
        }
    };

    const exportToExcel = () => {
        // Server-Side Export URL
        const query = new URLSearchParams();
        if (startDate) query.append('startDate', startDate);
        if (endDate) query.append('endDate', endDate);
        if (showAll) query.append('showAll', 'true');
        query.append('minDiff', minDiff.toString());
        query.append('profitThreshold', profitThreshold.toString());
        query.append('costRatioThreshold', costRatioThreshold.toString());
        query.append('export', 'true');

        // Add Filters to export too
        Object.entries(textFilters).forEach(([key, value]) => {
            if (value) query.append(`filter_${key}`, value);
        });
        Object.entries(rangeFilters).forEach(([key, val]) => {
            const range = val as { min?: string; max?: string };
            if (range.min) query.append(`min_${key}`, range.min);
            if (range.max) query.append(`max_${key}`, range.max);
        });

        // Add Sort to export too
        if (sortConfig) {
            query.append('sortBy', sortConfig.key);
            query.append('sortDir', sortConfig.direction);
        }

        const url = `/api/analytics/shipping-anomalies?${query.toString()}`;
        // Open in new window to download
        window.open(url, '_blank');
    };

    const SortIcon = ({ column }: { column: keyof Anomaly }) => {
        if (sortConfig?.key !== column) return <span className="text-gray-300 ml-1">⇅</span>;
        return <span className="ml-1 text-indigo-600">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>;
    };

    const RangeInput = useMemo(() => {
        return ({ column, placeholder = "" }: { column: keyof Anomaly, placeholder?: string }) => (
            <div className="flex flex-col gap-1">
                <input
                    type="number"
                    placeholder={`Min ${placeholder}`}
                    value={rangeFilters[column as string]?.min || ''}
                    className="w-full min-w-[80px] p-1 border rounded text-[10px] bg-slate-50 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                    onChange={e => handleRangeFilterChange(column, 'min', e.target.value)}
                />
                <input
                    type="number"
                    placeholder={`Max ${placeholder}`}
                    value={rangeFilters[column as string]?.max || ''}
                    className="w-full min-w-[80px] p-1 border rounded text-[10px] bg-slate-50 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                    onChange={e => handleRangeFilterChange(column, 'max', e.target.value)}
                />
            </div>
        );
    }, [rangeFilters, handleRangeFilterChange]);

    const TextInput = useMemo(() => {
        return ({ column, placeholder = "Filter..." }: { column: keyof Anomaly, placeholder?: string }) => (
            <input
                type="text"
                placeholder={placeholder}
                value={textFilters[column as string] || ''}
                className="w-full min-w-[100px] p-1 border rounded text-[10px] bg-slate-50 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                onChange={e => handleTextFilterChange(column, e.target.value)}
            />
        );
    }, [textFilters, handleTextFilterChange]);

    return (
        <div className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold mb-2">ตรวจสอบค่าส่งผิดปกติ (Claims)</h1>
                    <p className="text-gray-500">ตรวจสอบพัสดุที่ค่าส่งไม่สัมพันธ์กับน้ำหนัก เพื่อทำเรื่องเคลมขอคืนเงิน</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={syncAndRefresh}
                        disabled={loading}
                        className="bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 px-4 py-2 rounded-lg flex items-center gap-2 shadow-md transition-colors text-sm font-medium"
                    >
                        {loading ? '⟳ Syncing...' : '🔄 Sync from Sheets'}
                    </button>
                    <button
                        onClick={() => navigate('/weight-analysis')}
                        className="bg-amber-600 text-white hover:bg-amber-700 px-4 py-2 rounded-lg flex items-center gap-2 shadow-md hover:shadow-lg transition-all text-sm font-medium"
                    >
                        ⚖️ Weight Analysis
                    </button>
                    <button
                        onClick={() => {
                            const query = new URLSearchParams();
                            query.append('minDiff', minDiff.toString());
                            query.append('profitThreshold', profitThreshold.toString());
                            query.append('costRatioThreshold', costRatioThreshold.toString());
                            window.open(`/api/analytics/generate-report?${query.toString()}`, '_blank');
                        }}
                        className="bg-purple-600 text-white hover:bg-purple-700 px-4 py-2 rounded-lg flex items-center gap-2 shadow-md hover:shadow-lg transition-all text-sm font-medium"
                    >
                        📊 Download Analysis
                    </button>
                    <button
                        onClick={exportToExcel}
                        className="bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 rounded-lg flex items-center gap-2 shadow-md hover:shadow-lg transition-all text-sm font-bold"
                    >
                        Export Excel (เคลมเงินคืน)
                    </button>
                </div>
            </div>

            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Total Scanned</div>
                        <div className="text-2xl font-bold text-gray-800">{stats.totalScanned.toLocaleString()}</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Valid Records</div>
                        <div className="text-2xl font-bold text-gray-800">{stats.validRecords.toLocaleString()}</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 bg-red-50 border-red-100">
                        <div className="text-xs font-semibold uppercase tracking-wider text-red-600 mb-1">Anomalies Detected</div>
                        <div className="text-2xl font-bold text-red-700">{stats.anomaliesFound.toLocaleString()}</div>
                    </div>
                    {/* Potential Refund Card Hidden as per user request (criteria pending)
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 bg-emerald-50 border-emerald-100">
                        <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600 mb-1">Potential Refund</div>
                        <div className="text-2xl font-bold text-emerald-700">
                            ฿{stats.totalRefundPotential ? stats.totalRefundPotential.toLocaleString() : 0}
                        </div>
                    </div>
                    */}
                </div>
            )}

            {/* Global Filters */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 mb-6">
                <div className="flex flex-wrap gap-4 items-end">
                    {/* Analysis Settings */}
                    <div className="flex items-end gap-4 flex-wrap">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">MIN DIFF (฿)</label>
                            <input
                                type="number"
                                value={minDiff}
                                onChange={(e) => setMinDiff(Number(e.target.value))}
                                className="px-3 py-1.5 border rounded w-24 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">PROFIT ALERT (&lt;)</label>
                            <input
                                type="number"
                                value={profitThreshold}
                                onChange={(e) => setProfitThreshold(Number(e.target.value))}
                                className="px-3 py-1.5 border rounded w-24 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">COST % ALERT (&gt;)</label>
                            <input
                                type="number"
                                value={costRatioThreshold}
                                onChange={(e) => setCostRatioThreshold(Number(e.target.value))}
                                className="px-3 py-1.5 border rounded w-24 text-sm"
                            />
                        </div>

                        {/* Apply Filters Button */}
                        <button
                            onClick={fetchData}
                            disabled={loading}
                            className="px-4 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <span className="animate-spin">⟳</span>
                                    Applying...
                                </>
                            ) : (
                                <>
                                    🔄 Apply Filters
                                </>
                            )}
                        </button>

                        <div className="text-xs text-gray-500 self-center">
                            Found: <span className="font-bold text-gray-700">{totalItems.toLocaleString()}</span> items
                        </div>
                    </div>
                </div>
            </div>


            {/* Table */}
            <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden flex flex-col">
                {loading ? (
                    <div className="p-12 text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-emerald-600 mb-4"></div>
                        <div className="text-gray-500 font-medium">Scanning database records...</div>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-600 text-sm uppercase tracking-wider border-b cursor-pointer select-none">
                                        <th className="p-4 font-bold text-center w-16">#</th>
                                        <th className="p-4 font-bold" onClick={() => handleSort('tracking')}>Tracking <SortIcon column="tracking" /></th>
                                        <th className="p-4 font-bold" onClick={() => handleSort('date')}>Date <SortIcon column="date" /></th>
                                        <th className="p-4 font-bold" onClick={() => handleSort('name')}>Customer <SortIcon column="name" /></th>
                                        <th className="p-4 font-bold">Phone</th>
                                        <th className="p-4 font-bold text-right" onClick={() => handleSort('weight')}>Weight <SortIcon column="weight" /></th>
                                        <th className="p-4 font-bold text-right text-emerald-600" onClick={() => handleSort('codAmount')}>COD <SortIcon column="codAmount" /></th>
                                        <th className="p-4 font-bold text-right text-blue-600" onClick={() => handleSort('profit')}>Profit <SortIcon column="profit" /></th>
                                        <th className="p-4 font-bold text-right" onClick={() => handleSort('costPercent')}>% Cost <SortIcon column="costPercent" /></th>
                                        <th className="p-4 font-bold text-right" onClick={() => handleSort('cost')}>Charged <SortIcon column="cost" /></th>
                                        <th className="p-4 font-bold text-right" onClick={() => handleSort('expectedCost')}>Expected <SortIcon column="expectedCost" /></th>
                                        <th className="p-4 font-bold text-right" onClick={() => handleSort('diff')}>Diff <SortIcon column="diff" /></th>
                                        <th className="p-4 text-center">Action</th>
                                    </tr>
                                    {/* Filter Row */}
                                    <tr className="bg-white border-b shadow-sm">
                                        <th className="p-2"></th>
                                        <th className="p-2"><TextInput column="tracking" /></th>
                                        <th className="p-2"><TextInput column="date" /></th>
                                        <th className="p-2"><TextInput column="name" /></th>
                                        <th className="p-2"><TextInput column="phone" /></th>
                                        <th className="p-2"><RangeInput column="weight" /></th>
                                        <th className="p-2"><RangeInput column="codAmount" /></th>
                                        <th className="p-2"><RangeInput column="profit" /></th>
                                        <th className="p-2"><RangeInput column="costPercent" /></th>
                                        <th className="p-2"><RangeInput column="cost" /></th>
                                        <th className="p-2"><RangeInput column="expectedCost" /></th>
                                        <th className="p-2"><RangeInput column="diff" /></th>
                                        <th className="p-2"></th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm divide-y divide-slate-100">
                                    {currentItems.map((row, index) => {
                                        const isCritical = row.anomalyType === 'negative_profit';
                                        const isWarning = row.anomalyType === 'high_ratio';
                                        const isNormal = row.anomalyType === 'normal';
                                        const rowClass = isCritical ? 'bg-red-50 hover:bg-red-100' : (isWarning ? 'bg-orange-50 hover:bg-orange-100' : (isNormal ? 'hover:bg-gray-50' : 'hover:bg-slate-50'));

                                        return (
                                            <tr key={row.id} className={`${rowClass} transition-colors border-b last:border-0`}>
                                                <td className="p-4 text-gray-500 text-sm text-center">{(currentPage - 1) * 50 + index + 1}</td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-medium text-indigo-600 select-all cursor-text">{row.tracking}</span>
                                                        <div className="select-none flex gap-1">
                                                            {isCritical && <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] rounded uppercase">Loss</span>}
                                                            {isWarning && <span className="px-2 py-0.5 bg-orange-500 text-white text-[10px] rounded uppercase">Check</span>}
                                                            {isNormal && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] rounded uppercase">OK</span>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-gray-600">{row.date}</td>
                                                <td className="p-4 text-gray-800 font-medium">{row.name}</td>
                                                <td className="p-4 text-gray-600 text-sm">{row.phone || '-'}</td>
                                                <td className="p-4 text-right font-mono">{row.weight} kg</td>
                                                <td className="p-4 text-right font-bold text-emerald-600">฿{row.codAmount}</td>
                                                <td className="p-4 text-right font-bold text-blue-600">฿{row.profit}</td>
                                                <td className="p-4 text-right font-mono text-gray-500">{row.costPercent}%</td>
                                                <td className="p-4 text-right font-bold text-red-600">฿{row.cost}</td>
                                                <td className="p-4 text-right text-gray-500">฿{row.expectedCost}</td>
                                                <td className="p-4 text-right">
                                                    <span className={`px-2 py-1 rounded font-bold text-xs ${row.diff > 0 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
                                                        }`}>
                                                        {row.diff > 0 ? "+" : ""}{row.diff}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <button
                                                        onClick={() => setSelectedShipment(row)}
                                                        className="text-gray-400 hover:text-indigo-600 transition-colors"
                                                        title="View Details"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Controls */}
                        {anomalies.length > 0 ? (
                            <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                                <div className="text-sm text-gray-500">
                                    Showing page <span className="font-bold">{currentPage}</span> of <span className="font-bold">{totalPages}</span> (Total <span className="font-bold">{totalItems}</span>)
                                </div>
                                {/* Numbered Pagination */}
                                <div className="flex items-center justify-center gap-2 py-4 border-t border-gray-200">
                                    <button
                                        onClick={() => goToPage(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                                    >
                                        « Previous
                                    </button>

                                    {/* Page Numbers */}
                                    <div className="flex gap-1">
                                        {(() => {
                                            const pages = [];
                                            const maxVisible = 7;

                                            if (totalPages <= maxVisible) {
                                                // Show all pages
                                                for (let i = 1; i <= totalPages; i++) {
                                                    pages.push(i);
                                                }
                                            } else {
                                                // Show first, last, current, and neighbors
                                                if (currentPage <= 4) {
                                                    // Near start
                                                    for (let i = 1; i <= 5; i++) pages.push(i);
                                                    pages.push('...');
                                                    pages.push(totalPages);
                                                } else if (currentPage >= totalPages - 3) {
                                                    // Near end
                                                    pages.push(1);
                                                    pages.push('...');
                                                    for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
                                                } else {
                                                    // Middle
                                                    pages.push(1);
                                                    pages.push('...');
                                                    for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
                                                    pages.push('...');
                                                    pages.push(totalPages);
                                                }
                                            }

                                            return pages.map((page, idx) => {
                                                if (page === '...') {
                                                    return <span key={`ellipsis-${idx}`} className="px-2 py-1">...</span>;
                                                }
                                                return (
                                                    <button
                                                        key={page}
                                                        onClick={() => goToPage(page as number)}
                                                        className={`px-3 py-1 border rounded ${currentPage === page
                                                            ? 'bg-blue-600 text-white border-blue-600'
                                                            : 'hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        {page}
                                                    </button>
                                                );
                                            });
                                        })()}
                                    </div>

                                    <button
                                        onClick={() => goToPage(currentPage + 1)}
                                        disabled={currentPage >= totalPages}
                                        className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                                    >
                                        Next »
                                    </button>

                                    <span className="ml-4 text-sm text-gray-600">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            !loading && (
                                <div className="p-12 text-center text-gray-400 bg-white">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p className="font-medium">No anomalies found matching your criteria.</p>
                                    <p className="text-sm mt-1">Try adjusting the date range or minimum difference.</p>
                                </div>
                            )
                        )}
                    </>
                )
                }
            </div >

            {/* Detail Modal */}
            {
                selectedShipment && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                <h3 className="text-lg font-bold text-gray-800">Shipment Details</h3>
                                <button
                                    onClick={() => setSelectedShipment(null)}
                                    className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-all"
                                >
                                    ✕
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold">Tracking</label>
                                        <div className="font-mono text-lg font-medium select-all">{selectedShipment.tracking}</div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold">Date</label>
                                        <div className="font-medium">{selectedShipment.date}</div>
                                    </div>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-gray-600">Customer</span>
                                        <span className="font-bold">{selectedShipment.name}</span>
                                    </div>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-gray-600">Weight</span>
                                        <span className="font-mono">{selectedShipment.weight} kg</span>
                                    </div>
                                    <div className="flex justify-between items-center mb-2 text-emerald-700">
                                        <span className="font-medium">COD Amount</span>
                                        <span className="font-bold">฿{selectedShipment.codAmount}</span>
                                    </div>
                                    <div className="flex justify-between items-center mb-2 text-blue-700">
                                        <span className="font-medium">Profit (COD - Cost)</span>
                                        <span className="font-bold">฿{selectedShipment.profit}</span>
                                    </div>
                                    <div className="flex justify-between items-center mb-2 text-gray-500 text-sm">
                                        <span>Cost % of COD</span>
                                        <span>{selectedShipment.costPercent}%</span>
                                    </div>
                                    <div className="my-2 border-t border-dashed border-gray-300"></div>
                                    <div className="flex justify-between items-center text-red-600">
                                        <span>Charged Cost</span>
                                        <span className="font-bold text-lg">฿{selectedShipment.cost}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-gray-500 text-sm">
                                        <span>Expected Cost (Mode)</span>
                                        <span>฿{selectedShipment.expectedCost}</span>
                                    </div>
                                    <div className="mt-3 bg-red-100 text-red-700 px-3 py-2 rounded-lg text-center font-bold text-sm">
                                        Overcharged by +฿{selectedShipment.diff}
                                    </div>
                                </div>

                                <div className="text-xs text-gray-400 text-center">
                                    ID: {selectedShipment.id} • TS: {selectedShipment.timestamp}
                                </div>
                            </div>
                            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                                <button
                                    onClick={() => setSelectedShipment(null)}
                                    className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black font-medium transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default ShippingAnomalyPage;
