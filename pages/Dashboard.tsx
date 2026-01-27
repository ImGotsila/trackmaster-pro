import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useSettings } from '../context/SettingsContext';
import { Calendar, RefreshCw, Search, Package, ExternalLink, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Trash2, Database, Save } from 'lucide-react';
import AddressDetailModal from '../components/AddressDetailModal';
import Pagination from '../components/Pagination';
import { getApiUrl } from '../utils/environment';

const ITEMS_PER_PAGE = 50;

const Dashboard: React.FC = () => {
  const { filteredShipments, isLoading, deleteShipment, refreshData, startDate, endDate } = useData();
  const { settings } = useSettings();
  const codFeePercent = settings.cod_fee || 0;
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await fetch(getApiUrl('/api/sync/sheets'), { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      alert(`Sync Complete: Processed ${data.processed}, Errors: ${data.errors}`);
      if (refreshData) refreshData();
    } catch (err: any) {
      alert('Sync Error: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleBackup = async () => {
    if (isBackingUp) return;
    setIsBackingUp(true);
    try {
      const res = await fetch(getApiUrl('/api/backup'), { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Backup failed');
      alert('Backup Successful!');
    } catch (err: any) {
      alert('Backup Error: ' + err.message);
    } finally {
      setIsBackingUp(false);
    }
  };

  // Address Lookup State
  const [selectedZipCode, setSelectedZipCode] = useState<string>('');
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  const handleZipClick = (zip: string) => {
    if (!zip) return;
    setSelectedZipCode(zip);
    setIsAddressModalOpen(true);
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [startDate, endDate, searchTerm]);

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cod' | 'transfer'>('all');

  const filteredResults = useMemo(() => {
    return filteredShipments.filter(s => {
      // 1. Search Filter
      const matchesSearch = searchTerm === '' ||
        s.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.phoneNumber.includes(searchTerm) ||
        (s.sequenceNumber && s.sequenceNumber.includes(searchTerm));

      if (!matchesSearch) return false;

      // 2. Payment Filter
      if (paymentFilter === 'cod') return (s.codAmount || 0) > 0;
      if (paymentFilter === 'transfer') return (s.codAmount || 0) === 0;

      return true;
    });
  }, [filteredShipments, searchTerm, paymentFilter]);

  // Sorting Logic
  const sortedShipments = useMemo(() => {
    let sortableItems = [...filteredResults];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof typeof a];
        let bValue: any = b[sortConfig.key as keyof typeof b];

        // Specific handling for nulls/undefined to ensure standard behavior
        if (sortConfig.key === 'weight' || sortConfig.key === 'codAmount' || sortConfig.key === 'shippingCost') {
          aValue = aValue || 0;
          bValue = bValue || 0;
        }

        // Custom Sort Keys (Computed)
        if (sortConfig.key === 'profit') {
          const aFee = (a.codAmount || 0) * (codFeePercent / 100);
          const bFee = (b.codAmount || 0) * (codFeePercent / 100);
          aValue = (a.codAmount || 0) - (a.shippingCost || 0) - aFee;
          bValue = (b.codAmount || 0) - (b.shippingCost || 0) - bFee;
        }
        if (sortConfig.key === 'costPercent') {
          aValue = a.codAmount > 0 ? ((a.shippingCost || 0) / a.codAmount) * 100 : 0;
          bValue = b.codAmount > 0 ? ((b.shippingCost || 0) / b.codAmount) * 100 : 0;
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredResults, sortConfig, codFeePercent]);

  // Pagination Logic
  const totalPages = Math.ceil(sortedShipments.length / ITEMS_PER_PAGE);
  const paginatedShipments = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedShipments.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedShipments, currentPage]);

  const stats = useMemo(() => {
    return filteredResults.reduce((acc, curr) => {
      const codFee = (curr.codAmount || 0) * (codFeePercent / 100);
      return {
        count: acc.count + 1,
        totalCOD: acc.totalCOD + (curr.codAmount || 0),
        totalCost: acc.totalCost + (curr.shippingCost || 0),
        totalFee: acc.totalFee + codFee
      };
    }, { count: 0, totalCOD: 0, totalCost: 0, totalFee: 0 });
  }, [filteredResults, codFeePercent]);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('th-TH', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: '2-digit'
      }).format(date);
    } catch (e) {
      return dateStr;
    }
  };

  const getTrackingUrl = (tracking: string, courier: string) => {
    if (courier.includes('Kerry')) return `https://th.kerryexpress.com/th/track/?track=${tracking}`;
    if (courier.includes('J&T')) return `https://www.jtexpress.co.th/service/track?billcode=${tracking}`;
    if (courier.includes('Flash')) return `https://www.flashexpress.co.th/tracking/?se=${tracking}`;
    // Default to Thailand Post
    return `https://track.thailandpost.co.th/?trackNumber=${tracking}`;
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 w-full">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-100 border-t-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Detailed View */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

        {/* Dashboard Header */}
        <div className="p-3 md:p-6 border-b border-slate-100 bg-white space-y-3 md:space-y-6 shrink-0">
          <div className="flex flex-col gap-3">
            {/* Top Row: Title & Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg md:text-2xl font-bold text-slate-900 tracking-tight flex flex-wrap items-center gap-2">
                  {startDate && endDate ? (startDate === endDate ? formatDate(startDate) : `${formatDate(startDate)} - ${formatDate(endDate)}`) : 'สรุปข้อมูลทั้งหมด'}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => refreshData && refreshData()}
                      className="text-slate-400 hover:text-indigo-600 transition-colors p-1 rounded-full hover:bg-indigo-50"
                      title="รีเฟรชข้อมูล"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100 uppercase tracking-tighter">
                      v1.5
                    </span>
                  </div>
                </h2>

                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={handleSync}
                    disabled={isSyncing}
                    className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${isSyncing
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100'
                      }`}
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing...' : 'Sync Data'}
                  </button>
                  <button
                    onClick={handleBackup}
                    disabled={isBackingUp}
                    className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${isBackingUp
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100'
                      }`}
                  >
                    <Save className="w-3 h-3" />
                    {isBackingUp ? 'Backing up...' : 'Backup DB'}
                  </button>
                </div>
              </div>
            </div>

            {/* Stats Grid (Mobile Optimized) */}
            <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 md:gap-3">
              <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-slate-200 rounded-full shrink-0"><Package className="w-3 h-3 text-slate-600" /></div>
                  <span className="text-xs text-slate-500 font-bold">รวม:</span>
                </div>
                <b className="text-slate-800 text-sm md:ml-auto">{stats.count} ชิ้น</b>
              </div>

              <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-emerald-200 rounded-full shrink-0"><Save className="w-3 h-3 text-emerald-700" /></div>
                  <span className="text-xs text-emerald-700 font-bold">COD:</span>
                </div>
                <b className="text-sm text-emerald-900 md:ml-auto">{stats.totalCOD.toLocaleString()}</b>
              </div>

              <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-rose-200 rounded-full shrink-0"><Package className="w-3 h-3 text-rose-700" /></div>
                  <span className="text-xs text-rose-700 font-bold">ค่าส่ง:</span>
                </div>
                <b className="text-sm text-rose-900 md:ml-auto">{stats.totalCost.toLocaleString()}</b>
              </div>

              <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 bg-indigo-50 border border-indigo-100 px-3 py-2 rounded-lg shadow-sm relative overflow-hidden">
                <div className="flex items-center gap-2 relative z-10">
                  <div className="p-1 bg-indigo-200 rounded-full shrink-0"><Database className="w-3 h-3 text-indigo-700" /></div>
                  <span className="text-xs text-indigo-600 font-bold">กำไร:</span>
                </div>
                <b className="text-sm text-indigo-900 relative z-10 md:ml-auto">{(stats.totalCOD - stats.totalCost - stats.totalFee).toLocaleString(undefined, { maximumFractionDigits: 0 })}</b>

                {/* % Cost Badge - Absolute on Mobile */}
                <div className={`absolute top-0 right-0 bottom-0 w-1.5 md:w-auto md:static md:ml-2 md:px-1.5 md:py-0.5 md:rounded md:text-[10px] md:font-black md:border ${((stats.totalCost + stats.totalFee) / (stats.totalCOD || 1)) * 100 > 30 ? 'bg-rose-500 md:bg-rose-100 md:text-rose-600 md:border-rose-200' : 'bg-emerald-500 md:bg-emerald-100 md:text-emerald-600 md:border-emerald-200'}`}>
                  <span className="hidden md:inline">{stats.totalCOD > 0 ? (((stats.totalCost + stats.totalFee) / stats.totalCOD) * 100).toFixed(1) : 0}% Cost</span>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-2 md:items-center ml-auto w-full">
              <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
                <button
                  onClick={() => setPaymentFilter('all')}
                  className={`flex-1 md:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-center ${paymentFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  ทั้งหมด
                </button>
                <button
                  onClick={() => setPaymentFilter('cod')}
                  className={`flex-1 md:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-center ${paymentFilter === 'cod' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-emerald-600'}`}
                >
                  COD
                </button>
                <button
                  onClick={() => setPaymentFilter('transfer')}
                  className={`flex-1 md:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-center ${paymentFilter === 'transfer' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-indigo-600'}`}
                >
                  โอน
                </button>
              </div>

              <div className="relative w-full md:w-64 group">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  type="text"
                  placeholder="ค้นหา..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-x-auto overflow-y-auto bg-white custom-scrollbar relative">


          {/* Table View (Scrollable on mobile) */}
          <div className="min-w-full">
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-10 text-center">#</th>
                  <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[180px] cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('trackingNumber')}>
                    Tracking / Status <span className="opacity-50 ml-1">⇅</span>
                  </th>
                  {/* <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[100px]">Pay Tag</th> */}
                  {/* <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[100px]">Service</th> */}
                  <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[160px] cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('customerName')}>
                    ชื่อลูกค้า / Service <span className="opacity-50 ml-1">⇅</span>
                  </th>
                  <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right min-w-[70px] cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('weight')}>
                    นน. <span className="opacity-50 ml-1">⇅</span>
                  </th>
                  <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right min-w-[80px] cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('codAmount')}>
                    COD <span className="opacity-50 ml-1">⇅</span>
                  </th>
                  <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right min-w-[70px] cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('shippingCost')}>
                    ค่าส่ง <span className="opacity-50 ml-1">⇅</span>
                  </th>
                  <th
                    className="px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right min-w-[80px] cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort('profit')}
                  >
                    Profit <span className="text-[10px] opacity-50 ml-1">⇅</span>
                  </th>
                  <th
                    className="px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center min-w-[60px] cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort('costPercent')}
                  >
                    % <span className="text-[10px] opacity-50 ml-1">⇅</span>
                  </th>
                  <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[60px] text-center">ปณ.</th>
                  {/* <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center min-w-[90px]">สถานะ</th> */}
                  <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedShipments.map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-3 py-3 text-xs font-medium text-slate-400 text-center">
                      {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${item.status === 'รับฝาก'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : item.status === 'Delivered'
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                            {item.status}
                          </span>
                          {item.payTag && (
                            <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1 rounded border border-slate-200" title="Pay Tag">
                              {item.payTag}
                            </span>
                          )}
                        </div>
                        <a
                          href={getTrackingUrl(item.trackingNumber, item.courier)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs md:text-sm font-bold text-indigo-700 font-mono tracking-tight whitespace-nowrap hover:text-indigo-900 hover:underline cursor-pointer"
                          title={`ตรวจสอบสถานะ ${item.trackingNumber}`}
                        >
                          {item.trackingNumber}
                          <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </a>
                        {item.sequenceNumber && <span className="text-[10px] text-slate-400 font-mono">Ref: {item.sequenceNumber}</span>}
                      </div>
                    </td>
                    {/* Removed Pay Tag Column */}
                    {/* Removed Service Column */}
                    <td className="px-3 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-700 truncate max-w-[180px]" title={item.customerName}>{item.customerName}</span>
                        <span className="text-sm text-indigo-700 font-bold font-mono my-0.5">{item.phoneNumber}</span>
                        {item.serviceType && (
                          <span className="text-[9px] text-slate-400 truncate max-w-[150px] italic" title={item.serviceType}>
                            {item.serviceType}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs md:text-sm font-medium text-slate-600 text-right">
                      {item.weight ? item.weight.toFixed(2) : '-'}
                    </td>
                    <td className="px-3 py-3 text-xs md:text-sm font-bold text-right">
                      {item.codAmount > 0 ? (
                        <span className="text-emerald-600">{item.codAmount.toLocaleString()}</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs md:text-sm font-medium text-slate-600 text-right">{item.shippingCost}</td>
                    <td className="px-3 py-3 text-xs md:text-sm font-bold text-right bg-indigo-50/20">
                      <span className={(item.codAmount - item.shippingCost - ((item.codAmount || 0) * (codFeePercent / 100))) > 0 ? 'text-indigo-700' : 'text-slate-400'}>
                        {(item.codAmount - item.shippingCost - ((item.codAmount || 0) * (codFeePercent / 100))) > 0 ?
                          (item.codAmount - item.shippingCost - ((item.codAmount || 0) * (codFeePercent / 100))).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {item.codAmount > 0 ? (
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${((item.shippingCost || 0) / item.codAmount) * 100 > 30
                          ? 'bg-rose-100 text-rose-700 border border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          }`}>
                          {((item.shippingCost || 0) / item.codAmount * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleZipClick(item.zipCode);
                        }}
                        className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded text-xs font-bold font-mono hover:bg-indigo-100 hover:scale-105 transition-all cursor-pointer"
                        title="คลิกเพื่อดูรายละเอียดพื้นที่"
                      >
                        {item.zipCode}
                      </button>
                    </td>
                    {/* Removed Status Column */}
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm('คุณต้องการลบรายการนี้ใช่หรือไม่?')) {
                            deleteShipment(item.id);
                          }
                        }}
                        className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded transition-all opacity-0 group-hover:opacity-100"
                        title="ลบรายการ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredShipments.length === 0 && (
                  <tr>
                    <td colSpan={13} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <Package className="w-16 h-16 mb-4 opacity-10" />
                        <p className="text-base font-semibold">ไม่พบข้อมูลในวันที่เลือก</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>

        {/* Pagination Footer */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredResults.length}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      </div>

      <AddressDetailModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        zipCode={selectedZipCode}
      />
    </div>
  );
};

export default Dashboard;