import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../db';
import Header from '../components/Header';
import { Supplier, Payment, PurchaseInvoice } from '../types';
import { Printer } from 'lucide-react';
import PrintableSupplierLedger, { Transaction } from '../components/PrintableSupplierLedger';
import Modal from '../components/Modal';
import { supabase } from '../lib/supabaseClient';
import { parseJalaliDate } from '../lib/dateConverter';
import { useNotification } from '../contexts/NotificationContext';


const SupplierLedgerView: React.FC<{ supplier: Supplier, allPurchases: PurchaseInvoice[], allPayments: Payment[] }> = ({ supplier, allPurchases, allPayments }) => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const { showNotification } = useNotification();
    
    // --- Date Filtering State ---
    const [filterPeriod, setFilterPeriod] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
    const [customDateInputs, setCustomDateInputs] = useState({ start: '', end: '' });

    const dateRange = useMemo(() => {
        const end = new Date();
        const start = new Date();
        end.setHours(23, 59, 59, 999);
        start.setHours(0, 0, 0, 0);

        switch(filterPeriod) {
            case 'today':
                return { start, end };
            case 'week':
                start.setDate(start.getDate() - 7);
                return { start, end };
            case 'month':
                start.setMonth(start.getMonth() - 1);
                return { start, end };
            case 'custom': {
                const customStart = customDateInputs.start ? parseJalaliDate(customDateInputs.start) : null;
                const customEnd = customDateInputs.end ? parseJalaliDate(customDateInputs.end) : null;
                if (customStart && customEnd && customStart > customEnd) {
                    showNotification('تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.', 'error');
                    return null;
                }
                if (customEnd) customEnd.setHours(23, 59, 59, 999);
                return { start: customStart, end: customEnd };
            }
            case 'all':
            default:
                return { start: null, end: null };
        }
    }, [filterPeriod, customDateInputs, showNotification]);


    useEffect(() => {
        const allCombined = [
            ...allPurchases.map(p => ({ type: 'purchase' as const, date: p.date, data: p })),
            ...allPayments.map(p => ({ type: 'payment' as const, date: p.date, data: p })),
        ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        let openingBalance = supplier.totalDebt;
        allCombined.forEach(item => {
            if (item.type === 'purchase') openingBalance -= item.data.totalAmount;
            else openingBalance += item.data.amount;
        });
        
        const processAndSetTransactions = (source: typeof allCombined) => {
            let runningBalance = openingBalance;
            const processed: Transaction[] = [];

            if (Math.abs(openingBalance) > 0.001 || source.length > 0) {
                 processed.push({
                    date: source.length > 0 ? new Date(new Date(source[0].date).getTime() - 1).toISOString() : new Date().toISOString(),
                    description: 'مانده از قبل', debit: 0, credit: 0, balance: openingBalance, isOpeningBalance: true
                });
            }

            source.forEach(item => {
                if (item.type === 'purchase') {
                    const p = item.data;
                    runningBalance += p.totalAmount;
                    processed.push({ date: p.date, description: `بابت فاکتور خرید #${p.invoiceNumber || ''}`, debit: p.totalAmount, credit: 0, balance: runningBalance });
                } else {
                    const p = item.data;
                    runningBalance -= p.amount;
                    processed.push({ date: p.date, description: `پرداخت وجه`, detail: p.recipientName, debit: 0, credit: p.amount, balance: runningBalance });
                }
            });
            return processed;
        }

        if (dateRange && (dateRange.start || dateRange.end)) {
            const start = dateRange.start || new Date(0);
            const end = dateRange.end || new Date();
            
            const beforePeriod = allCombined.filter(t => new Date(t.date) < start);
            const inPeriod = allCombined.filter(t => {
                const itemDate = new Date(t.date);
                return itemDate >= start && itemDate <= end;
            });
            
            let filteredOpeningBalance = supplier.totalDebt;
            [...beforePeriod, ...inPeriod].forEach(item => {
                if (new Date(item.date) >= start) {
                     if (item.type === 'purchase') filteredOpeningBalance -= item.data.totalAmount;
                     else filteredOpeningBalance += item.data.amount;
                }
            });

            setTransactions(processAndSetTransactions(inPeriod));
        } else {
            setTransactions(processAndSetTransactions(allCombined));
        }
    }, [supplier.totalDebt, allPurchases, allPayments, dateRange]);
    

    const finalBalance = supplier.totalDebt;

    const handleApplyCustomFilter = () => {
        setFilterPeriod('custom');
    };

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700 p-6 space-y-4">
            <div className="flex justify-between items-center pb-4 border-b border-gray-700">
                <div>
                    <h3 className="text-2xl font-bold text-white">دفتر کل: {supplier.name}</h3>
                    <p className="text-gray-400">نمایش تمام تراکنش‌های مالی شما</p>
                </div>
                <button 
                    onClick={() => setIsPrintModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Printer size={18} />
                    <span>چاپ صورت حساب</span>
                </button>
            </div>
            {/* Date Filter UI */}
             <div className="flex flex-wrap items-center gap-2 text-sm p-3 bg-gray-700/40 rounded-lg">
                <span className="font-semibold">فیلتر زمانی:</span>
                <button onClick={() => setFilterPeriod('all')} className={`btn-filter ${filterPeriod === 'all' && 'active'}`}>همه</button>
                <button onClick={() => setFilterPeriod('today')} className={`btn-filter ${filterPeriod === 'today' && 'active'}`}>امروز</button>
                <button onClick={() => setFilterPeriod('week')} className={`btn-filter ${filterPeriod === 'week' && 'active'}`}>این هفته</button>
                <button onClick={() => setFilterPeriod('month')} className={`btn-filter ${filterPeriod === 'month' && 'active'}`}>این ماه</button>
                 <div className="flex items-center gap-1">
                    <input type="text" placeholder="از: ۱۴۰۳/۰۱/۰۱" value={customDateInputs.start} onChange={e => setCustomDateInputs(p => ({...p, start: e.target.value}))} className="input-date"/>
                    <input type="text" placeholder="تا: ۱۴۰۳/۱۲/۲۹" value={customDateInputs.end} onChange={e => setCustomDateInputs(p => ({...p, end: e.target.value}))} className="input-date"/>
                    <button onClick={handleApplyCustomFilter} className="btn-filter-apply">اعمال</button>
                </div>
            </div>

            <div className="p-4 bg-gray-900/50 rounded-lg flex justify-between items-center">
                <span className="font-semibold text-gray-300">مانده حساب نهایی:</span>
                <span className={`text-xl font-bold ${finalBalance > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                    ${Math.abs(finalBalance).toFixed(2)}
                     {finalBalance < 0 ? ' (بستانکار)' : ' (بدهکار)'}
                </span>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
                <PrintableSupplierLedger supplier={supplier} transactions={transactions} />
            </div>
            {isPrintModalOpen && (
                <PrintLedgerModal 
                    supplier={supplier}
                    transactions={transactions} 
                    onClose={() => setIsPrintModalOpen(false)} 
                />
            )}
             <style>{`
                .btn-filter { font-size: 0.8rem; padding: 0.3rem 0.8rem; border-radius: 0.5rem; background-color: #374151; color: #d1d5db; transition: background-color 0.2s; }
                .btn-filter:hover { background-color: #4b5563; }
                .btn-filter.active { background-color: #2563eb; color: white; }
                .btn-filter-apply { font-size: 0.8rem; padding: 0.3rem 0.8rem; border-radius: 0.5rem; background-color: #16a34a; color: white; }
                .input-date { background-color: #374151; border: 1px solid #4b5563; color: #d1d5db; border-radius: 0.5rem; padding: 0.25rem; font-size: 0.8rem; width: 110px; text-align: center; }
             `}</style>
        </div>
    );
}

const PrintLedgerModal: React.FC<{ supplier: Supplier, transactions: Transaction[], onClose: () => void }> = ({ supplier, transactions, onClose }) => {
    return (
        <Modal title={`چاپ دفتر کل: ${supplier.name}`} onClose={onClose}>
            <div className="space-y-4">
                <PrintableSupplierLedger supplier={supplier} transactions={transactions} />
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-700 print-hidden">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">بستن</button>
                    <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700">
                        <Printer size={18} />
                        <span>چاپ</span>
                    </button>
                </div>
                <style>{`@media print { .print-hidden { display: none; } }`}</style>
            </div>
        </Modal>
    );
};


const SupplierPortal: React.FC = () => {
  const { currentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State to hold the synced data
  const [supplierData, setSupplierData] = useState<Supplier | null>(null);
  const [purchaseData, setPurchaseData] = useState<PurchaseInvoice[]>([]);
  const [paymentData, setPaymentData] = useState<Payment[]>([]);

  
  // Just-in-Time Sync Effect: This is the core fix.
  useEffect(() => {
    const syncSupplierData = async () => {
        setIsLoading(true);
        setError(null);

        if (currentUser?.type !== 'supplier') {
            setError('دسترسی نامعتبر.');
            setIsLoading(false);
            return;
        }

        if (!navigator.onLine) {
            setError('برای مشاهده پورتال، لطفا به اینترنت متصل شوید.');
            setIsLoading(false);
            return;
        }

        try {
             const supplierId = currentUser.supplierId;

             // Fetch all necessary data for this supplier from Supabase
             const [supplierRes, purchasesRes, paymentsRes] = await Promise.all([
                 supabase.from('suppliers').select('*').eq('id', supplierId).single(),
                 supabase.from('purchase_invoices').select('*').eq('supplier_id', supplierId),
                 supabase.from('payments').select('*').eq('supplier_id', supplierId)
             ]);

             if (supplierRes.error) throw new Error(`تامین‌کننده یافت نشد: ${supplierRes.error.message}`);
             if (purchasesRes.error) throw purchasesRes.error;
             if (paymentsRes.error) throw paymentsRes.error;
             
             const liveSupplier: Supplier = {
                 id: supplierRes.data.id, remoteId: supplierRes.data.id,
                 name: supplierRes.data.name, contactPerson: supplierRes.data.contact_person,
                 phone: supplierRes.data.phone, totalDebt: supplierRes.data.total_debt,
             };

             const livePurchases: PurchaseInvoice[] = purchasesRes.data.map((p: any) => ({
                 id: p.id, remoteId: p.id, invoiceNumber: p.invoice_number, supplierId: liveSupplier.id!,
                 date: p.date, totalAmount: p.total_amount, amountPaid: p.amount_paid, items: []
             }));

             const livePayments: Payment[] = paymentsRes.data.map((p: any) => ({
                 id: p.id, remoteId: p.id, supplierId: liveSupplier.id!, amount: p.amount,
                 date: p.date, recipientName: p.recipient_name, description: p.description
             }));
             
             // Set state directly with the fresh data
             setSupplierData(liveSupplier);
             setPurchaseData(livePurchases);
             setPaymentData(livePayments);
             
        } catch(err: any) {
            console.error("Failed to sync supplier portal data:", err);
            setError(err.message || 'خطا در بارگذاری اطلاعات. لطفا با مدیر سیستم تماس بگیرید.');
        } finally {
            setIsLoading(false);
        }
    };
    
    syncSupplierData();
  }, [currentUser]);

  
  const renderContent = () => {
    if (isLoading) {
        return (
             <div className="flex h-screen w-full items-center justify-center bg-gray-900">
                <p className="text-lg text-gray-300">در حال بارگذاری اطلاعات...</p>
             </div>
        );
    }
    
    if (error) {
        return (
             <div className="flex h-screen w-full items-center justify-center bg-gray-900">
                <p className="text-lg text-red-400">{error}</p>
             </div>
        );
    }
    
    if (!supplierData) {
        return (
             <div className="flex h-screen w-full items-center justify-center bg-gray-900">
                <p className="text-lg text-red-400">اطلاعات تامین‌کننده یافت نشد.</p>
             </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
          <Header currentPageTitle={`پورتال تامین‌کننده`} />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <SupplierLedgerView 
                supplier={supplierData} 
                allPurchases={purchaseData}
                allPayments={paymentData}
            />
          </main>
        </div>
    );
  }

  return renderContent();
};

export default SupplierPortal;