import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useData } from '../context/DataContext';
import {
    Table, Upload, Search, Download, Save, RefreshCw,
    FileSpreadsheet, AlertTriangle, CheckCircle2, Phone,
    MapPin, Smartphone, Facebook, LayoutGrid, Filter,
    ChevronDown, ChevronRight, X, Calendar, Edit3, Trash2,
    PieChart, BarChart3, ArrowRight, User, QrCode, Camera,
    Loader2, UploadCloud, CloudUpload, FileText, PlayCircle, Eye, Info, Plus
} from 'lucide-react';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import ReportIssueModal from '../components/ReportIssueModal';

// Types for RTS Master
interface RTSMasterRecord {
    id: string; // "1-001"
    shipmentId: string | null;
    dateCode: string; // "01" (Day)
    facebookName: string;
    customerName: string;
    customerAddress: string;
    customerPhone: string;
    pageCode: string; // "A2B2"
    originalCod: number;
    originalTt: number;
    resendCod: number;
    resendTt: number;
    totalAmount: number;
    followUpStatus: string; // "โทรครั้งที่ 1", "โทรครั้งที่ 2"
    finalStatus: string; // "จัดส่งแล้ว", "แกะทิ้ง", "ยกเลิก"
    monthYear: string; // "09-2568"
    notes: string;
    product?: string;
    isMatched: boolean; // True if matched with system shipment
    updatedAt?: number;
}

interface StagedRTSFile {
    id: string;
    file: File;
    name: string;
    status: 'pending' | 'processing' | 'checked' | 'saving' | 'saved' | 'error';
    records: RTSMasterRecord[];
    matchCount: number;
    message?: string;
}

const MONTH_OPTIONS = [
    { value: 'all', label: '--- แสดงทั้งหมด (All) ---' },
    { value: '09-2568', label: 'กันยายน 2568' },
    { value: '10-2568', label: 'ตุลาคม 2568' },
    { value: '11-2568', label: 'พฤศจิกายน 2568' },
    { value: '12-2568', label: 'ธันวาคม 2568' },
    { value: '01-2569', label: 'มกราคม 2569' },
    { value: '02-2569', label: 'กุมภาพันธ์ 2569' },
];

const FOLLOW_UP_OPTIONS = ['-', 'โทรครั้งที่ 1', 'โทรครั้งที่ 2', 'โทรครั้งที่ 3', 'ปิดเครื่อง', 'ไม่รับสาย'];
const STATUS_OPTIONS = ['-', 'รอการแก้ไข', 'จัดส่งแล้ว', 'แกะทิ้ง', 'ยกเลิก', 'สินค้าเสียหาย', 'สูญหาย'];

