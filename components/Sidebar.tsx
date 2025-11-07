import React, { useState, useMemo } from 'react';
import { Page, Permission } from '../types';
import { BarChart3, Pill, ShoppingCart, Truck, Landmark, Settings, ChevronLeft, ChevronRight, Dna, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';

interface SidebarProps {
  activePage: Page;
  setActivePage: (page: Page) => void;
}

interface NavItemConfig {
  id: Page;
  icon: React.ReactNode;
  text: string;
  permission: Permission;
}

const NavItem: React.FC<{ icon: React.ReactNode; text: string; active: boolean; onClick: () => void; collapsed: boolean }> = ({ icon, text, active, onClick, collapsed }) => {
  return (
    <li
      className={`
        relative flex items-center py-3 px-4 my-1
        font-medium rounded-md cursor-pointer
        transition-colors group
        ${active
          ? 'bg-blue-600 text-white shadow-lg'
          : 'hover:bg-gray-700 text-gray-300'
        }
      `}
      onClick={onClick}
    >
      {icon}
      <span className={`overflow-hidden transition-all ${collapsed ? 'w-0' : 'w-full mr-3'}`}>{text}</span>
      {!collapsed && (
        <div className={`
          absolute right-0 top-0 h-full w-1.5
          bg-blue-400 rounded-l-full
          transition-transform transform scale-y-0 group-hover:scale-y-100
          ${active ? 'scale-y-100' : ''}
        `}></div>
      )}
    </li>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { hasPermission } = useAuth();
  
  const settings = useLiveQuery(() => db.settings.toArray());
  const pharmacyInfo = useMemo(() => {
    if (!settings) return { name: 'شفا-یار', logo: null };
    const name = settings.find(s => s.key === 'pharmacyName')?.value as string || 'شفا-یار';
    const logo = settings.find(s => s.key === 'pharmacyLogo')?.value as string || null;
    return { name, logo };
  }, [settings]);


  const allNavItems: NavItemConfig[] = [
    { id: 'Dashboard', icon: <BarChart3 size={22} />, text: 'داشبورد', permission: 'page:dashboard' },
    { id: 'Inventory', icon: <Pill size={22} />, text: 'انبارداری', permission: 'page:inventory' },
    { id: 'Sales', icon: <ShoppingCart size={22} />, text: 'فروش (POS)', permission: 'page:sales' },
    { id: 'Purchases', icon: <Truck size={22} />, text: 'خریدها', permission: 'page:purchases' },
    { id: 'Accounting', icon: <Landmark size={22} />, text: 'حسابداری', permission: 'page:accounting' },
    { id: 'Reports', icon: <FileText size={22} />, text: 'گزارشات', permission: 'page:reports' },
    { id: 'Settings', icon: <Settings size={22} />, text: 'تنظیمات', permission: 'page:settings' },
  ];

  const visibleNavItems = useMemo(() => allNavItems.filter(item => hasPermission(item.permission)), [hasPermission]);

  return (
    <aside className={`relative bg-gray-800 text-gray-200 h-screen transition-all duration-300 ease-in-out ${collapsed ? 'w-20' : 'w-64'}`}>
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className={`flex items-center transition-opacity duration-200 ${collapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
          {pharmacyInfo.logo ? <img src={pharmacyInfo.logo} alt="Logo" className="h-8 w-auto object-contain" /> : <Dna size={28} className="text-blue-400" />}
          <h1 className="text-xl font-bold mr-2 whitespace-nowrap">{pharmacyInfo.name}</h1>
        </div>
         <div className={`flex items-center justify-center transition-all ${collapsed ? 'w-full' : ''}`}>
           <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
            {collapsed ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>
      </div>
      <nav className="flex-1 px-2 py-4">
        <ul>
          {visibleNavItems.map(item => (
            <NavItem
              key={item.id}
              icon={item.icon}
              text={item.text}
              active={activePage === item.id}
              onClick={() => setActivePage(item.id as Page)}
              collapsed={collapsed}
            />
          ))}
        </ul>
      </nav>
      <div className={`absolute bottom-0 left-0 w-full p-4 border-t border-gray-700 ${collapsed ? 'hidden' : 'block'}`}>
         <div className="text-xs text-center text-gray-500">
            <p>&copy; 2024 {pharmacyInfo.name}</p>
            <p>نسخه آنلاین</p>
         </div>
      </div>
    </aside>
  );
};

export default Sidebar;