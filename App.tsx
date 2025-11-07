import React, { useState, useCallback, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Sales from './pages/Sales';
import Purchases from './pages/Purchases';
import Accounting from './pages/Accounting';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Login from './pages/Login';
import SupplierPortal from './pages/SupplierPortal';
import { Page, SaleInvoice, SaleItem, ClinicTransaction } from './types';
import Header from './components/Header';
import AIAssistant from './components/AIAssistant';
import { useAuth } from './contexts/AuthContext';
import { Dna } from 'lucide-react';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { processSyncQueue, syncStatusChannel } from './lib/syncService';
import SyncStatus from './components/SyncStatus';
import { db } from './db';
import { useLiveQuery } from 'dexie-react-hooks';
import { supabase } from './lib/supabaseClient';


const MainApp: React.FC = () => {
  const [activePage, setActivePage] = useState<Page>('Dashboard');

  const renderPage = useCallback(() => {
    switch (activePage) {
      case 'Dashboard':
        return <Dashboard />;
      case 'Inventory':
        return <Inventory />;
      case 'Sales':
        return <Sales />;
      case 'Purchases':
        return <Purchases />;
      case 'Accounting':
        return <Accounting />;
      case 'Reports':
        return <Reports />;
      case 'Settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  }, [activePage]);

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header currentPageTitle={pageTitles[activePage]} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-900 p-4 sm:p-6 lg:p-8">
          {renderPage()}
        </main>
      </div>
      <AIAssistant />
    </div>
  );
};

const pageTitles: Record<Page, string> = {
  Dashboard: 'داشبورد',
  Inventory: 'مدیریت انبار',
  Sales: 'فروش (POS)',
  Purchases: 'خریدها',
  Accounting: 'حسابداری',
  Reports: 'گزارشات',
  Settings: 'تنظیمات',
};

// ============================================================================
// Data Synchronization Logic
// ============================================================================
// FIX: Modified syncTable to accept separate local and remote table names to handle naming convention differences (camelCase vs. snake_case).
const syncTable = async (localTableName: keyof typeof db, remoteTableName: string, remoteColumns: string, localMapper: (item: any) => any) => {
    // FIX: Wrap localTableName in String() to prevent implicit conversion error from symbol keys on Dexie object.
    console.log(`[Sync] Starting sync for table: ${String(localTableName)} from remote: ${remoteTableName}`);
    const { data, error } = await supabase.from(remoteTableName).select(remoteColumns);
    if (error) {
        console.error(`[Sync] Error fetching ${remoteTableName}:`, error);
        return;
    }
    if (data) {
        // Map remote data to local schema and add/update it in Dexie
        const localData = data.map(localMapper);
        // FIX: Correctly access the table method on the db instance. This relies on the fix in db.ts.
        // FIX: Wrap localTableName in String() to prevent implicit conversion error from symbol keys on Dexie object. This resolves the error on line 74.
        await db.table(String(localTableName)).bulkPut(localData);
        // FIX: Wrap localTableName in String() to prevent implicit conversion error from symbol keys on Dexie object.
        console.log(`[Sync] Successfully synced ${data.length} records for ${String(localTableName)}.`);
    }
};

// ============================================================================
// Data Synchronization Logic for Sales Invoices (Handles relations)
// ============================================================================
const syncSaleInvoicesWithItems = async () => {
    console.log(`[Sync] Starting sync for sale invoices with items.`);
    // Fetch recent 100 invoices with their items
    const { data: remoteInvoices, error } = await supabase
        .from('sale_invoices')
        .select('*, sale_invoice_items(*)')
        .order('date', { ascending: false })
        .limit(100);

    if (error) {
        console.error(`[Sync] Error fetching sale_invoices:`, error);
        return;
    }

    if (remoteInvoices) {
        // Create a map of remote drug IDs to local drug IDs for efficient lookup
        const localDrugs = await db.drugs.toArray();
        const drugRemoteIdToLocalIdMap = new Map<number, number>();
        localDrugs.forEach(drug => {
            if (drug.remoteId && drug.id) {
                drugRemoteIdToLocalIdMap.set(drug.remoteId, drug.id);
            }
        });

        const localInvoicesToPut: SaleInvoice[] = [];
        for (const remoteInv of remoteInvoices) {
            const mappedItems: SaleItem[] = [];
            
            for (const remoteItem of remoteInv.sale_invoice_items) {
                const localDrugId = drugRemoteIdToLocalIdMap.get(remoteItem.drug_id);
                if (!localDrugId) {
                    console.warn(`[Sync] Skipping sale item "${remoteItem.name}" because its drug (remoteId: ${remoteItem.drug_id}) is not found in local DB. The invoice might be incomplete.`);
                    continue; 
                }
                mappedItems.push({
                    drugId: localDrugId,
                    name: remoteItem.name,
                    quantity: remoteItem.quantity,
                    unitPrice: remoteItem.unit_price,
                    totalPrice: remoteItem.quantity * remoteItem.unit_price,
                    deductions: [] // This is for local offline logic and not synced from server.
                });
            }

            // To preserve the local auto-incrementing ID, we must check if the record exists.
            const existingLocalInvoice = await db.saleInvoices.where('remoteId').equals(remoteInv.id).first();
            
            localInvoicesToPut.push({
                id: existingLocalInvoice?.id, // Important to preserve local primary key
                remoteId: remoteInv.id,
                date: remoteInv.date,
                totalAmount: remoteInv.total_amount,
                items: mappedItems,
            });
        }
        
        await db.saleInvoices.bulkPut(localInvoicesToPut);
        console.log(`[Sync] Successfully synced/updated ${localInvoicesToPut.length} sale invoices.`);
    }
};


// ============================================================================
// Data Synchronization Logic for Clinic Transactions (Handles relations)
// ============================================================================
const syncClinicTransactions = async () => {
    console.log(`[Sync] Starting sync for clinic transactions.`);
    const { data: remoteTransactions, error } = await supabase
        .from('clinic_transactions')
        .select('*')
        .order('date', { ascending: false })
        .limit(500); // Sync recent 500 transactions

    if (error) {
        console.error(`[Sync] Error fetching clinic_transactions:`, error);
        return;
    }

    if (remoteTransactions) {
        // Create maps for services and providers to translate foreign keys
        const localServices = await db.clinicServices.toArray();
        const serviceRemoteIdToLocalIdMap = new Map<number, number>();
        localServices.forEach(s => {
            if (s.remoteId && s.id) serviceRemoteIdToLocalIdMap.set(s.remoteId, s.id);
        });

        const localProviders = await db.serviceProviders.toArray();
        const providerRemoteIdToLocalIdMap = new Map<number, number>();
        localProviders.forEach(p => {
            if (p.remoteId && p.id) providerRemoteIdToLocalIdMap.set(p.remoteId, p.id);
        });

        const localTransactionsToPut: ClinicTransaction[] = [];
        for (const remoteTx of remoteTransactions) {
            const localServiceId = serviceRemoteIdToLocalIdMap.get(remoteTx.service_id);
            if (!localServiceId) {
                console.warn(`[Sync] Skipping clinic transaction #${remoteTx.id} because its service (remoteId: ${remoteTx.service_id}) is not found in local DB.`);
                continue; 
            }

            const localProviderId = remoteTx.provider_id ? providerRemoteIdToLocalIdMap.get(remoteTx.provider_id) : undefined;

            const existingLocalTx = await db.clinicTransactions.where('remoteId').equals(remoteTx.id).first();
            
            localTransactionsToPut.push({
                id: existingLocalTx?.id,
                remoteId: remoteTx.id,
                serviceId: localServiceId,
                providerId: localProviderId,
                patientName: remoteTx.patient_name,
                amount: remoteTx.amount,
                date: remoteTx.date,
                ticketNumber: remoteTx.ticket_number,
            });
        }
        
        await db.clinicTransactions.bulkPut(localTransactionsToPut);
        console.log(`[Sync] Successfully synced/updated ${localTransactionsToPut.length} clinic transactions.`);
    }
};


const AppContent: React.FC = () => {
  const { currentUser, isLoading } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  
   useEffect(() => {
    const syncInitialData = async () => {
        if (currentUser && currentUser.type === 'employee') {
            const lastSync = localStorage.getItem(`lastSync_${currentUser.id}`);
            // Simple check: sync if never synced before or if it's been more than an hour
            if (!lastSync || Date.now() - parseInt(lastSync, 10) > 3600 * 1000) {
                 setIsSyncing(true);
                try {
                    // FIX: Updated calls to syncTable with correct local camelCase and remote snake_case table names.
                    await syncTable('roles', 'roles', '*', item => ({ ...item, remoteId: item.id, isEditable: item.is_editable }));
                    await syncTable('users', 'users', 'id, username, role_id', item => ({ remoteId: item.id, username: item.username, roleId: item.role_id }));
                    await syncTable('suppliers', 'suppliers', '*', item => ({ ...item, remoteId: item.id, contactPerson: item.contact_person, totalDebt: item.total_debt }));
                    await syncTable('supplierAccounts', 'supplier_accounts', '*', item => ({ ...item, remoteId: item.id, supplierId: item.supplier_id }));
                    await syncTable('drugs', 'drugs', '*', item => ({ ...item, remoteId: item.id, purchasePrice: item.purchase_price, salePrice: item.sale_price, totalStock: item.total_stock, internalBarcode: item.internal_barcode }));
                    await syncTable('drugBatches', 'drug_batches', '*', item => ({ ...item, remoteId: item.id, drugId: item.drug_id, lotNumber: item.lot_number, expiryDate: item.expiry_date, quantityInStock: item.quantity_in_stock, purchasePrice: item.purchase_price }));
                    await syncTable('clinicServices', 'clinic_services', '*', item => ({ ...item, remoteId: item.id, requiresProvider: item.requires_provider }));
                    await syncTable('serviceProviders', 'service_providers', '*', item => ({ ...item, remoteId: item.id }));
                    await syncTable('simpleAccountingColumns', 'simple_accounting_columns', '*', item => ({ ...item, remoteId: item.id }));
                    await syncTable('simpleAccountingEntries', 'simple_accounting_entries', 'id, date, patient_name, description, values', item => ({ ...item, remoteId: item.id, patientName: item.patient_name }));

                    
                    await syncSaleInvoicesWithItems();
                    await syncClinicTransactions();
                    
                    localStorage.setItem(`lastSync_${currentUser.id}`, Date.now().toString());
                } catch (error) {
                    console.error("Initial data synchronization failed:", error);
                } finally {
                    setIsSyncing(false);
                }
            }
        }
    };
    syncInitialData();
  }, [currentUser]);

  if (isLoading || isSyncing) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <Dna size={48} className="text-blue-400 animate-spin" />
          <p className="text-lg text-gray-300">{isLoading ? 'بارگذاری...' : 'همگام‌سازی اولیه...'}</p>
        </div>
      </div>
    );
  }
  
  if (!currentUser) {
    return <Login />;
  }
  
  if (currentUser.type === 'supplier') {
      return <SupplierPortal />;
  }
  
  return <MainApp />;
};

const App: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { currentUser } = useAuth();
  const syncQueueCount = useLiveQuery(() => db.syncQueue.count(), []);


  // Effect for triggering sync process
  useEffect(() => {
    let syncInterval: number | undefined;

    const startSyncProcess = () => {
      // Immediately attempt to sync when going online or on login
      console.log("Attempting to process sync queue...");
      processSyncQueue();
      
      // Then set up a regular interval to check for pending items
      syncInterval = setInterval(processSyncQueue, 15000) as unknown as number; // every 15 seconds
    };

    if (isOnline && currentUser) {
      startSyncProcess();
    } else {
       syncStatusChannel.postMessage({ status: 'offline' });
    }

    return () => {
      if (syncInterval) {
        clearInterval(syncInterval);
      }
    };
  }, [isOnline, currentUser]);

  // Effect for warning user before closing tab with unsynced data
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
        // This condition checks if there are items in the queue.
        // It's mainly for offline sales now.
        if (syncQueueCount && syncQueueCount > 0) {
            const message = 'شما تغییرات همگام‌سازی نشده‌ای دارید که در صورت بستن صفحه ممکن است از بین بروند. آیا مطمئن هستید؟';
            event.preventDefault();
            event.returnValue = message;
            return message;
        }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [syncQueueCount]);

  // Effect for Real-time Subscriptions to keep local cache updated
  useEffect(() => {
    if (!currentUser || currentUser.type !== 'employee') return;

    console.log('[Realtime] Setting up subscriptions for keeping local cache alive...');

    const handleDrugChange = (payload: any) => {
        const record = payload.new || payload.old;
        const eventType = payload.eventType;
        console.log(`[Realtime] Drug change received: ${eventType}`, record);

        if (!record.id) return;

        db.transaction('rw', db.drugs, async () => {
            const localDrug = await db.drugs.where('remoteId').equals(record.id).first();
            if (eventType === 'DELETE') {
                if (localDrug) await db.drugs.delete(localDrug.id!);
            } else { // INSERT or UPDATE
                const mappedRecord = {
                    id: localDrug?.id, // Keep local ID if it exists
                    remoteId: record.id,
                    name: record.name,
                    company: record.company,
                    purchasePrice: record.purchase_price,
                    salePrice: record.sale_price,
                    totalStock: record.total_stock,
                    type: record.type,
                    internalBarcode: record.internal_barcode,
                    barcode: record.barcode,
                };
                await db.drugs.put(mappedRecord);
            }
        }).catch(e => console.error('[Realtime] Error processing drug change:', e));
    };
    
    const handleBatchChange = (payload: any) => {
        const record = payload.new || payload.old;
        const eventType = payload.eventType;
        console.log(`[Realtime] Batch change received: ${eventType}`, record);
        
        if (!record.id) return;

        db.transaction('rw', db.drugBatches, db.drugs, async () => {
            const localBatch = await db.drugBatches.where('remoteId').equals(record.id).first();
             if (eventType === 'DELETE') {
                if (localBatch) await db.drugBatches.delete(localBatch.id!);
            } else { // INSERT or UPDATE
                // Need to resolve drugId foreign key from remote to local
                const localDrug = await db.drugs.where('remoteId').equals(record.drug_id).first();
                if (!localDrug) {
                    console.warn(`[Realtime] Received batch change for a drug not yet in local cache (remote drug_id: ${record.drug_id}). Skipping.`);
                    return;
                }
                const mappedRecord = {
                    id: localBatch?.id,
                    remoteId: record.id,
                    drugId: localDrug.id!, // Use local drug ID
                    lotNumber: record.lot_number,
                    expiryDate: record.expiry_date,
                    quantityInStock: record.quantity_in_stock,
                    purchasePrice: record.purchase_price,
                };
                await db.drugBatches.put(mappedRecord);
            }
        }).catch(e => console.error('[Realtime] Error processing batch change:', e));
    };

    const drugsSubscription = supabase
        .channel('public:drugs')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'drugs' }, handleDrugChange)
        .subscribe();

    const batchesSubscription = supabase
        .channel('public:drug_batches')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'drug_batches' }, handleBatchChange)
        .subscribe();
        
    return () => {
        console.log('[Realtime] Unsubscribing from channels.');
        supabase.removeChannel(drugsSubscription);
        supabase.removeChannel(batchesSubscription);
    };

  }, [currentUser]);


  return (
    <>
      <AppContent />
    </>
  );
};

export default App;