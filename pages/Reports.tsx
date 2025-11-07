import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { SaleInvoice, PurchaseInvoice, Drug, Supplier, Payment, DrugBatch } from '../types';
import { TrendingUp, DollarSign, Archive, Printer, ListOrdered, ChevronLeft, Package, Users, PackageOpen, FileText, Banknote, ChevronsDown, Barcode } from 'lucide-react';
import Modal from '../components/Modal';
import { parseJalaliDate } from '../lib/dateConverter';
import PrintablePurchaseInvoice from '../components/PrintablePurchaseInvoice';
import PrintableSupplierLedger, { Transaction } from '../components/PrintableSupplierLedger';
import { supabase } from '../lib/supabaseClient';
import PrintableBarcodeLabels from '../components/PrintableBarcodeLabels';


// ============================================================================
// Main Reports Component
// ============================================================================
const Reports: React.FC = () => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    startOfMonth.setHours(0,0,0,0);

    const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>({
        start: startOfMonth,
        end: new Date()
    });
    
    const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center print-hidden">
                <h2 className="text-3xl font-bold text-white">گزارشات پیشرفته</h2>
            </div>

            <div id="main-reports-content" className="space-y-8">
                <DateFilter onDateChange={setDateRange} />
                <KPIs dateRange={dateRange} />
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
                    <SupplierReports dateRange={dateRange} />
                    <InventoryStockReport />
                </div>
                
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 space-y-4 print-hidden">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Barcode size={22}/> چاپ بارکدهای داخلی
                    </h3>
                    <p className="text-sm text-gray-400">
                        چاپ برچسب برای تمام داروهایی که دارای بارکد داخلی هستند. این برچسب‌ها شامل نام دارو و بارکد قابل اسکن می‌باشند و می‌توانند برای چسباندن روی محصولات استفاده شوند.
                    </p>
                    <button onClick={() => setIsBarcodeModalOpen(true)} className="btn-primary flex items-center gap-2">
                        <Printer size={16}/> نمایش و چاپ برچسب‌ها
                    </button>
                </div>

            </div>
            
            {isBarcodeModalOpen && (
                <PrintPreviewModal title="چاپ برچسب‌های بارکد داخلی" onClose={() => setIsBarcodeModalOpen(false)}>
                    <PrintableBarcodeLabels />
                </PrintPreviewModal>
            )}

            <style>{`
                .btn-primary { 
                    font-size: 0.875rem; 
                    padding: 0.5rem 1rem; 
                    border-radius: 0.5rem; 
                    background-color: #2563eb; 
                    color: white;
                    transition: background-color 0.2s;
                }
                .btn-primary:hover {
                    background-color: #1d4ed8;
                }
            `}</style>
        </div>
    );
};

// ============================================================================
// Date Filter Component
// ============================================================================
const DateFilter: React.FC<{ onDateChange: (range: { start: Date, end: Date }) => void }> = ({ onDateChange }) => {
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    const setPresetRange = (preset: 'today' | 'this_month' | 'last_month') => {
        let end = new Date();
        let start = new Date();
        end.setHours(23, 59, 59, 999);
        start.setHours(0, 0, 0, 0);

        if (preset === 'this_month') {
            start.setDate(1);
        } else if (preset === 'last_month') {
            end = new Date(start.getFullYear(), start.getMonth(), 0);
            start = new Date(end.getFullYear(), end.getMonth(), 1);
            end.setHours(23, 59, 59, 999);
        }
        
        onDateChange({ start, end });
        setCustomStart('');
        setCustomEnd('');
    };
    
    const applyCustomRange = () => {
        const start = customStart ? parseJalaliDate(customStart) : null;
        let end: Date | null = customEnd ? parseJalaliDate(customEnd) : new Date();

        if (start) start.setHours(0,0,0,0);
        if (end) end.setHours(23,59,59,999);

        if (start && end && start > end) {
            alert("تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.");
            return;
        }

        if(start) {
            onDateChange({ start, end: end || new Date() });
        }
    };

    return (
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex flex-wrap items-center justify-between gap-4 print-hidden">
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-gray-300">بازه زمانی گزارش:</span>
                <button onClick={() => setPresetRange('today')} className="btn-filter">امروز</button>
                <button onClick={() => setPresetRange('this_month')} className="btn-filter">این ماه</button>
                <button onClick={() => setPresetRange('last_month')} className="btn-filter">ماه گذشته</button>
            </div>
             <div className="flex items-center gap-2 flex-wrap">
                <input type="text" placeholder="از: ۱۴۰۳/۰۱/۰۱" value={customStart} onChange={e => setCustomStart(e.target.value)} className="input-date"/>
                <input type="text" placeholder="تا: ۱۴۰۳/۱۲/۲۹" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="input-date"/>
                <button onClick={applyCustomRange} className="btn-filter-apply">اعمال</button>
            </div>
            <style>{`
                .btn-filter { font-size: 0.875rem; padding: 0.5rem 1rem; border-radius: 0.5rem; background-color: #374151; color: #d1d5db; transition: background-color 0.2s; }
                .btn-filter:hover { background-color: #4b5563; }
                .btn-filter-apply { font-size: 0.875rem; padding: 0.5rem 1rem; border-radius: 0.5rem; background-color: #2563eb; color: white; }
                .input-date { background-color: #374151; border: 1px solid #4b5563; color: #d1d5db; border-radius: 0.5rem; padding: 0.4rem; font-size: 0.875rem; width: 150px; text-align: center; }
            `}</style>
        </div>
    );
};

