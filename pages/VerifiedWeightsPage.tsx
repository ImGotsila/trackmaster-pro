import React, { useState, useEffect } from 'react';
import { Search, FileDown, Trash2, CheckCircle, Scale, ArrowRight } from 'lucide-react';
import * as XLSX from 'xlsx';

interface VerifiedItem {
    id: string;
    trackingNumber: string;
    customerName: string;
    phoneNumber: string;
    weight: number;
    normalWeight: number;
    codAmount: number;
    shippingCost: number;
    expectedCost: number;
    diff: number;
    profit: number;
    percentCost: number;
    status: string;
    notes: string;
    timestamp: number;
}

const VerifiedWeightsPage: React.FC = () => {
    const [items, setItems] = useState<VerifiedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        // Demo Mode for GitHub Pages
        if (window.location.hostname.includes('github.io')) {
            setItems([
                {
                    id: 'demo-1',
                    trackingNumber: 'TH0123456789A',
                    customerName: 'Demo Customer',
                    phoneNumber: '0812345678',
                    weight: 3.5,
                    normalWeight: 1.0,
                    codAmount: 199,
                    shippingCost: 45,
                    expectedCost: 25,
                    diff: 20,
                    profit: 154,
                    percentCost: 22.6,
                    status: 'Verified',
                    notes: 'Demo Data',
                    timestamp: Date.now()
                }
            ]);
            setLoading(false);
            return;
        }

        try {
            const res = await fetch('/api/weight-verification');
            if (res.ok) {
                const data = await res.json();
                setItems(data);
            }
        } catch (error) {
            console.error("Failed to fetch verified items", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to remove this verified item?')) return;
        try {
            const res = await fetch(`/api/weight-verification/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setItems(prev => prev.filter(item => item.id !== id));
            }
        } catch (error) {
            console.error(error);
            alert('Failed to delete');
        }
    };

    const handleExport = () => {
        const exportData = items.map(item => ({
            Tracking: item.trackingNumber,
            Customer: item.customerName,
            Phone: item.phoneNumber,
            'Actual Weight': item.weight,
            'Normal Weight': item.normalWeight,
            COD: item.codAmount,
            Cost: item.shippingCost,
            Expected: item.expectedCost,
            Diff: item.diff,
            Profit: item.profit,
            '% Cost': item.percentCost,
            Status: item.status,
            Date: new Date(item.timestamp).toLocaleDateString('th-TH')
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Verified Weights");
        XLSX.writeFile(wb, `Verified_Weights_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const filteredItems = items.filter(item =>
        item.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.phoneNumber && item.phoneNumber.includes(searchTerm))
    );

    return (
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-6">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
                        <CheckCircle className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Verified Weight Anomalies</h1>
                        <p className="text-slate-500">List of verified shipping anomalies ready for action</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-bold transition-colors"
                    >
                        <FileDown className="w-4 h-4" /> Export Excel
                    </button>
                    <button
                        onClick={fetchData}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                    >
                        ↻
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search tracking, customer, phone..."
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="text-sm font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                    {filteredItems.length} Records
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold border-b border-slate-200">
                            <tr>
                                <th className="p-4">Tracking / Customer</th>
                                <th className="p-4 text-right">Weight Info</th>
                                <th className="p-4 text-right">Financials</th>
                                <th className="p-4 text-right">Shipping Cost</th>
                                <th className="p-4 text-center">Cost Diff</th>
                                <th className="p-4 text-center">Date</th>
                                <th className="p-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={6} className="p-12 text-center text-slate-400">Loading verified items...</td></tr>
                            ) : filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center text-slate-400">
                                        <Scale className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                        <p>No verified items found.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map(item => (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 align-top">
                                            <div className="font-mono text-lg font-black text-indigo-700">{item.trackingNumber}</div>
                                            <div className="font-bold text-slate-700 text-base">{item.customerName}</div>
                                            <div className="text-sm text-slate-500 font-mono mt-1">{item.phoneNumber || '-'}</div>
                                        </td>
                                        <td className="p-4 text-right align-top">
                                            <div className="font-bold text-slate-800">{item.weight} kg</div>
                                            <div className="text-xs text-slate-400">Normal: {item.normalWeight} kg</div>
                                        </td>
                                        <td className="p-4 text-right align-top">
                                            <div className="space-y-1">
                                                <div className="flex justify-end items-baseline gap-2">
                                                    <span className="text-xs text-slate-400 font-bold uppercase">COD</span>
                                                    <span className="font-black text-xl text-emerald-600">฿{item.codAmount.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-end items-baseline gap-2">
                                                    <span className="text-xs text-indigo-300 font-bold uppercase">Profit</span>
                                                    <span className="font-black text-xl text-indigo-600">฿{Math.floor(item.profit).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right align-top">
                                            <div className="font-bold text-slate-800 text-lg">฿{item.shippingCost}</div>
                                            <div className="text-xs text-slate-400 font-medium">{item.percentCost.toFixed(1)}% of COD</div>
                                        </td>
                                        <td className="p-4 text-center align-top">
                                            <span className={`px-3 py-1.5 rounded-lg font-black text-base shadow-sm border ${item.diff > 0 ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                                                {item.diff > 0 ? '+' : ''}{item.diff}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center align-top text-xs text-slate-500">
                                            {new Date(item.timestamp).toLocaleDateString('th-TH')}
                                            <div className="text-[10px] opacity-70">
                                                {new Date(item.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center align-top">
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                                title="Remove"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default VerifiedWeightsPage;
