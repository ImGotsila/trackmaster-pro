import * as React from 'react';
import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { Settings as SettingsIcon, Users, Database, Shield, Save, UserPlus, Trash2, Key, Info } from 'lucide-react';

const AdminSettingsPage: React.FC = () => {
    const { settings, updateSetting } = useSettings();
    const { isAdmin } = useAuth();
    const [activeTab, setActiveTab] = useState<'general' | 'users'>('general');

    // States for Settings
    const [codFee, setCodFee] = useState(settings.cod_fee.toString());
    const [avgTransferValue, setAvgTransferValue] = useState(settings.avg_transfer_value?.toString() || '0');
    const [isSaving, setIsSaving] = useState(false);

    // States for User Management
    const [users, setUsers] = useState<any[]>([]);
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState<'admin' | 'user'>('user');

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/users');
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (isAdmin) fetchUsers();
        setCodFee(settings.cod_fee.toString());
        setAvgTransferValue(settings.avg_transfer_value?.toString() || '0');
    }, [isAdmin, settings.cod_fee, settings.avg_transfer_value]);

    const handleSaveSettings = async () => {
        setIsSaving(true);
        try {
            await updateSetting('cod_fee', parseFloat(codFee));
            await updateSetting('avg_transfer_value', parseFloat(avgTransferValue));
            alert('บันทึกการตั้งค่าเรียบร้อยแล้ว');
        } catch (e) { alert('เกิดข้อผิดพลาด'); }
        finally { setIsSaving(false); }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole }),
            });
            if (res.ok) {
                setNewUsername('');
                setNewPassword('');
                fetchUsers();
                alert('สร้างผู้ใช้สำเร็จ');
            }
        } catch (e) { alert('เกิดข้อผิดพลาด'); }
    };

    const handleDeleteUser = async (id: string) => {
        if (id === 'admin-init') return alert('ไม่สามารถลบผู้ใช้เริ่มต้นได้');
        if (!window.confirm('ยืนยันระบบการลบผู้ใช้?')) return;
        try {
            const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
            if (res.ok) fetchUsers();
        } catch (e) { console.error(e); }
    };

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-96 space-y-4">
                <Shield className="w-16 h-16 text-rose-500 opacity-20" />
                <h2 className="text-xl font-bold text-slate-800">ขออภัย คุณไม่มีสิทธิ์เข้าถึงหน้านี้</h2>
                <p className="text-slate-500">กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์การเข้าใช้งาน</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center space-x-3 pb-2 border-b border-slate-200">
                <Shield className="w-8 h-8 text-indigo-600" />
                <h1 className="text-2xl font-bold text-slate-800">ระบบหลังบ้าน (Admin Settings)</h1>
            </div>

            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('general')}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'general' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <SettingsIcon className="w-4 h-4 inline mr-2" />
                    ตั้งค่าทั่วไป
                </button>
                <button
                    onClick={() => setActiveTab('users')}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'users' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Users className="w-4 h-4 inline mr-2" />
                    จัดการผู้ใช้
                </button>
            </div>

            {activeTab === 'general' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="p-2 bg-indigo-50 rounded-lg"><SettingsIcon className="w-5 h-5 text-indigo-600" /></div>
                            <h3 className="font-bold text-slate-800">การหักค่าบริการ (Transaction Fees)</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-600">ค่าธรรมเนียม COD (%)</label>
                                <div className="flex gap-3">
                                    <input
                                        type="number"
                                        value={codFee}
                                        onChange={(e) => setCodFee(e.target.value)}
                                        className="flex-1 px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="3"
                                    />
                                </div>
                                <p className="text-xs text-slate-400">ค่าเริ่มต้นคือ 3% ซึ่งจะถูกนำไปคำนวณกำไรสุทธิในทุกหน้าของระบบ</p>
                            </div>

                            <div className="space-y-2 pt-2 border-t border-slate-100">
                                <label className="text-sm font-bold text-slate-600">มูลค่าเฉลี่ยออร์เดอร์โอน (Estimated Value)</label>
                                <div className="flex gap-3">
                                    <input
                                        type="number"
                                        value={avgTransferValue}
                                        onChange={(e) => setAvgTransferValue(e.target.value)}
                                        className="flex-1 px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="500"
                                    />
                                </div>
                                <p className="text-xs text-slate-400">ระบุยอดขายเฉลี่ยต่อออร์เดอร์ (สำหรับรายการโอน/ส่งฟรี) เพื่อให้ระบบคำนวณกำไรได้แม่นยำขึ้น</p>
                            </div>

                            <button
                                onClick={handleSaveSettings}
                                disabled={isSaving}
                                className="w-full mt-4 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                            >
                                <Save className="w-4 h-4" />
                                {isSaving ? 'บันทึกการตั้งค่า' : 'บันทึกการตั้งค่า'}
                            </button>
                        </div>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col justify-center">
                        <div className="flex items-center gap-3 text-amber-600 bg-amber-50 p-4 rounded-xl border border-amber-100">
                            <Info className="w-6 h-6 shrink-0" />
                            <div className="text-sm">
                                <p className="font-bold">ข้อมูลการคำนวณกำไร (Formula)</p>
                                <p className="mt-1 pb-1 border-b border-amber-200/50">กำไร COD = ยอด COD - ค่าส่ง - (ยอด COD &times; {settings.cod_fee}%)</p>
                                <p className="mt-1">กำไรโอน = ((ยอดโอน + ส่งฟรี) &times; ฿{settings.avg_transfer_value || 0}) - ต้นทุนสินค้าโอน</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'users' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <UserPlus className="w-5 h-5 text-indigo-600" />
                            เพิ่มผู้ใช้งานใหม่
                        </h3>
                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Username</label>
                                <input
                                    required
                                    value={newUsername}
                                    onChange={(e) => setNewUsername(e.target.value)}
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Password</label>
                                <input
                                    required
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Role</label>
                                <select
                                    value={newRole}
                                    onChange={(e) => setNewRole(e.target.value as any)}
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-700"
                                >
                                    <option value="user">User (ดูข้อมูลทั่วไป)</option>
                                    <option value="admin">Admin (จัดการระบบ)</option>
                                </select>
                            </div>
                            <button className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all mt-4">
                                สร้างผู้ใช้งาน
                            </button>
                        </form>
                    </div>

                    <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b border-slate-100 font-bold text-slate-700">รายการผู้ใช้งาน</div>
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-3">Username</th>
                                    <th className="px-6 py-3">Role</th>
                                    <th className="px-6 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {users.map(u => (
                                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-700">{u.username}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${u.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleDeleteUser(u.id)}
                                                className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminSettingsPage;
