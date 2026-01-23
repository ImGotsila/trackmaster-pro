import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Search, Package, User, Phone, MapPin, Copy, ExternalLink, X, ShieldCheck, Lock, Eye, AlertCircle, CheckCircle2, History, Trash2, ChevronRight, ArrowLeft, Banknote, Calendar } from 'lucide-react';
import { Shipment } from '../types';

const SearchPage: React.FC = () => {
  const { shipments } = useData();
  const [query, setQuery] = useState('');

  // Search State
  const [searchResults, setSearchResults] = useState<Shipment[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);

  // Security & Verification States
  const [isDetailsRevealed, setIsDetailsRevealed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [verifyInput, setVerifyInput] = useState('');
  const [verifyError, setVerifyError] = useState('');

  // History State
  const [historyIds, setHistoryIds] = useState<string[]>([]);

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem('trackmaster_search_history');
    if (saved) {
      try {
        setHistoryIds(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history");
      }
    }
  }, []);

  const resetSelection = () => {
    setSelectedShipment(null);
    setIsDetailsRevealed(false);
    setVerifyInput('');
    setVerifyError('');
  };

  // Search Logic
  useEffect(() => {
    const cleanQuery = query.trim();
    if (cleanQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    // If typing changes while viewing details, go back to list and lock data
    if (selectedShipment) {
      setSelectedShipment(null);
      setIsDetailsRevealed(false);
    }

    const found = shipments
      .filter(s =>
        s.trackingNumber.toLowerCase().includes(cleanQuery.toLowerCase()) ||
        s.phoneNumber.includes(cleanQuery) ||
        s.customerName.toLowerCase().includes(cleanQuery.toLowerCase())
      )
      .sort((a, b) => b.timestamp - a.timestamp);

    setSearchResults(found);
  }, [query, shipments]);

  // Grouping Logic for Search Results
  const groupedResults = useMemo(() => {
    const groups: Record<string, { customerName: string, phoneNumber: string, items: Shipment[] }> = {};
    searchResults.forEach(item => {
      // Create a unique key based on name and phone to group same customer
      const key = `${item.customerName.trim()}|${item.phoneNumber.replace(/[^0-9]/g, '')}`;
      if (!groups[key]) {
        groups[key] = {
          customerName: item.customerName,
          phoneNumber: item.phoneNumber,
          items: []
        };
      }
      groups[key].items.push(item);
    });
    return Object.values(groups);
  }, [searchResults]);

  // Derive Customer Shipments for Detail View
  const customerShipments = useMemo(() => {
    if (!selectedShipment) return [];
    const clean = (p: string) => p.replace(/[^0-9]/g, '');
    const targetPhone = clean(selectedShipment.phoneNumber);
    const targetName = selectedShipment.customerName.trim();

    return shipments.filter(s =>
      clean(s.phoneNumber) === targetPhone &&
      s.customerName.trim() === targetName
    ).sort((a, b) => b.timestamp - a.timestamp);
  }, [selectedShipment, shipments]);

  const totalCOD = useMemo(() => customerShipments.reduce((sum, s) => sum + s.codAmount, 0), [customerShipments]);

  const addToHistory = (id: string) => {
    setHistoryIds(prev => {
      const filtered = prev.filter(existingId => existingId !== id);
      const newHistory = [id, ...filtered].slice(0, 5); // Keep last 5
      localStorage.setItem('trackmaster_search_history', JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const removeFromHistory = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setHistoryIds(prev => {
      const newHistory = prev.filter(existingId => existingId !== id);
      localStorage.setItem('trackmaster_search_history', JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const clearHistory = () => {
    setHistoryIds([]);
    localStorage.removeItem('trackmaster_search_history');
  };

  const clearSearch = () => {
    setQuery('');
    setSearchResults([]);
    resetSelection();
  };

  const handleSelectShipment = (item: Shipment) => {
    setSelectedShipment(item);
    setIsDetailsRevealed(false);
    setVerifyInput('');
    setVerifyError('');
    addToHistory(item.id);
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipment) return;

    // Remove dashes or spaces for comparison
    const cleanInput = verifyInput.replace(/[^0-9]/g, '');
    // Get the first 5 digits of the actual phone number for verification
    const cleanTarget = selectedShipment.phoneNumber.replace(/[^0-9]/g, '').substring(0, 5);

    if (cleanInput === cleanTarget) {
      setIsDetailsRevealed(true);
      setIsModalOpen(false);
      setVerifyError('');
      setVerifyInput('');
    } else {
      setVerifyError('เลข 5 ตัวหน้าไม่ถูกต้อง กรุณาลองใหม่');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getTrackingUrl = (tracking: string, courier: string) => {
    if (courier.includes('Kerry')) return `https://th.kerryexpress.com/th/track/?track=${tracking}`;
    if (courier.includes('J&T')) return `https://www.jtexpress.co.th/service/track?billcode=${tracking}`;
    if (courier.includes('Flash')) return `https://www.flashexpress.co.th/tracking/?se=${tracking}`;
    return `https://track.thailandpost.co.th/?trackNumber=${tracking}`;
  };

  const getMultiTrackingUrl = (courier: string, trackings: string[]) => {
    const t = trackings.join(',');
    if (courier.includes('Kerry')) return `https://th.kerryexpress.com/th/track/?track=${t}`;
    if (courier.includes('J&T')) return `https://www.jtexpress.co.th/service/track?billcode=${t}`;
    if (courier.includes('Flash')) return `https://www.flashexpress.co.th/tracking/?se=${t}`;
    // Thailand Post supports comma separated values
    return `https://track.thailandpost.co.th/?trackNumber=${t}`;
  };

  // --- PDPA Helper Functions ---
  const maskName = (fullName: string) => {
    if (isDetailsRevealed) return fullName;
    const parts = fullName.split(' ');
    return parts.map(part => {
      if (part.length < 2) return part;
      return part.charAt(0) + '•'.repeat(Math.max(3, part.length - 1));
    }).join(' ');
  };

  const maskPhone = (phone: string) => {
    if (isDetailsRevealed) return phone;
    const clean = phone.replace(/[^0-9]/g, '');
    if (clean.length < 5) return clean;
    return 'xxxxx' + clean.slice(-5);
  };

  const maskTracking = (tracking: string) => {
    if (tracking.length < 5) return tracking;
    return '•••••' + tracking.slice(-5);
  };

  // Get recent shipments objects
  const recentShipments = historyIds
    .map(id => shipments.find(s => s.id === id))
    .filter((s): s is Shipment => !!s);

  return (
    <div className="max-w-xl mx-auto flex flex-col items-center pt-6 md:pt-8 animate-fade-in px-4 pb-24 md:pb-20">

      {/* Icon Header */}
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="w-14 h-14 md:w-16 md:h-16 bg-white rounded-2xl flex items-center justify-center mb-3 md:mb-4 shadow-md shadow-indigo-100 border border-slate-100">
          <ShieldCheck className="w-7 h-7 md:w-8 md:h-8 text-indigo-600" />
        </div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">ค้นหาพัสดุ (PDPA)</h1>
        <p className="text-slate-500 text-xs md:text-sm mt-1">พิมพ์เบอร์โทร, ชื่อ หรือเลขพัสดุ (อย่างน้อย 2 ตัวอักษร)</p>
      </div>

      {/* Search Input */}
      <div className="w-full relative group mb-6 z-20">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          {selectedShipment ? (
            <button onClick={resetSelection} className="pointer-events-auto">
              <ArrowLeft className="h-5 w-5 text-indigo-600" />
            </button>
          ) : (
            <Search className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          )}
        </div>
        <input
          type="text"
          className={`block w-full pl-11 pr-10 py-3.5 border rounded-xl leading-5 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all text-base shadow-sm ${selectedShipment
            ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-bold'
            : 'bg-white border-slate-200 text-slate-800 focus:border-indigo-500'
            }`}
          placeholder="กรอกข้อมูลเพื่อค้นหา..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClick={() => { if (selectedShipment) resetSelection(); }}
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-slate-300 hover:text-slate-500"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Logic for View Switching */}
      {selectedShipment ? (
        // --- DETAIL VIEW (CUSTOMER GROUP) ---
        <div className="w-full relative animate-fade-in">

          {/* Customer Summary Card */}
          <div className={`w-full bg-white rounded-2xl shadow-xl shadow-indigo-100/40 border overflow-hidden transition-all duration-300 ${isDetailsRevealed ? 'border-indigo-200' : 'border-slate-200'}`}>

            {/* Private Header */}
            <div className={`px-6 pt-8 pb-4 border-b flex justify-between items-end ${isDetailsRevealed ? 'bg-indigo-50/50 border-indigo-100' : 'bg-slate-50/50 border-slate-100'}`}>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  {isDetailsRevealed ? 'ข้อมูลยืนยันแล้ว' : 'ข้อมูลส่วนบุคคล (PDPA)'}
                </p>
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  {maskName(selectedShipment.customerName)}
                  {!isDetailsRevealed && <Lock className="w-4 h-4 text-slate-400" />}
                  {isDetailsRevealed && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
                </h3>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-white border border-slate-200 text-slate-600 shadow-sm">
                  {customerShipments.length} พัสดุ
                </span>
              </div>
            </div>

            {/* Info Grid */}
            <div className="p-6 space-y-5">

              {/* Phone Row */}
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors shadow-sm ${isDetailsRevealed ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-slate-100 text-slate-400'}`}>
                  <Phone className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-slate-400 font-bold uppercase mb-1">เบอร์โทรศัพท์</p>
                  <p className={`text-2xl font-mono font-black tracking-tight ${isDetailsRevealed ? 'text-indigo-700' : 'text-slate-800'}`}>
                    {maskPhone(selectedShipment.phoneNumber)}
                  </p>
                </div>
              </div>

              {/* Total COD Row */}
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isDetailsRevealed ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                  <Banknote className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-slate-400 font-bold uppercase mb-1">ยอดรวม COD ทั้งหมด</p>
                  <div className={`font-mono font-bold flex items-center gap-2 ${isDetailsRevealed ? 'text-emerald-600 text-2xl' : 'text-slate-300 text-base'}`}>
                    {isDetailsRevealed ? (
                      totalCOD > 0 ? (
                        <>
                          <span>฿{totalCOD.toLocaleString()}</span>
                        </>
                      ) : <span className="text-slate-400 text-lg">ชำระแล้ว</span>
                    ) : (
                      '฿ ••••'
                    )}
                  </div>
                </div>
              </div>

              {/* Address/Zip Row */}
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isDetailsRevealed ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                  <MapPin className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-slate-400 font-bold uppercase mb-1">รหัสไปรษณีย์</p>
                  <p className="text-2xl font-mono font-black text-slate-800 tracking-wider">{selectedShipment.zipCode}</p>
                </div>
              </div>

              {/* Action / Shipments List Area */}
              <div className="pt-4 mt-2 border-t border-slate-100">
                {!isDetailsRevealed ? (
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    ยืนยันตัวตนเพื่อดูพัสดุทั้งหมด ({customerShipments.length} รายการ)
                  </button>
                ) : (
                  <div className="space-y-4 animate-slide-up">
                    <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Package className="w-4 h-4 text-indigo-600" />
                      รายการพัสดุ ({customerShipments.length})
                    </h4>

                    {/* Track All Buttons */}
                    {customerShipments.length > 1 && (
                      <div className="flex flex-col gap-2 mb-2">
                        {Object.entries(customerShipments.reduce((acc, s) => {
                          if (!acc[s.courier]) acc[s.courier] = [];
                          acc[s.courier].push(s.trackingNumber);
                          return acc;
                        }, {} as Record<string, string[]>)).map(([courierName, trackings]) => (
                          <a
                            key={courierName}
                            href={getMultiTrackingUrl(courierName, trackings as string[])}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                          >
                            <ExternalLink className="w-4 h-4" />
                            ติดตามพัสดุทั้งหมด ({(trackings as string[]).length} รายการ)
                          </a>
                        ))}
                      </div>
                    )}

                    <div className="space-y-3">
                      {customerShipments.map((item, idx) => (
                        <div key={item.id} className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 transition-all hover:bg-indigo-50">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm md:text-base font-bold text-indigo-900">
                                {item.trackingNumber}
                              </span>
                              <button
                                onClick={() => copyToClipboard(item.trackingNumber)}
                                className="p-1.5 text-indigo-400 hover:text-indigo-700 hover:bg-indigo-200/50 rounded-lg transition-colors"
                                title="Copy Tracking"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${item.status === 'รับฝาก' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                              item.status === 'Delivered' ? 'bg-green-100 text-green-700 border-green-200' :
                                'bg-slate-100 text-slate-600 border-slate-200'
                              }`}>
                              {item.status}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3 h-3" />
                              {item.importDate}
                            </div>
                            <div className="font-bold">
                              {item.codAmount > 0 ? (
                                <span className="text-emerald-600">COD: ฿{item.codAmount.toLocaleString()}</span>
                              ) : (
                                <span className="text-slate-400">Paid</span>
                              )}
                            </div>
                          </div>

                          <a
                            href={getTrackingUrl(item.trackingNumber, item.courier)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 w-full py-2 bg-white border border-indigo-200 text-indigo-600 rounded-lg font-bold text-xs hover:bg-indigo-50 hover:border-indigo-300 transition-colors flex items-center justify-center gap-1.5"
                          >
                            <ExternalLink className="w-3 h-3" />
                            ติดตามพัสดุ
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

      ) : query.length >= 2 ? (
        // --- SEARCH RESULTS LIST (GROUPED) ---
        <div className="w-full animate-fade-in">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-sm font-bold text-slate-500">
              ผลการค้นหา ({groupedResults.length} รายชื่อ)
            </h3>
          </div>

          {groupedResults.length > 0 ? (
            <div className="space-y-4">
              {groupedResults.map((group, index) => (
                <div key={index} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  {/* Group Header */}
                  <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-200">
                      <User className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-800 text-base truncate">
                        {maskName(group.customerName)}
                      </h4>
                      <p className="text-xs text-slate-500 font-mono">
                        {maskPhone(group.phoneNumber)}
                      </p>
                    </div>
                    {group.items.length > 1 && (
                      <span className="text-[10px] font-bold bg-white border border-slate-200 text-slate-500 px-2 py-1 rounded-md shadow-sm">
                        {group.items.length} พัสดุ
                      </span>
                    )}
                  </div>

                  {/* Items List - Click any to open customer detail */}
                  <div className="divide-y divide-slate-50">
                    {group.items.map(item => (
                      <button
                        key={item.id}
                        onClick={() => handleSelectShipment(item)}
                        className="w-full p-4 flex items-center justify-between hover:bg-indigo-50/30 transition-colors group text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${item.status === 'รับฝาก' ? 'bg-blue-50 text-blue-600' :
                            item.status === 'Delivered' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'
                            }`}>
                            <Package className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-mono text-sm font-bold text-slate-700 truncate">
                                {maskTracking(item.trackingNumber)}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${item.status === 'รับฝาก' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                item.status === 'Delivered' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-slate-50 text-slate-500 border-slate-200'
                                }`}>
                                {item.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400">
                              {item.importDate}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full p-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 border-dashed">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">ไม่พบข้อมูลที่ตรงกัน</p>
            </div>
          )}
        </div>

      ) : (
        // --- HISTORY VIEW ---
        recentShipments.length > 0 && (
          <div className="w-full animate-fade-in">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-sm font-bold text-slate-500 flex items-center gap-2">
                <History className="w-4 h-4" />
                รายการที่ดูล่าสุด
              </h3>
              <button
                onClick={clearHistory}
                className="text-xs font-medium text-slate-400 hover:text-rose-500 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> ล้างประวัติ
              </button>
            </div>
            <div className="space-y-2">
              {recentShipments.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleSelectShipment(item)}
                  className="w-full bg-white p-3 rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all flex items-center gap-3 group text-left"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${item.status === 'รับฝาก' ? 'bg-blue-50 text-blue-600' :
                    item.status === 'Delivered' ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-500'
                    }`}>
                    <Package className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 truncate text-sm">{maskName(item.customerName)}</p>
                    <p className="text-xs text-slate-400 font-mono truncate">{maskPhone(item.phoneNumber)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-50 text-slate-500 font-bold border border-slate-100 hidden sm:inline-block">
                      {item.importDate}
                    </span>
                    <div
                      onClick={(e) => removeFromHistory(e, item.id)}
                      className="p-1.5 rounded-md text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )
      )}

      {/* Verification Modal */}
      {isModalOpen && selectedShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden animate-scale-up">
            <div className="p-6 pt-8 text-center">
              <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600">
                <Lock className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">ยืนยันความเป็นเจ้าของ</h3>
              <p className="text-slate-500 text-sm mt-2 mb-6">
                กรุณากรอก <b>5 ตัวหน้า</b> ของเบอร์โทรศัพท์ <br />เพื่อยืนยันตัวตน
              </p>

              <form onSubmit={handleVerify} className="space-y-4">
                <div className="relative">
                  <input
                    type="tel"
                    autoFocus
                    className={`w-full text-center text-2xl font-mono font-bold tracking-widest py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition-all ${verifyError ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50' : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20'}`}
                    placeholder="0xxxx"
                    maxLength={5}
                    value={verifyInput}
                    onChange={(e) => setVerifyInput(e.target.value)}
                  />
                </div>

                {verifyError && (
                  <div className="text-rose-600 text-xs font-bold flex items-center justify-center gap-1 animate-shake">
                    <AlertCircle className="w-3 h-3" /> {verifyError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setIsModalOpen(false); setVerifyError(''); }}
                    className="py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors text-sm"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors text-sm shadow-md shadow-indigo-200"
                  >
                    ยืนยัน
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SearchPage;