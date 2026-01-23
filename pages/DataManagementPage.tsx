import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Shipment } from '../types';
import { CloudUpload, Database, CheckCircle, Clock, AlertTriangle, FileJson, Trash2 } from 'lucide-react';

const DataManagementPage: React.FC = () => {
    const { localBatches, syncBatch, syncingBatches, historyLogs, syncProgress } = useData();
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const batches = Object.entries(localBatches).sort((a, b) => b[0].localeCompare(a[0])) as [string, Shipment[]][];

    const handleSync = async (date: string) => {
        setMessage(null);
        try {
            await syncBatch(date);
            setMessage({ type: 'success', text: `Sync for ${date} successful!` });
        } catch (err) {
            setMessage({ type: 'error', text: `Failed to sync ${date}. Check connection.` });
        }
    };

    const calculateTotalItems = () => batches.reduce((sum, [, items]) => sum + items.length, 0);

    return (
        <div className="max-w-4xl mx-auto p-6 md:p-8 animate-fade-in pb-24">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Database className="w-8 h-8 text-indigo-600" />
                        จัดการข้อมูล (Data Management)
                    </h1>
                    <p className="text-slate-500 mt-1">
                        จัดการข้อมูลที่บันทึกไว้ในเครื่อง (Local JSON) และอัปเดตขึ้น Google Sheet
                    </p>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-6">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">รอการอัปเดต</p>
                        <p className="text-3xl font-bold text-indigo-600">{calculateTotalItems()} <span className="text-sm text-slate-500 font-normal">รายการ</span></p>
                    </div>
                    <div className="h-10 w-px bg-slate-100"></div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">ไฟล์คงค้าง</p>
                        <p className="text-3xl font-bold text-orange-500">{batches.length} <span className="text-sm text-slate-500 font-normal">วัน</span></p>
                    </div>
                </div>
            </div>

            {message && (
                <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                    {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    <p className="font-bold">{message.text}</p>
                </div>
            )}

            {/* Batches List */}
            <div className="space-y-4">
                {batches.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                            <CheckCircle className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-600">ข้อมูลเป็นปัจจุบันแล้ว</h3>
                        <p className="text-slate-400">ไม่มีข้อมูลคงค้างในเครื่อง</p>
                    </div>
                ) : (
                    batches.map(([date, items]) => {
                        const isSyncing = syncingBatches.includes(date);
                        const totalCOD = items.reduce((sum, i) => sum + (i.codAmount || 0), 0);

                        return (
                            <div key={date} className={`bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col md:flex-row transition-all ${isSyncing ? 'border-indigo-300 shadow-md ring-2 ring-indigo-500/10' : 'border-slate-200'}`}>

                                {/* Left: Date & Info */}
                                <div className="p-4 md:p-6 flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                                            <FileJson className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-800 font-mono tracking-tight">{date}</h3>
                                            <div className="flex items-center gap-2">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded uppercase ${isSyncing ? 'bg-indigo-100 text-indigo-700 animate-pulse' : 'bg-orange-50 text-orange-600'}`}>
                                                    {isSyncing ? 'Syncing...' : 'Pending Sync'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500 mt-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
                                                {items.length}
                                            </div>
                                            <span className="font-medium">รายการ</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                                <span className="font-bold text-xs">฿</span>
                                            </div>
                                            <span className="font-bold text-emerald-700">COD: {totalCOD.toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                                <Clock className="w-4 h-4" />
                                            </div>
                                            <span className="text-xs">บันทึกล่าสุด: {new Date(items[0]?.timestamp || Date.now()).toLocaleTimeString('th-TH')}</span>
                                        </div>
                                    </div>

                                    {isSyncing && (
                                        <div className="mt-4 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className="bg-indigo-600 h-full rounded-full transition-all duration-300 ease-out"
                                                style={{ width: `${syncProgress[date] || 0}%` }}
                                            ></div>
                                        </div>
                                    )}
                                </div>

                                {/* Right: Actions */}
                                <div className="p-4 bg-slate-50 border-t md:border-t-0 md:border-l border-slate-100 flex items-center justify-end gap-3 min-w-[200px]">
                                    <button
                                        onClick={() => handleSync(date)}
                                        disabled={isSyncing}
                                        className={`w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold shadow-sm transition-all ${isSyncing
                                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 hover:scale-105 active:scale-95'
                                            }`}
                                    >
                                        {isSyncing ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                                                <span>Updating... {syncProgress[date] || 0}%</span>
                                            </>
                                        ) : (
                                            <>
                                                <CloudUpload className="w-5 h-5" />
                                                Sync to Sheet
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* History Logs */}
            {historyLogs.length > 0 && (
                <div className="mt-12 border-t border-slate-200 pt-8 animate-fade-in">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-slate-400" />
                        ประวัติการดำเนินการ (History Log)
                    </h3>
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar divide-y divide-slate-100">
                            {historyLogs.map(log => (
                                <div key={log.id} className="p-4 flex items-start gap-3 hover:bg-slate-50 transition-colors">
                                    <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${log.status === 'success' ? 'bg-emerald-500' : 'bg-rose-500'
                                        }`}></div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-700">{log.details}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            {new Date(log.timestamp).toLocaleString('th-TH')} • <span className="uppercase font-mono">{log.action}</span>
                                        </p>
                                    </div>
                                    {log.status === 'error' && (
                                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Disclaimer */}
            {batches.length > 0 && (
                <div className="mt-8 text-center">
                    <p className="text-xs text-slate-400">
                        * ข้อมูลที่ยังไม่ซิงค์จะถูกเก็บไว้ในเบราว์เซอร์นี้เท่านั้น (Local Storage) <br />
                        กรุณากด Sync เพื่อป้องกันข้อมูลสูญหาย
                    </p>
                </div>
            )}

        </div>
    );
};

export default DataManagementPage;
