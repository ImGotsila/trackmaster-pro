import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Shipment, ActionLog } from '../types';
import { GoogleSheetsService } from '../services/GoogleSheetsService';

interface DataContextType {
  shipments: Shipment[];
  localBatches: Record<string, Shipment[]>;
  syncingBatches: string[];
  historyLogs: ActionLog[];
  syncProgress: Record<string, number>;
  addShipments: (newShipments: Shipment[]) => void;
  importShipments: (newShipments: Shipment[], mode: 'skip' | 'replace') => { added: number; updated: number; skipped: number };
  syncBatch: (date: string) => Promise<void>;
  deleteShipment: (id: string) => Promise<void>;
  addLog: (action: ActionLog['action'], details: string, status?: 'success' | 'error') => void;
  isLoading: boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [serverShipments, setServerShipments] = useState<Shipment[]>([]);
  const [localBatches, setLocalBatches] = useState<Record<string, Shipment[]>>({}); // Local unsynced data
  const [syncingBatches, setSyncingBatches] = useState<string[]>([]);
  const [syncProgress, setSyncProgress] = useState<Record<string, number>>({});
  const [historyLogs, setHistoryLogs] = useState<ActionLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Load Server Data
  const loadServerData = async () => {
    setIsLoading(true);
    const data = await GoogleSheetsService.fetchShipments();
    setServerShipments(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadServerData();
  }, []);

