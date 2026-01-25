import * as React from 'react';
import { useState, useRef } from 'react';
import { X, Camera, AlertTriangle, Upload, PackageX, Truck, ShieldAlert, CheckCircle2, ArrowRight } from 'lucide-react';
import { Shipment } from '../types';
import { useData } from '../context/DataContext';

interface ReportIssueModalProps {
    isOpen: boolean;
    onClose: () => void;
    shipment: Shipment;
    onSuccess?: () => void;
}

const REPORT_TYPES = [
    { id: 'checked', label: 'สมบูรณ์ (PASS)', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    { id: 'rts', label: 'ตีกลับ (RTS)', icon: Truck, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
    { id: 'damaged', label: 'เสียหาย (FAIL)', icon: PackageX, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
    { id: 'claim', label: 'แจ้งเคลม', icon: ShieldAlert, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
];

const ReportIssueModal: React.FC<ReportIssueModalProps> = ({ isOpen, onClose, shipment, onSuccess }) => {
    const { addRTSReport } = useData();
    const [selectedType, setSelectedType] = useState('checked');
    const [productCode, setProductCode] = useState('');
    const [notes, setNotes] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [products, setProducts] = useState<any[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (isOpen) {
            fetch('/api/products')
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) setProducts(data);
                })
                .catch(err => console.error(err));
        }
    }, [isOpen]);

    const handleProductChange = (sku: string) => {
        setProductCode(sku);
        const prod = products.find(p => p.sku === sku);
        setSelectedProduct(prod || null);
    };

    React.useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
            setSelectedProduct(null);
            setProductCode('');
            setNotes('');
            setFile(null);
            setSelectedType('checked');
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen) return null;

    const compressImage = (file: File): Promise<File | Blob> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1200;
                    const scale = Math.min(1, MAX_WIDTH / img.width);
                    canvas.width = img.width * scale;
                    canvas.height = img.height * scale;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                    canvas.toBlob((blob) => {
                        resolve(blob || file);
                    }, 'image/jpeg', 0.7); // 70% quality
                };
            };
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const compressed = await compressImage(e.target.files[0]);
            // Convert blob back to file if needed for consistency
            const newFile = new File([compressed], e.target.files[0].name, { type: 'image/jpeg' });
            setFile(newFile);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const typeLabel = REPORT_TYPES.find(t => t.id === selectedType)?.label || 'รายงาน';
            await addRTSReport({
                trackingNumber: shipment.trackingNumber,
                status: selectedType === 'checked' ? 'Closed' : 'Open',
                customerName: shipment.customerName,
                actionType: typeLabel,
                productCode: productCode || 'Unknown',
                notes: notes,
                photo: file || undefined,
                reportedBy: 'Factory_Staff',
                newTrackingNumber: ''
            });
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            alert("บันทึกไม่สำเร็จ");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={onClose}></div>

            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl relative z-10 flex flex-col max-h-[95vh] animate-scale-up overflow-hidden border border-white/20">

                {/* Header: Compact & Professional */}
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                            <Truck className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-800 text-xl tracking-tight">Factory Reporting</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{shipment.trackingNumber}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-2xl text-slate-400 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content: Factory Workflow Optimized */}
                <div className="overflow-y-auto flex-1 p-8 custom-scrollbar space-y-8">

                    {/* 1. Item Identification */}
                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 block">1. ระบุสินค้า (Product SKU)</label>
                        <select
                            className="w-full px-6 py-4 rounded-2xl border-2 border-slate-200 focus:border-indigo-500 outline-none font-black text-slate-700 bg-white shadow-sm transition-all"
                            value={productCode}
                            onChange={(e) => handleProductChange(e.target.value)}
                        >
                            <option value="">-- แตะเพื่อเลือกสินค้า --</option>
                            {products.map(p => (
                                <option key={p.id} value={p.sku}>{p.sku} | {p.name}</option>
                            ))}
                        </select>

                        {/* Visual Spec Card: The heart of the factory flow */}
                        {selectedProduct && (
                            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                                <div className="bg-white p-5 rounded-2xl border-2 border-indigo-100 shadow-sm flex flex-col items-center justify-center text-center">
                                    <span className="text-[10px] font-black text-indigo-400 uppercase mb-1">Paper Size</span>
                                    <p className="text-4xl font-black text-indigo-600 leading-none">{selectedProduct.size_code}</p>
                                    <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase">{selectedProduct.type}</p>
                                </div>
                                <div className="bg-white p-5 rounded-2xl border-2 border-emerald-100 shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-2 opacity-10">
                                        <ArrowRight className="w-8 h-8 rotate-45" />
                                    </div>
                                    <div className="space-y-4 relative z-10">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-black text-slate-400 uppercase">Width</span>
                                            <p className="font-mono font-black text-slate-800 text-lg">{selectedProduct.width_cm} <span className="text-[10px] text-slate-400 uppercase">cm</span></p>
                                        </div>
                                        <div className="flex justify-between items-center border-t border-slate-50 pt-3">
                                            <span className="text-[10px] font-black text-slate-400 uppercase">Height</span>
                                            <p className="font-mono font-black text-slate-800 text-lg">{selectedProduct.height_cm} <span className="text-[10px] text-slate-400 uppercase">cm</span></p>
                                        </div>
                                    </div>
                                </div>
                                {selectedProduct.conditions && (
                                    <div className="md:col-span-2 bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-3">
                                        <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
                                        <p className="text-xs font-bold text-amber-700 italic leading-relaxed">{selectedProduct.conditions}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 2. Status Selection: Large Tappable Grid */}
                    <div className="space-y-4">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">2. ตรวจสอบสถานะ (Status Check)</label>
                        <div className="grid grid-cols-2 gap-4">
                            {REPORT_TYPES.map(type => (
                                <button
                                    key={type.id}
                                    type="button"
                                    onClick={() => setSelectedType(type.id)}
                                    className={`p-5 rounded-[1.5rem] border-2 flex flex-col items-center gap-3 transition-all active:scale-95 ${selectedType === type.id
                                        ? `${type.border} ${type.bg} shadow-md`
                                        : 'border-slate-100 hover:border-slate-300'}`}
                                >
                                    <type.icon className={`w-8 h-8 ${selectedType === type.id ? type.color : 'text-slate-300'}`} />
                                    <span className={`text-xs font-black ${selectedType === type.id ? type.color : 'text-slate-400'}`}>{type.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 3. Evidence Collection */}
                    <div className="space-y-4">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">3. บันทึกภาพ & หมายเหตุ (Evidence)</label>
                        <div className="flex flex-col md:flex-row gap-4">
                            <div
                                className="flex-1 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-6 flex flex-col items-center justify-center gap-2 hover:bg-slate-100 transition-all cursor-pointer group"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {file ? (
                                    <div className="relative w-full h-32">
                                        <img src={URL.createObjectURL(file)} alt="Preview" className="w-full h-full object-cover rounded-xl" />
                                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                                            <Camera className="w-8 h-8 text-white" />
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-slate-300">
                                            <Camera className="w-6 h-6" />
                                        </div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter text-center">แตะเพื่อบันทึกภาพ</span>
                                    </>
                                )}
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />
                            </div>
                            <textarea
                                className="flex-1 px-6 py-4 rounded-3xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none text-sm font-bold text-slate-700 min-h-[120px] transition-all"
                                placeholder="หมายเหตุโรงงานเพิ่มเติม (ถ้ามี)..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Keyboard Spacer */}
                    <div className="h-4 md:h-0"></div>
                </div>

                {/* Footer: Dominant Action Button */}
                <div className="p-8 border-t border-slate-100 bg-white shrink-0">
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="w-full py-6 rounded-[1.5rem] font-black text-lg text-white bg-slate-900 hover:bg-black shadow-2xl shadow-slate-200 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                        {isSubmitting ? (
                            <span className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <Upload className="w-6 h-6" />
                                ยืนยันการรายงานสินค้า
                            </>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default ReportIssueModal;
