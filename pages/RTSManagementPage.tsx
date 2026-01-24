import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import {
    QrCode, Search, Camera, Package, User, AlertCircle, CheckCircle2,
    RotateCcw, Trash2, Save, History, RefreshCw, ChevronRight, X
} from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface RTSReport {
    id: string;
    trackingNumber: string;
    status: string;
    customerName: string;
    actionType: string;
    notes: string;
    photoUrl: string;
    timestamp: number;
    reportedBy: string;
}

const STATUS_OPTIONS = [
    { value: 'checked', label: 'เช็คพัสดุแล้ว (OK)', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { value: 'rts_received', label: 'รับสินค้าตีกลับ (RTS)', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    { value: 'damaged', label: 'สินค้าเสียหาย', color: 'bg-rose-50 text-rose-700 border-rose-200' },
    { value: 'cancelled', label: 'ยกเลิกรายการ', color: 'bg-slate-100 text-slate-700 border-slate-300' },
];

const ACTION_OPTIONS = [
    { value: 'resend_original', label: 'ส่งสินค้าเดิมกลับไป', icon: RotateCcw },
    { value: 'new_production', label: 'ขอผลิตสินค้าใหม่ (เคลม)', icon: RefreshCw },
    { value: 'restock', label: 'เก็บเข้าสต็อกเพื่อขายใหม่', icon: Package },
    { value: 'refund', label: 'คืนเงินลูกค้า', icon: Save },
];

const RTSManagementPage: React.FC = () => {
    const { shipments } = useData();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'scan' | 'search' | 'history'>('scan');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedShipment, setSelectedShipment] = useState<any>(null);
    const [reports, setReports] = useState<RTSReport[]>([]);

    // Form State
    const [status, setStatus] = useState('checked');
    const [actionType, setActionType] = useState('resend_original');
    const [notes, setNotes] = useState('');
    const [photo, setPhoto] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [scanResult, setScanResult] = useState<string | null>(null);
    const [trackHistory, setTrackHistory] = useState<RTSReport[]>([]);
    const [newTrackingNumber, setNewTrackingNumber] = useState('');
    const formRef = useRef<HTMLDivElement>(null);

    const [isScanning, setIsScanning] = useState(false);
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);

    // Load History
    const fetchHistory = async () => {
        try {
            const res = await fetch('/api/rts');
            if (res.ok) {
                const data = await res.json();
                setReports(data || []);
            }
        } catch (e) {
            console.error('Failed to fetch RTS history', e);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const startScanner = () => {
        if (!scannerRef.current) {
            const scanner = new Html5QrcodeScanner(
                "reader",
                { fps: 15, qrbox: { width: 250, height: 250 } },
                false
            );
            scanner.render(onScanSuccess, onScanFailure);
            scannerRef.current = scanner;
            setIsScanning(true);
        }
    };

    const stopScanner = async () => {
        if (scannerRef.current) {
            try {
                await scannerRef.current.clear();
                scannerRef.current = null;
                setIsScanning(false);
            } catch (e) {
                console.error("Failed to clear scanner", e);
            }
        }
    };

    useEffect(() => {
        return () => {
            stopScanner();
        };
    }, []);

    // Also stop if tab changes
    useEffect(() => {
        if (activeTab !== 'scan') {
            stopScanner();
        }
    }, [activeTab]);

    function onScanSuccess(decodedText: string) {
        setScanResult(decodedText);
        handleFindShipment(decodedText);
        stopScanner(); // Auto stop once found to clear UI
    }

    function onScanFailure(error: any) {
        // Quiet failure
    }

    const handleFindShipment = async (tracking: string) => {
        const found = shipments.find(s => s.trackingNumber === tracking || s.id === tracking);
        if (found) {
            setSelectedShipment(found);
            // Fetch history for this specific tracking
            try {
                const res = await fetch(`/api/rts/${found.trackingNumber}`);
                if (res.ok) {
                    const historyData = await res.json();
                    setTrackHistory(historyData);
                }
            } catch (e) {
                console.error("Failed to load track history", e);
            }

            // Scroll to form on mobile
            if (window.innerWidth < 1024) {
                formRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
        } else {
            alert(`ไม่พบข้อมูลพัสดุเลขที่: ${tracking}`);
        }
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPhoto(file);
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedShipment) return;

        setIsSubmitting(true);
        const formData = new FormData();
        formData.append('trackingNumber', selectedShipment.trackingNumber);
        formData.append('status', status);
        formData.append('customerName', selectedShipment.customerName || '');
        formData.append('actionType', actionType);
        formData.append('notes', notes);
        formData.append('reportedBy', user?.username || 'unknown');
        if (newTrackingNumber) {
            formData.append('newTrackingNumber', newTrackingNumber);
        }
        if (photo) {
            formData.append('photo', photo);
        }

        try {
            const res = await fetch('/api/rts', {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                alert('บันทึกข้อมูลสำเร็จ!');
                // Reset form
                setSelectedShipment(null);
                setNotes('');
                setPhoto(null);
                setPreviewUrl(null);
                setScanResult(null);
                setNewTrackingNumber('');
                setTrackHistory([]);
                fetchHistory();
                setActiveTab('history');
            } else {
                throw new Error('Failed to save');
            }
        } catch (err) {
            alert('เกิดข้อผิดพลาดในการบันทึก');
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredShipments = searchTerm.length > 2
        ? shipments.filter(s =>
            s.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.trackingNumber?.toLowerCase().includes(searchTerm.toLowerCase())
        ).slice(0, 5)
        : [];

    return (
        <div className="space-y-6 pb-12 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center space-x-3">
                    <div className="bg-slate-900 p-2 rounded-xl text-white shadow-lg">
                        <Package className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">จัดการสินค้า & ตีกลับ (Check-out/RTS)</h1>
                        <p className="text-sm text-slate-500 font-medium">สแกนพัสดุ ตรวจสอบคุณภาพ และรายงานสินค้าตีกลับ</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm w-fit">
                <button
                    onClick={() => setActiveTab('scan')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'scan' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <QrCode className="w-4 h-4" />
                    สแกน QR/Barcode
                </button>
                <button
                    onClick={() => setActiveTab('search')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'search' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <Search className="w-4 h-4" />
                    ค้นหารายชื่อ
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'history' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <History className="w-4 h-4" />
                    ประวัติรายงาน
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Side: Scanning or Search */}
                <div className="space-y-6">
                    {activeTab === 'scan' && (
                        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl overflow-hidden text-center">
                            {!isScanning ? (
                                <div className="py-12 space-y-6">
                                    <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                                        <Camera className="w-10 h-10" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-800">พร้อมสแกนพัสดุ</h3>
                                        <p className="text-slate-400 font-medium max-w-[250px] mx-auto mt-2">กดปุ่มด้านล่างเพื่อเริ่มเปิดกล้องสแกนบาร์โค้ดหน้ากล่อง</p>
                                    </div>
                                    <button
                                        onClick={startScanner}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-12 py-6 rounded-3xl font-black text-2xl shadow-2xl shadow-indigo-200 transition-all active:scale-90 flex items-center gap-4 mx-auto animate-pulse"
                                    >
                                        <QrCode className="w-8 h-8" />
                                        เริ่มสแกนพัสดุ
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-black text-slate-800 flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                                            กำลังเปิดกล้อง...
                                        </h3>
                                        <button
                                            onClick={stopScanner}
                                            className="text-rose-500 text-sm font-bold hover:underline"
                                        >
                                            ปิดกล้อง
                                        </button>
                                    </div>
                                    <div id="reader" className="overflow-hidden rounded-2xl border-4 border-slate-900 bg-slate-50 aspect-square"></div>
                                </div>
                            )}

                            {scanResult && (
                                <div className="mt-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                        <div className="text-left">
                                            <p className="text-[10px] uppercase font-black text-emerald-600 tracking-widest">SCANNED RESULT</p>
                                            <p className="font-mono font-bold text-slate-700">{scanResult}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setScanResult(null)}
                                        className="p-1 hover:bg-emerald-100 rounded-lg"
                                    >
                                        <X className="w-4 h-4 text-emerald-400" />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'search' && (
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="ค้นหา Tracking หรือ ชื่อลูกค้า..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-slate-900 outline-none font-medium"
                                />
                            </div>

                            <div className="space-y-2">
                                {filteredShipments.map(s => (
                                    <div
                                        key={s.id}
                                        onClick={() => setSelectedShipment(s)}
                                        className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between group ${selectedShipment?.id === s.id ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-100 hover:border-slate-300'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedShipment?.id === s.id ? 'bg-white/10' : 'bg-slate-100'}`}>
                                                <User className={`w-5 h-5 ${selectedShipment?.id === s.id ? 'text-white' : 'text-slate-500'}`} />
                                            </div>
                                            <div>
                                                <p className="font-bold">{s.customerName}</p>
                                                <p className={`text-xs ${selectedShipment?.id === s.id ? 'text-white/60' : 'text-slate-400'}`}>{s.trackingNumber}</p>
                                            </div>
                                        </div>
                                        <ChevronRight className={`w-5 h-5 transition-transform group-hover:translate-x-1 ${selectedShipment?.id === s.id ? 'text-white/40' : 'text-slate-300'}`} />
                                    </div>
                                ))}
                                {searchTerm.length > 2 && filteredShipments.length === 0 && (
                                    <div className="text-center py-8 text-slate-400">
                                        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                        <p className="text-sm font-bold">ไม่พบข้อมูล</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-[600px]">
                            <div className="p-4 bg-slate-50 border-b border-slate-200 font-black text-slate-800">
                                ประวัติการรายงานล่าสุด
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {reports.map(r => (
                                    <div key={r.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex gap-4">
                                        {r.photoUrl ? (
                                            <img src={r.photoUrl} className="w-20 h-20 rounded-xl object-cover border" alt="RTS" />
                                        ) : (
                                            <div className="w-20 h-20 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400">
                                                <Camera className="w-8 h-8" />
                                            </div>
                                        )}
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <h4 className="font-bold text-slate-800">{r.trackingNumber}</h4>
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase border ${STATUS_OPTIONS.find(so => so.value === r.status)?.color || 'bg-slate-100'}`}>
                                                    {STATUS_OPTIONS.find(so => so.value === r.status)?.label || r.status}
                                                </span>
                                            </div>
                                            <p className="text-xs font-bold text-slate-500 mt-1">{r.customerName}</p>
                                            <p className="text-[10px] mt-2 text-slate-400">{new Date(r.timestamp).toLocaleString('th-TH')}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Side: Reporting Form */}
                <div className="space-y-6">
                    {selectedShipment ? (
                        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6 animate-slide-up">
                            <div className="relative group">
                                <button
                                    type="button"
                                    onClick={() => setSelectedShipment(null)}
                                    className="absolute -right-2 -top-2 bg-rose-500 text-white p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                                <div className="bg-slate-900 rounded-2xl p-6 text-white relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                                    <div className="relative z-10 flex flex-col gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-white/20 p-2 rounded-lg">
                                                <User className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">CUSTOMER INFO</p>
                                                <h4 className="text-xl font-bold">{selectedShipment.customerName}</h4>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">TRACKING</p>
                                                <p className="font-mono font-bold">{selectedShipment.trackingNumber}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">STATUS</p>
                                                <p className="font-bold text-emerald-400">{selectedShipment.status}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Track History Mini View */}
                            {trackHistory.length > 0 && (
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
                                    <div className="bg-slate-100 px-4 py-2 text-[10px] font-black text-slate-500 uppercase flex items-center gap-2">
                                        <History className="w-3 h-3" />
                                        ประวัติการดำเนินการของแทร็กนี้
                                    </div>
                                    <div className="p-3 space-y-2 max-h-40 overflow-y-auto">
                                        {trackHistory.map((h) => (
                                            <div key={h.id} className="text-xs flex gap-2 border-b border-slate-100 last:border-0 pb-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1 shrink-0"></div>
                                                <div>
                                                    <p className="font-bold text-slate-700">{STATUS_OPTIONS.find(so => so.value === h.status)?.label || h.status} ({ACTION_OPTIONS.find(ao => ao.value === h.actionType)?.label || h.actionType})</p>
                                                    <p className="text-[10px] text-slate-400">{new Date(h.timestamp).toLocaleString('th-TH')}</p>
                                                    {h.notes && <p className="italic text-slate-500 mt-0.5 opacity-80">{h.notes}</p>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Status Selection */}
                            <div className="space-y-3">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">สถานะปัจจุบัน</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {STATUS_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setStatus(opt.value)}
                                            className={`p-3 rounded-xl border-2 text-xs font-bold transition-all ${status === opt.value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-100 bg-slate-50 text-slate-500'}`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Action Selection */}
                            <div className="space-y-3">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">การดำเนินการ (Action)</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {ACTION_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setActionType(opt.value)}
                                            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${actionType === opt.value ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-200'}`}
                                        >
                                            <div className={`p-2 rounded-lg ${actionType === opt.value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                <opt.icon className="w-5 h-5" />
                                            </div>
                                            <span className={`font-bold ${actionType === opt.value ? 'text-indigo-700' : 'text-slate-600'}`}>{opt.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* New Tracking Field (Conditionally shown) */}
                            {(actionType === 'resend_original' || actionType === 'new_production') && (
                                <div className="space-y-3 animate-slide-up">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center justify-between">
                                        เลขพัสดุใหม่ (ถ้ามี)
                                        <span className="text-[10px] text-indigo-500">ใส่กรณีมีการเปลี่ยน Tracking</span>
                                    </label>
                                    <div className="relative">
                                        <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <input
                                            type="text"
                                            value={newTrackingNumber}
                                            onChange={(e) => setNewTrackingNumber(e.target.value)}
                                            placeholder="กรอกเลขพัสดุใหม่..."
                                            className="w-full pl-12 pr-4 py-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl focus:ring-2 focus:ring-slate-900 outline-none font-mono font-bold"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Photo Reporting */}
                            <div className="space-y-3">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">ถ่ายรูปสินค้า/หลักฐาน</label>
                                <div className="flex gap-4 items-center">
                                    <label className="flex-1 cursor-pointer">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            onChange={handlePhotoChange}
                                            className="hidden"
                                        />
                                        <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 hover:bg-slate-100 transition-colors group">
                                            {previewUrl ? (
                                                <img src={previewUrl} className="w-full h-32 object-contain rounded-xl" alt="Preview" />
                                            ) : (
                                                <>
                                                    <Camera className="w-8 h-8 text-slate-300 group-hover:text-indigo-500 transition-colors mb-2" />
                                                    <span className="text-xs font-bold text-slate-400">กดเพื่อเปิดกล้อง</span>
                                                </>
                                            )}
                                        </div>
                                    </label>
                                    {previewUrl && (
                                        <button
                                            type="button"
                                            onClick={() => { setPhoto(null); setPreviewUrl(null); }}
                                            className="bg-rose-50 text-rose-500 p-2 rounded-full border border-rose-100"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Notes */}
                            <div className="space-y-3">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">หมายเหตุเพิ่มเติม</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="ระบุรายละเอียด เช่น สินค้าชำรุดตรงไหน หรือส่งสินค้าตัวใหม่แทน..."
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-slate-900 outline-none text-sm min-h-[100px]"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-3xl font-black text-xl shadow-2xl shadow-slate-200 flex items-center justify-center gap-3 active:scale-95 transition-all"
                            >
                                {isSubmitting ? <RefreshCw className="w-7 h-7 animate-spin" /> : <Save className="w-7 h-7" />}
                                บันทึกรายงานทันที
                            </button>
                        </form>
                    ) : (
                        <div ref={formRef} className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center flex flex-col items-center justify-center h-full min-h-[400px]">
                            <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                                <Package className="w-12 h-12 text-slate-300" />
                            </div>
                            <h3 className="text-xl font-black text-slate-400">ยังไม่เลือกพัสดุ</h3>
                            <p className="text-sm text-slate-400 max-w-[200px] mt-2">กรุณาสแกนหรือค้นหาผู้รับ เพื่อเริ่มทำการเช็คสินค้าหรือรายงาน RTS</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RTSManagementPage;