  // 2. Load Local Batches and History
  useEffect(() => {
    const savedBatches = localStorage.getItem('trackmaster_local_batches');
    // History is now loaded from API, not LocalStorage

    if (savedBatches) {
      try {
        setLocalBatches(JSON.parse(savedBatches));
      } catch (e) {
        console.error("Failed to parse local batches");
      }
    }

    // Load History from API
    fetch('/api/history')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setHistoryLogs(data);
        }
      })
      .catch(err => console.error("Failed to load history logs", err));
  }, []);

  // 3. Save Local Batches
  useEffect(() => {
    localStorage.setItem('trackmaster_local_batches', JSON.stringify(localBatches));
  }, [localBatches]);

  // 4. Save History (Removed LocalStorage sync, now API based)
  /* useEffect(() => {
    localStorage.setItem('trackmaster_history_logs', JSON.stringify(historyLogs));
  }, [historyLogs]); */

  const addLog = async (action: ActionLog['action'], details: string, status: 'success' | 'error' = 'success') => {
    const newLog: ActionLog = {
      id: Date.now().toString() + Math.random(),
      timestamp: Date.now(),
      action,
      details,
      status
    };

    // Optimistic UI Update
    setHistoryLogs(prev => [newLog, ...prev].slice(0, 100));

    // Send to API
    try {
      await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLog)
      });
    } catch (err) {
      console.error("Failed to save log to DB", err);
    }
  };

  // Combined Shipments (Server + Local) used for Display
  // Local items are overlayed on top if needed, but primarily we just show them all.
  // Combined Shipments (Server + Local) used for Display
  // We prioritize Local items (newer) over Server items.
  const shipments = useMemo(() => {
    const localItems = Object.values(localBatches).flat() as Shipment[];
    const localTrackingSet = new Set(localItems.map(s => s.trackingNumber));

    // Filter out server items that have a local override (same tracking number)
    // This allows "Moving" a shipment to a new date without seeing the ghost of the old one from server
    const serverItemsFiltered = serverShipments.filter(s => !localTrackingSet.has(s.trackingNumber));

    return [...localItems, ...serverItemsFiltered].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [serverShipments, localBatches]);

  const addShipments = (newShipments: Shipment[]) => {
    importShipments(newShipments, 'skip');
  };

  const importShipments = (newShipments: Shipment[], mode: 'skip' | 'replace') => {
    let added = 0;
    let updated = 0;
    let skipped = 0;

    setLocalBatches(prev => {
      const nextBatches = { ...prev };

      // We need to look up against ALL existing local items to check for duplicates
      // constructing a map of all local items
      const localMap = new Map<string, Shipment>((Object.values(prev).flat() as Shipment[]).map(s => [s.trackingNumber, s]));
      const serverMap = new Map<string, Shipment>(serverShipments.map(s => [s.trackingNumber, s]));

      newShipments.forEach(newItem => {
        // Determine the batch key for this item (use its importDate or fall back to today)
        const batchKey = newItem.importDate || new Date().toISOString().split('T')[0];

        // Ensure the batch array exists
        if (!nextBatches[batchKey]) {
          nextBatches[batchKey] = [];
        }

        // Logic to add/update item in the specific batch
        // We need to be careful: if we are "updating", the item might be in a DIFFERENT batch (e.g. wrong date before).
        // For simplicity in this version:
        // 1. If it exists LOCALLY (in any batch), we update it IN PLACE (keep it in its original batch) OR move it?
        //    Let's stick to: Update it where it is. If we want to "move" it to the new date, that's complex.
        //    Actually, if the user explicitly provided a new file with a new date, maybe they WANT it moved?
        //    Let's assume "Replace" means update stats/data but keep ID. 
        //    If `importDate` changes, we should probably move it. 
        //    BUT, `localMap` gives us the item but not easily the batch key without searching.

        //    Simple approach: 
        //    If ID/Tracking exists locally:
        //       If REPLACE: Remove old, add new to `batchKey` (effectively move & update).
        //       If SKIP: Do nothing.
        //    Else: Add to `batchKey`.

        if (localMap.has(newItem.trackingNumber)) {
          if (mode === 'replace') {
            // Find original batch and remove it
            for (const d in nextBatches) {
              const idx = nextBatches[d].findIndex(s => s.trackingNumber === newItem.trackingNumber);
              if (idx !== -1) {
                // Found it. Remove it.
                nextBatches[d].splice(idx, 1);
                if (nextBatches[d].length === 0) delete nextBatches[d]; // Cleanup empty batch
                break;
              }
            }
            // Add to correct batch (new date)
            // We preserve ID if possible, but honestly if we are replacing, taking the new object is fine (maybe keep internal ID?)
            // Let's keep the ID from the old item if we can find it easily, or just generate new one?
            // actually localMap has the old item
            const oldItem = localMap.get(newItem.trackingNumber)!;
            nextBatches[batchKey] = nextBatches[batchKey] || [];
            nextBatches[batchKey].unshift({ ...newItem, id: oldItem.id });
            updated++;
          } else {
            skipped++;
          }
        } else if (serverMap.has(newItem.trackingNumber)) {
          // In Server
          if (mode === 'replace') {
            // It's in server, so we are "updating" it locally to override server.
            // Add to `batchKey`
            const serverItem = serverMap.get(newItem.trackingNumber)!;
            nextBatches[batchKey].unshift({ ...newItem, id: serverItem.id });
            updated++;
          } else {
            skipped++;
          }
        } else {
          // New
          nextBatches[batchKey].unshift(newItem);
          added++;
        }
      });

      // Cleanup empty batches created during this process
      for (const key of Object.keys(nextBatches)) {
        if (nextBatches[key].length === 0) {
          delete nextBatches[key];
        }
      }

      return nextBatches;
    });

    return { added, updated, skipped };
  };

  // Cleanup empty batches on mount (fix for existing bad state)
  useEffect(() => {
    setLocalBatches(prev => {
      const next = { ...prev };
      let hasChanges = false;
      for (const key of Object.keys(next)) {
        if (next[key].length === 0) {
          delete next[key];
          hasChanges = true;
        }
      }
      return hasChanges ? next : prev;
    });
  }, []);


  // Queue state
  const syncQueueRef = React.useRef<{ date: string; resolve: () => void; reject: (err: any) => void }[]>([]);
  const isSyncingRef = React.useRef(false);

  const processQueue = async () => {
    if (isSyncingRef.current || syncQueueRef.current.length === 0) return;

    isSyncingRef.current = true;
    const { date, resolve, reject } = syncQueueRef.current.shift()!;

    // Execute Sync Logic
    const batch = localBatches[date];
    if (!batch || batch.length === 0) {
      // Should not happen if filtered correctly before, but safety check
      isSyncingRef.current = false;
      resolve();
      processQueue();
      return;
    }

    // setSyncingBatches(prev => [...prev, date]); // Handled in syncBatch
    setSyncProgress(prev => ({ ...prev, [date]: 0 }));

    try {
      const CHUNK_SIZE = 50;
      let processed = 0;
      const total = batch.length;
      let totalAdded = 0;
      let totalUpdated = 0;

      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = batch.slice(i, i + CHUNK_SIZE);
        const result = await GoogleSheetsService.saveShipments(chunk);

        totalAdded += result.added;
        totalUpdated += result.updated;
        processed += chunk.length;

        const progress = Math.min(Math.round((processed / total) * 100), 100);
        setSyncProgress(prev => ({ ...prev, [date]: progress }));
      }

      // On success, remove from local batches
      setLocalBatches(prev => {
        const next = { ...prev };
        delete next[date];
        return next;
      });

      addLog('sync', `Synced local batch ${date} (${totalAdded} added, ${totalUpdated} updated)`, 'success');

      // Refresh server data ONLY if this was the last item or we want intermediate updates
      // Optimization: maybe only refresh at the end of queue? 
      // For safety/consistency let's refresh every time for now, or maybe just once if we want speed.
      // But user expects to see results.
      await loadServerData();

      resolve();

    } catch (err: any) {
      console.error(`Failed to sync batch ${date}`, err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      addLog('sync', `Failed to sync batch ${date}: ${errorMessage}`, 'error');
      reject(err);
    } finally {
      // Cleanup UI state
      setSyncingBatches(prev => prev.filter(d => d !== date));
      setSyncProgress(prev => {
        const next = { ...prev };
        delete next[date];
        return next;
      });

      // Continue Queue
      isSyncingRef.current = false;
      processQueue();
    }
  };

  const syncBatch = (date: string): Promise<void> => {
    // 1. Mark as syncing immediately to disable UI
    setSyncingBatches(prev => prev.includes(date) ? prev : [...prev, date]);

    return new Promise((resolve, reject) => {
      syncQueueRef.current.push({ date, resolve, reject });
      processQueue();
    });
  };

  const deleteShipment = async (id: string) => {
    // Find the shipment to get the tracking number
    const shipment = shipments.find(s => s.id === id);
    const trackingNumber = shipment?.trackingNumber;
    const isServerItem = serverShipments.some(s => s.id === id);

    // 1. Remove from Server State (Optimistic)
    setServerShipments(prev => prev.filter(s => s.id !== id));

    // 2. Remove from Local Batches
    setLocalBatches(prev => {
      const next = { ...prev };
      for (const date in next) {
        next[date] = next[date].filter(s => s.id !== id);
        if (next[date].length === 0) delete next[date];
      }
      return next;
    });

    // 3. Call Server API (Only if it was a server item)
    if (isServerItem && trackingNumber) {
      try {
        // Pass trackingNumber instead of ID which is volatile (row-index)
        await GoogleSheetsService.deleteShipment(trackingNumber);
        addLog('delete', `Deleted shipment ${trackingNumber}`, 'success');
      } catch (e) {
        console.error("Failed to delete from server", e);
        addLog('delete', `Failed to delete shipment ${trackingNumber}`, 'error');
        // Ideally rollback state here, but for now we log error
      }
    }
  };

  return (
    <DataContext.Provider value={{ shipments, localBatches, syncingBatches, historyLogs, syncProgress, addShipments, importShipments, syncBatch, deleteShipment, addLog, isLoading }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};