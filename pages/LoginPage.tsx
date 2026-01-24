import * as React from 'react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, User, AlertCircle } from 'lucide-react';

const LoginPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            await login(username, password);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 p-8 border border-slate-100 space-y-8 animate-fade-in">
                    {/* Logo/Brand */}
                    <div className="text-center space-y-2">
                        <div className="mx-auto w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                            <Shield className="w-8 h-8" />
                        </div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tighter">TrackMaster Pro</h1>
                        <p className="text-slate-400 font-medium">เข้าสู่ระบบจัดการการจัดส่ง</p>
                    </div>

                    {window.location.hostname.includes('github.io') && (
                        <div className="bg-indigo-50 text-indigo-700 p-4 rounded-xl text-xs font-bold border border-indigo-100 mb-4">
                            <Info className="w-4 h-4 inline mr-2" />
                            ระบบ Demo (GitHub Pages): ใช้ User `guest` และรหัสผ่านอะไรก็ได้ครับ
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">

                        {error && (
                            <div className="bg-rose-50 text-rose-600 p-4 rounded-xl text-sm font-bold flex items-center gap-3 border border-rose-100">
                                <AlertCircle className="w-5 h-5 shrink-0" />
                                {error}
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Username</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                                <input
                                    type="text"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
                                    placeholder="ผู้ใช้งาน"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
                                    placeholder="รหัสผ่าน"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-lg hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            ) : (
                                'เข้าสู่ระบบ'
                            )}
                        </button>
                    </form>

                    <div className="pt-4 text-center">
                        <p className="text-xs text-slate-400 font-medium">© 2026 Advanced Agentic Coding Team</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
