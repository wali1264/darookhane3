import { db } from '../db';
import { supabase } from './supabaseClient';
import { SyncQueueItem } from '../types';

export const syncStatusChannel = new BroadcastChannel('sync_status');

let isSyncing = false;

export async function processSyncQueue() {
    if (isSyncing || !navigator.onLine) {
        return;
    }

    isSyncing = true;
    try {
        const itemsToSync = await db.syncQueue.orderBy('timestamp').toArray();
        if (itemsToSync.length === 0) {
            syncStatusChannel.postMessage({ status: 'synced' });
            return;
        }

        console.log(`[Sync] Starting sync for ${itemsToSync.length} items.`);
        syncStatusChannel.postMessage({ status: 'syncing', processed: 0, total: itemsToSync.length });

        const successfullySyncedIds: number[] = [];
        let errorOccurred = false;

        for (let i = 0; i < itemsToSync.length; i++) {
            const item = itemsToSync[i];
            try {
                const success = await handleSyncItem(item);
                if (success) {
                    successfullySyncedIds.push(item.id!);
                } else {
                    console.error(`[Sync] Failed to sync item ${item.id}`, item);
                    errorOccurred = true;
                }
            } catch (error) {
                console.error(`[Sync] CRITICAL Error processing sync item ${item.id}:`, error);
                errorOccurred = true;
            } finally {
                syncStatusChannel.postMessage({ status: 'syncing', processed: i + 1, total: itemsToSync.length });
            }
        }

        if (successfullySyncedIds.length > 0) {
            await db.syncQueue.bulkDelete(successfullySyncedIds);
            console.log(`[Sync] Cleaned up ${successfullySyncedIds.length} successfully synced items.`);
        }

        const remainingItems = await db.syncQueue.count();
        console.log(`[Sync] Finished. ${remainingItems} items remaining in queue.`);
        
        if (errorOccurred) {
             syncStatusChannel.postMessage({ status: 'error', remaining: remainingItems });
        } else if (remainingItems > 0) {
             syncStatusChannel.postMessage({ status: 'pending', count: remainingItems });
        } else {
             syncStatusChannel.postMessage({ status: 'synced' });
        }

    } catch (e) {
        console.error("[Sync] A fatal error occurred during the sync process:", e);
        const remaining = await db.syncQueue.count();
        syncStatusChannel.postMessage({ status: 'error', remaining });
    } finally {
        isSyncing = false;
    }
}

async function handleSyncItem(item: SyncQueueItem): Promise<boolean> {
    const { table, action, recordId } = item;
    
    console.log(`[Sync] Processing: ${action.toUpperCase()} on table '${table}' with local ID ${recordId}`);

    try {
        if (action === 'create' && table === 'saleInvoices') {
            const localInvoice = await db.saleInvoices.get(recordId as number);
            if (!localInvoice) {
                console.warn(`[Sync] SaleInvoice with local ID ${recordId} not found. Assuming already processed. Skipping.`);
                return true; 
            }
            if (localInvoice.remoteId) {
                console.log(`[Sync] SaleInvoice with local ID ${recordId} is already synced. Skipping.`);
                return true;
            }
            
            // Construct payload for the atomic RPC function
            const rpcPayloadItems = [];
            for (const localItem of localInvoice.items) {
                const drug = await db.drugs.get(localItem.drugId);
                if (!drug || !drug.remoteId) {
                    throw new Error(`Cannot sync sale: Drug "${localItem.name}" with local ID ${localItem.drugId} has no remoteId.`);
                }
                rpcPayloadItems.push({
                    drug_id: drug.remoteId,
                    name: localItem.name, // FIX: Added missing 'name' field required by the RPC function.
                    quantity: localItem.quantity,
                    unit_price: localItem.unitPrice,
                });
            }

            const rpcPayload = {
                p_items: rpcPayloadItems,
                p_total_amount: localInvoice.totalAmount,
                p_date: localInvoice.date, // Pass the original date from the offline invoice
            };

            // FIX: The RPC function expects a single JSONB argument named 'p_payload'.
            // The entire payload must be wrapped in an object with that key.
            const { data, error } = await supabase.rpc('create_sale_invoice_transaction', { p_payload: rpcPayload });


            if (error) {
                console.error(`[Sync Error] RPC call for SaleInvoice ${recordId} failed:`, error);
                return false; // Keep item in queue
            }
            
            if (data && data.success) {
                // Update local record with its new remote ID to prevent re-syncing
                await db.saleInvoices.update(recordId as number, { remoteId: data.new_invoice_id });
                console.log(`[Sync] Successfully synced SaleInvoice ${recordId} via RPC. New remote ID: ${data.new_invoice_id}`);
                return true; // Success, item will be removed from queue
            } else {
                console.error(`[Sync Error] RPC call for SaleInvoice ${recordId} returned failure:`, data?.message);
                return false; // Keep item in queue
            }
        }
        // Other sync actions for other tables would go here...

    } catch (e) {
        console.error(`[Sync] Unhandled exception in handleSyncItem for item ${item.id}:`, e);
        return false;
    }
    
    // If the item type is not handled, consider it successful to prevent getting stuck
    console.warn(`[Sync] Unhandled sync item type: ${table}. Marking as successful.`);
    return true;
}