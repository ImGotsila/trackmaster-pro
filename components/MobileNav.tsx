import React from 'react';
import { LayoutDashboard, Search, FileInput, Database, TrendingUp, Map, RotateCcw } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const MobileNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { path: '/', label: 'ภาพรวม', icon: LayoutDashboard },
    { path: '/summary', label: 'สรุป', icon: TrendingUp },
    { path: '/analytics', label: 'แผนที่', icon: Map },
    { path: '/search', label: 'ค้นหา', icon: Search },
    { path: '/import', label: 'นำเข้า', icon: FileInput },
    { path: '/rts', label: 'RTS', icon: RotateCcw },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 px-6 pb-safe pt-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <div className="flex justify-between items-center h-14">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center w-full space-y-1 transition-all duration-200 active:scale-95 ${isActive ? 'text-indigo-600' : 'text-slate-400'
                }`}
            >
              <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-indigo-50' : 'bg-transparent'}`}>
                <item.icon className={`w-6 h-6 ${isActive ? 'fill-indigo-600 text-indigo-600' : 'text-slate-400'}`} strokeWidth={isActive ? 0 : 2} />
              </div>
              <span className={`text-[10px] font-bold ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MobileNav;