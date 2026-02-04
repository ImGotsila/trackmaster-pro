import React from 'react';
import { useData } from '../context/DataContext';
import { Calendar, X } from 'lucide-react';

interface GlobalDateFilterProps {
    externalStartDate?: string | null;
    externalEndDate?: string | null;
    onDateChange?: (start: string | null, end: string | null) => void;
}

const GlobalDateFilter: React.FC<GlobalDateFilterProps> = ({ externalStartDate, externalEndDate, onDateChange }) => {
    // Use Context (default) or External Props
    const contextData = useData();

    // Determine which values to use
    const startDate = onDateChange ? externalStartDate : contextData.startDate;
    const endDate = onDateChange ? externalEndDate : contextData.endDate;
    const setDateRange = onDateChange || contextData.setDateRange;

    // Helper to get today's date in YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];

    // Get unique dates from shipments to show available range hints if needed
    // (Optional: can be used for min/max attributes on inputs)

    const handleClear = () => {
        setDateRange(null, null);
    };

    const isFiltered = startDate || endDate;

    return (
        <div className="bg-white border-b border-slate-200 px-4 py-3 flex flex-col md:flex-row items-center gap-4 shrink-0 shadow-sm z-20">
            <div className="flex items-center gap-2 text-indigo-900 font-black text-xs uppercase tracking-wider shrink-0 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span>ช่วงเวลาวิเคราะห์</span>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto bg-slate-50 p-1 rounded-xl border border-slate-200">
                <div className="relative flex-1 md:w-36">
                    <input
                        type="date"
                        value={startDate || ''}
                        onChange={(e) => setDateRange(e.target.value || null, endDate)}
                        className="w-full pl-3 pr-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold text-slate-700 shadow-sm transition-all"
                    />
                </div>
                <span className="text-slate-400 text-[10px] font-black uppercase">To</span>
                <div className="relative flex-1 md:w-36">
                    <input
                        type="date"
                        value={endDate || ''}
                        onChange={(e) => setDateRange(startDate, e.target.value || null)}
                        className="w-full pl-3 pr-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold text-slate-700 shadow-sm transition-all"
                    />
                </div>

                {isFiltered && (
                    <button
                        onClick={handleClear}
                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-white hover:shadow-sm rounded-lg transition-all"
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
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all border ${startDate === today && endDate === today
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-indigo-600'
                        }`}
                >
                    วันนี้
                </button>
                <button
                    onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 1);
                        const yersterday = d.toISOString().split('T')[0];
                        setDateRange(yersterday, yersterday);
                    }}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all font-sans"
                >
                    เมื่อวาน
                </button>
                <button
                    onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 7);
                        setDateRange(d.toISOString().split('T')[0], today);
                    }}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all"
                >
                    7 วัน
                </button>
                <button
                    onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 30);
                        setDateRange(d.toISOString().split('T')[0], today);
                    }}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all"
                >
                    30 วัน
                </button>
                <button
                    onClick={() => {
                        const d = new Date();
                        d.setDate(1); // First of month
                        setDateRange(d.toISOString().split('T')[0], today);
                    }}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all"
                >
                    เดือนนี้
                </button>
            </div>
        </div>
    );
};

export default GlobalDateFilter;
