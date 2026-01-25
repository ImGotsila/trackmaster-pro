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

  const filteredResults = useMemo(() => {
    return filteredShipments.filter(s => {
      const matchesSearch = searchTerm === '' ||
        s.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.phoneNumber.includes(searchTerm) ||
        (s.sequenceNumber && s.sequenceNumber.includes(searchTerm));
      return matchesSearch;
    });
  }, [filteredShipments, searchTerm]);

  // Sorting Logic
  const sortedShipments = useMemo(() => {
    let sortableItems = [...filteredResults];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof typeof a];
        let bValue: any = b[sortConfig.key as keyof typeof b];

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
  }, [filteredShipments, sortConfig]);

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
        <div className="p-4 md:p-6 border-b border-slate-100 bg-white space-y-4 md:space-y-6 shrink-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                {startDate && endDate ? (startDate === endDate ? formatDate(startDate) : `${formatDate(startDate)} - ${formatDate(endDate)}`) : 'สรุปข้อมูลทั้งหมด'}
                <button
                  onClick={() => refreshData && refreshData()}
                  className="text-slate-400 hover:text-indigo-600 transition-colors p-1 rounded-full hover:bg-indigo-50"
                  title="รีเฟรชข้อมูล"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100 uppercase tracking-tighter">
                  v1.5 - Factory Mode
                </span>
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={handleSync}
                  disabled={isSyncing}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${isSyncing
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100'
                    }`}
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'กำลังซิงค์...' : 'Sync Data'}
                </button>
                <button
                  onClick={handleBackup}
                  disabled={isBackingUp}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${isBackingUp
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100'
                    }`}
                >
                  <Save className="w-3 h-3" />
                  {isBackingUp ? 'กำลังสำรอง...' : 'Backup DB'}
                </button>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2 text-xs md:text-sm items-center">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-medium">รวม: <b className="text-slate-800">{stats.count}</b> ชิ้น</span>
                </div>
                <div className="h-4 w-px bg-slate-200 hidden md:block"></div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-medium">COD: <b className="text-emerald-600">{stats.totalCOD.toLocaleString()}</b> บ.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-medium">ค่าส่ง: <b className="text-rose-600">{stats.totalCost.toLocaleString()}</b> บ.</span>
                </div>
                <div className="h-4 w-px bg-slate-200 hidden md:block"></div>
                {/* Cost Analysis */}
                <div className="flex items-center gap-3 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
                  <span className="text-slate-500 font-medium">
                    กำไร (Est): <b className="text-indigo-600">{(stats.totalCOD - stats.totalCost - stats.totalFee).toLocaleString(undefined, { maximumFractionDigits: 0 })}</b> บ.
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${((stats.totalCost + stats.totalFee) / (stats.totalCOD || 1)) * 100 > 30
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-emerald-100 text-emerald-700'
                    }`}>
                    ต้นทุน {stats.totalCOD > 0 ? (((stats.totalCost + stats.totalFee) / stats.totalCOD) * 100).toFixed(1) : 0}%
                  </span>
                  {codFeePercent > 0 && <span className="text-[10px] font-bold text-slate-400 tracking-tight">(หักค่า COD {codFeePercent}%)</span>}
                </div>
              </div>
            </div>

            <div className="relative w-full md:w-80 group">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="text"
                placeholder="ค้นหา (ชื่อ, เบอร์, Tracking)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-x-auto overflow-y-auto bg-white custom-scrollbar relative">
          {/* Mobile Card View (Visible on small screens) */}
          <div className="md:hidden space-y-3 p-3">
            {paginatedShipments.map((item) => {
              const profit = (item.codAmount || 0) - (item.shippingCost || 0) - ((item.codAmount || 0) * (codFeePercent / 100));
              const costPercent = item.codAmount > 0 ? ((item.shippingCost || 0) / item.codAmount) * 100 : 0;

              return (
                <div key={item.id} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <a
                        href={getTrackingUrl(item.trackingNumber, item.courier)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-bold text-indigo-700 font-mono tracking-tight flex items-center gap-1"
                      >
                        {item.trackingNumber}
                        <ExternalLink className="w-3 h-3 opacity-50" />
                      </a>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">{item.customerName}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${item.status === 'รับฝาก'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : item.status === 'Delivered'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                      {item.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-50">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">COD Amount</p>
                      <p className="text-sm font-bold text-slate-800">{item.codAmount > 0 ? item.codAmount.toLocaleString() : '-'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Profit (Est.)</p>
                      <p className={`text-sm font-bold ${profit > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {profit > 0 ? profit.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleZipClick(item.zipCode);
                      }}
                      className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100"
                    >
                      {item.zipCode}
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm('คุณต้องการลบรายการนี้ใช่หรือไม่?')) {
                            deleteShipment(item.id);
                          }
                        }}
                        className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {paginatedShipments.length === 0 && (
              <div className="text-center py-10 text-slate-400">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p className="text-sm font-medium">ไม่พบข้อมูล</p>
              </div>
            )}
          </div>

          {/* Desktop Table View (Hidden on mobile) */}
          <div className="hidden md:block min-w-full">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-10 text-center">#</th>
                  <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-14 text-center">ลำดับ</th>
                  <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[130px]">Tracking</th>
                  <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[160px]">ชื่อลูกค้า</th>
                  <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[100px]">เบอร์โทร</th>
                  <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right min-w-[80px]">COD</th>
                  <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right min-w-[70px]">ค่าส่ง</th>
                  <th
                    className="px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right min-w-[80px] cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort('profit')}
                  >
                    Profit <span className="text-[10px] opacity-50 ml-1">⇅</span>
                  </th>
                  <th
                    className="px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center min-w-[80px] cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort('costPercent')}
                  >
                    % Cost <span className="text-[10px] opacity-50 ml-1">⇅</span>
                  </th>
                  <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[70px] text-center">ปณ.</th>
                  <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center min-w-[90px]">สถานะ</th>
                  <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedShipments.map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-3 py-3 text-xs font-medium text-slate-400 text-center">
                      {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {item.sequenceNumber ? (
                        <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {item.sequenceNumber}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
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
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-slate-700 truncate max-w-[180px]" title={item.customerName}>
                      {item.customerName}
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-block px-2 py-0.5 bg-slate-100 rounded text-sm font-bold text-slate-700 font-mono tracking-wide">
                        {item.phoneNumber}
                      </span>
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
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${((item.shippingCost || 0) / item.codAmount) * 100 > 30
                          ? 'bg-rose-100 text-rose-700 border border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          }`}>
                          {((item.shippingCost || 0) / item.codAmount * 100).toFixed(1)}%
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
                        className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded text-sm font-bold font-mono hover:bg-indigo-100 hover:scale-105 transition-all cursor-pointer"
                        title="คลิกเพื่อดูรายละเอียดพื้นที่"
                      >
                        {item.zipCode}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] md:text-xs font-bold border ${item.status === 'รับฝาก'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : item.status === 'Delivered'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                        {item.status}
                      </span>
                    </td>
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
                    <td colSpan={10} className="px-6 py-20 text-center">
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