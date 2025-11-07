import React, { useState, useMemo, FormEvent, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Supplier, Payment, PurchaseInvoice, ClinicService, ServiceProvider, ClinicTransaction, SimpleAccountingColumn, SimpleAccountingEntry } from '../types';
import Modal from '../components/Modal';
import { Plus, Printer, Eye, Truck, Stethoscope, BookOpen, Edit, Trash2, Columns, FilePlus, Users, Save, Filter, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { logActivity } from '../lib/activityLogger';
import { supabase } from '../lib/supabaseClient';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import PrintablePaymentReceipt from '../components/PrintablePaymentReceipt';
import PrintableSupplierLedger, { Transaction } from '../components/PrintableSupplierLedger';
import PrintableClinicTicket from '../components/PrintableClinicTicket';
import EditClinicTransactionModal from '../components/EditClinicTransactionModal';
import { parseJalaliDate } from '../lib/dateConverter';


const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; text: string }> = ({ active, onClick, icon, text }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-3 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
            active ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
    >
        {icon}
        {text}
    </button>
);

const Accounting: React.FC = () => {
    const { hasPermission } = useAuth();
    const availableTabs = useMemo(() => {
        const tabs: ('suppliers' | 'clinic' | 'simple')[] = [];
        if (hasPermission('accounting:suppliers:manage')) tabs.push('suppliers');
        if (hasPermission('accounting:clinic:manage')) tabs.push('clinic');
        if (hasPermission('accounting:simple:manage')) tabs.push('simple');
        return tabs;
    }, [hasPermission]);

    const [activeTab, setActiveTab] = useState<('suppliers' | 'clinic' | 'simple') | null>(availableTabs[0] || null);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-white">حسابداری</h2>
                <div className="flex items-center gap-3 p-1 bg-gray-800 rounded-lg">
                    {availableTabs.includes('suppliers') && <TabButton active={activeTab === 'suppliers'} onClick={() => setActiveTab('suppliers')} icon={<Truck size={18} />} text="حسابات تامین‌کنندگان" />}
                    {availableTabs.includes('clinic') && <TabButton active={activeTab === 'clinic'} onClick={() => setActiveTab('clinic')} icon={<Stethoscope size={18} />} text="صندوق کلینیک" />}
                    {availableTabs.includes('simple') && <TabButton active={activeTab === 'simple'} onClick={() => setActiveTab('simple')} icon={<BookOpen size={18} />} text="حسابداری ساده" />}
                </div>
            </div>
            {activeTab === 'suppliers' && <SupplierAccounts />}
            {activeTab === 'clinic' && <ClinicFund />}
            {activeTab === 'simple' && <SimpleAccountingView />}
            {activeTab === null && <div className="text-center text-gray-500 py-10">شما به هیچ بخشی از حسابداری دسترسی ندارید.</div>}
        </div>
    );
};

