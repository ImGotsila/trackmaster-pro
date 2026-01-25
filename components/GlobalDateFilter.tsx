import React from 'react';
import { useData } from '../context/DataContext';
import { Calendar, X } from 'lucide-react';

const GlobalDateFilter: React.FC = () => {
    const { startDate, endDate, setDateRange, shipments } = useData();

    // Helper to get today's date in YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];

    // Get unique dates from shipments to show available range hints if needed
    // (Optional: can be used for min/max attributes on inputs)

    const handleClear = () => {
        setDateRange(null, null);
    };

    const isFiltered = startDate || endDate;

    return (
        <div className="bg-white border-b border-slate-200 px-4 py-2 flex flex-col md:flex-row items-start md:items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-wider shrink-0">
                <Calendar className="w-4 h-4 text-indigo-500" />
                <span>ช่วงเวลาวิเคราะห์:</span>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-40">
                    <input
                        type="date"
                        value={startDate || ''}
                        onChange={(e) => setDateRange(e.target.value || null, endDate)}
                        className="w-full pl-3 pr-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold text-slate-700"
                    />
                </div>
                <span className="text-slate-400 text-xs font-bold">ถึง</span>
                <div className="relative flex-1 md:w-40">
                    <input
                        type="date"
                        value={endDate || ''}
                        onChange={(e) => setDateRange(startDate, e.target.value || null)}
                        className="w-full pl-3 pr-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold text-slate-700"
                    />
                </div>

                {isFiltered && (
                    <button
                        onClick={handleClear}
                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                        title="ล้างตัวกรอง"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div className="hidden lg:flex items-center gap-2 ml-auto">
                <button
                    onClick={() => {
                        const d = new Date();
                        const dateStr = d.toISOString().split('T')[0];
                        setDateRange(dateStr, dateStr);
                    }}
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter transition-all ${startDate === today && endDate === today
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                >
                    Today
                </button>
                <button
                    onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 7);
                        setDateRange(d.toISOString().split('T')[0], today);
                    }}
                    className="px-3 py-1 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-full text-[10px] font-black uppercase tracking-tighter transition-all"
                >
                    Last 7 Days
                </button>
                <button
                    onClick={() => {
                        const d = new Date();
                        d.setDate(1); // First of month
                        setDateRange(d.toISOString().split('T')[0], today);
                    }}
                    className="px-3 py-1 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-full text-[10px] font-black uppercase tracking-tighter transition-all"
                >
                    This Month
                </button>
            </div>
        </div>
    );
};

export default GlobalDateFilter;