// ============================================================================
// KPIs Section
// ============================================================================
const KPIs: React.FC<{ dateRange: { start: Date, end: Date } }> = ({ dateRange }) => {
    const allDrugs = useLiveQuery(() => db.drugs.toArray(), []);
    const allSaleInvoices = useLiveQuery(() => db.saleInvoices.toArray(), []);
    
    const inventoryValue = useMemo(() => {
        if (!allDrugs) return 0;
        return allDrugs.reduce((sum, drug) => sum + ((Number(drug.totalStock) || 0) * (Number(drug.purchasePrice) || 0)), 0);
    }, [allDrugs]);

    const salesAndProfit = useMemo(() => {
        if (!allSaleInvoices || !allDrugs) return { totalSales: 0, netProfit: 0 };
        
        const drugCosts = new Map(allDrugs.map(d => [d.id!, Number(d.purchasePrice) || 0]));
        
        const filteredInvoices = allSaleInvoices.filter(inv => {
            const invDate = new Date(inv.date);
            return invDate >= dateRange.start && invDate <= dateRange.end;
        });

        let totalSales = 0;
        let totalCost = 0;

        for (const invoice of filteredInvoices) {
            totalSales += Number(invoice.totalAmount) || 0;
            for (const item of invoice.items) {
                const cost = drugCosts.get(item.drugId) || 0;
                // FIX: Defensively cast item.quantity to a number. Data from the database might not strictly
                // conform to the 'number' type, and this prevents runtime errors if it's null, undefined, or a non-numeric string.
                totalCost += (Number(item.quantity) || 0) * Number(cost);
            }
        }
        
        const netProfit = totalSales - totalCost;
        return { totalSales, netProfit };
    }, [dateRange, allSaleInvoices, allDrugs]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 flex items-center gap-4">
                <div className="p-3 bg-purple-500/20 rounded-full"><Archive size={28} className="text-purple-400"/></div>
                <div>
                    <p className="text-sm text-gray-400">ارزش کل موجودی انبار</p>
                    <p className="text-2xl font-bold text-white">${inventoryValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                </div>
            </div>
             <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 flex items-center gap-4">
                <div className="p-3 bg-blue-500/20 rounded-full"><Banknote size={28} className="text-blue-300"/></div>
                <div>
                    <p className="text-sm text-gray-400">مجموع فروش (در بازه)</p>
                    <p className="text-2xl font-bold text-white">${salesAndProfit.totalSales.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                </div>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 flex items-center gap-4">
                <div className="p-3 bg-green-500/20 rounded-full"><TrendingUp size={28} className="text-green-400"/></div>
                <div>
                    <p className="text-sm text-gray-400">سود خالص (در بازه)</p>
                    <p className={`text-2xl font-bold ${salesAndProfit.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>${salesAndProfit.netProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// Inventory Stock Report Section
// ============================================================================
const InventoryStockReport: React.FC = () => {
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const drugs = useLiveQuery(() => db.drugs.orderBy('name').toArray(), []);
    const batches = useLiveQuery(() => db.drugBatches.toArray(), []);

    const drugsWithBatches = useMemo(() => {
        if (!drugs || !batches) return [];
        const batchMap = new Map<number, DrugBatch[]>();
        for (const batch of batches) {
            if (batch.quantityInStock > 0) {
                if (!batchMap.has(batch.drugId)) {
                    batchMap.set(batch.drugId, []);
                }
                batchMap.get(batch.drugId)!.push(batch);
            }
        }
        return drugs.map(drug => ({
            ...drug,
            batches: batchMap.get(drug.id!)?.sort((a,b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()) || []
        }));
    }, [drugs, batches]);
    
    const ReportContent = () => (
        <table className="w-full text-sm text-right">
            <thead className="text-xs text-gray-400 uppercase bg-gray-800 sticky top-0">
                <tr>
                    <th className="p-2 text-right">نام دارو</th>
                    <th className="p-2 text-center">موجودی کل</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
                {drugsWithBatches.map(drug => (
                    <React.Fragment key={drug.id}>
                        <tr className="font-semibold bg-gray-700/30">
                            <td className="p-2">{drug.name}</td>
                            <td className="p-2 text-center">{drug.totalStock}</td>
                        </tr>
                        {drug.batches.length > 0 && (
                             <tr>
                                <td colSpan={2} className="p-2">
                                    <table className="w-full text-xs bg-gray-900/50 rounded">
                                        <thead className="text-gray-500">
                                            <tr>
                                                <th className="p-1.5 text-right">شماره لات</th>
                                                <th className="p-1.5 text-center">تعداد در این بچ</th>
                                                <th className="p-1.5 text-center">تاریخ انقضا</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-700">
                                            {drug.batches.map(batch => (
                                                <tr key={batch.id}>
                                                    <td className="p-1.5 text-right">{batch.lotNumber}</td>
                                                    <td className="p-1.5 text-center">{batch.quantityInStock}</td>
                                                    <td className="p-1.5 text-center">{new Date(batch.expiryDate).toLocaleDateString('fa-IR')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </td>
                            </tr>
                        )}
                    </React.Fragment>
                ))}
            </tbody>
        </table>
    );

    return (
         <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 space-y-4">
            <div className="flex justify-between items-center">
                 <h3 className="text-xl font-bold text-white flex items-center gap-2"><Package size={20}/> گزارش کامل موجودی انبار</h3>
                 <button onClick={() => setIsPrintModalOpen(true)} className="btn-secondary print-hidden"><Printer size={16}/> چاپ</button>
            </div>
            <div className="max-h-[80vh] overflow-y-auto report-content-wrapper">
                <ReportContent />
            </div>
            {isPrintModalOpen && (
                <PrintPreviewModal title="پیش‌نمایش گزارش موجودی انبار" onClose={() => setIsPrintModalOpen(false)}>
                    <ReportContent />
                </PrintPreviewModal>
            )}
            <style>{`.btn-secondary { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 1rem; background-color: #4b5563; border-radius: 0.5rem; font-size: 0.875rem; color: white; }`}</style>
        </div>
    );
};

// ============================================================================
// Supplier Reports Section
// ============================================================================
type LedgerTransaction = { date: string; type: 'purchase' | 'payment'; description: string; debit: number; credit: number; balance: number; original: PurchaseInvoice | Payment };

const SupplierReports: React.FC<{ dateRange: { start: Date, end: Date } }> = ({ dateRange }) => {
    const [selectedSupplierId, setSelectedSupplierId] = useState<number | ''>('');
    const [invoiceToView, setInvoiceToView] = useState<PurchaseInvoice | null>(null);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    
    const [supplierTransactions, setSupplierTransactions] = useState<{purchases: PurchaseInvoice[], payments: Payment[]}>({purchases: [], payments: []});
    const [isFetching, setIsFetching] = useState(false);

    const suppliers = useLiveQuery(() => db.suppliers.orderBy('name').toArray(), []);
    const selectedSupplier = useMemo(() => suppliers?.find(s => s.id === selectedSupplierId), [suppliers, selectedSupplierId]);

    useEffect(() => {
        const fetchSupplierData = async () => {
            if (!selectedSupplier?.remoteId) {
                setSupplierTransactions({purchases: [], payments: []});
                return;
            }
            setIsFetching(true);
            try {
                const [purchasesRes, paymentsRes] = await Promise.all([
                    supabase.from('purchase_invoices').select('*, purchase_invoice_items(*)').eq('supplier_id', selectedSupplier.remoteId),
                    supabase.from('payments').select('*').eq('supplier_id', selectedSupplier.remoteId)
                ]);

                if (purchasesRes.error) throw purchasesRes.error;
                if (paymentsRes.error) throw paymentsRes.error;

                const purchases: PurchaseInvoice[] = purchasesRes.data.map((inv: any) => ({
                    ...inv, id: inv.id, remoteId: inv.id, invoiceNumber: inv.invoice_number, supplierId: selectedSupplier.id!, totalAmount: inv.total_amount, amountPaid: inv.amount_paid,
                    items: inv.purchase_invoice_items.map((item: any) => ({
                        drugId: item.drug_id, name: item.name, quantity: item.quantity, purchasePrice: item.purchase_price, lotNumber: item.lot_number, expiryDate: item.expiry_date,
                    }))
                }));

                const payments: Payment[] = paymentsRes.data.map((p: any) => ({
                    ...p, id: p.id, remoteId: p.id, supplierId: selectedSupplier.id!, recipientName: p.recipient_name
                }));
                
                setSupplierTransactions({ purchases, payments });

            } catch (error) {
                console.error("Error fetching supplier data:", error);
                setSupplierTransactions({purchases: [], payments: []});
            } finally {
                setIsFetching(false);
            }
        };
        fetchSupplierData();
    }, [selectedSupplier]);

    const invoicesInPeriod = useMemo(() => {
        return supplierTransactions.purchases.filter(p => {
            const pDate = new Date(p.date);
            return pDate >= dateRange.start && pDate <= dateRange.end;
        }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [dateRange, supplierTransactions.purchases]);

    const ledgerData = useMemo(() => {
        if (!selectedSupplier) return null;

        const totalPurchases = supplierTransactions.purchases.reduce((sum, p) => sum + p.totalAmount, 0);
        const totalPayments = supplierTransactions.payments.reduce((sum, p) => sum + p.amount, 0);

        const combined: { date: string; type: 'purchase' | 'payment'; data: PurchaseInvoice | Payment }[] = [
            ...supplierTransactions.purchases.map(p => ({ date: p.date, type: 'purchase' as const, data: p })),
            ...supplierTransactions.payments.map(p => ({ date: p.date, type: 'payment' as const, data: p }))
        ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        let openingBalance = selectedSupplier.totalDebt - (totalPurchases - totalPayments);
        let runningBalance = openingBalance;
        
        const allTransactions: Transaction[] = [];

        if (combined.length > 0 || openingBalance !== 0) {
            allTransactions.push({
                date: combined.length > 0 ? new Date(new Date(combined[0].date).getTime() - 1).toISOString() : new Date().toISOString(),
                description: 'مانده اولیه',
                debit: 0,
                credit: 0,
                balance: openingBalance,
                isOpeningBalance: true,
            });
        }
        
        combined.forEach(item => {
            if (item.type === 'purchase') {
                const purchase = item.data as PurchaseInvoice;
                runningBalance += purchase.totalAmount;
                allTransactions.push({ date: purchase.date, description: `فاکتور خرید #${purchase.invoiceNumber}`, debit: purchase.totalAmount, credit: 0, balance: runningBalance });
            } else {
                const payment = item.data as Payment;
                runningBalance -= payment.amount;
                allTransactions.push({ date: payment.date, description: `پرداخت وجه به ${payment.recipientName}`, debit: 0, credit: payment.amount, balance: runningBalance });
            }
        });

        return allTransactions;

    }, [selectedSupplier, supplierTransactions]);

    return (
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 space-y-4">
            <div className="flex justify-between items-center">
                 <h3 className="text-xl font-bold text-white flex items-center gap-2"><Users size={20}/> صورت‌حساب جامع تامین‌کننده</h3>
                 <button onClick={() => setIsPrintModalOpen(true)} disabled={!selectedSupplier} className="btn-secondary print-hidden disabled:opacity-50 disabled:cursor-not-allowed"><Printer size={16}/> چاپ</button>
            </div>
            <select value={selectedSupplierId} onChange={e => setSelectedSupplierId(Number(e.target.value))} className="input-style w-full print-hidden">
                <option value="" disabled>-- انتخاب تامین‌کننده --</option>
                {suppliers?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            
            {!selectedSupplier ? (
                <div className="text-center text-gray-500 py-10">یک تامین‌کننده را برای مشاهده گزارش انتخاب کنید.</div>
            ) : isFetching ? (
                 <div className="text-center text-gray-500 py-10">در حال بارگذاری اطلاعات...</div>
            ) : (
                <div className="space-y-6">
                    <div>
                        <h4 className="font-semibold text-lg text-gray-300 mb-2 border-b border-gray-700 pb-2">فاکتورهای خرید (در بازه زمانی)</h4>
                        <div className="max-h-60 overflow-y-auto space-y-2 report-content-wrapper">
                             {invoicesInPeriod.length > 0 ? invoicesInPeriod.map(inv => (
                                <div key={inv.id} className="flex justify-between items-center p-2 bg-gray-700/50 rounded-md">
                                    <div>
                                        <p className="font-semibold">فاکتور #{inv.invoiceNumber}</p>
                                        <p className="text-xs text-gray-400">{new Date(inv.date).toLocaleDateString('fa-IR')}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold">${inv.totalAmount.toFixed(2)}</span>
                                        <button onClick={() => setInvoiceToView(inv)} className="text-blue-400 hover:underline print-hidden text-xs">(مشاهده جزئیات)</button>
                                    </div>
                                </div>
                            )) : <p className="text-sm text-gray-500 text-center p-4">هیچ فاکتور خریدی در این بازه زمانی یافت نشد.</p>}
                        </div>
                    </div>

                     {ledgerData && (
                        <div>
                            <h4 className="font-semibold text-lg text-gray-300 mb-2 border-b border-gray-700 pb-2">دفتر کل دقیق</h4>
                             <div className="max-h-[60vh] overflow-y-auto report-content-wrapper">
                                <PrintableSupplierLedger supplier={selectedSupplier} transactions={ledgerData} />
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {invoiceToView && selectedSupplier && <PurchaseDetailsModal invoice={invoiceToView} supplierName={selectedSupplier.name} onClose={() => setInvoiceToView(null)} />}
            {isPrintModalOpen && selectedSupplier && ledgerData && (
                 <PrintPreviewModal title={`پیش‌نمایش صورت‌حساب: ${selectedSupplier.name}`} onClose={() => setIsPrintModalOpen(false)}>
                    <PrintableSupplierLedger supplier={selectedSupplier} transactions={ledgerData} />
                </PrintPreviewModal>
            )}
             <style>{`.input-style { background-color: #374151; border: 1px solid #4b5563; color: #d1d5db; border-radius: 0.5rem; padding: 0.75rem; width: 100%; }`}</style>
        </div>
    );
};

// ============================================================================
// Shared Modals (Print, Purchase Details)
// ============================================================================

const PrintPreviewModal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => {
    return (
        <Modal title={title} onClose={onClose}>
            <div className="printable-area bg-white text-black p-4">
                {children}
            </div>
            <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-gray-700 print-hidden">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">بستن</button>
                <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700"><Printer size={18}/>چاپ نهایی</button>
            </div>
            <style>{`
                @media print {
                    .printable-area {
                        background: white !important;
                        color: black !important;
                    }
                    /* Content-specific print styles should be in the child components */
                    .report-content-wrapper {
                        max-height: none !important;
                        overflow: visible !important;
                    }
                }
            `}</style>
        </Modal>
    );
};

const PurchaseDetailsModal: React.FC<{ invoice: PurchaseInvoice; supplierName: string; onClose: () => void }> = ({ invoice, supplierName, onClose }) => {
    return (
        <Modal title={`جزئیات فاکتور #${invoice.invoiceNumber}`} onClose={onClose}>
            <PrintablePurchaseInvoice invoice={invoice} supplierName={supplierName} />
             <div className="flex justify-end gap-3 pt-4 border-t border-gray-700 print-hidden">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">بستن</button>
                 <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700"><Printer size={18}/>چاپ</button>
            </div>
        </Modal>
    );
};

export default Reports;