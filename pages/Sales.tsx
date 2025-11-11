import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Drug, SaleItem, SaleInvoice } from '../types';
import { Search, X, Plus, Minus, Printer, Edit, History, Filter, XCircle, Barcode } from 'lucide-react';
import Modal from '../components/Modal';
import PrintableInvoice from '../components/PrintableInvoice';
import { useVoiceInput } from '../hooks/useVoiceInput';
import VoiceControlHeader from '../components/VoiceControlHeader';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { logActivity } from '../lib/activityLogger';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { processSyncQueue } from '../lib/syncService';
import { supabase } from '../lib/supabaseClient';
import { parseJalaliDate } from '../lib/dateConverter';

// Helper to get ISO date strings for filtering
const getISODateForFilter = (date: Date) => {
    return date.toISOString();
};

const Sales: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState<Omit<SaleItem, 'deductions'>[]>([]);
    const [invoiceToPrint, setInvoiceToPrint] = useState<SaleInvoice | null>(null);
    const [editingInvoice, setEditingInvoice] = useState<SaleInvoice | null>(null);
    const [dateFilter, setDateFilter] = useState<{ start: string | null, end: string | null }>({ start: null, end: null });
    const [customDateInputs, setCustomDateInputs] = useState({ start: '', end: '' });
    const [isScanModeActive, setIsScanModeActive] = useState(false);

    const { hasPermission } = useAuth();
    const { showNotification } = useNotification();
    const isOnline = useOnlineStatus();

    const drugs = useLiveQuery(() => db.drugs.toArray(), []);
    
    const recentInvoices = useLiveQuery(async () => {
        if (dateFilter.start && dateFilter.end) {
            // Filtered view: get all within the date range, sorted by date descending
            return await db.saleInvoices
                .where('date')
                .between(dateFilter.start, dateFilter.end, true, true)
                .reverse()
                .sortBy('date');
        } else {
            // Default view: get the 100 most recent invoices
            return await db.saleInvoices
                .orderBy('date')
                .reverse()
                .limit(100)
                .toArray();
        }
    }, [dateFilter]);


    const handleVoiceTranscript = (transcript: string) => {
        setSearchTerm(transcript);
    };

    const voiceControls = useVoiceInput({ onTranscript: handleVoiceTranscript });

    const filteredDrugs = useMemo(() => {
        if (!searchTerm || isScanModeActive) return []; // Don't show dropdown in scan mode
        if (!drugs) return [];
        const lowerCaseSearchTerm = searchTerm.toLowerCase().split(' ').filter(Boolean);
        if (lowerCaseSearchTerm.length === 0) return [];
        
        return drugs.filter(drug => {
            const drugNameLower = drug.name.toLowerCase();
            const barcodeMatch = drug.barcode === searchTerm || drug.internalBarcode === searchTerm;
            const nameMatch = lowerCaseSearchTerm.every(term => drugNameLower.includes(term));
            
            return (nameMatch || barcodeMatch) && drug.totalStock > 0;
        }).slice(0, 5);
    }, [searchTerm, drugs, isScanModeActive]);


    const addToCart = (drug: Drug) => {
        const existingItem = cart.find(item => item.drugId === drug.id);
        if (existingItem) {
            updateQuantity(drug.id!, Math.min(drug.totalStock, existingItem.quantity + 1));
        } else {
            if (drug.totalStock > 0) {
                setCart([...cart, {
                    drugId: drug.id!,
                    name: drug.name,
                    quantity: 1,
                    unitPrice: drug.salePrice,
                    totalPrice: drug.salePrice,
                }]);
            }
        }
        setSearchTerm('');
    };

    useEffect(() => {
        if (isScanModeActive && searchTerm.trim() !== '') {
            const matchedDrug = drugs?.find(d => 
                (d.barcode && d.barcode === searchTerm.trim()) || 
                (d.internalBarcode && d.internalBarcode === searchTerm.trim())
            );

            if (matchedDrug) {
                addToCart(matchedDrug);
                // The search term is cleared inside addToCart, which re-triggers this effect with an empty string, stopping the loop.
            }
        }
    }, [searchTerm, isScanModeActive, drugs]); // This will run whenever searchTerm changes in scan mode

    const updateQuantity = (drugId: number, quantity: number) => {
        const drugInStock = drugs?.find(d => d.id === drugId);
        if (!drugInStock) return;

        const newQuantity = Math.max(0, Math.min(quantity, drugInStock.totalStock));
        if (newQuantity === 0) {
            removeFromCart(drugId);
            return;
        }

        setCart(cart.map(item =>
            item.drugId === drugId
                ? { ...item, quantity: newQuantity, totalPrice: item.unitPrice * newQuantity }
                : item
        ));
    };

    const removeFromCart = (drugId: number) => {
        setCart(cart.filter(item => item.drugId !== drugId));
    };

    const totalAmount = useMemo(() => {
        return cart.reduce((sum, item) => sum + item.totalPrice, 0);
    }, [cart]);

    const handleCheckout = async () => {
        if (cart.length === 0) return;

        if (isOnline) {
            console.log("[Checkout] Online mode. Using RPC for atomic transaction.");
            try {
                const rpcPayload = {
                    p_items: cart.map(item => {
                        const drug = drugs?.find(d => d.id === item.drugId);
                        return {
                            drug_id: drug?.remoteId,
                            name: item.name, // FIX: Added missing 'name' field
                            quantity: item.quantity,
                            unit_price: item.unitPrice,
                        };
                    }),
                    p_total_amount: totalAmount,
                    p_date: new Date().toISOString(),
                };
                
                if (rpcPayload.p_items.some(item => !item.drug_id)) {
                    showNotification('برخی داروها هنوز با سرور همگام‌سازی نشده‌اند. لطفاً لحظه‌ای صبر کرده و دوباره تلاش کنید.', 'error');
                    return;
                }

                const { data, error } = await supabase.rpc('create_sale_invoice_transaction', { p_payload: rpcPayload });

                if (error) throw error;
                
                if (data.success) {
                    const newInvoiceForPrint: SaleInvoice = {
                        remoteId: data.new_invoice_id,
                        date: rpcPayload.p_date,
                        items: cart.map(c => ({ ...c, deductions: [] })),
                        totalAmount: totalAmount,
                    };
                    
                    // Add a minimal version to Dexie for "Recent Invoices" list.
                    // The real-time subscription will update the stock levels automatically.
                    await db.saleInvoices.add(newInvoiceForPrint);

                    setInvoiceToPrint(newInvoiceForPrint);
                    setCart([]);
                    showNotification(data.message, 'success');
                } else {
                    throw new Error(data.message);
                }

            } catch (error: any) {
                console.error("Online checkout failed:", error);
                showNotification(`فروش آنلاین با خطا مواجه شد: ${error.message || 'خطای سرور'}`, 'error');
            }
        } else {
            console.log("[Checkout] Offline mode. Using local DB transaction.");
            try {
                const newInvoiceId = await db.transaction('rw', db.saleInvoices, db.drugs, db.drugBatches, db.syncQueue, async () => {
                    const itemsWithDeductions: SaleItem[] = [];
                    for (const item of cart) {
                        let quantityToDeduct = item.quantity;
                        const itemDeductions: { batchId: number; quantity: number }[] = [];

                        const batches = await db.drugBatches
                            .where('drugId').equals(item.drugId)
                            .and(batch => batch.quantityInStock > 0)
                            .sortBy('expiryDate');

                        for (const batch of batches) {
                            if (quantityToDeduct === 0) break;
                            const deduction = Math.min(quantityToDeduct, batch.quantityInStock);
                            
                            await db.drugBatches.update(batch.id!, {
                                quantityInStock: batch.quantityInStock - deduction
                            });
                            itemDeductions.push({ batchId: batch.id!, quantity: deduction });
                            quantityToDeduct -= deduction;
                        }

                        if (quantityToDeduct > 0) {
                            throw new Error(`موجودی برای ${item.name} کافی نیست.`);
                        }

                        await db.drugs.where('id').equals(item.drugId).modify(drug => {
                            drug.totalStock -= item.quantity;
                        });

                        itemsWithDeductions.push({ ...item, deductions: itemDeductions });
                    }

                    const invoice: Omit<SaleInvoice, 'id'> = {
                        date: new Date().toISOString(),
                        items: itemsWithDeductions,
                        totalAmount: totalAmount,
                    };
                    
                    const createdInvoiceId = await db.saleInvoices.add(invoice as SaleInvoice);

                    await db.syncQueue.add({
                        table: 'saleInvoices',
                        action: 'create',
                        recordId: createdInvoiceId,
                        payload: {},
                        timestamp: Date.now(),
                    });

                    return createdInvoiceId;
                });

                const finalInvoice = await db.saleInvoices.get(newInvoiceId);
                setInvoiceToPrint(finalInvoice!);
                setCart([]);
                showNotification('فاکتور با موفقیت ثبت و در صف همگام‌سازی قرار گرفت.', 'success');
                
                // Immediately attempt to process queue, just in case connection comes back
                processSyncQueue();

            } catch (error) {
                console.error("Failed to process sale:", error);
                showNotification(error instanceof Error ? error.message : 'خطا در پردازش فروش.', 'error');
            }
        }
    };
    
    const handleOpenEditModal = (invoice: SaleInvoice) => {
        setEditingInvoice(invoice);
    };
    
    // --- Date Filter Handlers ---
    const applyCustomDateFilter = () => {
        const start = customDateInputs.start ? parseJalaliDate(customDateInputs.start) : null;
        const end = customDateInputs.end ? parseJalaliDate(customDateInputs.end) : null;

        if (start && end && start > end) {
            showNotification('تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.', 'error');
            return;
        }

        const startISO = start ? getISODateForFilter(start) : null;
        // To include the whole end day, set time to 23:59:59
        if (end) end.setHours(23, 59, 59, 999);
        const endISO = end ? getISODateForFilter(end) : null;

        setDateFilter({ start: startISO, end: endISO || new Date().toISOString() });
    };

    const setQuickFilter = (period: 'today' | 'week' | 'month') => {
        const end = new Date();
        const start = new Date();
        end.setHours(23, 59, 59, 999);
        start.setHours(0, 0, 0, 0);

        if (period === 'week') {
            start.setDate(start.getDate() - start.getDay()); // Assuming week starts on Sunday
        } else if (period === 'month') {
            start.setDate(1);
        }
        
        setDateFilter({ start: getISODateForFilter(start), end: getISODateForFilter(end) });
        setCustomDateInputs({start: '', end: ''});
    };

    const clearFilter = () => {
        setDateFilter({ start: null, end: null });
        setCustomDateInputs({start: '', end: ''});
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            <div className="lg:col-span-2 flex flex-col gap-6">
                {/* Search and Results */}
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 flex flex-col">
                    <div className="relative mb-4">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            name="drugSearchInput"
                            placeholder="جستجوی دارو بر اساس نام یا بارکد..."
                            className="w-full bg-gray-700/50 border border-gray-600 rounded-lg py-2 pr-10 pl-4 text-white focus:outline-none focus:border-blue-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="flex-grow space-y-2 overflow-y-auto">
                        {filteredDrugs.map(drug => (
                            <div key={drug.id} onClick={() => addToCart(drug)} className="p-3 bg-gray-700 rounded-lg flex justify-between items-center cursor-pointer hover:bg-blue-600 transition-colors">
                                <div>
                                    <p className="font-semibold text-white">{drug.name}</p>
                                    <p className="text-sm text-gray-400">موجودی: {drug.totalStock} | قیمت: ${drug.salePrice.toFixed(2)}</p>
                                </div>
                                <Plus className="text-green-400" />
                            </div>
                        ))}
                    </div>
                </div>
                 {/* Recent Invoices */}
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 flex flex-col">
                    <div className="border-b border-gray-600 pb-3 mb-3">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <History size={20} />
                            فاکتورهای اخیر
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mt-3 text-sm">
                            <Filter size={16} className="text-gray-400"/>
                            <button onClick={() => setQuickFilter('today')} className="btn-filter">امروز</button>
                            <button onClick={() => setQuickFilter('week')} className="btn-filter">این هفته</button>
                            <button onClick={() => setQuickFilter('month')} className="btn-filter">این ماه</button>
                            <input type="text" placeholder="از YYYY/MM/DD" value={customDateInputs.start} onChange={e => setCustomDateInputs(p => ({...p, start: e.target.value}))} onBlur={applyCustomDateFilter} className="input-date"/>
                            <input type="text" placeholder="تا YYYY/MM/DD" value={customDateInputs.end} onChange={e => setCustomDateInputs(p => ({...p, end: e.target.value}))} onBlur={applyCustomDateFilter} className="input-date"/>
                            {(dateFilter.start || dateFilter.end) && (
                                <button onClick={clearFilter} className="flex items-center gap-1 text-red-400 hover:text-red-300 text-xs p-1 rounded-full bg-red-500/10 hover:bg-red-500/20"><XCircle size={14}/>پاک کردن فیلتر</button>
                            )}
                        </div>
                    </div>
                    <div className="space-y-2 overflow-y-auto pr-2 -mr-2 max-h-96">
                        {recentInvoices?.map(inv => (
                            <div key={inv.id} className="p-3 bg-gray-700/60 rounded-lg flex justify-between items-center">
                                <div>
                                    <p className="font-semibold text-white">فاکتور #{inv.remoteId || inv.id}</p>
                                    <p className="text-sm text-gray-400">{new Date(inv.date).toLocaleString('fa-IR')} - ${inv.totalAmount.toFixed(2)}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                     <button onClick={() => setInvoiceToPrint(inv)} className="flex items-center gap-2 text-sm px-3 py-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-500">
                                        <Printer size={14} />
                                        <span>چاپ</span>
                                    </button>
                                    {hasPermission('sales:edit') && (
                                        <button 
                                            onClick={() => handleOpenEditModal(inv)} 
                                            disabled={!isOnline}
                                            title={!isOnline ? "این عملیات در حالت آفلاین در دسترس نیست" : "ویرایش"}
                                            className="flex items-center gap-2 text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed">
                                            <Edit size={14} />
                                            <span>ویرایش</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                         {recentInvoices?.length === 0 && (
                            <p className="text-center text-gray-500 py-8">هیچ فاکتوری برای این بازه زمانی یافت نشد.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Cart */}
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 flex flex-col">
                <div className="flex justify-between items-center mb-4 border-b border-gray-600 pb-3">
                    <h3 className="text-xl font-bold text-white">سبد خرید</h3>
                    <div className="flex items-center gap-2">
                         <button 
                            onClick={() => setIsScanModeActive(prev => !prev)}
                            title={isScanModeActive ? 'غیرفعال کردن حالت اسکن' : 'فعال کردن حالت اسکن برای فروش'}
                            className={`p-2 rounded-full transition-colors ${isScanModeActive ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}
                        >
                            <Barcode size={20} />
                        </button>
                        <VoiceControlHeader {...voiceControls} />
                    </div>
                </div>
                <div className="flex-grow space-y-3 overflow-y-auto pr-2 -mr-2">
                    {cart.length === 0 && <p className="text-gray-500 text-center mt-8">سبد خرید خالی است.</p>}
                    {cart.map(item => (
                        <div key={item.drugId} className="p-3 bg-gray-700/60 rounded-lg flex items-center justify-between">
                             <div>
                                <p className="font-semibold text-white text-sm">{item.name}</p>
                                <p className="text-xs text-gray-400">${item.unitPrice.toFixed(2)} x {item.quantity}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 bg-gray-800 rounded-full p-1">
                                    <button onClick={() => updateQuantity(item.drugId, item.quantity + 1)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-600"><Plus size={14} /></button>
                                    <span className="w-5 text-center text-sm">{item.quantity}</span>
                                    <button onClick={() => updateQuantity(item.drugId, item.quantity - 1)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-600"><Minus size={14} /></button>
                                </div>
                                <button onClick={() => removeFromCart(item.drugId)} className="text-red-400 hover:text-red-300"><X size={16} /></button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="border-t border-gray-600 pt-4 mt-4">
                    <div className="flex justify-between items-center text-lg font-bold text-white mb-4">
                        <span>مجموع:</span>
                        <span>${totalAmount.toFixed(2)}</span>
                    </div>
                    <button
                        onClick={handleCheckout}
                        disabled={cart.length === 0 || !hasPermission('sales:create')}
                        title={!hasPermission('sales:create') ? "شما دسترسی لازم برای ثبت فاکتور را ندارید." : ""}
                        className="w-full py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors">
                        ثبت فاکتور
                    </button>
                </div>
            </div>
            {invoiceToPrint && (
                <InvoiceModal invoice={invoiceToPrint} onClose={() => setInvoiceToPrint(null)} />
            )}
            {editingInvoice && (
                <EditInvoiceModal 
                    invoice={editingInvoice} 
                    onClose={() => setEditingInvoice(null)} 
                    onSave={() => {
                        setEditingInvoice(null);
                        // Notification is now handled inside EditInvoiceModal
                    }}
                />
            )}
             <style>{`
                .btn-filter { font-size: 0.8rem; padding: 0.3rem 0.8rem; border-radius: 0.5rem; background-color: #374151; color: #d1d5db; transition: background-color 0.2s; }
                .btn-filter:hover { background-color: #4b5563; }
                .input-date { background-color: #374151; border: 1px solid #4b5563; color: #d1d5db; border-radius: 0.5rem; padding: 0.25rem; font-size: 0.8rem; width: 110px; text-align: center; }
             `}</style>
        </div>
    );
};

const InvoiceModal: React.FC<{invoice: SaleInvoice, onClose: () => void}> = ({invoice, onClose}) => {
    const handlePrint = () => {
        // This is a browser-native function to open the print dialog
        window.print();
    };
    return (
        <Modal title={`فاکتور شماره #${invoice.remoteId || invoice.id}`} onClose={onClose}>
            <div className="space-y-4">
                <PrintableInvoice invoice={invoice} />
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-700 print-hidden">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">بستن</button>
                    <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700">
                        <Printer size={18} />
                        <span>چاپ</span>
                    </button>
                </div>
            </div>
        </Modal>
    );
}


const EditInvoiceModal: React.FC<{ invoice: SaleInvoice; onClose: () => void; onSave: () => void; }> = ({ invoice, onClose, onSave }) => {
    const [items, setItems] = useState(invoice.items);
    const [isSaving, setIsSaving] = useState(false);
    const drugs = useLiveQuery(() => db.drugs.toArray(), []);
    const { showNotification } = useNotification();
    const isOnline = useOnlineStatus();

    const updateQuantity = (drugId: number, quantity: number) => {
        const drugInStock = drugs?.find(d => d.id === drugId);
        const originalItem = invoice.items.find(i => i.drugId === drugId);
        if (!drugInStock || !originalItem) return;

        const maxQuantity = drugInStock.totalStock + originalItem.quantity;
        const newQuantity = Math.max(0, Math.min(quantity, maxQuantity));

        if (newQuantity === 0) {
            setItems(items.filter(item => item.drugId !== drugId));
            return;
        }

        setItems(items.map(item =>
            item.drugId === drugId
                ? { ...item, quantity: newQuantity, totalPrice: item.unitPrice * newQuantity }
                : item
        ));
    };
    
    const removeItem = (drugId: number) => setItems(items.filter(item => item.drugId !== drugId));

    const totalAmount = useMemo(() => items.reduce((sum, item) => sum + item.totalPrice, 0), [items]);

    const handleUpdate = async () => {
        if (!isOnline || !invoice.remoteId) {
            showNotification('ویرایش فاکتور فقط در حالت آنلاین امکان‌پذیر است.', 'error');
            return;
        }
        setIsSaving(true);
        try {
            const drugMap = new Map(drugs?.map(d => [d.id, d.remoteId]));
            const newItemsPayload = [];
            for (const item of items) {
                const remoteDrugId = drugMap.get(item.drugId);
                if (!remoteDrugId) {
                    throw new Error(`داروی "${item.name}" هنوز با سرور همگام‌سازی نشده است.`);
                }
                newItemsPayload.push({
                    drug_id: remoteDrugId,
                    name: item.name,
                    quantity: item.quantity,
                    unit_price: item.unitPrice,
                    total_price: item.totalPrice,
                });
            }

            const rpcPayload = {
                p_invoice_id: invoice.remoteId,
                p_new_items: newItemsPayload,
            };

            const { data, error } = await supabase.rpc('update_sale_invoice_transaction', rpcPayload);

            if (error) throw error;
            // The function returns a TABLE, so data is an array.
            if (!data || data.length === 0 || !data[0].success) {
                 throw new Error(data?.[0]?.message || "تراکنش در پایگاه داده ناموفق بود.");
            }

            // On successful RPC, update local DB transactionally for instant UI feedback
            await db.transaction('rw', db.saleInvoices, db.drugs, async () => {
                const stockChanges = new Map<number, number>();
                
                // Calculate stock changes: + for old items, - for new items
                invoice.items.forEach(oldItem => {
                    stockChanges.set(oldItem.drugId, (stockChanges.get(oldItem.drugId) || 0) + oldItem.quantity);
                });
                items.forEach(newItem => {
                    stockChanges.set(newItem.drugId, (stockChanges.get(newItem.drugId) || 0) - newItem.quantity);
                });

                // Apply stock changes
                for (const [drugId, change] of stockChanges.entries()) {
                    await db.drugs.where('id').equals(drugId).modify(d => {
                        d.totalStock += change;
                    });
                }
                
                // Update the invoice itself
                await db.saleInvoices.update(invoice.id!, {
                    items: items,
                    totalAmount: totalAmount,
                });
            });

            await logActivity('UPDATE', 'SaleInvoice', invoice.remoteId, { old: invoice, new: { ...invoice, items, totalAmount } });
            showNotification(data[0].message, 'success');
            onSave();
        } catch (error: any) {
            console.error("Failed to update invoice:", error);
            const errorMessage = error.message || 'درخواست توسط سرور رد شد. لطفاً از صحت دسترسی‌ها و داده‌های ورودی اطمینان حاصل کنید.';
            showNotification(`خطا در ویرایش فاکتور: ${errorMessage}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal title={`ویرایش فاکتور #${invoice.remoteId || invoice.id}`} onClose={onClose}>
            <div className="flex flex-col" style={{minHeight: '400px'}}>
                <div className="flex-grow space-y-3 overflow-y-auto pr-2 -mr-2">
                    {items.map(item => (
                        <div key={item.drugId} className="p-3 bg-gray-700/60 rounded-lg flex items-center justify-between">
                            <div>
                                <p className="font-semibold text-white text-sm">{item.name}</p>
                                <p className="text-xs text-gray-400">${item.unitPrice.toFixed(2)} x {item.quantity}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 bg-gray-800 rounded-full p-1">
                                    <button onClick={() => updateQuantity(item.drugId, item.quantity + 1)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-600"><Plus size={14} /></button>
                                    <span className="w-5 text-center text-sm">{item.quantity}</span>
                                    <button onClick={() => updateQuantity(item.drugId, item.quantity - 1)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-600"><Minus size={14} /></button>
                                </div>
                                <button onClick={() => removeItem(item.drugId)} className="text-red-400 hover:text-red-300"><X size={16} /></button>
                            </div>
                        </div>
                    ))}
                </div>
                 <div className="border-t border-gray-600 pt-4 mt-4">
                    <div className="flex justify-between items-center text-lg font-bold text-white mb-4">
                        <span>مجموع جدید:</span>
                        <span>${totalAmount.toFixed(2)}</span>
                    </div>
                     <div className="flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">لغو</button>
                        <button type="button" onClick={handleUpdate} disabled={isSaving} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-500">
                            {isSaving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    )
}

export default Sales;