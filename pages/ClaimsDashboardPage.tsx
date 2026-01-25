import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import {
    AlertTriangle, ShieldAlert, PackageX, Truck, Search, Filter,
    CheckCircle2, Clock, MoreHorizontal, ArrowRight, User
} from 'lucide-react';
import Pagination from '../components/Pagination';
import { RTSReport } from '../types';

const ClaimsDashboardPage: React.FC = () => {
    const [reports, setReports] = useState<RTSReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<'all' | 'Open' | 'Resolved'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    const fetchReports = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/rts');
            if (res.ok) {
                const data = await res.json();
                setReports(data || []);
            }
        } catch (error) {
            console.error("Failed to fetch reports", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    const filteredReports = reports.filter(r => {
        const matchesStatus = filterStatus === 'all' || (filterStatus === 'Resolved' ? r.status === 'Resolved' : r.status !== 'Resolved');
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch =
            r.trackingNumber?.toLowerCase().includes(searchLower) ||
            r.customerName?.toLowerCase().includes(searchLower) ||
            r.productCode?.toLowerCase().includes(searchLower) ||
            r.actionType?.toLowerCase().includes(searchLower);

        return matchesStatus && matchesSearch;
    });

    const totalPages = Math.ceil(filteredReports.length / ITEMS_PER_PAGE);
    const paginatedReports = filteredReports.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const getStatusBadge = (status: string) => {
        if (status === 'Resolved') return <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-100 uppercase tracking-wide">Resolved</span>;
        return <span className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold border border-indigo-100 uppercase tracking-wide">Active / Pending</span>;
    };

    const getTypeIcon = (type: string) => {
        if (type.includes('ตีกลับ')) return <Truck className="w-4 h-4 text-amber-500" />;
        if (type.includes('เสียหาย')) return <PackageX className="w-4 h-4 text-rose-500" />;
        if (type.includes('เคลม')) return <ShieldAlert className="w-4 h-4 text-purple-500" />;
        return <AlertTriangle className="w-4 h-4 text-slate-400" />;
    };

    return (
        <div className="space-y-6 pb-20 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div className="flex items-center space-x-3">
                    <div className="bg-rose-600 p-2 rounded-xl text-white shadow-lg shadow-rose-200">
                        <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">จัดการเคส & เคลม (Claims Board)</h1>
                        <p className="text-sm text-slate-500 font-medium">ติดตามสถานะพัสดุที่มีปัญหา ตีกลับ หรือเสียหาย</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={fetchReports} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
                        <div className="w-5 h-5 flex items-center justify-center">↻</div>
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">เคสทั้งหมด</p>
                        <h3 className="text-2xl font-black text-slate-800">{reports.length}</h3>
                    </div>
                    <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                        <AlertTriangle className="w-5 h-5" />
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">รอดำเนินการ</p>
                        <h3 className="text-2xl font-black text-indigo-600">
                            {reports.filter(r => r.status !== 'Resolved').length}
                        </h3>
                    </div>
                    <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-500">
                        <Clock className="w-5 h-5" />
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">สินค้าเสียหาย</p>
                        <h3 className="text-2xl font-black text-rose-500">
                            {reports.filter(r => r.actionType?.includes('เสียหาย')).length}
                        </h3>
                    </div>
                    <div className="w-10 h-10 bg-rose-50 rounded-lg flex items-center justify-center text-rose-500">
                        <PackageX className="w-5 h-5" />
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">ปิดเคสแล้ว</p>
                        <h3 className="text-2xl font-black text-emerald-600">
                            {reports.filter(r => r.status === 'Resolved').length}
                        </h3>
                    </div>
                    <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-500">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none font-medium text-sm"
                            placeholder="ค้นหา Tracking, ชื่อลูกค้า, หรือ SKU..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
                        <button
                            onClick={() => setFilterStatus('all')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === 'all' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            ทั้งหมด
                        </button>
                        <button
                            onClick={() => setFilterStatus('Open')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === 'Open' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            รอดำเนินการ
                        </button>
                        <button
                            onClick={() => setFilterStatus('Resolved')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === 'Resolved' ? 'bg-white shadow text-emerald-600' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            เสร็จสิ้น
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-extrabold top-0 sticky z-10 shadow-sm">
                                <th className="p-4 rounded-tl-lg">Tracking / Customer</th>
                                <th className="p-4">SKU / Product</th>
                                <th className="p-4">Issue Type</th>
                                <th className="p-4">Reported</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 rounded-tr-lg">Evidence</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center text-slate-400">Loading data...</td>
                                </tr>
                            ) : filteredReports.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center text-slate-400">
                                        <PackageX className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p>ไม่พบรายการที่ค้นหา</p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedReports.map((report) => (
                                    <tr key={report.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="p-4 align-top">
                                            <div className="flex items-start gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-slate-400">
                                                    <User className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-700 font-mono text-sm">{report.trackingNumber}</p>
                                                    <p className="text-xs text-slate-500 truncate max-w-[150px]">{report.customerName}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 align-top">
                                            {report.productCode ? (
                                                <span className="font-mono bg-slate-100 px-2 py-1 rounded text-xs font-bold text-slate-600 border border-slate-200">
                                                    {report.productCode}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-300 italic">-</span>
                                            )}
                                        </td>
                                        <td className="p-4 align-top">
                                            <div className="flex items-center gap-2">
                                                {getTypeIcon(report.actionType || '')}
                                                <span className="text-sm font-bold text-slate-600">{report.actionType || 'General Issue'}</span>
                                            </div>
                                            {report.notes && (
                                                <p className="text-xs text-slate-400 mt-1 line-clamp-2 max-w-[200px]">{report.notes}</p>
                                            )}
                                        </td>
                                        <td className="p-4 align-top">
                                            <p className="text-xs font-bold text-slate-500">
                                                {new Date(report.timestamp).toLocaleDateString('th-TH')}
                                            </p>
                                            <p className="text-[10px] text-slate-400">
                                                {new Date(report.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </td>
                                        <td className="p-4 align-top">
                                            {getStatusBadge(report.status)}
                                        </td>
                                        <td className="p-4 align-top">
                                            {report.photoUrl ? (
                                                <a href={report.photoUrl} target="_blank" rel="noopener noreferrer" className="block relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200 hover:ring-2 hover:ring-indigo-500 transition-all">
                                                    <img src={report.photoUrl} alt="Proof" className="w-full h-full object-cover" />
                                                </a>
                                            ) : (
                                                <span className="text-xs text-slate-300">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    totalItems={filteredReports.length}
                    itemsPerPage={ITEMS_PER_PAGE}
                />
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {/* Mobile Filters */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-sm"
                            placeholder="ค้นหา..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
                        <button onClick={() => setFilterStatus('all')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === 'all' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>ทั้งหมด</button>
                        <button onClick={() => setFilterStatus('Open')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === 'Open' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>รอ</button>
                        <button onClick={() => setFilterStatus('Resolved')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === 'Resolved' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'}`}>เสร็จ</button>
                    </div>
                </div>

                {/* Mobile Cards */}
                <div className="space-y-3">
                    {isLoading ? (
                        <div className="text-center py-12 text-slate-400">Loading...</div>
                    ) : filteredReports.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <PackageX className="w-10 h-10 mx-auto mb-2 opacity-20" />
                            <p className="text-sm">ไม่พบรายการ</p>
                        </div>
                    ) : (
                        paginatedReports.map((report) => (
                            <div key={report.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${report.actionType?.includes('เสียหาย') ? 'bg-rose-50 text-rose-500' : 'bg-slate-100 text-slate-500'}`}>
                                            {getTypeIcon(report.actionType || '')}
                                        </div>
                                        <div>
                                            <p className="font-mono font-bold text-slate-800 text-sm">{report.trackingNumber}</p>
                                            <p className="text-xs text-slate-500 truncate max-w-[140px]">{report.customerName}</p>
                                        </div>
                                    </div>
                                    {getStatusBadge(report.status)}
                                </div>

                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400 font-bold text-xs">SKU:</span>
                                        <span className="font-mono font-bold text-indigo-600">{report.productCode || '-'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400 font-bold text-xs">Issue:</span>
                                        <span className="font-bold text-slate-700">{report.actionType}</span>
                                    </div>
                                    <div className="pt-2 border-t border-slate-200 text-xs text-slate-600">
                                        <span className="font-bold">Note:</span> {report.notes || '-'}
                                    </div>
                                </div>

                                <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-50">
                                    <div className="text-[10px] text-slate-400 font-bold uppercase">
                                        {new Date(report.timestamp).toLocaleDateString('th-TH')} • {new Date(report.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    {report.photoUrl && (
                                        <a href={report.photoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                                            หลักฐาน <ArrowRight className="w-3 h-3" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
                {filteredReports.length > ITEMS_PER_PAGE && (
                    <div className="mt-4">
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                            totalItems={filteredReports.length}
                            itemsPerPage={ITEMS_PER_PAGE}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClaimsDashboardPage;
