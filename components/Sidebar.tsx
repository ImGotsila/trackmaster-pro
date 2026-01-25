import { LayoutDashboard, Search, FileInput, Package, Database, TrendingUp, Map, DollarSign, BarChart3, Shield, LogOut, RotateCcw, ShieldAlert, LucideIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { isDemoMode } from '../utils/environment';

export interface MenuItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

export const MENU_ITEMS: MenuItem[] = [
  { path: '/', label: 'ภาพรวม (Dashboard)', icon: LayoutDashboard },
  { path: '/summary', label: 'สรุปข้อมูล (Summary)', icon: TrendingUp },
  { path: '/visual-stats', label: 'วิเคราะห์เชิงภาพ (Charts)', icon: BarChart3 },
  { path: '/analytics', label: 'วิเคราะห์พื้นที่ (Map)', icon: Map },
  { path: '/cost-analytics', label: 'วิเคราะห์ค่าส่ง (Cost)', icon: DollarSign },
  { path: '/products', label: 'จัดการสินค้า (Products)', icon: Package },
  { path: '/rts', label: 'ค้นหาพัสดุ (Search & Scan)', icon: Search },
  { path: '/claims', label: 'จัดการเคส (Claims)', icon: ShieldAlert },
  { path: '/import', label: 'นำเข้าข้อมูล (Import)', icon: FileInput },
  { path: '/management', label: 'จัดการข้อมูล (Data)', icon: Database },
];

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, user, logout } = useAuth();

  return (
    <div className="w-64 bg-white h-full border-r border-slate-200 flex flex-col z-20 hidden md:flex flex-none shadow-sm">
      <div className="p-6 flex flex-col gap-1 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-2.5 rounded-xl shadow-lg shadow-indigo-200">
            <Package className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-slate-800 tracking-tight">TrackMaster</span>
        </div>
        <div className="flex items-center gap-2 mt-2 ml-1">
          <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100 uppercase tracking-tighter">
            v1.5 - Factory Mode
          </span>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto custom-scrollbar">
        {MENU_ITEMS.map((item) => {
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

        {(isAdmin || isDemoMode()) && (
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