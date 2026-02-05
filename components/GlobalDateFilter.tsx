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

    const [activePreset, setActivePreset] = React.useState<string | null>(null);

    // Helper to calculate date ranges for presets
    const getPresetRange = (preset: string): { start: string, end: string } => {
        const end = new Date();
        const start = new Date();

        switch (preset) {
            case 'today':
                // start and end are already today
                break;
            case 'yesterday':
                start.setDate(start.getDate() - 1);
                end.setDate(end.getDate() - 1);
                break;
            case '7d':
                start.setDate(start.getDate() - 7);
                break;
            case '30d':
                start.setDate(start.getDate() - 30);
                break;
            case 'thisMonth':
                start.setDate(1);
                break;
            case '3M':
                start.setMonth(start.getMonth() - 3);
                break;
            case '6M':
                start.setMonth(start.getMonth() - 6);
                break;
            case '1Y':
                start.setFullYear(start.getFullYear() - 1);
                break;
            case '3Y':
                start.setFullYear(start.getFullYear() - 3);
                break;
            case '5Y':
                start.setFullYear(start.getFullYear() - 5);
                break;
            case 'all':
                start.setFullYear(2020, 0, 1); // Earliest possible date
                break;
        }

        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        };
    };

    const handlePresetClick = (preset: string) => {
        const { start, end } = getPresetRange(preset);
        setDateRange(start, end);
        setActivePreset(preset);
    };

    const handleClear = () => {
        setDateRange(null, null);
        setActivePreset(null);
    };

    // Provide effect to update active preset when dates change externally
    React.useEffect(() => {
        if (!startDate || !endDate) {
            setActivePreset(null);
            return;
        }

        const checkPreset = (preset: string) => {
            const { start, end } = getPresetRange(preset);
            return start === startDate && end === endDate;
        };

        const allPresets = ['today', 'yesterday', '7d', '30d', 'thisMonth', 'all', '3M', '6M', '1Y', '3Y', '5Y'];
        const found = allPresets.find(checkPreset);
        if (found) setActivePreset(found);
        else setActivePreset(null);
    }, [startDate, endDate]);

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

            <div className="flex items-center gap-2 ml-auto overflow-x-auto no-scrollbar">
                {/* Short-term Presets */}
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                    {[
                        { label: 'วันนี้', value: 'today' },
                        { label: 'เมื่อวาน', value: 'yesterday' },
                        { label: '7 วัน', value: '7d' },
                        { label: '30 วัน', value: '30d' },
                        { label: 'เดือนนี้', value: 'thisMonth' },
                    ].map((preset) => (
                        <button
                            key={preset.value}
                            onClick={() => handlePresetClick(preset.value)}
                            className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-tight transition-all 
                                ${activePreset === preset.value
                                    ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5'
                                    : 'text-slate-500 hover:text-indigo-600 hover:bg-white/50'
                                }
                            `}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>

                {/* Long-term Presets */}
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                    {[
                        { label: 'All', value: 'all' },
                        { label: '3M', value: '3M' },
                        { label: '6M', value: '6M' },
                        { label: '1Y', value: '1Y' },
                        { label: '3Y', value: '3Y' },
                        { label: '5Y', value: '5Y' },
                    ].map((preset) => (
                        <button
                            key={preset.value}
                            onClick={() => handlePresetClick(preset.value)}
                            className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-tight transition-all 
                                ${activePreset === preset.value
                                    ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5'
                                    : 'text-slate-500 hover:text-indigo-600 hover:bg-white/50'
                                }
                            `}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default GlobalDateFilter;
