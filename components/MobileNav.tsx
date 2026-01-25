import React, { useState } from 'react';
import { LayoutDashboard, Search, FileInput, Package, Database, TrendingUp, Map, DollarSign, BarChart3, Shield, LogOut, ShieldAlert, X, Menu, User, ChevronRight } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isDemoMode } from '../utils/environment';
import { MENU_ITEMS } from './Sidebar';

const MobileNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const bottomBarItems = [
    { path: '/', label: 'ภาพรวม', icon: LayoutDashboard },
    { path: '/rts', label: 'Scan', icon: Search },
    { path: null, label: 'เมนู', icon: Menu, onClick: () => setIsOpen(true) },
  ];

  const handleNavigate = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  return (
    <>
      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] bg-slate-900/90 backdrop-blur-lg border border-white/10 z-50 px-6 py-3 rounded-2xl shadow-2xl ring-1 ring-white/10">
        <div className="flex justify-between items-center h-12">
          {bottomBarItems.map((item, idx) => {
            const isActive = item.path ? location.pathname === item.path : false;
            return (
              <button
                key={idx}
                onClick={item.onClick || (() => handleNavigate(item.path!))}
                className={`flex flex-col items-center justify-center space-y-1 transition-all duration-200 active:scale-90 ${isActive ? 'text-indigo-400' : 'text-slate-400'
                  }`}
              >
                <item.icon className={`w-6 h-6 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} strokeWidth={isActive ? 2.5 : 2} />
                <span className={`text-[10px] font-bold ${isActive ? 'text-indigo-400' : 'text-slate-400'}`}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] transition-opacity duration-300 md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsOpen(false)} />

      <div className={`fixed inset-y-0 right-0 w-[85%] max-w-sm bg-white z-[101] shadow-2xl transition-transform duration-300 transform md:hidden ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-full flex flex-col">
          <div className="p-6 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center space-x-3">
              <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-100">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black text-slate-800 tracking-tight">TrackMaster</span>
                <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full border border-indigo-100 uppercase tracking-tighter w-fit -mt-1">
                  v1.5 - Factory Mode
                </span>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
            <div className="space-y-1">
              <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Main Tools</p>
              {MENU_ITEMS.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNavigate(item.path)}
                    className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-600 active:bg-slate-50'}`}
                  >
                    <div className="flex items-center space-x-3">
                      <item.icon className="w-5 h-5" />
                      <span className="text-sm font-bold">{item.label}</span>
                    </div>
                    <ChevronRight className={`w-4 h-4 opacity-50 ${isActive ? 'hidden' : 'block'}`} />
                  </button>
                );
              })}
            </div>

            {(isAdmin || isDemoMode()) && (
              <div className="space-y-1">
                <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Administrator</p>
                <button
                  onClick={() => handleNavigate('/admin')}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all ${location.pathname === '/admin' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-600 active:bg-slate-50'}`}
                >
                  <div className="flex items-center space-x-3">
                    <Shield className="w-5 h-5" />
                    <span className="text-sm font-bold">หลังบ้าน (Admin)</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </button>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-black">
                  {user?.username?.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{user?.username}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{user?.role}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                title="Log Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MobileNav;