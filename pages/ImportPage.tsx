import React, { useState, useRef, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { UploadCloud, FileText, ArrowRight, AlertCircle, CheckCircle2, Info, FileUp, X, Settings2, Eye, AlertTriangle, Package, ChevronDown, ChevronUp, Trash2, Calendar, PlayCircle, Loader2 } from 'lucide-react';
import { Courier, Shipment } from '../types';
import { useNavigate } from 'react-router-dom';
import { read, utils } from 'xlsx';

interface StagedFile {
    id: string;
    name: string;
    date: string;
    time: string;
    items: Shipment[];
    status: 'pending' | 'processing' | 'done' | 'error';
    message?: string;
}

const ImportPage: React.FC = () => {
    const { shipments, importShipments } = useData();
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [courier, setCourier] = useState<Courier>('Thailand Post - EMS');
    const [inputText, setInputText] = useState('');

    // Staging Queue
    const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);

    const [importMode, setImportMode] = useState<'skip' | 'replace'>('skip');
    const [isProcessing, setIsProcessing] = useState(false);
    const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

    // Preview State
    const [previewResult, setPreviewResult] = useState<{
        all: Shipment[];
        newItems: Shipment[];
        duplicates: Shipment[];
        byFile: Record<string, { count: number, date: string }>;
    } | null>(null);

    const cleanString = (str: string) => str ? str.trim().replace(/^"/, '').replace(/"$/, '') : '';

    const calculatePreviewStats = (itemsToCheck: Shipment[]) => {
        const parsedMap = new Map<string, Shipment>();
        itemsToCheck.forEach(item => parsedMap.set(item.trackingNumber, item));
        const parsedShipments = Array.from(parsedMap.values());

        if (parsedShipments.length === 0) {
            throw new Error("ไม่พบข้อมูลที่ถูกต้อง กรุณาตรวจสอบรูปแบบไฟล์");
        }

        const existingTrackings = new Set(shipments.map(s => s.trackingNumber));
        const duplicates = parsedShipments.filter(s => existingTrackings.has(s.trackingNumber));
        const newItems = parsedShipments.filter(s => !existingTrackings.has(s.trackingNumber));

        // Group Stats by File (using Import Date + Time as key loosely)
        const byFile: Record<string, { count: number, date: string }> = {};
        parsedShipments.forEach(s => {
            const key = `${s.importDate} ${s.importTime || ''}`.trim();
            if (!byFile[key]) byFile[key] = { count: 0, date: s.importDate };
            byFile[key].count++;
        });

        return { all: parsedShipments, newItems, duplicates, byFile };
    };

    // Parsing Helpers
    const parseNameField = (rawName: string) => {
        let sequence = '';
        let name = rawName.trim();
        const seqMatch = name.match(/^(\d+)[\.\s]+(.*)/);
        if (seqMatch) { sequence = seqMatch[1]; name = seqMatch[2]; }
        name = name.replace(/^(fb|f\.b\.|f\.b|facebook)[\.\s]*/i, '');
        return { sequence, name: name.trim() };
    };

    const parseRowSmart = (parts: string[]): Partial<Shipment> | null => {
        const trackingIdx = parts.findIndex(p => /^[A-Z0-9]{9,16}$/i.test(p) && (p.endsWith('TH') || p.startsWith('JN') || p.startsWith('SP') || p.length > 10));
        if (trackingIdx === -1) return null;

        const phoneIdx = parts.findIndex((p, idx) => idx > trackingIdx && /^[\d\-\s]{9,12}$/.test(p) && (p.startsWith('0') || p.startsWith('6') || p.startsWith('8') || p.startsWith('9')));
        if (phoneIdx === -1) return null;

        const zipIdx = parts.findIndex((p, idx) => idx > trackingIdx && /^\d{5}$/.test(p));

        const shipment: Partial<Shipment> = {};
        shipment.trackingNumber = parts[trackingIdx];

        let rawPhone = parts[phoneIdx].replace(/[^0-9]/g, '');
        if (rawPhone.length === 9) rawPhone = '0' + rawPhone;
        shipment.phoneNumber = rawPhone;

        if (zipIdx !== -1) {
            shipment.zipCode = parts[zipIdx];
        } else {
            const possibleZip = parts[phoneIdx + 1];
            if (possibleZip && /^\d{5}$/.test(possibleZip)) shipment.zipCode = possibleZip;
        }

        if (phoneIdx > 0) {
            let rawNameField = parts[phoneIdx - 1];
            let sequence = '';
            let name = '';
            const parsedCheck = parseNameField(rawNameField);
            if (parsedCheck.sequence) { sequence = parsedCheck.sequence; name = parsedCheck.name; } else { name = parsedCheck.name; }

            if (phoneIdx > 1) {
                const prevCol = parts[phoneIdx - 2];
                const seqOnlyMatch = prevCol.match(/^(\d+)[\.]+$/);
                if (seqOnlyMatch) { if (!sequence) sequence = seqOnlyMatch[1]; }
                else if (/^[\d,\.]+$/.test(prevCol)) { shipment.codAmount = parseFloat(prevCol.replace(/,/g, '')) || 0; }
            }
            name = name.replace(/^(fb|f\.b\.|f\.b|facebook)[\.\s]*/i, '').trim();
            if (!sequence) { const parsed = parseNameField(rawNameField); sequence = parsed.sequence; name = parsed.name; }
            shipment.customerName = name || 'ไม่ระบุชื่อ';
            if (sequence) shipment.sequenceNumber = sequence;
        }

        if (zipIdx !== -1 && zipIdx + 1 < parts.length) {
            const rawCost = parts[zipIdx + 1];
            if (/^[\d,\.]+$/.test(rawCost)) { shipment.shippingCost = parseFloat(rawCost.replace(/,/g, '')) || 0; }
        } else if (parts[parts.length - 2] && /^[\d,\.]+$/.test(parts[parts.length - 2])) {
            shipment.shippingCost = parseFloat(parts[parts.length - 2].replace(/,/g, '')) || 0;
        }

        const lastCol = parts[parts.length - 1];
        if (lastCol && (lastCol.includes('รับฝาก') || lastCol.includes('Deliver') || lastCol.length < 20)) {
            shipment.status = lastCol as any;
        } else { shipment.status = 'รับฝาก'; }

        if (/\d{4}-\d{2}-\d{2}/.test(lastCol)) {
            shipment.importDate = lastCol;
            if (parts.length > 2) shipment.status = parts[parts.length - 2] as any;
        }

        return shipment;
    };

    const processRawText = (text: string, importDate: string, courierName: Courier, importTime: string = '00:00'): Shipment[] => {
        const lines = text.trim().split('\n');
        const results: Shipment[] = [];
        const baseId = Date.now();
        const randomOffset = Math.floor(Math.random() * 10000);

        lines.forEach((line, index) => {
            if (!line.trim()) return;
            if (line.includes('Barcode') || line.includes('Tracking') || line.includes('ผู้รับ')) return;
            const separator = line.includes('\t') ? '\t' : ',';
            const parts = line.split(separator).map(cleanString).filter(p => p !== '');
            const shipment = parseRowSmart(parts);
            if (shipment && shipment.trackingNumber) {
                results.push({
                    ...shipment,
                    id: `import-${baseId}-${randomOffset}-${index}`,
                    courier: courierName,
                    importDate: shipment.importDate || importDate,
                    importTime: importTime,
                    timestamp: Date.now() - index,
                    codAmount: shipment.codAmount || 0,
                    shippingCost: shipment.shippingCost || 0,
                    customerName: shipment.customerName || 'ไม่ระบุชื่อ',
                    zipCode: shipment.zipCode || '',
                    phoneNumber: shipment.phoneNumber || '',
                    status: shipment.status || 'รับฝาก',
                    sequenceNumber: shipment.sequenceNumber
                } as Shipment);
            }
        });
        return results;
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsProcessing(true);
        const newStagedFiles: StagedFile[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            let fileDate = date;

            // Date Extraction
            const dateMatch = file.name.match(/(\d{2})[-/.](\d{2})[-/.](\d{4})/);
            if (dateMatch) {
                let day = parseInt(dateMatch[1]);
                let month = parseInt(dateMatch[2]);
                let year = parseInt(dateMatch[3]);
                if (year > 2400) year -= 543;
                const newDate = new Date(year, month - 1, day);
                if (!isNaN(newDate.getTime())) {
                    const yyyy = newDate.getFullYear();
                    const mm = String(newDate.getMonth() + 1).padStart(2, '0');
                    const dd = String(newDate.getDate()).padStart(2, '0');
                    fileDate = `${yyyy}-${mm}-${dd}`;
                }
            }

            // Time Extraction
            let fileTime = '00:00';
            const timeMatch = file.name.match(/(?:_|\s)(\d{1,2})[-.:](\d{2})(?:_|\s|\.)/);
            if (timeMatch) {
                const h = parseInt(timeMatch[1]);
                const m = parseInt(timeMatch[2]);
                if (h >= 0 && h < 24 && m >= 0 && m < 60) {
                    fileTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                }
            }

            try {
                let text = '';
                if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                    const arrayBuffer = await file.arrayBuffer();
                    const workbook = read(arrayBuffer, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    text = utils.sheet_to_csv(worksheet, { FS: '\t' });
                } else {
                    text = await file.text();
                }

                const items = processRawText(text, fileDate, courier, fileTime);

                newStagedFiles.push({
                    id: Date.now() + Math.random().toString(),
                    name: file.name,
                    date: fileDate,
                    time: fileTime,
                    items: items,
                    status: 'pending'
                });

            } catch (error) {
                console.error(`Failed to process file ${file.name}`, error);
                setMessage({ type: 'error', text: `ไม่สามารถอ่านไฟล์ ${file.name} ได้` });
            }
        }

        setStagedFiles(prev => [...prev, ...newStagedFiles]);
        setIsProcessing(false);
        e.target.value = '';
    };

    const removeStagedFile = (id: string) => {
        setStagedFiles(prev => prev.filter(f => f.id !== id));
    };

    const handlePreview = () => {
        setIsProcessing(true);
        setMessage(null);

        setTimeout(() => {
            try {
                let allNewItems: Shipment[] = [];
                if (inputText.trim()) {
                    const manualItems = processRawText(inputText, date, courier, '00:00');
                    allNewItems = [...allNewItems, ...manualItems];
                }

                // Add Items from Staged Files (Only pending)
                stagedFiles.forEach(f => {
                    if (f.status === 'pending') {
                        allNewItems.push(...f.items);
                    }
                });

                if (allNewItems.length === 0) {
                    throw new Error("กรุณากรอกข้อมูลหรือเพิ่มไฟล์ในคิว");
                }

                const result = calculatePreviewStats(allNewItems);
                setPreviewResult(result);

            } catch (err: any) {
                setMessage({ type: 'error', text: err.message || "เกิดข้อผิดพลาดในการประมวลผล" });
            } finally {
                setIsProcessing(false);
            }
        }, 600);
    };

    const processQueue = async () => {
        if (!previewResult) return;
        setIsProcessing(true);

        const filesToProcess = stagedFiles.filter(f => f.status === 'pending');
        let totalAdded = 0;
        let totalUpdated = 0;
        let totalSkipped = 0;

        // Process File by File (Sequential)
        for (const file of filesToProcess) {
            setStagedFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'processing' } : f));

            // Artificial delay for better UX visually
            await new Promise(r => setTimeout(r, 500));

            try {
                const result = importShipments(file.items, importMode);
                totalAdded += result.added;
                totalUpdated += result.updated;
                totalSkipped += result.skipped;

                setStagedFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'done' } : f));
            } catch (e) {
                setStagedFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'error', message: 'Failed' } : f));
            }
        }

        // Process Manual Input if any
        if (inputText.trim()) {
            const manualItems = processRawText(inputText, date, courier, '00:00');
            const result = importShipments(manualItems, importMode);
            totalAdded += result.added;
            totalUpdated += result.updated;
            totalSkipped += result.skipped;
            setInputText(''); // Clear input
        }

        setPreviewResult(null);
        setIsProcessing(false);
        setMessage({
            type: 'success',
            text: `ประมวลผลเสร็จสิ้น: เพิ่ม ${totalAdded}, อัปเดต ${totalUpdated}, ข้าม ${totalSkipped}`
        });

        // Delay navigation to let user see "Done" status
        setTimeout(() => {
            // Optional: Auto Navigate? Or let user stay? User might want to clear list manually.
            // Let's not auto-navigate if there are finished items to show status. 
            // But usually we go back.
            // Let's wait 2 seconds then navigate if all done?
            // Or maybe just stay and let user decide.
        }, 1000);
    };

    const groupedPreviewData = useMemo(() => {
        if (!previewResult) return [];
        const groups: Record<string, { name: string, phone: string, items: Shipment[] }> = {};
        previewResult.all.forEach(item => {
            const key = `${item.customerName}|${item.phoneNumber}`;
            if (!groups[key]) { groups[key] = { name: item.customerName, phone: item.phoneNumber, items: [] }; }
            groups[key].items.push(item);
        });
        return Object.values(groups);
    }, [previewResult]);

    return (
        <>
            <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-10">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">นำเข้าพัสดุ (Import Queue)</h1>
                        <p className="text-slate-600 mt-1 font-medium">จัดการคิวการอัปโหลด ตรวจสอบทีละวัน และบันทึกข้อมูลอย่างแม่นยำ</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Input & Settings */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
                            <div className="bg-slate-50 border-b border-slate-200 p-6 grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-800 block">วันที่นำเข้า (Default)</label>
                                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-300 rounded-xl outline-none text-slate-900 font-medium" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-800 block">ผู้ให้บริการขนส่ง</label>
                                    <select value={courier} onChange={(e) => setCourier(e.target.value as Courier)} className="w-full px-4 py-2 bg-white border border-slate-300 rounded-xl outline-none text-slate-900 font-medium">
                                        <option>Thailand Post - EMS</option>
                                        <option>Kerry Express</option>
                                        <option>J&T Express</option>
                                        <option>Flash Express</option>
                                    </select>
                                </div>
                            </div>

                            <div className="p-6 space-y-6">
                                <div className="relative group">
                                    <textarea
                                        value={inputText}
                                        onChange={(e) => setInputText(e.target.value)}
                                        placeholder="วางข้อมูล หรือกดปุ่มด้านล่างเพื่อเลือกไฟล์..."
                                        className="w-full h-[200px] p-5 bg-slate-50 border-2 border-slate-300 rounded-xl outline-none text-sm font-mono text-slate-900 resize-none transition-all placeholder:text-slate-400"
                                    />
                                    {!inputText && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <button onClick={() => fileInputRef.current?.click()} className="pointer-events-auto px-6 py-3 bg-white border border-indigo-200 text-indigo-600 rounded-xl font-bold hover:bg-indigo-50 transition-colors shadow-sm flex items-center gap-2">
                                                <FileUp className="w-5 h-5" /> เลือกไฟล์ Excel/CSV
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv,.txt,.xls,.xlsx" multiple className="hidden" />

                                <div className="flex justify-end pt-2">
                                    <button onClick={handlePreview} disabled={isProcessing || (stagedFiles.length === 0 && !inputText)} className={`px-8 py-3 rounded-xl font-bold text-white shadow-lg flex items-center gap-2 transition-all ${isProcessing || (stagedFiles.length === 0 && !inputText) ? 'bg-slate-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                                        {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Eye className="w-5 h-5" />}
                                        ตรวจสอบข้อมูลทั้งหมด
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: File Queue */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-2xl shadow-md border border-slate-200 h-full flex flex-col overflow-hidden">
                            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    <UploadCloud className="w-5 h-5 text-indigo-500" />
                                    คิวอัปโหลด ({stagedFiles.length})
                                </h3>
                                {stagedFiles.length > 0 && (
                                    <button onClick={() => setStagedFiles([])} className="text-xs text-rose-500 hover:text-rose-700 font-medium">ล้างทั้งหมด</button>
                                )}
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 min-h-[300px] max-h-[500px]">
                                {stagedFiles.length === 0 && (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                                        <FileText className="w-12 h-12 mb-2 opacity-50" />
                                        <p className="text-sm">ยังไม่มีไฟล์ในคิว</p>
                                    </div>
                                )}
                                {stagedFiles.map(file => (
                                    <div key={file.id} className={`p-3 rounded-xl border flex items-center justify-between group transition-all ${file.status === 'done' ? 'bg-emerald-50 border-emerald-100' :
                                        file.status === 'processing' ? 'bg-indigo-50 border-indigo-200' :
                                            file.status === 'error' ? 'bg-rose-50 border-rose-100' :
                                                'bg-white border-slate-200 hover:border-indigo-300'
                                        }`}>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-slate-700 text-sm truncate max-w-[150px]">{file.name}</span>
                                                {file.status === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                                                {file.status === 'processing' && <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <span className="bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" /> {file.date} {file.time !== '00:00' && file.time}
                                                </span>
                                                <span className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-medium">
                                                    {file.items.length} รายการ
                                                </span>
                                            </div>
                                        </div>
                                        {file.status === 'pending' && (
                                            <button onClick={() => removeStagedFile(file.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Feedback */}
                {message && (
                    <div className={`p-4 rounded-xl flex items-center gap-3 border-l-4 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-500' : 'bg-rose-50 text-rose-900 border-rose-500'}`}>
                        {message.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                        <span className="font-bold">{message.text}</span>
                    </div>
                )}
            </div>

            {/* Preview Modal */}
            {previewResult && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setPreviewResult(null)}></div>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col relative z-10 animate-scale-up">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900">ตรวจสอบคิวข้อมูล (Queue Preview)</h2>
                                <p className="text-slate-500 text-sm mt-1">สรุปข้อมูลแยกตามไฟล์/วัน</p>
                            </div>
                            <button onClick={() => setPreviewResult(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X className="w-6 h-6" /></button>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                            {/* Summary by Batch */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {Object.entries(previewResult.byFile).map(([key, stats]: [string, { count: number, date: string }]) => (
                                    <div key={key} className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                                        <h4 className="font-bold text-indigo-900 mb-1">{stats.date} {key.split(' ')[1] || ''}</h4>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-indigo-700/70">จำนวนรายการ</span>
                                            <span className="text-2xl font-bold text-indigo-600">{stats.count}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Detailed Stats */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                                    <p className="text-xs font-bold text-emerald-700 uppercase">พร้อมข้อมูลใหม่</p>
                                    <p className="text-3xl font-bold text-emerald-900">{previewResult.newItems.length}</p>
                                </div>
                                <div className={`p-4 rounded-xl border ${previewResult.duplicates.length > 0 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                                    <p className={`text-xs font-bold uppercase ${previewResult.duplicates.length > 0 ? 'text-amber-700' : 'text-slate-500'}`}>ข้อมูลซ้ำ</p>
                                    <p className={`text-3xl font-bold ${previewResult.duplicates.length > 0 ? 'text-amber-900' : 'text-slate-700'}`}>{previewResult.duplicates.length}</p>
                                </div>
                            </div>

                            {/* Duplicates Logic */}
                            {previewResult.duplicates.length > 0 && (
                                <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                                    <h3 className="font-bold text-amber-800 mb-2 flex items-center gap-2"><Settings2 className="w-4 h-4" /> พบข้อมูลซ้ำ</h3>
                                    <div className="flex gap-4">
                                        <button onClick={() => setImportMode('skip')} className={`flex-1 py-2 rounded-lg border font-bold text-sm ${importMode === 'skip' ? 'bg-white border-amber-500 text-amber-700 shadow-sm' : 'border-transparent text-amber-600/60'}`}>ข้าม (Skip)</button>
                                        <button onClick={() => setImportMode('replace')} className={`flex-1 py-2 rounded-lg border font-bold text-sm ${importMode === 'replace' ? 'bg-white border-amber-500 text-amber-700 shadow-sm' : 'border-transparent text-amber-600/60'}`}>ทับ (Replace)</button>
                                    </div>
                                </div>
                            )}

                            {/* Items Preview */}
                            <div>
                                <h3 className="font-bold text-slate-800 mb-3">ตัวอย่างรายการ</h3>
                                <div className="border rounded-xl divide-y overflow-hidden max-h-[300px] overflow-y-auto custom-scrollbar">
                                    {previewResult.all.slice(0, 20).map((item, i) => (
                                        <div key={i} className="px-4 py-3 flex justify-between bg-white hover:bg-slate-50">
                                            <span className="font-mono font-bold text-indigo-600">{item.trackingNumber}</span>
                                            <span className="text-sm text-slate-600">{item.customerName}</span>
                                        </div>
                                    ))}
                                    {previewResult.all.length > 20 && <div className="px-4 py-3 text-center text-xs text-slate-400">...อีก {previewResult.all.length - 20} รายการ...</div>}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            <button onClick={() => setPreviewResult(null)} className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-white border border-transparent hover:border-slate-200 transition-all">ยกเลิก</button>
                            <button onClick={processQueue} disabled={isProcessing} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2">
                                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlayCircle className="w-5 h-5" />}
                                ยืนยันนำเข้าตามคิว (Start Queue)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ImportPage;
