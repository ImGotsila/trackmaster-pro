import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, Edit2, Trash2, X, Check, FileDown, Cuboid } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Product {
    id: string;
    sku: string;
    name: string;
    type: string;
    size_code: string;
    width_cm: number;
    height_cm: number;
    width_inch: number;
    height_inch: number;
    conditions: string;
    updated_at: number;
}

const ProductManagementPage: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { isAdmin } = useAuth(); // Assuming only admin can manage products? kept flexible for now.

    const [formData, setFormData] = useState<Partial<Product>>({
        sku: '', name: '', type: 'Floating Frame', size_code: 'A1',
        width_cm: 0, height_cm: 0, width_inch: 0, height_inch: 0, conditions: ''
    });

    const [editingId, setEditingId] = useState<string | null>(null);

    const productTypes = [
        'Floating Frame (Die-cut)',
        'Floating Frame (Premium)',
        'Floating Frame (Vinyl)',
        'Canvas Frame',
        'Louis Frame',
        'Polaroid',
        'Poster Paper',
        'Sticker',
        'Other'
    ];

    const sizeStandards: Record<string, { w_cm: number, h_cm: number, w_in: number, h_in: number }> = {
        'A0': { w_cm: 84.1, h_cm: 118.9, w_in: 33.1, h_in: 46.8 },
        'A1': { w_cm: 59.4, h_cm: 84.1, w_in: 23.4, h_in: 33.1 },
        'A2': { w_cm: 42.0, h_cm: 59.4, w_in: 16.5, h_in: 23.4 },
        'A3': { w_cm: 29.7, h_cm: 42.0, w_in: 11.7, h_in: 16.5 },
        'A4': { w_cm: 21.0, h_cm: 29.7, w_in: 8.3, h_in: 11.7 },
        'Custom': { w_cm: 0, h_cm: 0, w_in: 0, h_in: 0 }
    };

    const fetchProducts = async () => {
        try {
            const res = await fetch('/api/products');
            const data = await res.json();
            if (Array.isArray(data)) setProducts(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    const handleOpenModal = (product?: Product) => {
        if (product) {
            setEditingId(product.id);
            setFormData(product);
        } else {
            setEditingId(null);
            setFormData({
                sku: '', name: '', type: 'Floating Frame (Die-cut)', size_code: 'A1',
                width_cm: 59.4, height_cm: 84.1, width_inch: 23.4, height_inch: 33.1, conditions: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleSizeChange = (code: string) => {
        const std = sizeStandards[code];
        if (std) {
            setFormData(prev => ({
                ...prev,
                size_code: code,
                width_cm: std.w_cm,
                height_cm: std.h_cm,
                width_inch: std.w_in,
                height_inch: std.h_in
            }));
        } else {
            setFormData(prev => ({ ...prev, size_code: code }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const url = editingId ? `/api/products/${editingId}` : '/api/products';
            const method = editingId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!res.ok) throw new Error('Failed to save');

            await fetchProducts();
            setIsModalOpen(false);
        } catch (err) {
            alert('Error saving product: ' + err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('ยืนยันการลบสินค้า?')) return;
        try {
            await fetch(`/api/products/${id}`, { method: 'DELETE' });
            fetchProducts();
        } catch (err) {
            alert('Error deleting');
        }
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Package className="w-8 h-8 text-indigo-600" />
                        จัดการสินค้า (Products)
                    </h1>
                    <p className="text-sm text-slate-500">จัดการข้อมูลกรอบรูป ขนาด และเงื่อนไขสินค้า</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200"
                >
                    <Plus className="w-5 h-5" />
                    เพิ่มสินค้าใหม่
                </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="ค้นหาชื่อ, SKU, หรือประเภท..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <div className="px-4 py-2 bg-slate-100 rounded-xl font-bold text-slate-600">
                    {filteredProducts.length} รายการ
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm uppercase">
                                <th className="p-4 font-bold">SKU</th>
                                <th className="p-4 font-bold">ชื่อสินค้า</th>
                                <th className="p-4 font-bold">ประเภท</th>
                                <th className="p-4 font-bold">ขนาด</th>
                                <th className="p-4 font-bold">มิติ (cm / inch)</th>
                                <th className="p-4 font-bold">เงื่อนไข</th>
                                <th className="p-4 font-bold text-right">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr><td colSpan={7} className="p-8 text-center text-slate-400">Loading...</td></tr>
                            ) : filteredProducts.length === 0 ? (
                                <tr><td colSpan={7} className="p-8 text-center text-slate-400">ไม่พบข้อมูลสินค้า</td></tr>
                            ) : (
                                filteredProducts.map(product => (
                                    <tr key={product.id} className="hover:bg-slate-50 transition">
                                        <td className="p-4 font-mono font-bold text-indigo-600">{product.sku}</td>
                                        <td className="p-4 font-bold text-slate-800">{product.name}</td>
                                        <td className="p-4">
                                            <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold border border-slate-200">
                                                {product.type}
                                            </span>
                                        </td>
                                        <td className="p-4 font-bold text-emerald-600">{product.size_code}</td>
                                        <td className="p-4 text-sm text-slate-500">
                                            <div>{product.width_cm} x {product.height_cm} cm</div>
                                            <div className="text-xs text-slate-400">{product.width_inch}" x {product.height_inch}"</div>
                                        </td>
                                        <td className="p-4 text-sm text-slate-500 truncate max-w-xs">{product.conditions || '-'}</td>
                                        <td className="p-4 text-right space-x-2">
                                            <button
                                                onClick={() => handleOpenModal(product)}
                                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(product.id)}
                                                className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden grid grid-cols-1 gap-4">
                {isLoading ? (
                    <div className="text-center p-8 text-slate-400">Loading...</div>
                ) : filteredProducts.length === 0 ? (
                    <div className="text-center p-8 text-slate-400">ไม่พบข้อมูลสินค้า</div>
                ) : (
                    filteredProducts.map(product => (
                        <div key={product.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">{product.sku}</span>
                                    <h3 className="font-bold text-slate-800 text-lg mt-1">{product.name}</h3>
                                    <p className="text-xs text-slate-500">{product.type}</p>
                                </div>
                                <div className="text-right">
                                    <span className="block text-2xl font-black text-slate-200">{product.size_code}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-sm bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Dimensions (cm)</p>
                                    <p className="font-mono font-bold text-slate-700">{product.width_cm} x {product.height_cm}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Dimensions (in)</p>
                                    <p className="font-mono font-bold text-slate-700">{product.width_inch}" x {product.height_inch}"</p>
                                </div>
                            </div>

                            {product.conditions && (
                                <div className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg mb-4 border border-amber-100">
                                    <span className="font-bold">เงื่อนไข:</span> {product.conditions}
                                </div>
                            )}

                            <div className="flex gap-2 pt-2 border-t border-slate-100">
                                <button
                                    onClick={() => handleOpenModal(product)}
                                    className="flex-1 py-2.5 rounded-xl font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 flex items-center justify-center gap-2 transition"
                                >
                                    <Edit2 className="w-4 h-4" /> แก้ไข
                                </button>
                                <button
                                    onClick={() => handleDelete(product.id)}
                                    className="px-4 py-2.5 rounded-xl font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 flex items-center justify-center gap-2 transition"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-in">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Cuboid className="w-6 h-6 text-indigo-500" />
                                {editingId ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-rose-500 transition">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">รหัส SKU *</label>
                                    <input required type="text" value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="FRAME-A1-001" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">ชื่อสินค้า *</label>
                                    <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="กรอบขอบลอย..." />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">ประเภทสินค้า</label>
                                    <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                                        {productTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">ขนาดมาตรฐาน</label>
                                    <select value={formData.size_code} onChange={e => handleSizeChange(e.target.value)}
                                        className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                                        {Object.keys(sizeStandards).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                    <FileDown className="w-4 h-4" /> ขนาดมิติ (Dimensions)
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div><label className="text-xs text-slate-500">กว้าง (cm)</label><input type="number" step="0.1" value={formData.width_cm} onChange={e => setFormData({ ...formData, width_cm: parseFloat(e.target.value) })} className="w-full p-2 border rounded-lg" /></div>
                                    <div><label className="text-xs text-slate-500">สูง (cm)</label><input type="number" step="0.1" value={formData.height_cm} onChange={e => setFormData({ ...formData, height_cm: parseFloat(e.target.value) })} className="w-full p-2 border rounded-lg" /></div>
                                    <div><label className="text-xs text-slate-500">กว้าง (inch)</label><input type="number" step="0.1" value={formData.width_inch} onChange={e => setFormData({ ...formData, width_inch: parseFloat(e.target.value) })} className="w-full p-2 border rounded-lg" /></div>
                                    <div><label className="text-xs text-slate-500">สูง (inch)</label><input type="number" step="0.1" value={formData.height_inch} onChange={e => setFormData({ ...formData, height_inch: parseFloat(e.target.value) })} className="w-full p-2 border rounded-lg" /></div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700">เงื่อนไข / หมายเหตุ</label>
                                <textarea rows={2} value={formData.conditions} onChange={e => setFormData({ ...formData, conditions: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none" placeholder="เช่น ห้ามโดนนำ้, ต้องวางแนวตั้งเท่านั้น..." />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition">
                                    ยกเลิก
                                </button>
                                <button type="submit" disabled={isSubmitting} className="px-6 py-2 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 flex items-center gap-2">
                                    {isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    บันทึกข้อมูล
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductManagementPage;
