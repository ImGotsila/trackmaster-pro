import React from 'react';
import { LayoutDashboard, Search, FileInput, Package, Database, TrendingUp, Map } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { path: '/', label: 'ภาพรวม (Dashboard)', icon: LayoutDashboard },
    { path: '/summary', label: 'สรุปข้อมูล (Summary)', icon: TrendingUp },
    { path: '/analytics', label: 'วิเคราะห์พื้นที่ (Map)', icon: Map },
    { path: '/search', label: 'ค้นหาพัสดุ (Search)', icon: Search },
    { path: '/import', label: 'นำเข้าข้อมูล (Import)', icon: FileInput },
    { path: '/management', label: 'จัดการข้อมูล (Data)', icon: Database },
  ];

  return (
    // Changed: Removed 'fixed' and z-index for desktop, added flex-none to work with App layout
    <div className="w-64 bg-white h-full border-r border-slate-200 flex-col z-20 hidden md:flex flex-none shadow-sm">
      <div className="p-6 flex items-center space-x-3 shrink-0">
        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-2.5 rounded-xl shadow-lg shadow-indigo-200">
          <Package className="w-6 h-6 text-white" />
        </div>
        <span className="text-xl font-bold text-slate-800 tracking-tight">TrackMaster</span>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto custom-scrollbar">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all duration-200 font-medium ${isActive
                ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
            >
              <item.icon className={`w-5 h-5 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-100 shrink-0">
        <div className="flex items-center space-x-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
          <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-indigo-700 font-bold text-sm shadow-sm">
            A
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-700">Admin User</span>
            <span className="text-xs text-slate-500">ผู้ดูแลระบบ</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;