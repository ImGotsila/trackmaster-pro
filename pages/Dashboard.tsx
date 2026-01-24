import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Calendar, RefreshCw, Search, Package, ExternalLink, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Trash2 } from 'lucide-react';
import AddressDetailModal from '../components/AddressDetailModal';

const ITEMS_PER_PAGE = 50;

const Dashboard: React.FC = () => {
  const { shipments, isLoading, deleteShipment } = useData();
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Address Lookup State
  const [selectedZipCode, setSelectedZipCode] = useState<string>('');
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  const handleZipClick = (zip: string) => {
    if (!zip) return;
    setSelectedZipCode(zip);
    setIsAddressModalOpen(true);
  };

  // Get unique dates
  const uniqueDates = useMemo(() => {
    const dates = Array.from(new Set(shipments.map(s => s.importDate)));
    return dates.sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime());
  }, [shipments]);

  // Set initial selected date
  useEffect(() => {
    if (uniqueDates.length > 0 && !selectedDate) {
      setSelectedDate(uniqueDates[0]);
    }
  }, [uniqueDates, selectedDate]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate, searchTerm]);

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredShipments = useMemo(() => {
    return shipments.filter(s => {
      const matchesDate = s.importDate === selectedDate;
      const matchesSearch = searchTerm === '' ||
        s.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.phoneNumber.includes(searchTerm) ||
        (s.sequenceNumber && s.sequenceNumber.includes(searchTerm));
      return matchesDate && matchesSearch;
    });
  }, [shipments, selectedDate, searchTerm]);

  // Sorting Logic
  const sortedShipments = useMemo(() => {
    let sortableItems = [...filteredShipments];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof typeof a];
        let bValue: any = b[sortConfig.key as keyof typeof b];

        // Custom Sort Keys (Computed)
        if (sortConfig.key === 'profit') {
          aValue = (a.codAmount || 0) - (a.shippingCost || 0);
          bValue = (b.codAmount || 0) - (b.shippingCost || 0);
        }
        if (sortConfig.key === 'costPercent') {
          aValue = a.codAmount > 0 ? (a.shippingCost || 0) / a.codAmount : 0;
          bValue = b.codAmount > 0 ? (b.shippingCost || 0) / b.codAmount : 0;
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
    return filteredShipments.reduce((acc, curr) => ({
      count: acc.count + 1,
      totalCOD: acc.totalCOD + (curr.codAmount || 0),
      totalCost: acc.totalCost + (curr.shippingCost || 0)
    }), { count: 0, totalCOD: 0, totalCost: 0 });
  }, [filteredShipments]);

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
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 lg:h-[calc(100vh-3.5rem)]">

      {/* Left Column: Date List */}
      <div className="w-full lg:w-64 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col shrink-0 lg:max-h-full overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/80 backdrop-blur-sm sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-2 text-slate-800 font-bold">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <h2>เลือกวันที่</h2>
          </div>
        </div>
        <div className="lg:flex-1 overflow-x-auto lg:overflow-y-auto p-2 space-x-2 lg:space-x-0 lg:space-y-2 custom-scrollbar flex lg:block">
          {uniqueDates.map(date => {
            const count = shipments.filter(s => s.importDate === date).length;
            const isSelected = selectedDate === date;
            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`flex-shrink-0 w-32 md:w-36 lg:w-full text-left px-3 py-2 lg:px-4 lg:py-3 rounded-xl flex flex-col lg:flex-row lg:justify-between lg:items-center transition-all duration-200 border ${isSelected
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 border-indigo-600'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-100'
                  }`}
              >
                <div className="min-w-0">
                  <span className={`text-[10px] font-semibold uppercase truncate block ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                    {date}
                  </span>
                  <span className="font-bold text-sm block mt-0.5 truncate">{formatDate(date)}</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold mt-2 lg:mt-0 w-fit shrink-0 ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Column: Detailed View */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">

        {/* Dashboard Header */}
        <div className="p-4 md:p-6 border-b border-slate-100 bg-white space-y-4 md:space-y-6 shrink-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                {selectedDate ? formatDate(selectedDate) : 'เลือกวันที่'}
                <button className="text-slate-400 hover:text-indigo-600 transition-colors p-1 rounded-full hover:bg-indigo-50">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </h2>
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
                    กำไร (Est): <b className="text-indigo-600">{(stats.totalCOD - stats.totalCost).toLocaleString()}</b> บ.
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${(stats.totalCost / (stats.totalCOD || 1)) * 100 > 30
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-emerald-100 text-emerald-700'
                    }`}>
                    ต้นทุน {stats.totalCOD > 0 ? ((stats.totalCost / stats.totalCOD) * 100).toFixed(1) : 0}%
                  </span>
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
          <table className="w-full text-left border-collapse min-w-[800px] md:min-w-[900px]">
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
                    <span className={(item.codAmount - item.shippingCost) > 0 ? 'text-indigo-700' : 'text-slate-400'}>
                      {(item.codAmount - item.shippingCost) > 0 ? (item.codAmount - item.shippingCost).toLocaleString() : '-'}
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

        {/* Pagination Footer */}
        {filteredShipments.length > 0 && (
          <div className="p-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
            <div className="text-xs md:text-sm text-slate-500 text-center sm:text-left">
              แสดง <span className="font-bold text-slate-800">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> ถึง <span className="font-bold text-slate-800">{Math.min(currentPage * ITEMS_PER_PAGE, filteredShipments.length)}</span> จาก <span className="font-bold text-slate-800">{filteredShipments.length}</span>
            </div>

            <div className="flex items-center gap-1 md:gap-2">
              <button
                onClick={() => goToPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 md:p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronsLeft className="w-4 h-4 md:w-5 md:h-5" />
              </button>
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1.5 md:p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
              </button>

              <span className="px-2 md:px-4 py-1.5 md:py-2 bg-indigo-50 text-indigo-700 font-bold rounded-lg border border-indigo-100 min-w-[60px] md:min-w-[80px] text-center text-xs md:text-sm">
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-1.5 md:p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
              </button>
              <button
                onClick={() => goToPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1.5 md:p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronsRight className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>
          </div>
        )}
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