const RTSManagementPage: React.FC = () => {
    const { filteredShipments } = useData();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'import' | 'scan'>('dashboard');
    // Modals
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isManualAddModalOpen, setIsManualAddModalOpen] = useState(false);
    // Manual Form
    const [newRecord, setNewRecord] = useState({ id: '', facebookName: '', customerPhone: '', product: '', notes: '' });

    const [selectedMonth, setSelectedMonth] = useState<string>('all');
    const [records, setRecords] = useState<RTSMasterRecord[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Queue State
    const [stagedFiles, setStagedFiles] = useState<StagedRTSFile[]>([]);
    const [isProcessingQueue, setIsProcessingQueue] = useState(false);
    const [previewFileId, setPreviewFileId] = useState<string | null>(null);

    // Scan State
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState<string | null>(null);
    const [selectedShipment, setSelectedShipment] = useState<any>(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Stats
    const stats = useMemo(() => {
        const total = records.length;
        const reshipped = records.filter(r => r.finalStatus === 'จัดส่งแล้ว').length;
        const discarded = records.filter(r => r.finalStatus === 'แกะทิ้ง').length;
        const pending = total - reshipped - discarded;
        const successRate = total > 0 ? (reshipped / total) * 100 : 0;

        const totalCod = records.reduce((sum, r) => sum + (r.resendCod || 0), 0);
        const originalLoss = records.reduce((sum, r) => sum + (r.originalCod || 0) + (r.originalTt || 0), 0);

        return { total, reshipped, discarded, pending, successRate, totalCod, originalLoss };
    }, [records]);

    useEffect(() => {
        fetchRecords();
    }, [selectedMonth]);

    const fetchRecords = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/rts/master?month=${selectedMonth}`);
            if (res.ok) {
                const data = await res.json();
                setRecords(data);
            }
        } catch (e) {
            console.error("Fetch Error", e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleManualAdd = async () => {
        if (!newRecord.id || !newRecord.facebookName) return alert('กรุณาระบุ ID และ ชื่อลูกค้า');

        try {
            const res = await fetch('/api/rts/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...newRecord,
                    monthYear: selectedMonth === 'all' ? '01-2569' : selectedMonth // Default if All
                })
            });
            const data = await res.json();
            if (data.success) {
                alert('บันทึกสำเร็จ');
                setIsManualAddModalOpen(false);
                setNewRecord({ id: '', facebookName: '', customerPhone: '', product: '', notes: '' });
                fetchRecords();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            console.error(error);
            alert('Failed to save');
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const newStaged: StagedRTSFile[] = Array.from(files).map(file => ({
            id: Math.random().toString(36).substring(7),
            file: file,
            name: file.name,
            status: 'pending',
            records: [],
            matchCount: 0
        }));

        setStagedFiles(prev => [...prev, ...newStaged]);
        e.target.value = ''; // Reset input
    };

    const removeStagedFile = (id: string) => {
        setStagedFiles(prev => prev.filter(f => f.id !== id));
    };

    const processQueue = async () => {
        setIsProcessingQueue(true);

        // 1. Check/Verify Files
        const pendingFiles = stagedFiles.filter(f => f.status === 'pending');

        for (const fileItem of pendingFiles) {
            setStagedFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: 'processing' } : f));

            const formData = new FormData();
            formData.append('file', fileItem.file);

            try {
                // Determine month from filename or use selectedMonth?
                // Ideally we should use selectedMonth for now or parse from file

                const res = await fetch('/api/rts/upload-check', {
                    method: 'POST',
                    body: formData
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.success && Array.isArray(data.records)) {
                        const matchedCount = data.records.filter((r: any) => r.isMatched).length;

                        // Tag with selected Month
                        const recordsWithMonth = data.records.map((r: any) => ({
                            ...r,
                            monthYear: selectedMonth
                        }));

                        setStagedFiles(prev => prev.map(f => f.id === fileItem.id ? {
                            ...f,
                            status: 'checked',
                            records: recordsWithMonth,
                            matchCount: matchedCount
                        } : f));

                        // Auto-preview logic
                        setPreviewFileId(fileItem.id);
                    } else {
                        throw new Error('No records returned');
                    }
                } else {
                    const err = await res.json();
                    throw new Error(err.error || 'Server Error');
                }
            } catch (e: any) {
                console.error("Process Error", e);
                setStagedFiles(prev => prev.map(f => f.id === fileItem.id ? {
                    ...f,
                    status: 'error',
                    message: e.message
                } : f));
            }

            // Small delay for UI grouping
            await new Promise(r => setTimeout(r, 500));
        }

        setIsProcessingQueue(false);
    };

    const saveQueue = async () => {
        if (!window.confirm('ยืนยันบันทึกข้อมูลทั้งหมดลงฐานข้อมูล?')) return;

        setIsProcessingQueue(true);
        const checkedFiles = stagedFiles.filter(f => f.status === 'checked');

        for (const fileItem of checkedFiles) {
            setStagedFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: 'saving' } : f));

            try {
                const res = await fetch('/api/rts/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ records: fileItem.records, monthYear: selectedMonth })
                });

                if (res.ok) {
                    setStagedFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: 'saved' } : f));
                } else {
                    const err = await res.json();
                    throw new Error(err.error);
                }
            } catch (e: any) {
                setStagedFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: 'error', message: e.message } : f));
            }
        }

        setIsProcessingQueue(false);
        fetchRecords(); // Update dashboard in background

        if (window.confirm('✅ บันทึกข้อมูลเสร็จสิ้น! ต้องการไปที่หน้าตารางจัดการเลยหรือไม่?')) {
            setActiveTab('dashboard');
        }
    };

    const updateRecord = async (id: string, field: string, value: any) => {
        // Optimistic Update
        const oldRecords = [...records];
        setRecords(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));

        try {
            await fetch(`/api/rts/master/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [field]: value })
            });
        } catch (e) {
            console.error("Update failed", e);
            setRecords(oldRecords); // Revert
        }
    };

    const deleteRecord = async (id: string) => {
        if (!confirm('ยืนยันลบรายการนี้?')) return;
        setRecords(prev => prev.filter(r => r.id !== id));
        await fetch(`/api/rts/master/${id}`, { method: 'DELETE' });
    };

    const getPreviewData = () => {
        const file = stagedFiles.find(f => f.id === previewFileId);
        return file ? file.records : [];
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-6">

            {/* --- TOP HEADER & CONTROLS --- */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100 gap-4">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-100 p-3 rounded-lg text-indigo-600">
                        <FileText size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">จัดการสินค้าตีกลับ (RTS)</h1>
                        <p className="text-slate-500 text-sm">ระบบติดตามสถานะและการส่งใหม่</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="ค้นหา ID, ชื่อ, เบอร์..."
                            className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-200 outline-none w-64"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <select
                        className="p-2 border rounded-lg bg-slate-50 font-medium text-slate-700"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                    >
                        {MONTH_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>

                    <button
                        onClick={() => setIsManualAddModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm transition-all"
                    >
                        <Plus size={18} /> เพิ่มรายการ
                    </button>

                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-all"
                    >
                        <Upload size={18} /> นำเข้า Excel
                    </button>

                    <button
                        onClick={fetchRecords}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"
                        title="รีเฟรชข้อมูล"
                    >
                        <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {/* --- DASHBOARD CONTENT --- */}
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {isLoading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-500" size={40} /></div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-600 text-sm uppercase tracking-wider">
                                        <th className="p-4 border-b w-24">ID/วันที่</th>
                                        <th className="p-4 border-b">ชื่อลูกค้า</th>
                                        <th className="p-4 border-b w-48">เบอร์โทร</th>
                                        <th className="p-4 border-b w-48">สินค้า</th>
                                        <th className="p-4 border-b text-center w-32">COD เดิม</th>
                                        <th className="p-4 border-b w-40">สถานะติดตาม</th>
                                        <th className="p-4 border-b w-40">สถานะจบ</th>
                                        <th className="p-4 border-b w-32">ส่งใหม่ (ยอด)</th>
                                        <th className="p-4 border-b">หมายเหตุ</th>
                                        <th className="p-4 border-b w-20"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {records
                                        .filter(r =>
                                            r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                            r.facebookName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                            r.customerPhone.includes(searchTerm) ||
                                            (r.product && r.product.toLowerCase().includes(searchTerm.toLowerCase()))
                                        )
                                        .map(r => (
                                            <tr key={r.id} className="hover:bg-indigo-50/30 transition-colors group">
                                                <td className="p-4 font-mono font-medium text-slate-600">{r.id}</td>
                                                <td className="p-4">
                                                    <div className="font-medium text-slate-800">{r.facebookName}</div>
                                                    {r.customerName && r.customerName !== r.facebookName && (
                                                        <div className="text-xs text-slate-400">{r.customerName}</div>
                                                    )}
                                                </td>
                                                <td className="p-4 font-mono text-slate-600">{r.customerPhone}</td>


                                                <td className="p-4">
                                                    <input
                                                        type="text"
                                                        className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none text-slate-700"
                                                        defaultValue={r.product || ''}
                                                        onBlur={(e) => updateRecord(r.id, 'product', e.target.value)}
                                                        placeholder="..."
                                                    />
                                                </td>

                                                <td className="p-4 text-center text-slate-500">{r.originalCod > 0 ? r.originalCod.toLocaleString() : '-'}</td>


                                                <td className="p-4">
                                                    <select
                                                        className={`w-full p-1 rounded border text-xs font-medium ${r.followUpStatus === 'ปิดเครื่อง' ? 'bg-red-50 text-red-600 border-red-200' :
                                                            r.followUpStatus.includes('โทร') ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-slate-50 text-slate-600'
                                                            }`}
                                                        value={r.followUpStatus}
                                                        onChange={(e) => updateRecord(r.id, 'followUpStatus', e.target.value)}
                                                    >
                                                        {FOLLOW_UP_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                                    </select>
                                                </td>
                                                <td className="p-4">
                                                    <select
                                                        className={`w-full p-1 rounded border text-xs font-medium ${r.finalStatus === 'จัดส่งแล้ว' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                                            r.finalStatus === 'แกะทิ้ง' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-50 text-slate-600'
                                                            }`}
                                                        value={r.finalStatus}
                                                        onChange={(e) => updateRecord(r.id, 'finalStatus', e.target.value)}
                                                    >
                                                        {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                                    </select>
                                                </td>


                                                <td className="p-4">
                                                    <input
                                                        type="number"
                                                        className="w-20 p-1 border rounded text-right text-xs"
                                                        placeholder="COD"
                                                        defaultValue={r.resendCod || ''}
                                                        onBlur={(e) => updateRecord(r.id, 'resendCod', parseFloat(e.target.value) || 0)}
                                                    />
                                                </td>

                                                <td className="p-4">
                                                    <input
                                                        type="text"
                                                        className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none text-slate-500 text-xs truncate"
                                                        defaultValue={r.notes}
                                                        onBlur={(e) => updateRecord(r.id, 'notes', e.target.value)}
                                                        title={r.notes}
                                                    />
                                                </td>

                                                <td className="p-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => deleteRecord(r.id)} // This will be defined implicitly or we need to check if deleteRecord is in scope
                                                        className="p-2 text-slate-400 hover:text-red-600 rounded-full hover:bg-red-50"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    {records.length === 0 && (
                                        <tr>
                                            <td colSpan={10} className="p-10 text-center text-slate-400">
                                                ไม่พบข้อมูล (เลือกเดือน หรือ เพิ่มรายการใหม่)
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* --- IMPORT MODAL --- */}
            {isImportModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl p-6 h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Upload size={24} className="text-indigo-600" /> นำเข้าไฟล์ Excel
                            </h3>
                            <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex gap-6 h-full">
                            {/* Left: Queue */}
                            <div className="w-1/3 space-y-4">
                                <div className="bg-slate-50 p-6 rounded-xl border border-dashed border-slate-300">
                                    <label className="flex flex-col items-center justify-center w-full h-32 cursor-pointer hover:bg-slate-100 transition-colors rounded-lg">
                                        <CloudUpload className="text-indigo-400 mb-2" size={32} />
                                        <p className="text-sm text-slate-600 font-medium">คลิกเพื่อเลือกไฟล์ Excel</p>
                                        <input type="file" className="hidden" accept=".xlsx,.csv" onChange={handleFileUpload} />
                                    </label>
                                </div>

                                <div className="space-y-3">
                                    {stagedFiles.map(f => (
                                        <div key={f.id} className="p-3 border rounded-lg bg-white shadow-sm">
                                            <div className="flex justify-between items-center">
                                                <div className="truncate w-32 font-medium text-sm text-slate-700">{f.file.name}</div>
                                                <div className="flex gap-1">
                                                    {f.status === 'pending' && (
                                                        <button onClick={() => processQueue()} className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"><PlayCircle size={14} /></button>
                                                    )}
                                                    {f.status === 'checked' && (
                                                        <>
                                                            <button onClick={() => setPreviewFileId(previewFileId === f.id ? null : f.id)} className="p-1 bg-slate-200 text-slate-600 rounded hover:bg-slate-300"><FileText size={14} /></button>
                                                            <button onClick={saveQueue} className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"><CheckCircle2 size={14} /></button>
                                                        </>
                                                    )}
                                                    <button onClick={() => removeStagedFile(f.id)} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                                                </div>
                                            </div>
                                            <div className="text-xs text-slate-400 mt-1 capitalize">{f.status}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right: Preview */}
                            <div className="w-2/3 bg-slate-50 rounded-xl border border-slate-200 p-4 overflow-hidden flex flex-col">
                                {previewFileId ? (() => {
                                    const f = stagedFiles.find(file => file.id === previewFileId);
                                    if (!f || !f.records) return <div className="text-center text-slate-400 mt-20">ไม่พบข้อมูลไฟล์</div>;
                                    return (
                                        <div className="h-full overflow-auto">
                                            <table className="w-full text-left text-sm">
                                                <thead className="sticky top-0 bg-slate-100 z-10">
                                                    <tr>
                                                        <th className="p-2 border-b">ID</th>
                                                        <th className="p-2 border-b">Name</th>
                                                        <th className="p-2 border-b">Phone</th>
                                                        <th className="p-2 border-b">Status</th>
                                                        <th className="p-2 border-b">Notes</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200">
                                                    {f.records.map((r: any, i: number) => (
                                                        <tr key={i} className="bg-white">
                                                            <td className="p-2 font-mono text-slate-500">{r.id}</td>
                                                            <td className="p-2 truncate max-w-[150px]">{r.facebookName}</td>
                                                            <td className="p-2 font-mono">{r.customerPhone}</td>
                                                            <td className="p-2">{r.isMatched ? '✅' : 'New'}</td>
                                                            <td className="p-2 text-xs truncate max-w-[150px]">{r.notes}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    );
                                })() : (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                        <FileSpreadsheet size={48} className="mb-4 opacity-20" />
                                        <p>เลือกไฟล์เพื่อดูตัวอย่าง</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MANUAL ADD MODAL --- */}
            {isManualAddModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800">เพิ่มรายการใหม่ (Manual Add)</h3>
                            <button onClick={() => setIsManualAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">ID / วันที่ (เช่น 1-001)</label>
                                <input
                                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={newRecord.id}
                                    onChange={e => setNewRecord({ ...newRecord, id: e.target.value })}
                                    placeholder="Ex. 1-001"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อลูกค้า (Facebook)</label>
                                <input
                                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={newRecord.facebookName}
                                    onChange={e => setNewRecord({ ...newRecord, facebookName: e.target.value })}
                                    placeholder="ชื่อเฟสบุ๊ค"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">เบอร์โทร</label>
                                    <input
                                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={newRecord.customerPhone}
                                        onChange={e => setNewRecord({ ...newRecord, customerPhone: e.target.value })}
                                        placeholder="08xxxxxxxx"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">สินค้า</label>
                                    <input
                                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={newRecord.product}
                                        onChange={e => setNewRecord({ ...newRecord, product: e.target.value })}
                                        placeholder="ระบุสินค้า..."
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">หมายเหตุ</label>
                                <textarea
                                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-20"
                                    value={newRecord.notes}
                                    onChange={e => setNewRecord({ ...newRecord, notes: e.target.value })}
                                    placeholder="หมายเหตุเพิ่มเติม..."
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-8">
                            <button
                                onClick={() => setIsManualAddModalOpen(false)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleManualAdd}
                                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium shadow-sm"
                            >
                                บันทึกข้อมูล
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- SCAN TAB --- */}
            {activeTab === 'scan' && (
                <div className="p-8 max-w-4xl mx-auto w-full h-full overflow-y-auto">
                    <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xl overflow-hidden text-center">
                        {!isScanning ? (
                            <div className="py-8 space-y-6">
                                <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                                    <QrCode className="w-10 h-10" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800">โหมดสแกนพัสดุ (ดั้งเดิม)</h3>
                                    <p className="text-slate-400 font-medium max-w-[280px] mx-auto mt-2 text-sm">
                                        ใช้สำหรับแจ้งปัญหาด่วน หรือตรวจสอบสถานะรายชิ้น
                                    </p>
                                </div>

                                <button
                                    onClick={() => {
                                        if (!scannerRef.current) {
                                            const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
                                            scanner.render((decoded) => {
                                                setScanResult(decoded);
                                                const found = filteredShipments.find(s => s.trackingNumber === decoded || s.id === decoded);
                                                if (found) {
                                                    setSelectedShipment(found);
                                                    setIsReportModalOpen(true);
                                                } else {
                                                    alert('ไม่พบข้อมูลพัสดุ');
                                                }
                                                scanner.clear();
                                                setIsScanning(false);
                                            }, (err) => console.warn(err));
                                            scannerRef.current = scanner;
                                            setIsScanning(true);
                                        }
                                    }}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl font-black shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center gap-2 mx-auto"
                                >
                                    <Camera className="w-5 h-5" />
                                    เปิดกล้องสแกน
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-black text-slate-800">กำลังสแกน...</h3>
                                    <button onClick={() => { scannerRef.current?.clear(); setIsScanning(false); }} className="text-rose-500 font-bold">ยกเลิก</button>
                                </div>
                                <div id="reader" className="overflow-hidden rounded-2xl border-4 border-slate-900 bg-slate-50 aspect-square"></div>
                            </div>
                        )}
                    </div>
                    {selectedShipment && (
                        <ReportIssueModal
                            isOpen={isReportModalOpen}
                            onClose={() => setIsReportModalOpen(false)}
                            shipment={selectedShipment}
                            onSuccess={() => {
                                setIsReportModalOpen(false);
                                setActiveTab('dashboard');
                                fetchRecords();
                            }}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

export default RTSManagementPage;
