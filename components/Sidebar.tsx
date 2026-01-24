import React from 'react';
import { LayoutDashboard, Search, FileInput, Package, Database, TrendingUp, Map, DollarSign, BarChart3, Shield, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, user, logout } = useAuth();

  const menuItems = [
    { path: '/', label: 'ภาพรวม (Dashboard)', icon: LayoutDashboard },
    { path: '/summary', label: 'สรุปข้อมูล (Summary)', icon: TrendingUp },
    { path: '/visual-stats', label: 'วิเคราะห์เชิงภาพ (Charts)', icon: BarChart3 },
    { path: '/analytics', label: 'วิเคราะห์พื้นที่ (Map)', icon: Map },
    { path: '/cost-analytics', label: 'วิเคราะห์ค่าส่ง (Cost)', icon: DollarSign },
    { path: '/search', label: 'ค้นหาพัสดุ (Search)', icon: Search },
    { path: '/import', label: 'นำเข้าข้อมูล (Import)', icon: FileInput },
    { path: '/management', label: 'จัดการข้อมูล (Data)', icon: Database },
  ];

  return (
    <div className="w-64 bg-white h-full border-r border-slate-200 flex flex-col z-20 hidden md:flex flex-none shadow-sm">
      <div className="p-6 flex items-center space-x-3 shrink-0">
        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-2.5 rounded-xl shadow-lg shadow-indigo-200">
          <Package className="w-6 h-6 text-white" />
        </div>
        <span className="text-xl font-bold text-slate-800 tracking-tight">TrackMaster</span>
      </div>

      <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto custom-scrollbar">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 font-bold text-sm ${isActive
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'
                }`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          );
        })}

        {isAdmin && (
          <>
            <div className="pt-6 pb-2 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Administrator</div>
            <button
              onClick={() => navigate('/admin')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 font-bold text-sm ${location.pathname === '/admin'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                : 'text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'
                }`}
            >
              <Shield className="w-5 h-5" />
              <span>หลังบ้าน (Admin)</span>
            </button>
          </>
        )}
      </nav>

      <div className="p-4 border-t border-slate-100 shrink-0 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-indigo-700 font-black text-sm shadow-sm shrink-0">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-700 truncate">{user?.username}</p>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-tight">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
            title="ออกจากระบบ"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;