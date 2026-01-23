import React, { useState, useRef, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { UploadCloud, FileText, ArrowRight, AlertCircle, CheckCircle2, Info, FileUp, X, Settings2, Eye, AlertTriangle, Package, ChevronDown, ChevronUp } from 'lucide-react';
import { Courier, Shipment } from '../types';
import { useNavigate } from 'react-router-dom';
import { read, utils } from 'xlsx';

const ImportPage: React.FC = () => {
    const { shipments, importShipments } = useData(); // Get existing shipments to check for duplicates
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [courier, setCourier] = useState<Courier>('Thailand Post - EMS');
    const [inputText, setInputText] = useState('');

    // Store shipments parsed directly from files
    const [fileShipments, setFileShipments] = useState<Shipment[]>([]);

    const [importMode, setImportMode] = useState<'skip' | 'replace'>('skip');

    const [isProcessing, setIsProcessing] = useState(false);
    const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

    // Preview State
    const [previewResult, setPreviewResult] = useState<{
        all: Shipment[];
        newItems: Shipment[];
        duplicates: Shipment[];
    } | null>(null);

    const cleanString = (str: string) => str ? str.trim().replace(/^"/, '').replace(/"$/, '') : '';

    // Logic to calculate preview stats (New vs Duplicate)
    const calculatePreviewStats = (itemsToCheck: Shipment[]) => {
        // Deduplicate: Last one wins if duplicate tracking in this batch
        const parsedMap = new Map<string, Shipment>();
        itemsToCheck.forEach(item => parsedMap.set(item.trackingNumber, item));

        const parsedShipments = Array.from(parsedMap.values());

        if (parsedShipments.length === 0) {
            throw new Error("ไม่พบข้อมูลที่ถูกต้อง กรุณาตรวจสอบรูปแบบไฟล์");
        }

        // Check for duplicates in existing data
        const existingTrackings = new Set(shipments.map(s => s.trackingNumber));
        const duplicates = parsedShipments.filter(s => existingTrackings.has(s.trackingNumber));
        const newItems = parsedShipments.filter(s => !existingTrackings.has(s.trackingNumber));

        return {
            all: parsedShipments,
            newItems,
            duplicates
        };
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsProcessing(true); // Show loading state immediately

        const newFileShipments: Shipment[] = [];
        let processedCount = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            let fileDate = date; // Default to global date

            // Extract Date from Filename
            // Pattern: DD-MM-YYYY (e.g. 18-01-2569)
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

            // Extract Time from Filename
            // Pattern: HH-mm, HH.mm, HHmm (looking for time-like patterns often after date or separate)
            // We search for patterns like `_14-30` or ` 14.30` or `1430` (if length is 4 and plausible)
            let fileTime = '00:00';
            const timeMatch = file.name.match(/(?:_|\s)(\d{1,2})[-.:](\d{2})(?:_|\s|\.)/);
            if (timeMatch) {
                const h = parseInt(timeMatch[1]);
                const m = parseInt(timeMatch[2]);
                if (h >= 0 && h < 24 && m >= 0 && m < 60) {
                    fileTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                }
            }

            // Process File
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
                newFileShipments.push(...items);
                processedCount++;

            } catch (error) {
                console.error(`Failed to process file ${file.name}`, error);
            }
        }

        // Update State
        setFileShipments(prev => [...prev, ...newFileShipments]);

        // Auto-Trigger Preview
        if (processedCount > 0) {
            try {
                // Combine: Manual Input + Existing Files + New Files
                let allItems: Shipment[] = [];

                if (inputText.trim()) {
                    allItems.push(...processRawText(inputText, date, courier, '00:00'));
                }

                allItems.push(...fileShipments); // Existing
                allItems.push(...newFileShipments); // New

                const result = calculatePreviewStats(allItems);

                setPreviewResult(result);

                // Also set message for feedback (behind modal)
                setMessage({
                    type: 'success',
                    text: `โหลด ${processedCount} ไฟล์เรียบร้อย (${newFileShipments.length} รายการ: ใหม่ ${result.newItems.length}, เก่า/ซ้ำ ${result.duplicates.length})`
                });

            } catch (err: any) {
                setMessage({ type: 'error', text: err.message || "เกิดข้อผิดพลาดในการประมวลผล" });
            }
        }

        setIsProcessing(false);
        e.target.value = '';
    };

    // Helper to extract sequence and clean name
    const parseNameField = (rawName: string) => {
        let sequence = '';
        let name = rawName.trim();

        // Extract Sequence: "718. John" -> seq: 718, name: John
        const seqMatch = name.match(/^(\d+)[\.\s]+(.*)/);
        if (seqMatch) {
            sequence = seqMatch[1];
            name = seqMatch[2];
        }

        // Clean FB prefixes: "FB. John", "fb John", "F.B.John"
        name = name.replace(/^(fb|f\.b\.|f\.b|facebook)[\.\s]*/i, '');

        return { sequence, name: name.trim() };
    };

    const parseRowSmart = (parts: string[]): Partial<Shipment> | null => {
        // 1. Find Tracking Number Index
        const trackingIdx = parts.findIndex(p => /^[A-Z0-9]{9,16}$/i.test(p) && (p.endsWith('TH') || p.startsWith('JN') || p.startsWith('SP') || p.length > 10));
        if (trackingIdx === -1) return null;

        // 2. Find Phone Index
        const phoneIdx = parts.findIndex((p, idx) => idx > trackingIdx && /^[\d\-\s]{9,12}$/.test(p) && (p.startsWith('0') || p.startsWith('6') || p.startsWith('8') || p.startsWith('9')));
        if (phoneIdx === -1) return null;

        // 3. Find Zip Index
        const zipIdx = parts.findIndex((p, idx) => idx > trackingIdx && /^\d{5}$/.test(p));

        const shipment: Partial<Shipment> = {};
        shipment.trackingNumber = parts[trackingIdx];

        // Phone Processing
        let rawPhone = parts[phoneIdx].replace(/[^0-9]/g, '');
        if (rawPhone.length === 9) rawPhone = '0' + rawPhone;
        shipment.phoneNumber = rawPhone;

        // Zip Processing
        if (zipIdx !== -1) {
            shipment.zipCode = parts[zipIdx];
        } else {
            const possibleZip = parts[phoneIdx + 1];
            if (possibleZip && /^\d{5}$/.test(possibleZip)) shipment.zipCode = possibleZip;
        }

        // Name Processing
        if (phoneIdx > 0) {
            // Heuristic: Check if phoneIdx-2 is a sequence number (e.g. "250" or "250.")
            // and phoneIdx-1 is the name.
            let rawNameField = parts[phoneIdx - 1];
            let sequence = '';
            let name = '';

            // 1. Try key field (Name column) first
            // 1. Name Field Processing
            const parsedCheck = parseNameField(rawNameField);
            if (parsedCheck.sequence) {
                sequence = parsedCheck.sequence;
                name = parsedCheck.name;
            } else {
                name = parsedCheck.name;
            }

            // 2. Previous Column Processing (Sequence in col OR COD)
            if (phoneIdx > 1) {
                const prevCol = parts[phoneIdx - 2];

                // Check for Strict Sequence (e.g. "250.")
                const seqOnlyMatch = prevCol.match(/^(\d+)[\.]+$/);

                if (seqOnlyMatch) {
                    // Only accept as sequence if we don't have one yet
                    if (!sequence) {
                        sequence = seqOnlyMatch[1];
                    }
                } else if (/^[\d,\.]+$/.test(prevCol)) {
                    // Number but NO dot -> Likely COD
                    // We trust this as COD if it's not a sequence format
                    shipment.codAmount = parseFloat(prevCol.replace(/,/g, '')) || 0;
                }
            }

            // Final clean
            name = name.replace(/^(fb|f\.b\.|f\.b|facebook)[\.\s]*/i, '').trim();

            // Fallback: Re-check if name field itself has sequence (double check)
            if (!sequence) {
                const parsed = parseNameField(rawNameField);
                sequence = parsed.sequence;
                name = parsed.name;
            }

            shipment.customerName = name || 'ไม่ระบุชื่อ';
            if (sequence) shipment.sequenceNumber = sequence;
        }

        // Cost Processing
        if (zipIdx !== -1 && zipIdx + 1 < parts.length) {
            const rawCost = parts[zipIdx + 1];
            if (/^[\d,\.]+$/.test(rawCost)) {
                shipment.shippingCost = parseFloat(rawCost.replace(/,/g, '')) || 0;
            }
        } else if (parts[parts.length - 2] && /^[\d,\.]+$/.test(parts[parts.length - 2])) {
            shipment.shippingCost = parseFloat(parts[parts.length - 2].replace(/,/g, '')) || 0;
        }

        // Status / Date Processing
        const lastCol = parts[parts.length - 1];
        if (lastCol && (lastCol.includes('รับฝาก') || lastCol.includes('Deliver') || lastCol.length < 20)) {
            shipment.status = lastCol as any;
        } else {
            shipment.status = 'รับฝาก';
        }

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
        const randomOffset = Math.floor(Math.random() * 10000); // Avoid ID collision

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

    const handlePreview = () => {
        setIsProcessing(true);
        setMessage(null);

        setTimeout(() => {
            try {
                // 1. Process Manual Input
                let allNewItems: Shipment[] = [];

                if (inputText.trim()) {
                    const manualItems = processRawText(inputText, date, courier, '00:00');
                    allNewItems = [...allNewItems, ...manualItems];
                }

                // 2. Add File Items
                if (fileShipments.length > 0) {
                    allNewItems = [...allNewItems, ...fileShipments];
                }

                if (allNewItems.length === 0) {
                    throw new Error("กรุณากรอกข้อมูลหรืออัปโหลดไฟล์");
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

    const handleConfirmImport = () => {
        if (!previewResult) return;
        setIsProcessing(true);

        setTimeout(() => {
            const result = importShipments(previewResult.all, importMode);

            setMessage({
                type: 'success',
                text: `นำเข้าข้อมูลสำเร็จ: เพิ่มใหม่ ${result.added}, อัปเดต ${result.updated}, ข้าม ${result.skipped}`
            });
            setInputText('');
            setFileShipments([]); // Clear file shipments
            setPreviewResult(null);
            setIsProcessing(false);

            setTimeout(() => navigate('/'), 1500);
        }, 500);
    };

    // Grouping logic for visualization
    const groupedPreviewData = useMemo(() => {
        if (!previewResult) return [];

        // Group by Name + Phone
        const groups: Record<string, { name: string, phone: string, items: Shipment[] }> = {};

        previewResult.all.forEach(item => {
            const key = `${item.customerName}|${item.phoneNumber}`;
            if (!groups[key]) {
                groups[key] = {
                    name: item.customerName,
                    phone: item.phoneNumber,
                    items: []
                };
            }
            groups[key].items.push(item);
        });

        return Object.values(groups);
    }, [previewResult]);

    return (
        <>
            <div className="max-w-6xl mx-auto space-y-4 md:space-y-6 animate-fade-in pb-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-2 md:px-0">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">นำเข้าพัสดุ (Import)</h1>
                        <p className="text-slate-600 mt-1 font-medium text-sm md:text-base">จัดการข้อมูลนำเข้า กรองข้อมูลซ้ำ และจัดรูปแบบอัตโนมัติ</p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
                    {/* Settings Header */}
                    <div className="bg-slate-50 border-b border-slate-200 p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-800 block">วันที่นำเข้า</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-900 font-medium"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-800 block">ผู้ให้บริการขนส่ง</label>
                            <select
                                value={courier}
                                onChange={(e) => setCourier(e.target.value as Courier)}
                                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-900 font-medium"
                            >
                                <option>Thailand Post - EMS</option>
                                <option>Kerry Express</option>
                                <option>J&T Express</option>
                                <option>Flash Express</option>
                            </select>
                        </div>
                    </div>

                    {/* Input Area */}
                    <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-indigo-600" />
                                    <span className="hidden md:inline">วางข้อมูล (Excel/CSV)</span>
                                    <span className="md:hidden">วางข้อมูล</span>
                                </label>

                                <button
                                    onClick={() => setInputText('')}
                                    className="text-xs font-medium text-slate-400 hover:text-rose-500 flex items-center gap-1"
                                >
                                    <X className="w-3 h-3" /> ล้างข้อมูล
                                </button>
                            </div>

                            <div className="relative group">
                                <textarea
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    placeholder="ตัวอย่าง: 718. สุขสันต์ 0653937810..."
                                    className="w-full h-[50vh] md:h-[350px] p-4 md:p-5 bg-slate-50 border-2 border-slate-300 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-xs md:text-sm font-mono text-slate-900 resize-none transition-all placeholder:text-slate-400 leading-relaxed shadow-inner"
                                />

                                {!inputText && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="text-center p-6 rounded-xl bg-white/50 backdrop-blur-sm border border-slate-200 shadow-sm w-[80%] md:w-auto">
                                            <p className="text-slate-400 text-sm mb-2">วางข้อมูล หรือ</p>
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="pointer-events-auto px-4 py-2 bg-white border border-indigo-200 text-indigo-600 rounded-lg text-sm font-bold hover:bg-indigo-50 transition-colors shadow-sm flex items-center gap-2 mx-auto"
                                            >
                                                <FileUp className="w-4 h-4" />
                                                เลือกไฟล์ Excel/CSV
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept=".csv,.txt,.xls,.xlsx"
                                multiple
                                className="hidden"
                            />                  </div>

                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            accept=".csv,.txt,.xls,.xlsx"
                            multiple
                            className="hidden"
                        />

                        <div className="flex items-start gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-900 text-sm">
                            <Info className="w-5 h-5 shrink-0 mt-0.5 text-indigo-600" />
                            <div className="space-y-1">
                                <p className="font-bold">ฟีเจอร์จัดการข้อมูลอัตโนมัติ:</p>
                                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 list-disc list-inside opacity-90 text-xs md:text-sm font-medium">
                                    <li>ค้นหา Tracking, เบอร์, รหัสไปรษณีย์</li>
                                    <li>แยก <b>ลำดับ</b> หน้าชื่อเก็บแยก (เช่น 718. ชื่อ...)</li>
                                    <li>ตัดคำนำหน้า <b>fb., FB</b> ออกจากชื่ออัตโนมัติ</li>
                                    <li>กรอง <b>ข้อมูลซ้ำ</b> ก่อนนำเข้า (ซ้ำได้ถ้า Tracking คนละเลข)</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row justify-end gap-3 md:gap-4 pt-4 border-t border-slate-100">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full sm:w-auto px-6 py-3 md:py-4 bg-white border-2 border-slate-200 rounded-xl text-slate-600 font-bold hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 order-2 sm:order-1"
                        >
                            <UploadCloud className="w-5 h-5" />
                            <span>โหลดไฟล์</span>
                        </button>

                        <button
                            onClick={handlePreview}
                            disabled={isProcessing}
                            className={`w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 md:py-4 rounded-xl text-white font-bold text-lg transition-all shadow-xl shadow-indigo-200 order-1 sm:order-2 ${isProcessing
                                ? 'bg-indigo-400 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98]'
                                }`}
                        >
                            {isProcessing ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    <span>กำลังประมวลผล...</span>
                                </>
                            ) : (
                                <>
                                    <span>ตรวจสอบข้อมูล</span>
                                    <Eye className="w-6 h-6" />
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Feedback Area */}
                {message && (
                    <div className={`mx-4 md:mx-8 mb-8 p-4 rounded-xl flex items-center gap-3 animate-slide-up border-l-4 ${message.type === 'success'
                        ? 'bg-emerald-50 text-emerald-900 border-l-emerald-500 border border-emerald-100'
                        : 'bg-rose-50 text-rose-900 border-l-rose-500 border border-rose-100'
                        }`}>
                        {message.type === 'success' ? <CheckCircle2 className="w-6 h-6 shrink-0 text-emerald-600" /> : <AlertCircle className="w-6 h-6 shrink-0 text-rose-600" />}
                        <span className="font-bold text-sm md:text-base">{message.text}</span>
                    </div>
                )}
            </div>

            {/* Preview Modal */}
            {
                previewResult && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setPreviewResult(null)}></div>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] md:max-h-[90vh] flex flex-col relative z-10 animate-scale-up">

                            {/* Header */}
                            <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                                <div>
                                    <h2 className="text-lg md:text-2xl font-bold text-slate-900">ตรวจสอบข้อมูล (Preview)</h2>
                                    <p className="text-slate-500 text-xs md:text-sm mt-1">
                                        พบข้อมูลทั้งหมด <b className="text-indigo-600">{previewResult.all.length}</b> รายการ
                                        (จัดกลุ่มลูกค้า <b className="text-slate-700">{groupedPreviewData.length}</b> ราย)
                                    </p>
                                </div>
                                <button onClick={() => setPreviewResult(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Scrollable Content */}
                            <div className="p-4 md:p-6 overflow-y-auto custom-scrollbar space-y-4 md:space-y-6">

                                {/* Stats Cards */}
                                <div className="grid grid-cols-2 gap-3 md:gap-4">
                                    <div className="p-3 md:p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-2 md:gap-3">
                                        <div className="w-8 h-8 md:w-10 md:h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 shrink-0">
                                            <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] md:text-xs font-bold text-emerald-700 uppercase">ข้อมูลใหม่ (New)</p>
                                            <p className="text-lg md:text-2xl font-bold text-emerald-900">{previewResult.newItems.length}</p>
                                        </div>
                                    </div>

                                    <div className={`p-3 md:p-4 rounded-xl border flex items-center gap-2 md:gap-3 ${previewResult.duplicates.length > 0 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                                        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0 ${previewResult.duplicates.length > 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-400'}`}>
                                            <AlertTriangle className="w-4 h-4 md:w-5 md:h-5" />
                                        </div>
                                        <div>
                                            <p className={`text-[10px] md:text-xs font-bold uppercase ${previewResult.duplicates.length > 0 ? 'text-amber-700' : 'text-slate-500'}`}>ข้อมูลซ้ำ (Duplicate)</p>
                                            <p className={`text-lg md:text-2xl font-bold ${previewResult.duplicates.length > 0 ? 'text-amber-900' : 'text-slate-700'}`}>{previewResult.duplicates.length}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Duplicates Action */}
                                {previewResult.duplicates.length > 0 && (
                                    <div className="p-4 md:p-5 bg-white border-2 border-amber-100 rounded-xl shadow-sm">
                                        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-sm md:text-base">
                                            <Settings2 className="w-4 h-4 text-amber-500" />
                                            พบข้อมูลซ้ำ (Tracking เดิม) ต้องการจัดการอย่างไร?
                                        </h3>
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <button
                                                onClick={() => setImportMode('skip')}
                                                className={`flex-1 py-3 px-4 rounded-lg border-2 font-bold text-sm transition-all flex items-center justify-center gap-2 ${importMode === 'skip' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                            >
                                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${importMode === 'skip' ? 'border-indigo-600' : 'border-slate-300'}`}>
                                                    {importMode === 'skip' && <div className="w-2 h-2 rounded-full bg-indigo-600"></div>}
                                                </div>
                                                ข้ามข้อมูลซ้ำ (Skip)
                                            </button>
                                            <button
                                                onClick={() => setImportMode('replace')}
                                                className={`flex-1 py-3 px-4 rounded-lg border-2 font-bold text-sm transition-all flex items-center justify-center gap-2 ${importMode === 'replace' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                            >
                                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${importMode === 'replace' ? 'border-rose-500' : 'border-slate-300'}`}>
                                                    {importMode === 'replace' && <div className="w-2 h-2 rounded-full bg-rose-500"></div>}
                                                </div>
                                                เขียนทับข้อมูลเดิม (Replace)
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Grouped Preview List */}
                                <div>
                                    <h3 className="font-bold text-slate-800 mb-3 text-xs md:text-sm uppercase tracking-wider">ตัวอย่างข้อมูล (รวมกลุ่มตามรายชื่อ)</h3>
                                    <div className="space-y-3">
                                        {groupedPreviewData.slice(0, 50).map((group, gIdx) => (
                                            <div key={gIdx} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
                                                {/* Group Header */}
                                                <div className="bg-slate-50 px-4 py-3 flex items-center justify-between border-b border-slate-100">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                                                            <Package className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-slate-800 text-sm">{group.name}</h4>
                                                            <p className="text-xs text-slate-500 font-mono">{group.phone}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-xs font-bold px-2 py-1 bg-white border border-slate-200 rounded-md text-slate-600">
                                                        {group.items.length} ชิ้น
                                                    </div>
                                                </div>

                                                {/* Items List */}
                                                <div className="divide-y divide-slate-50">
                                                    {group.items.map((item, idx) => (
                                                        <div key={idx} className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50/50">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className="w-8 text-center text-xs text-slate-400 font-mono shrink-0">
                                                                    {item.sequenceNumber ? `#${item.sequenceNumber}` : '-'}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="font-mono text-sm font-bold text-indigo-600 truncate">{item.trackingNumber}</p>
                                                                </div>
                                                            </div>
                                                            <div className="text-right pl-4">
                                                                {item.codAmount > 0 ? (
                                                                    <span className="text-sm font-bold text-emerald-600 whitespace-nowrap">฿{item.codAmount.toLocaleString()}</span>
                                                                ) : (
                                                                    <span className="text-xs text-slate-400 font-medium">ชำระแล้ว</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {groupedPreviewData.length > 50 && (
                                        <p className="text-center text-xs text-slate-400 mt-4">...และอีก {groupedPreviewData.length - 50} รายการ...</p>
                                    )}
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="p-4 md:p-6 border-t border-slate-100 bg-slate-50 flex flex-col md:flex-row justify-end gap-3 shrink-0">
                                <button
                                    onClick={() => setPreviewResult(null)}
                                    className="order-2 md:order-1 w-full md:w-auto px-6 py-3 bg-white border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={handleConfirmImport}
                                    disabled={isProcessing}
                                    className="order-1 md:order-2 w-full md:w-auto px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                                >
                                    {isProcessing ? 'กำลังบันทึก...' : 'ยืนยันการนำเข้า'}
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

        </>
    );
};

export default ImportPage;