// ============================================================================
// Supplier Form Modal
// ============================================================================
const SupplierFormModal: React.FC<{ supplier: Supplier | null; onClose: () => void; }> = ({ supplier, onClose }) => {
    const [name, setName] = useState(supplier?.name || '');
    const [contactPerson, setContactPerson] = useState(supplier?.contactPerson || '');
    const [phone, setPhone] = useState(supplier?.phone || '');
    const [isSaving, setIsSaving] = useState(false);
    const { showNotification } = useNotification();
    const isEditing = !!supplier;

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            showNotification('نام تامین‌کننده نمی‌تواند خالی باشد.', 'error');
            return;
        }
        setIsSaving(true);
        try {
            const dataToSave = {
                name: name.trim(),
                contact_person: contactPerson.trim() || null,
                phone: phone.trim() || null,
            };

            if (isEditing && supplier?.id) {
                const { error } = await supabase.from('suppliers').update(dataToSave).eq('id', supplier.remoteId);
                if (error) throw error;
                await db.suppliers.update(supplier.id, { name: dataToSave.name, contactPerson: dataToSave.contact_person, phone: dataToSave.phone });
                await logActivity('UPDATE', 'Supplier', supplier.remoteId!, { old: supplier, new: dataToSave });
                showNotification('اطلاعات تامین‌کننده با موفقیت ویرایش شد.', 'success');
            } else {
                const { data, error } = await supabase.from('suppliers').insert({ ...dataToSave, total_debt: 0 }).select().single();
                if (error) throw error;
                const newSupplier: Supplier = { remoteId: data.id, name: data.name, contactPerson: data.contact_person, phone: data.phone, totalDebt: 0 };
                await db.suppliers.add(newSupplier);
                await logActivity('CREATE', 'Supplier', newSupplier.remoteId!, { newSupplier: data });
                showNotification('تامین‌کننده جدید با موفقیت ثبت شد.', 'success');
            }
            onClose();
        } catch (err: any) {
            console.error("Failed to save supplier:", err);
            showNotification(`خطا در ذخیره تامین‌کننده: ${err.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal title={isEditing ? 'ویرایش تامین‌کننده' : 'ثبت تامین‌کننده جدید'} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input value={name} onChange={e => setName(e.target.value)} placeholder="نام تامین‌کننده" required autoFocus className="input-style" />
                <input value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="شخص مسئول (اختیاری)" className="input-style" />
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="شماره تماس (اختیاری)" className="input-style" />
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-600">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">لغو</button>
                    <button type="submit" disabled={isSaving} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-500">{isSaving ? 'در حال ذخیره...' : (isEditing ? 'ذخیره تغییرات' : 'ثبت')}</button>
                </div>
                <style>{`.input-style { background-color: #1f2937; border: 1px solid #4b5563; color: #d1d5db; border-radius: 0.5rem; padding: 0.75rem; width: 100%; }`}</style>
            </form>
        </Modal>
    );
};


// ============================================================================
// Supplier Accounts Section
// ============================================================================
const SupplierAccounts: React.FC = () => {
    const suppliers = useLiveQuery(() => db.suppliers.orderBy('name').toArray());
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const isOnline = useOnlineStatus();
    const { showNotification } = useNotification();

    const openPaymentModal = (supplier: Supplier) => {
        setSelectedSupplier(supplier);
        setIsPaymentModalOpen(true);
    };

    const openLedgerModal = (supplier: Supplier) => {
        setSelectedSupplier(supplier);
        setIsLedgerModalOpen(true);
    };
    
    const openSupplierModalForNew = () => {
        setEditingSupplier(null);
        setIsSupplierModalOpen(true);
    };

    const openSupplierModalForEdit = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        setIsSupplierModalOpen(true);
    };

    const handleDeleteSupplier = async (supplier: Supplier) => {
        if (!supplier.id || !isOnline) return;

        if (Math.abs(supplier.totalDebt) > 0.01) {
            showNotification('امکان حذف تامین‌کننده‌ای که دارای بدهی یا بستانکاری است وجود ندارد.', 'error');
            return;
        }

        if (window.confirm(`آیا از حذف تامین‌کننده "${supplier.name}" مطمئن هستید؟`)) {
            try {
                const { error } = await supabase.from('suppliers').delete().eq('id', supplier.remoteId);
                if (error) throw error;
                await db.suppliers.delete(supplier.id);
                await logActivity('DELETE', 'Supplier', supplier.remoteId!, { deletedSupplier: supplier });
                showNotification('تامین‌کننده با موفقیت حذف شد.', 'success');
            } catch (err: any) {
                console.error("Failed to delete supplier:", err);
                showNotification(`خطا در حذف: ${err.message}`, 'error');
            }
        }
    };

    const closeModal = () => {
        setSelectedSupplier(null);
        setEditingSupplier(null);
        setIsPaymentModalOpen(false);
        setIsLedgerModalOpen(false);
        setIsSupplierModalOpen(false);
    };

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700">
             <div className="p-4 flex justify-between items-center border-b border-gray-700">
                <h3 className="text-xl font-bold text-white">لیست تامین‌کنندگان</h3>
                <button
                    onClick={openSupplierModalForNew}
                    disabled={!isOnline}
                    title={!isOnline ? "این عملیات در حالت آفلاین در دسترس نیست" : "ثبت تامین‌کننده جدید"}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
                >
                    <Plus size={20} />
                    <span>ثبت تامین‌کننده جدید</span>
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-right text-gray-300">
                    <thead className="text-xs text-gray-400 uppercase bg-gray-700/50">
                        <tr>
                            <th className="px-6 py-3">نام تامین‌کننده</th>
                            <th className="px-6 py-3">بدهی کل</th>
                            <th className="px-6 py-3 text-center">عملیات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {suppliers?.map(supplier => (
                            <tr key={supplier.id}>
                                <td className="px-6 py-4 font-medium text-white">{supplier.name}</td>
                                <td className={`px-6 py-4 font-bold ${supplier.totalDebt > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                                    ${supplier.totalDebt.toFixed(2)}
                                </td>
                                <td className="px-6 py-4 flex items-center justify-center gap-4">
                                    <button onClick={() => openLedgerModal(supplier)} disabled={!isOnline} className="flex items-center gap-2 text-sm text-gray-300 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed" title="مشاهده دفتر کل"><Eye size={16} /> </button>
                                    <button onClick={() => openPaymentModal(supplier)} disabled={!isOnline} className="flex items-center gap-2 text-sm text-green-400 hover:text-green-300 disabled:text-gray-600 disabled:cursor-not-allowed" title="ثبت پرداخت"><Plus size={14} /> </button>
                                    <button onClick={() => openSupplierModalForEdit(supplier)} disabled={!isOnline} className="text-blue-400 hover:text-blue-300 disabled:text-gray-600 disabled:cursor-not-allowed" title="ویرایش"><Edit size={16} /></button>
                                    <button onClick={() => handleDeleteSupplier(supplier)} disabled={!isOnline} className="text-red-400 hover:text-red-300 disabled:text-gray-600 disabled:cursor-not-allowed" title="حذف"><Trash2 size={16} /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {isPaymentModalOpen && selectedSupplier && <PaymentModal supplier={selectedSupplier} onClose={closeModal} />}
            {isLedgerModalOpen && selectedSupplier && <LedgerModal supplier={selectedSupplier} onClose={closeModal} />}
            {isSupplierModalOpen && <SupplierFormModal supplier={editingSupplier} onClose={closeModal} />}
        </div>
    );
};

const PaymentModal: React.FC<{ supplier: Supplier; onClose: () => void }> = ({ supplier, onClose }) => {
    const [amount, setAmount] = useState<number | ''>('');
    const [recipientName, setRecipientName] = useState('');
    const [description, setDescription] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const { showNotification } = useNotification();
    const [paymentToPrint, setPaymentToPrint] = useState<Payment | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!amount || amount <= 0 || !recipientName) {
            showNotification('لطفاً مبلغ و نام گیرنده را وارد کنید.', 'error');
            return;
        }

        if (Number(amount) > supplier.totalDebt && supplier.totalDebt > 0) {
            const confirmed = window.confirm(
                `مبلغ وارد شده (${Number(amount).toFixed(2)}$) از بدهی فعلی شما (${supplier.totalDebt.toFixed(2)}$) بیشتر است. آیا از ثبت این پرداخت و بستانکار شدن تامین‌کننده اطمینان دارید؟`
            );
            if (!confirmed) {
                return;
            }
        }

        setIsSaving(true);
        try {
            const paymentData = {
                p_supplier_id_remote: supplier.remoteId!,
                p_amount: Number(amount),
                p_recipient_name: recipientName,
                p_description: description,
            };

            const { data, error } = await supabase.rpc('create_supplier_payment_transaction', paymentData);

            if (error || !data.success) {
                throw new Error(data?.message || error?.message);
            }
            
            // On success, update local supplier debt and add payment record for UI
            const updatedSupplier = data.updated_supplier;
            await db.suppliers.update(supplier.id!, { totalDebt: updatedSupplier.total_debt });
            
            const newPaymentRemote = data.new_payment;
            const newPayment: Payment = {
                remoteId: newPaymentRemote.id,
                supplierId: supplier.id!,
                amount: newPaymentRemote.amount,
                date: newPaymentRemote.date,
                recipientName: newPaymentRemote.recipient_name,
                description: newPaymentRemote.description,
            };
            await db.payments.add(newPayment);

            await logActivity('CREATE', 'Payment', newPayment.remoteId!, { payment: newPayment });
            showNotification('پرداخت با موفقیت ثبت شد.', 'success');
            setPaymentToPrint(newPayment); // Trigger print view
        } catch (error: any) {
            console.error("Failed to save payment:", error);
            showNotification(`خطا در ثبت پرداخت: ${error.message}`, 'error');
            setIsSaving(false);
        }
    };

    if (paymentToPrint) {
        return (
             <Modal title="چاپ رسید پرداخت" onClose={onClose}>
                <PrintablePaymentReceipt payment={paymentToPrint} supplierName={supplier.name} />
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-700 print-hidden">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">بستن</button>
                    <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700"><Printer size={18}/>چاپ</button>
                </div>
            </Modal>
        )
    }

    return (
        <Modal title={`ثبت پرداخت برای: ${supplier.name}`} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} placeholder="مبلغ پرداخت" required className="input-style" autoFocus />
                <input type="text" value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="نام تحویل گیرنده" required className="input-style" />
                <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="شرح (اختیاری)" className="input-style" />
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-600">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">لغو</button>
                    <button type="submit" disabled={isSaving} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-500">{isSaving ? 'در حال ذخیره...' : 'ثبت پرداخت'}</button>
                </div>
                <style>{`.input-style { background-color: #1f2937; border: 1px solid #4b5563; color: #d1d5db; border-radius: 0.5rem; padding: 0.75rem; width: 100%; }`}</style>
            </form>
        </Modal>
    );
};

const LedgerModal: React.FC<{ supplier: Supplier; onClose: () => void }> = ({ supplier, onClose }) => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
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
        const fetchAndProcessTransactions = async () => {
            setIsLoading(true);
            if (!navigator.onLine || !supplier.remoteId) {
                showNotification('این عملیات نیاز به اتصال اینترنت دارد.', 'error');
                setIsLoading(false);
                return;
            }

            try {
                // JIT Sync: Fetch latest data from Supabase before displaying.
                const [supplierRes, purchasesRes, paymentsRes] = await Promise.all([
                    supabase.from('suppliers').select('total_debt').eq('id', supplier.remoteId).single(),
                    supabase.from('purchase_invoices').select('*').eq('supplier_id', supplier.remoteId),
                    supabase.from('payments').select('*').eq('supplier_id', supplier.remoteId)
                ]);

                if (supplierRes.error) throw supplierRes.error;
                if (purchasesRes.error) throw purchasesRes.error;
                if (paymentsRes.error) throw paymentsRes.error;

                const remoteTotalDebt = supplierRes.data.total_debt;
                await db.suppliers.update(supplier.id!, { totalDebt: remoteTotalDebt });
                
                const remotePurchases: PurchaseInvoice[] = purchasesRes.data.map((p: any) => ({
                    date: p.date, invoiceNumber: p.invoice_number, totalAmount: p.total_amount, id: p.id, supplierId: supplier.id!, items: [], amountPaid: 0
                }));
                const remotePayments: Payment[] = paymentsRes.data.map((p: any) => ({
                    date: p.date, amount: p.amount, recipientName: p.recipient_name, description: p.description, id: p.id, supplierId: supplier.id!
                }));

                // Combine and sort all transactions by date
                const allCombined = [
                    ...remotePurchases.map(p => ({ type: 'purchase' as const, date: p.date, data: p })),
                    ...remotePayments.map(p => ({ type: 'payment' as const, date: p.date, data: p })),
                ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                
                // Filter based on date range before processing balances
                const filteredCombined = dateRange && (dateRange.start || dateRange.end)
                    ? allCombined.filter(item => {
                        const itemDate = new Date(item.date);
                        const startOk = !dateRange.start || itemDate >= dateRange.start;
                        const endOk = !dateRange.end || itemDate <= dateRange.end;
                        return startOk && endOk;
                    })
                    : allCombined;

                // Calculate opening balance for the filtered period
                let openingBalance = remoteTotalDebt;
                allCombined.forEach(item => {
                    if (new Date(item.date) >= (dateRange?.start || new Date(0))) {
                        if (item.type === 'purchase') openingBalance -= item.data.totalAmount;
                        else openingBalance += item.data.amount;
                    }
                });
                
                let runningBalance = openingBalance;
                const processedTransactions: Transaction[] = [];

                if (Math.abs(openingBalance) > 0.001 || filteredCombined.length > 0) {
                     processedTransactions.push({
                        date: filteredCombined.length > 0 ? new Date(new Date(filteredCombined[0].date).getTime() - 1).toISOString() : new Date().toISOString(),
                        description: 'مانده از قبل', debit: 0, credit: 0, balance: openingBalance, isOpeningBalance: true
                    });
                }

                filteredCombined.forEach(item => {
                    if (item.type === 'purchase') {
                        const p = item.data;
                        runningBalance += p.totalAmount;
                        processedTransactions.push({ date: p.date, description: `فاکتور خرید #${p.invoiceNumber || ''}`, debit: p.totalAmount, credit: 0, balance: runningBalance });
                    } else {
                        const p = item.data;
                        runningBalance -= p.amount;
                        processedTransactions.push({ date: p.date, description: `پرداخت وجه`, detail: p.recipientName, debit: 0, credit: p.amount, balance: runningBalance });
                    }
                });
                
                setTransactions(processedTransactions);

            } catch (err) {
                console.error("Failed to sync ledger data from Supabase:", err);
                showNotification('خطا در همگام‌سازی اطلاعات دفتر کل.', 'error');
            } finally {
                setIsLoading(false);
            }
        };

        fetchAndProcessTransactions();
    }, [supplier.id, supplier.remoteId, dateRange, showNotification]);

    const handleApplyCustomFilter = () => {
        setFilterPeriod('custom'); // This will trigger the useMemo and useEffect
    };

    return (
        <Modal title={`دفتر کل حساب: ${supplier.name}`} onClose={onClose}>
            <div className="p-4 bg-gray-700/50 rounded-lg mb-4 print-hidden">
                 <div className="flex flex-wrap items-center gap-2 text-sm">
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
            </div>
            {isLoading ? <div className="text-center p-8">در حال بارگذاری و همگام‌سازی...</div> : <PrintableSupplierLedger supplier={supplier} transactions={transactions} />}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-700 print-hidden">
                <button onClick={onClose} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">بستن</button>
                <button onClick={() => window.print()} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"><Printer size={18}/>چاپ</button>
            </div>
             <style>{`
                .btn-filter { font-size: 0.8rem; padding: 0.3rem 0.8rem; border-radius: 0.5rem; background-color: #374151; color: #d1d5db; transition: background-color 0.2s; }
                .btn-filter:hover { background-color: #4b5563; }
                .btn-filter.active { background-color: #2563eb; color: white; }
                .btn-filter-apply { font-size: 0.8rem; padding: 0.3rem 0.8rem; border-radius: 0.5rem; background-color: #16a34a; color: white; }
                .input-date { background-color: #374151; border: 1px solid #4b5563; color: #d1d5db; border-radius: 0.5rem; padding: 0.25rem; font-size: 0.8rem; width: 110px; text-align: center; }
            `}</style>
        </Modal>
    )
};


// ============================================================================
// Clinic Fund Section
// ============================================================================
const ClinicFund: React.FC = () => {
    const services = useLiveQuery(() => db.clinicServices.toArray());
    const providers = useLiveQuery(() => db.serviceProviders.toArray());
    
    const [isSaving, setIsSaving] = useState(false);
    const [serviceId, setServiceId] = useState<number | ''>('');
    const [providerId, setProviderId] = useState<number | ''>('');
    const [patientName, setPatientName] = useState('');
    const [ticketToPrint, setTicketToPrint] = useState<ClinicTransaction | null>(null);
    const [transactionToEdit, setTransactionToEdit] = useState<ClinicTransaction | null>(null);
    const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
    const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
    const { showNotification } = useNotification();
    const isOnline = useOnlineStatus();

    // --- Date Filtering State ---
    const [filter, setFilter] = useState<FilterType>('today');
    const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });

    const dateRange = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const dayBefore = new Date(today);
        dayBefore.setDate(today.getDate() - 2);
        
        let startDate: Date;
        let endDate: Date;

        switch (filter) {
            case 'today':
                startDate = today;
                endDate = new Date(today);
                endDate.setDate(today.getDate() + 1);
                break;
            case 'yesterday':
                startDate = yesterday;
                endDate = today;
                break;
            case 'day_before':
                startDate = dayBefore;
                endDate = yesterday;
                break;
            case 'custom':
                const customStart = parseJalaliDate(customDateRange.start);
                const customEnd = parseJalaliDate(customDateRange.end);
                if (customStart && customEnd && customStart > customEnd) return null;
                startDate = customStart || new Date(0);
                if (customEnd) {
                    customEnd.setHours(23, 59, 59, 999);
                    endDate = customEnd;
                } else {
                    endDate = new Date();
                    endDate.setHours(23, 59, 59, 999);
                }
                break;
            default: // 'all'
                 return null;
        }

        return { start: startDate.toISOString(), end: endDate.toISOString() };
    }, [filter, customDateRange]);

    const transactions = useLiveQuery(() => {
        if (dateRange) {
             return db.clinicTransactions
                .where('date')
                .between(dateRange.start, dateRange.end, true, false)
                .reverse()
                .sortBy('date');
        }
        // Fallback for 'all' or invalid range, though 'all' is not used in UI now
        return db.clinicTransactions.orderBy('date').reverse().toArray();
    }, [dateRange]);


    const selectedService = useMemo(() => services?.find(s => s.id === serviceId), [services, serviceId]);
    const serviceMap = useMemo<Map<number, string>>(() => new Map(services?.map(s => [s.id!, s.name]) || []), [services]);
    const providerMap = useMemo<Map<number, string>>(() => new Map(providers?.map(p => [p.id!, p.name]) || []), [providers]);


    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!selectedService) {
            showNotification('لطفا یک خدمت را انتخاب کنید.', 'error');
            return;
        }
        if (selectedService.requiresProvider && !providerId) {
            showNotification('این خدمت نیاز به انتخاب متخصص دارد.', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const service = services?.find(s => s.id === serviceId);
            const provider = providers?.find(p => p.id === providerId);

            if (!service?.remoteId) {
                throw new Error("سرویس انتخاب شده معتبر نیست یا هنوز همگام‌سازی نشده است.");
            }

            const payload = {
                p_service_id_remote: service.remoteId,
                p_provider_id_remote: providerId ? provider?.remoteId : null,
                p_patient_name: patientName.trim(),
                p_amount: service.price,
            };

            const { data, error } = await supabase.rpc('create_clinic_transaction', payload);

            if (error) throw error;
            
            if (data.success) {
                const newRemoteTransaction = data.new_transaction;
                
                const newLocalTransaction: ClinicTransaction = {
                    remoteId: newRemoteTransaction.id,
                    serviceId: service.id!,
                    providerId: provider ? provider.id : undefined,
                    patientName: newRemoteTransaction.patient_name,
                    amount: newRemoteTransaction.amount,
                    date: newRemoteTransaction.date,
                    ticketNumber: newRemoteTransaction.ticket_number,
                };

                const newId = await db.clinicTransactions.add(newLocalTransaction);
                const finalTransactionForPrint = await db.clinicTransactions.get(newId);

                setTicketToPrint(finalTransactionForPrint!);
                setServiceId('');
                setProviderId('');
                setPatientName('');
                showNotification(data.message, 'success');
                await logActivity('CREATE', 'ClinicTransaction', newLocalTransaction.remoteId!, { newTransaction: newLocalTransaction });
            } else {
                throw new Error(data.message || 'خطا در ثبت تراکنش در سرور.');
            }
        } catch(err: any) {
            console.error("Error creating clinic transaction:", err);
            showNotification(err.message || 'خطا در ثبت تراکنش.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    if (ticketToPrint) {
        return (
            <Modal title="چاپ برگه نوبت" onClose={() => setTicketToPrint(null)}>
                <PrintableClinicTicket 
                    transaction={ticketToPrint} 
                    serviceName={serviceMap.get(ticketToPrint.serviceId) || 'سرویس نامشخص'}
                    providerName={ticketToPrint.providerId ? providerMap.get(ticketToPrint.providerId) : undefined}
                />
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-700 print-hidden">
                    <button onClick={() => setTicketToPrint(null)} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">بستن</button>
                    <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700"><Printer size={18}/>چاپ</button>
                </div>
            </Modal>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
                <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-6 border border-gray-700 space-y-4 h-min">
                    <h3 className="text-xl font-bold text-white mb-2">ثبت تراکنش جدید</h3>
                    <select value={serviceId} onChange={e => setServiceId(Number(e.target.value))} required className="input-style">
                        <option value="" disabled>-- انتخاب خدمت --</option>
                        {services?.map(s => <option key={s.id} value={s.id}>{s.name} (${s.price})</option>)}
                    </select>
                    {selectedService?.requiresProvider && (
                        <select value={providerId} onChange={e => setProviderId(Number(e.target.value))} required className="input-style">
                             <option value="" disabled>-- انتخاب متخصص --</option>
                             {providers?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    )}
                    <input type="text" value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="نام بیمار (اختیاری)" className="input-style" />
                    <button type="submit" disabled={isSaving || !isOnline} className="w-full py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed">
                        {isSaving ? 'در حال ثبت...' : 'ثبت و دریافت نوبت'}
                    </button>
                     {!isOnline && <p className="text-xs text-center text-yellow-400">ثبت تراکنش فقط در حالت آنلاین امکان‌پذیر است.</p>}
                </form>
                 <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 space-y-3">
                    <h3 className="text-xl font-bold text-white mb-2">مدیریت</h3>
                    <button onClick={() => setIsServiceModalOpen(true)} disabled={!isOnline} className="w-full flex items-center justify-center gap-2 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed">
                        <Stethoscope size={18} />
                        مدیریت خدمات
                    </button>
                     <button onClick={() => setIsProviderModalOpen(true)} disabled={!isOnline} className="w-full flex items-center justify-center gap-2 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed">
                        <Users size={18} />
                        مدیریت متخصصین
                    </button>
                </div>
            </div>
            <div className="lg:col-span-2 bg-gray-800 rounded-lg p-6 border border-gray-700">
                 <div className="flex flex-wrap justify-between items-center gap-4 mb-4 border-b border-gray-700 pb-4">
                    <h3 className="text-xl font-bold text-white">تراکنش‌ها</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                        <Filter size={16} className="text-gray-400"/>
                        <button onClick={() => setFilter('today')} className={`btn-filter ${filter === 'today' && 'active'}`}>امروز</button>
                        <button onClick={() => setFilter('yesterday')} className={`btn-filter ${filter === 'yesterday' && 'active'}`}>دیروز</button>
                        <button onClick={() => setFilter('day_before')} className={`btn-filter ${filter === 'day_before' && 'active'}`}>پریروز</button>
                        <input type="text" placeholder="از ۱۴۰۳/۰۱/۰۱" value={customDateRange.start} onChange={e => { setFilter('custom'); setCustomDateRange(p => ({...p, start: e.target.value}))}} className="input-date"/>
                        <input type="text" placeholder="تا ۱۴۰۳/۱۲/۲۹" value={customDateRange.end} onChange={e => { setFilter('custom'); setCustomDateRange(p => ({...p, end: e.target.value}))}} className="input-date"/>
                        {filter !== 'today' && (
                            <button onClick={() => { setFilter('today'); setCustomDateRange({start: '', end: ''}); }} className="flex items-center gap-1 text-red-400 hover:text-red-300 text-xs p-1 rounded-full bg-red-500/10 hover:bg-red-500/20"><XCircle size={14}/>پاک کردن فیلتر</button>
                        )}
                    </div>
                </div>
                <div className="max-h-[60vh] overflow-y-auto">
                    <table className="w-full text-sm text-right text-gray-300">
                         <thead className="text-xs text-gray-400 uppercase bg-gray-800 sticky top-0">
                            <tr>
                                <th className="px-4 py-2">نوبت</th>
                                <th className="px-4 py-2">خدمت</th>
                                <th className="px-4 py-2">بیمار</th>
                                <th className="px-4 py-2">مبلغ</th>
                                <th className="px-4 py-2">عملیات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {transactions?.map(t => (
                                <tr key={t.id}>
                                    <td className="px-4 py-2 font-bold text-blue-300">{t.ticketNumber}</td>
                                    <td className="px-4 py-2">{serviceMap.get(t.serviceId) || 'سرویس نامشخص'} {t.providerId ? `- ${providerMap.get(t.providerId) || 'متخصص نامشخص'}` : ''}</td>
                                    <td className="px-4 py-2">{t.patientName || 'عمومی'}</td>
                                    <td className="px-4 py-2">${t.amount.toFixed(2)}</td>
                                    <td className="px-4 py-2 flex gap-2">
                                        <button onClick={() => setTicketToPrint(t)} title="چاپ مجدد"><Printer size={16}/></button>
                                        <button onClick={() => setTransactionToEdit(t)} title="ویرایش"><Edit size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                            {transactions?.length === 0 && (
                                <tr><td colSpan={5} className="text-center py-8 text-gray-500">هیچ تراکنشی برای این بازه زمانی یافت نشد.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {transactionToEdit && <EditClinicTransactionModal transaction={transactionToEdit} onClose={() => setTransactionToEdit(null)} onSave={() => { setTransactionToEdit(null); showNotification('تغییرات با موفقیت ذخیره شد.', 'success'); }} />}
            {isServiceModalOpen && <ServiceManagerModal onClose={() => setIsServiceModalOpen(false)} />}
            {isProviderModalOpen && <ProviderManagerModal onClose={() => setIsProviderModalOpen(false)} />}
            <style>{`
                .input-style { background-color: #1f2937; border: 1px solid #4b5563; color: #d1d5db; border-radius: 0.5rem; padding: 0.75rem; width: 100%; }
                .btn-filter { font-size: 0.8rem; padding: 0.3rem 0.8rem; border-radius: 0.5rem; background-color: #374151; color: #d1d5db; transition: background-color 0.2s; }
                .btn-filter:hover { background-color: #4b5563; }
                .btn-filter.active { background-color: #2563eb; color: white; }
                .input-date { background-color: #374151; border: 1px solid #4b5563; color: #d1d5db; border-radius: 0.5rem; padding: 0.25rem; font-size: 0.8rem; width: 110px; text-align: center; }
            `}</style>
        </div>
    );
}

// ============================================================================
// Simple Accounting Section (Excel-like UI)
// ============================================================================
type FilterType = 'all' | 'today' | 'yesterday' | 'day_before' | 'custom';

const SimpleAccountingView: React.FC = () => {
    const isOnline = useOnlineStatus();
    const { showNotification } = useNotification();
    const [columns, setColumns] = useState<SimpleAccountingColumn[]>([]);
    const [entries, setEntries] = useState<SimpleAccountingEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
    
    // --- Date Filtering State ---
    const [filter, setFilter] = useState<FilterType>('today');
    const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });


    const fetchData = useCallback(async () => {
        if (!isOnline) {
            setIsLoading(false);
            setError("این بخش فقط در حالت آنلاین در دسترس است.");
            setColumns([]);
            setEntries([]);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const [cols, ents] = await Promise.all([
                supabase.from('simple_accounting_columns').select('*').order('order', { ascending: true }),
                supabase.from('simple_accounting_entries').select('*').order('date', { ascending: false }).limit(1000) // Fetch more for client-side filtering
            ]);
            if (cols.error) throw cols.error;
            if (ents.error) throw ents.error;
            setColumns(cols.data.map(c => ({ ...c, remoteId: c.id })));
            setEntries(ents.data.map(e => ({ ...e, id: e.id, remoteId: e.id, patientName: e.patient_name })));
        } catch (err: any) {
            setError("خطا در دریافت اطلاعات حسابداری.");
        } finally {
            setIsLoading(false);
        }
    }, [isOnline]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredEntries = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const dayBefore = new Date(today);
        dayBefore.setDate(today.getDate() - 2);
        
        let startDate: Date;
        let endDate: Date;

        switch (filter) {
            case 'today':
                startDate = today;
                endDate = new Date(today);
                endDate.setDate(today.getDate() + 1);
                break;
            case 'yesterday':
                startDate = yesterday;
                endDate = today;
                break;
            case 'day_before':
                startDate = dayBefore;
                endDate = yesterday;
                break;
            case 'custom':
                const customStart = parseJalaliDate(customDateRange.start);
                const customEnd = parseJalaliDate(customDateRange.end);
                if (customStart && customEnd && customStart > customEnd) return entries;
                startDate = customStart || new Date(0);
                if (customEnd) {
                    customEnd.setHours(23, 59, 59, 999);
                    endDate = customEnd;
                } else {
                    endDate = new Date();
                }
                break;
            default: // 'all'
                return entries;
        }

        const startISO = startDate.toISOString();
        const endISO = endDate.toISOString();

        return entries.filter(entry => entry.date >= startISO && entry.date < endISO);
    }, [filter, customDateRange, entries]);


    const handleUpdateEntry = async (entryId: number, updatedData: Partial<SimpleAccountingEntry>) => {
        try {
            const { error } = await supabase.from('simple_accounting_entries').update({
                date: updatedData.date,
                patient_name: updatedData.patientName,
                description: updatedData.description,
                values: updatedData.values,
            }).eq('id', entryId);
            if (error) throw error;
            // Optimistic update
            setEntries(prev => prev.map(e => e.id === entryId ? { ...e, ...updatedData } : e));
            showNotification("تغییرات ذخیره شد.", "success");
        } catch (err: any) {
            showNotification(`خطا در ذخیره: ${err.message}`, "error");
        }
    };
    
    const handleDeleteEntry = async (entryId: number) => {
        if (!window.confirm("آیا از حذف این رکورد مطمئن هستید؟")) return;
        try {
            const { error } = await supabase.from('simple_accounting_entries').delete().eq('id', entryId);
            if (error) throw error;
            showNotification("رکورد با موفقیت حذف شد.", "success");
            fetchData(); // Full refresh after delete
        } catch (err: any) {
            showNotification(`خطا در حذف رکورد: ${err.message}`, 'error');
        }
    }

    const incomeColumns = useMemo(() => columns.filter(c => c.type === 'income'), [columns]);
    const expenseColumns = useMemo(() => columns.filter(c => c.type === 'expense'), [columns]);

    const columnTotals = useMemo(() => {
        const totals: { [key: number]: number } = {};
        columns.forEach(col => totals[col.id!] = 0);
        
        filteredEntries.forEach(entry => {
            for (const colId in entry.values) {
                if (totals[colId] !== undefined) {
                    totals[colId] += Number(entry.values[colId] || 0);
                }
            }
        });
        return totals;
    }, [filteredEntries, columns]);
    
    if (!isOnline && !isLoading) {
        return (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
                <p className="text-yellow-400">{error}</p>
            </div>
        );
    }

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700">
            <div className="p-4 flex flex-wrap justify-between items-center gap-4 border-b border-gray-700">
                <h3 className="text-xl font-bold">جدول حسابداری ساده</h3>
                <div className="flex items-center gap-2 flex-wrap">
                    <Filter size={16} className="text-gray-400"/>
                    <button onClick={() => setFilter('today')} className={`btn-filter ${filter === 'today' && 'active'}`}>امروز</button>
                    <button onClick={() => setFilter('yesterday')} className={`btn-filter ${filter === 'yesterday' && 'active'}`}>دیروز</button>
                    <button onClick={() => setFilter('day_before')} className={`btn-filter ${filter === 'day_before' && 'active'}`}>پریروز</button>
                    <input type="text" placeholder="از ۱۴۰۳/۰۱/۰۱" value={customDateRange.start} onChange={e => { setFilter('custom'); setCustomDateRange(p => ({...p, start: e.target.value}))}} className="input-date"/>
                    <input type="text" placeholder="تا ۱۴۰۳/۱۲/۲۹" value={customDateRange.end} onChange={e => { setFilter('custom'); setCustomDateRange(p => ({...p, end: e.target.value}))}} className="input-date"/>
                    {filter !== 'all' && (
                        <button onClick={() => { setFilter('all'); setCustomDateRange({start: '', end: ''}); }} className="flex items-center gap-1 text-red-400 hover:text-red-300 text-xs p-1 rounded-full bg-red-500/10 hover:bg-red-500/20"><XCircle size={14}/>پاک کردن فیلتر</button>
                    )}
                </div>
                <button onClick={() => setIsColumnModalOpen(true)} disabled={!isOnline} className="btn-secondary"><Columns size={16}/> مدیریت ستون‌ها</button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-right text-gray-300 simple-accounting-table">
                    <thead>
                        <tr>
                            <th className="sticky-col">تاریخ</th>
                            <th>بیمار</th>
                            <th>شرح</th>
                            {incomeColumns.map(c => <th key={c.id} className="income-header">{c.name}</th>)}
                            {expenseColumns.map(c => <th key={c.id} className="expense-header">{c.name}</th>)}
                            <th>عملیات</th>
                        </tr>
                    </thead>
                    <tbody>
                        <NewEntryRow columns={columns} onSave={fetchData} />
                        {filteredEntries.map(entry => (
                            <tr key={entry.id}>
                                <td className="sticky-col"><EditableCell entry={entry} field="date" onUpdate={handleUpdateEntry} /></td>
                                <td><EditableCell entry={entry} field="patientName" onUpdate={handleUpdateEntry} /></td>
                                <td><EditableCell entry={entry} field="description" onUpdate={handleUpdateEntry} /></td>
                                {incomeColumns.map(c => <td key={c.id}><EditableCell entry={entry} field="values" columnId={c.id} onUpdate={handleUpdateEntry} /></td>)}
                                {expenseColumns.map(c => <td key={c.id}><EditableCell entry={entry} field="values" columnId={c.id} onUpdate={handleUpdateEntry} /></td>)}
                                <td><button onClick={() => handleDeleteEntry(entry.id!)} className="p-1 text-red-500 hover:text-red-400"><Trash2 size={16}/></button></td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-gray-900/50 font-bold">
                        <tr>
                            <td className="sticky-col p-3" colSpan={3}>جمع کل</td>
                            {incomeColumns.map(c => <td key={c.id} className="p-3 text-green-400">${columnTotals[c.id!]?.toFixed(2) || '0.00'}</td>)}
                            {expenseColumns.map(c => <td key={c.id} className="p-3 text-red-400">${columnTotals[c.id!]?.toFixed(2) || '0.00'}</td>)}
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            
            {isColumnModalOpen && <ColumnManagerModal columns={columns} onClose={() => setIsColumnModalOpen(false)} onSave={fetchData} />}
            <style>{`
                .btn-filter { font-size: 0.8rem; padding: 0.3rem 0.8rem; border-radius: 0.5rem; background-color: #374151; color: #d1d5db; transition: background-color 0.2s; }
                .btn-filter:hover { background-color: #4b5563; }
                .btn-filter.active { background-color: #2563eb; color: white; }
                .input-date { background-color: #374151; border: 1px solid #4b5563; color: #d1d5db; border-radius: 0.5rem; padding: 0.25rem; font-size: 0.8rem; width: 110px; text-align: center; }

                .simple-accounting-table { border-collapse: separate; border-spacing: 0; }
                .simple-accounting-table th, .simple-accounting-table td { padding: 8px 12px; border-bottom: 1px solid #374151; white-space: nowrap; }
                .simple-accounting-table thead th { background-color: #374151; position: sticky; top: 0; z-index: 1; }
                .simple-accounting-table .sticky-col { position: sticky; right: 0; background-color: #1f2937; z-index: 2; border-left: 1px solid #4b5563;}
                .simple-accounting-table thead .sticky-col, .simple-accounting-table tfoot .sticky-col { z-index: 3; background-color: #111827; }
                .simple-accounting-table tfoot .sticky-col { background-color: #111827; }
                .simple-accounting-table .income-header { color: #4ade80; }
                .simple-accounting-table .expense-header { color: #f87171; }
                .simple-accounting-table tbody tr:hover .sticky-col { background-color: #374151; }
                .editable-input { width: 100%; min-width: 80px; background: #111827; border: 1px solid #3b82f6; border-radius: 4px; color: white; padding: 4px 6px; }
            `}</style>
        </div>
    );
};

// --- Inline Editable Cell Component ---
const EditableCell: React.FC<{
    entry: SimpleAccountingEntry;
    field: 'date' | 'patientName' | 'description' | 'values';
    columnId?: number;
    onUpdate: (entryId: number, data: Partial<SimpleAccountingEntry>) => void;
}> = ({ entry, field, columnId, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    
    const getValue = useCallback(() => {
        if (field === 'values' && columnId) {
            return entry.values?.[columnId] ?? '';
        }
        return entry[field as keyof Omit<SimpleAccountingEntry, 'id' | 'values' >] ?? '';
    }, [entry, field, columnId]);

    const [value, setValue] = useState(getValue());

    useEffect(() => {
        setValue(getValue());
    }, [getValue]);


    const handleBlur = () => {
        setIsEditing(false);
        const originalValue = getValue();
        if (String(value) === String(originalValue)) return;

        let updatedData: Partial<SimpleAccountingEntry> = {};
        if (field === 'values' && columnId) {
            const newValues = { ...entry.values, [columnId]: Number(value) || 0 };
            updatedData = { values: newValues };
        } else if (field === 'date') {
            updatedData = { [field]: new Date(value as string).toISOString() };
        } else {
            updatedData = { [field]: value };
        }
        onUpdate(entry.id!, updatedData);
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleBlur();
        }
    }

    if (isEditing) {
        return <input 
            type={field === 'date' ? 'date' : field === 'values' ? 'number' : 'text'}
            value={value} 
            onChange={(e) => setValue(e.target.value)} 
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            autoFocus 
            className="editable-input"
        />;
    }
    
    const displayValue = field === 'date' ? new Date(entry.date).toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit'}) : value;

    return <div onClick={() => setIsEditing(true)} className="cursor-pointer min-h-[24px]">{displayValue || '-'}</div>;
}

// --- New Entry Row for Inline Adding ---
const NewEntryRow: React.FC<{ columns: SimpleAccountingColumn[], onSave: () => void }> = ({ columns, onSave }) => {
    const [newEntry, setNewEntry] = useState({ date: new Date().toISOString().split('T')[0], patientName: '', description: '', values: {} as {[key:number]: number | ''} });
    const { showNotification } = useNotification();
    const incomeColumns = columns.filter(c => c.type === 'income');
    const expenseColumns = columns.filter(c => c.type === 'expense');

    const handleUpdate = (field: keyof typeof newEntry, value: any, colId?: number) => {
        if (field === 'values' && colId) {
            setNewEntry(prev => ({ ...prev, values: { ...prev.values, [colId]: value } }));
        } else {
            setNewEntry(prev => ({ ...prev, [field]: value }));
        }
    };
    
    const handleSave = async () => {
        if (!Object.values(newEntry.values).some(v => v && Number(v) !== 0)) {
            // Don't save if no financial value is entered
            return;
        }

        const dataToSave = {
            date: newEntry.date,
            patient_name: newEntry.patientName,
            description: newEntry.description,
            values: Object.fromEntries(Object.entries(newEntry.values).map(([k, v]) => [k, Number(v) || 0]))
        };

        try {
            const { data, error } = await supabase.from('simple_accounting_entries').insert(dataToSave).select().single();
            if (error) throw error;
            await logActivity('CREATE', 'SimpleAccountingEntry', data.id, { newEntry: data });
            showNotification("رکورد جدید ثبت شد.", "success");
            setNewEntry({ date: new Date().toISOString().split('T')[0], patientName: '', description: '', values: {} }); // Reset form
            onSave(); // Trigger data refresh in parent
        } catch (err: any) {
            showNotification(`خطا در ثبت رکورد: ${err.message}`, 'error');
        }
    };

    return (
        <tr className="bg-gray-700/30">
            <td className="sticky-col"><input type="date" value={newEntry.date} onChange={e => handleUpdate('date', e.target.value)} className="editable-input" /></td>
            <td><input type="text" value={newEntry.patientName} onBlur={handleSave} onChange={e => handleUpdate('patientName', e.target.value)} className="editable-input" placeholder="بیمار..." /></td>
            <td><input type="text" value={newEntry.description} onBlur={handleSave} onChange={e => handleUpdate('description', e.target.value)} className="editable-input" placeholder="شرح..." /></td>
            {incomeColumns.map(c => <td key={c.id}><input type="number" value={newEntry.values[c.id!] ?? ''} onBlur={handleSave} onChange={e => handleUpdate('values', e.target.value, c.id)} className="editable-input" /></td>)}
            {expenseColumns.map(c => <td key={c.id}><input type="number" value={newEntry.values[c.id!] ?? ''} onBlur={handleSave} onChange={e => handleUpdate('values', e.target.value, c.id)} className="editable-input" /></td>)}
            <td></td>
        </tr>
    );
};


// ============================================================================
// Modals for Clinic Fund Management
// ============================================================================
const ServiceManagerModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const services = useLiveQuery(() => db.clinicServices.orderBy('name').toArray());
    const [editingService, setEditingService] = useState<ClinicService | null>(null);
    const { showNotification } = useNotification();

    const handleSave = async (serviceData: Omit<ClinicService, 'id' | 'remoteId'>, id?: number) => {
        try {
            if (id) { // Editing
                const oldService = await db.clinicServices.get(id);
                const remoteId = oldService?.remoteId;
                const { error } = await supabase.from('clinic_services').update({ name: serviceData.name, price: serviceData.price, requires_provider: serviceData.requiresProvider }).eq('id', remoteId);
                if (error) throw error;
                await db.clinicServices.update(id, serviceData);
                await logActivity('UPDATE', 'ClinicService', remoteId!, { old: oldService, new: serviceData });
                showNotification('خدمت با موفقیت ویرایش شد.', 'success');
            } else { // Adding
                const { data, error } = await supabase.from('clinic_services').insert({ name: serviceData.name, price: serviceData.price, requires_provider: serviceData.requiresProvider }).select().single();
                if (error) throw error;
                await db.clinicServices.add({ ...serviceData, remoteId: data.id });
                await logActivity('CREATE', 'ClinicService', data.id, { newService: data });
                showNotification('خدمت جدید با موفقیت اضافه شد.', 'success');
            }
            setEditingService(null);
        } catch (error: any) {
            showNotification(`خطا در ذخیره خدمت: ${error.message}`, 'error');
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('آیا از حذف این خدمت مطمئن هستید؟')) return;
        try {
            const serviceToDelete = await db.clinicServices.get(id);
            const { error } = await supabase.from('clinic_services').delete().eq('id', serviceToDelete?.remoteId);
            if (error) throw error;
            await db.clinicServices.delete(id);
            await logActivity('DELETE', 'ClinicService', serviceToDelete!.remoteId!, { deletedService: serviceToDelete });
            showNotification('خدمت با موفقیت حذف شد.', 'success');
        } catch (error: any) {
            showNotification(`خطا در حذف خدمت: ${error.message}`, 'error');
        }
    };

    return (
        <Modal title="مدیریت خدمات کلینیک" onClose={onClose}>
            <div className="space-y-4">
                <div className="max-h-60 overflow-y-auto space-y-2 pr-2 -mr-2">
                    {services?.map(service => (
                        <div key={service.id} className="flex justify-between items-center bg-gray-700/50 p-2 rounded-lg">
                            <div>
                                <p className="font-semibold">{service.name} - ${service.price.toFixed(2)}</p>
                                {service.requiresProvider && <p className="text-xs text-gray-400">نیاز به متخصص دارد</p>}
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setEditingService(service)} className="text-blue-400 hover:text-blue-300"><Edit size={16} /></button>
                                <button onClick={() => handleDelete(service.id!)} className="text-red-400 hover:text-red-300"><Trash2 size={16} /></button>
                            </div>
                        </div>
                    ))}
                </div>
                <ServiceForm key={editingService?.id} service={editingService} onSave={handleSave} onCancel={() => setEditingService(null)} />
            </div>
        </Modal>
    );
};

const ServiceForm: React.FC<{ service: ClinicService | null; onSave: (data: Omit<ClinicService, 'id' | 'remoteId'>, id?: number) => void; onCancel: () => void; }> = ({ service, onSave, onCancel }) => {
    const [name, setName] = useState('');
    const [price, setPrice] = useState<number | ''>('');
    const [requiresProvider, setRequiresProvider] = useState(false);

    useEffect(() => {
        setName(service?.name || '');
        setPrice(service?.price ?? '');
        setRequiresProvider(service?.requiresProvider || false);
    }, [service]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!name || price === '') return;
        onSave({ name, price: Number(price), requiresProvider }, service?.id);
        if (!service) { // Reset form only for new items
            setName('');
            setPrice('');
            setRequiresProvider(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="p-4 bg-gray-900/50 rounded-lg border border-gray-700 space-y-3">
             <h4 className="font-semibold text-lg">{service ? 'ویرایش خدمت' : 'افزودن خدمت جدید'}</h4>
             <div className="grid grid-cols-2 gap-3">
                <input value={name} onChange={e => setName(e.target.value)} placeholder="نام خدمت" required className="input-style col-span-2" />
                <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} placeholder="قیمت" required className="input-style" />
                 <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input type="checkbox" checked={requiresProvider} onChange={e => setRequiresProvider(e.target.checked)} className="w-4 h-4 rounded bg-gray-600 border-gray-500 text-blue-500 focus:ring-blue-600" />
                    نیاز به متخصص
                </label>
             </div>
             <div className="flex justify-end gap-2 pt-2">
                {service && <button type="button" onClick={onCancel} className="btn-secondary">لغو</button>}
                <button type="submit" className="btn-primary">{service ? 'ذخیره' : 'افزودن'}</button>
             </div>
             <style>{`
                .input-style { background-color: #1f2937; border: 1px solid #4b5563; color: #d1d5db; border-radius: 0.5rem; padding: 0.5rem; width: 100%; }
                .btn-primary { padding: 0.3rem 1rem; background-color: #2563eb; border-radius: 0.5rem; font-size: 0.875rem; }
                .btn-secondary { padding: 0.3rem 1rem; background-color: #4b5563; border-radius: 0.5rem; font-size: 0.875rem; }
            `}</style>
        </form>
    );
};

const ProviderManagerModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const providers = useLiveQuery(() => db.serviceProviders.orderBy('name').toArray());
    const [editingProvider, setEditingProvider] = useState<ServiceProvider | null>(null);
    const { showNotification } = useNotification();

    const handleSave = async (providerData: Omit<ServiceProvider, 'id' | 'remoteId'>, id?: number) => {
        try {
            if (id) { // Editing
                const oldProvider = await db.serviceProviders.get(id);
                const remoteId = oldProvider?.remoteId;
                const { error } = await supabase.from('service_providers').update({ name: providerData.name, specialty: providerData.specialty }).eq('id', remoteId);
                if (error) throw error;
                await db.serviceProviders.update(id, providerData);
                await logActivity('UPDATE', 'ServiceProvider', remoteId!, { old: oldProvider, new: providerData });
                showNotification('متخصص با موفقیت ویرایش شد.', 'success');
            } else { // Adding
                const { data, error } = await supabase.from('service_providers').insert({ name: providerData.name, specialty: providerData.specialty }).select().single();
                if (error) throw error;
                await db.serviceProviders.add({ ...providerData, remoteId: data.id });
                await logActivity('CREATE', 'ServiceProvider', data.id, { newProvider: data });
                showNotification('متخصص جدید با موفقیت اضافه شد.', 'success');
            }
            setEditingProvider(null);
        } catch (error: any) {
            showNotification(`خطا در ذخیره متخصص: ${error.message}`, 'error');
        }
    };
    
    const handleDelete = async (id: number) => {
        if (!window.confirm('آیا از حذف این متخصص مطمئن هستید؟')) return;
        try {
            const providerToDelete = await db.serviceProviders.get(id);
            const { error } = await supabase.from('service_providers').delete().eq('id', providerToDelete?.remoteId);
            if (error) throw error;
            await db.serviceProviders.delete(id);
             await logActivity('DELETE', 'ServiceProvider', providerToDelete!.remoteId!, { deletedProvider: providerToDelete });
            showNotification('متخصص با موفقیت حذف شد.', 'success');
        } catch (error: any) {
            showNotification(`خطا در حذف متخصص: ${error.message}`, 'error');
        }
    };

    return (
        <Modal title="مدیریت متخصصین" onClose={onClose}>
            <div className="space-y-4">
                <div className="max-h-60 overflow-y-auto space-y-2 pr-2 -mr-2">
                    {providers?.map(provider => (
                        <div key={provider.id} className="flex justify-between items-center bg-gray-700/50 p-2 rounded-lg">
                            <p className="font-semibold">{provider.name} <span className="text-sm text-gray-400">{provider.specialty}</span></p>
                            <div className="flex gap-3">
                                <button onClick={() => setEditingProvider(provider)} className="text-blue-400 hover:text-blue-300"><Edit size={16} /></button>
                                <button onClick={() => handleDelete(provider.id!)} className="text-red-400 hover:text-red-300"><Trash2 size={16} /></button>
                            </div>
                        </div>
                    ))}
                </div>
                <ProviderForm key={editingProvider?.id} provider={editingProvider} onSave={handleSave} onCancel={() => setEditingProvider(null)} />
            </div>
        </Modal>
    );
};

const ProviderForm: React.FC<{ provider: ServiceProvider | null; onSave: (data: Omit<ServiceProvider, 'id' | 'remoteId'>, id?: number) => void; onCancel: () => void; }> = ({ provider, onSave, onCancel }) => {
    const [name, setName] = useState('');
    const [specialty, setSpecialty] = useState('');

    useEffect(() => {
        setName(provider?.name || '');
        setSpecialty(provider?.specialty || '');
    }, [provider]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!name) return;
        onSave({ name, specialty }, provider?.id);
        if (!provider) { // Reset form for new items
            setName('');
            setSpecialty('');
        }
    };
    
    return (
        <form onSubmit={handleSubmit} className="p-4 bg-gray-900/50 rounded-lg border border-gray-700 space-y-3">
             <h4 className="font-semibold text-lg">{provider ? 'ویرایش متخصص' : 'افزودن متخصص جدید'}</h4>
             <div className="grid grid-cols-2 gap-3">
                <input value={name} onChange={e => setName(e.target.value)} placeholder="نام متخصص" required className="input-style" />
                <input value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="تخصص" className="input-style" />
             </div>
             <div className="flex justify-end gap-2 pt-2">
                {provider && <button type="button" onClick={onCancel} className="btn-secondary">لغو</button>}
                <button type="submit" className="btn-primary">{provider ? 'ذخیره' : 'افزودن'}</button>
             </div>
             <style>{`
                .input-style { background-color: #1f2937; border: 1px solid #4b5563; color: #d1d5db; border-radius: 0.5rem; padding: 0.5rem; width: 100%; }
                .btn-primary { padding: 0.3rem 1rem; background-color: #2563eb; border-radius: 0.5rem; font-size: 0.875rem; }
                .btn-secondary { padding: 0.3rem 1rem; background-color: #4b5563; border-radius: 0.5rem; font-size: 0.875rem; }
            `}</style>
        </form>
    );
};

// ============================================================================
// Modals for Simple Accounting
// ============================================================================

const ColumnManagerModal: React.FC<{ columns: SimpleAccountingColumn[], onClose: () => void, onSave: () => void }> = ({ columns, onClose, onSave }) => {
    const { showNotification } = useNotification();
    const [editingColumn, setEditingColumn] = useState<SimpleAccountingColumn | null>(null);

    const handleSave = async (colData: { name: string, type: 'income' | 'expense' }, id?: number) => {
        try {
            if (id) {
                const { error } = await supabase.from('simple_accounting_columns').update({ name: colData.name }).eq('id', id);
                if (error) throw error;
                showNotification("ستون ویرایش شد.", "success");
            } else {
                const maxOrder = columns.reduce((max, c) => Math.max(max, c.order), 0);
                const { error } = await supabase.from('simple_accounting_columns').insert({ ...colData, order: maxOrder + 1 });
                if (error) throw error;
                showNotification("ستون جدید اضافه شد.", "success");
            }
            setEditingColumn(null);
            onSave();
        } catch (err: any) {
            showNotification(`خطا در ذخیره ستون: ${err.message}`, "error");
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm("آیا از حذف این ستون مطمئن هستید؟ رکوردهای مالی مرتبط با این ستون باقی خواهند ماند اما نمایش داده نخواهند شد.")) return;
        try {
            const { error } = await supabase.from('simple_accounting_columns').delete().eq('id', id);
            if (error) throw error;
            showNotification("ستون حذف شد.", "success");
            onSave();
        } catch (err: any) {
            showNotification(`خطا در حذف ستون: ${err.message}`, 'error');
        }
    };

    return (
        <Modal title="مدیریت ستون‌های حسابداری" onClose={onClose}>
             <div className="space-y-4">
                <div className="max-h-60 overflow-y-auto space-y-2 pr-2 -mr-2">
                    {columns.map(col => (
                        <div key={col.id} className="flex justify-between items-center bg-gray-700/50 p-2 rounded-lg">
                            <p className={`font-semibold ${col.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>{col.name}</p>
                            <div className="flex gap-3">
                                <button onClick={() => setEditingColumn(col)} className="text-blue-400 hover:text-blue-300"><Edit size={16} /></button>
                                <button onClick={() => handleDelete(col.id!)} className="text-red-400 hover:text-red-300"><Trash2 size={16} /></button>
                            </div>
                        </div>
                    ))}
                </div>
                <ColumnForm key={editingColumn?.id} column={editingColumn} onSave={handleSave} onCancel={() => setEditingColumn(null)} />
            </div>
        </Modal>
    )
}

const ColumnForm: React.FC<{ column: SimpleAccountingColumn | null, onSave: (data: { name: string, type: 'income' | 'expense' }, id?: number) => void, onCancel: () => void }> = ({ column, onSave, onCancel }) => {
    const [name, setName] = useState(column?.name || '');
    const [type, setType] = useState<'income' | 'expense'>(column?.type || 'income');

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!name) return;
        onSave({ name, type }, column?.id);
        if (!column) {
            setName('');
            setType('income');
        }
    };

    return (
         <form onSubmit={handleSubmit} className="p-4 bg-gray-900/50 rounded-lg border border-gray-700 space-y-3">
             <h4 className="font-semibold text-lg">{column ? 'ویرایش ستون' : 'افزودن ستون جدید'}</h4>
             <div className="grid grid-cols-3 gap-3">
                <input value={name} onChange={e => setName(e.target.value)} placeholder="نام ستون" required className="input-style col-span-2" />
                <select value={type} onChange={e => setType(e.target.value as any)} disabled={!!column} className="input-style">
                    <option value="income">درآمد</option>
                    <option value="expense">هزینه</option>
                </select>
             </div>
             <div className="flex justify-end gap-2 pt-2">
                {column && <button type="button" onClick={onCancel} className="btn-secondary">لغو</button>}
                <button type="submit" className="btn-primary">{column ? 'ذخیره' : 'افزودن'}</button>
             </div>
             <style>{`
                .input-style { background-color: #1f2937; border: 1px solid #4b5563; color: #d1d5db; border-radius: 0.5rem; padding: 0.5rem; width: 100%; } .input-style:disabled { opacity: 0.5; }
                .btn-primary { padding: 0.3rem 1rem; background-color: #2563eb; border-radius: 0.5rem; font-size: 0.875rem; }
                .btn-secondary { padding: 0.3rem 1rem; background-color: #4b5563; border-radius: 0.5rem; font-size: 0.875rem; }
            `}</style>
        </form>
    )
}

export default Accounting;