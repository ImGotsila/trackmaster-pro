import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems?: number;
    itemsPerPage?: number;
    compact?: boolean;
}

const Pagination: React.FC<PaginationProps> = ({
    currentPage,
    totalPages,
    onPageChange,
    totalItems,
    itemsPerPage = 50,
    compact = false
}) => {
    if (totalPages <= 1) return null;

    const goToPage = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            onPageChange(page);
        }
    };

    return (
        <div className={`flex flex-col ${compact ? 'sm:flex-col' : 'sm:flex-row'} items-center justify-between gap-3 md:gap-4 py-4 px-2 shrink-0 border-t border-slate-100 bg-white/50`}>
            <div className={`text-xs md:text-sm text-slate-500 text-center ${compact ? 'sm:text-center' : 'sm:text-left'}`}>
                {totalItems !== undefined ? (
                    <div className="flex items-center justify-center gap-1 sm:block">
                        <span className={`${compact ? 'hidden' : 'sm:inline'} hidden`}>แสดง</span>
                        <span className="font-bold text-slate-800">{(currentPage - 1) * itemsPerPage + 1}</span>
                        <span className="sm:inline">-</span>
                        <span className="font-bold text-slate-800">{Math.min(currentPage * itemsPerPage, totalItems)}</span>
                        <span className={`${compact ? 'hidden' : 'sm:inline'} hidden`}>จาก</span>
                        <span className={`${compact ? 'inline' : 'sm:hidden'}`}>/</span>
                        <span className="font-bold text-slate-800">{totalItems}</span>
                    </div>
                ) : (
                    <div className="flex items-center justify-center gap-1 sm:block">
                        <span className={`${compact ? 'hidden' : 'sm:inline'} hidden`}>หน้า</span>
                        <span className="font-bold text-slate-800">{currentPage}</span>
                        <span>/</span>
                        <span className="font-bold text-slate-800">{totalPages}</span>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-1">
                {!compact && (
                    <button
                        onClick={() => goToPage(1)}
                        disabled={currentPage === 1}
                        className="p-1.5 md:p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-white hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                        <ChevronsLeft className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                )}
                <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-1.5 md:p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-white hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                    <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
                </button>

                <div className="flex items-center gap-1">
                    {[...Array(Math.min(compact ? 3 : 5, totalPages))].map((_, i) => {
                        let pageNum = currentPage;
                        const windowSize = compact ? 3 : 5;
                        const offset = Math.floor(windowSize / 2);

                        if (currentPage <= offset + 1) pageNum = i + 1;
                        else if (currentPage >= totalPages - offset) pageNum = totalPages - windowSize + 1 + i;
                        else pageNum = currentPage - offset + i;

                        if (pageNum < 1 || pageNum > totalPages) return null;

                        return (
                            <button
                                key={pageNum}
                                onClick={() => goToPage(pageNum)}
                                className={`${compact ? 'w-7 h-7' : 'w-8 h-8 md:w-10 md:h-10'} rounded-lg text-xs md:text-sm font-bold transition-all border ${currentPage === pageNum
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                                    }`}
                            >
                                {pageNum}
                            </button>
                        );
                    })}
                </div>

                <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-1.5 md:p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-white hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                    <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
                </button>
                {!compact && (
                    <button
                        onClick={() => goToPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="p-1.5 md:p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-white hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                        <ChevronsRight className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                )}
            </div>
        </div>
    );
};

export default Pagination;
