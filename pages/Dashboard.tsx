import React, { useMemo, useState, useEffect } from 'react';
import { DollarSign, AlertTriangle, Package, Users, Clock, ChevronsRight, List, FilePlus, FilePen, FileX, CircleDollarSign, LogIn, UserPlus, ShieldPlus, ShieldAlert, Save, DatabaseBackup, LogOut } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { ExpiryThreshold, Drug, ActivityLog, SaleInvoice, PurchaseInvoice, Payment, ClinicTransaction, User, Role } from '../types';
import Modal from '../components/Modal';
import { parseJalaliDate } from '../lib/dateConverter';
import { supabase } from '../lib/supabaseClient';
import { useOnlineStatus } from '../hooks/useOnlineStatus';


const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
  <div className="bg-gray-800 rounded-xl shadow-lg p-6 flex items-center space-x-6 hover:bg-gray-700/50 transition-all duration-300 border border-gray-700">
    <div className={`p-4 rounded-full ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-sm font-medium text-gray-400">{title}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  </div>
);

const AlertsSection: React.FC<{
  lowStockDrugs: Drug[];
  expiringDrugs: (Drug & { earliestExpiry: string })[];
}> = ({ lowStockDrugs, expiringDrugs }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
          <AlertTriangle className="ml-3 text-yellow-400" />
          هشدار کمبود موجودی
        </h3>
        <div className="max-h-60 overflow-y-auto space-y-2">
          {lowStockDrugs.length > 0 ? (
            lowStockDrugs.map(drug => (
              <div key={drug.id} className="flex justify-between items-center bg-gray-700/50 p-3 rounded-lg">
                <span className="text-white font-medium">{drug.name}</span>
                <span className="text-yellow-400 font-bold">{drug.totalStock} عدد</span>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center py-4">موردی یافت نشد.</p>
          )}
        </div>
      </div>
       <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
          <Clock className="ml-3 text-red-400" />
          داروهای نزدیک به انقضا
        </h3>
        <div className="max-h-60 overflow-y-auto space-y-2">
          {expiringDrugs.length > 0 ? (
            expiringDrugs.map(drug => (
              <div key={drug.id} className="flex justify-between items-center bg-gray-700/50 p-3 rounded-lg">
                <span className="text-white font-medium">{drug.name}</span>
                <span className="text-red-400 font-bold">{new Date(drug.earliestExpiry).toLocaleDateString('fa-IR')}</span>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center py-4">موردی یافت نشد.</p>
          )}
        </div>
      </div>
    </div>
  );
};


// --- Activity Log Section ---
type FilterType = 'today' | 'yesterday' | 'day_before' | 'custom';

const getISODateRange = (filter: FilterType, customStart?: string, customEnd?: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (filter) {
        case 'today':
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            return { start: today.toISOString(), end: tomorrow.toISOString() };
        case 'yesterday':
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            return { start: yesterday.toISOString(), end: today.toISOString() };
        case 'day_before':
            const dayBefore = new Date(today);
            dayBefore.setDate(today.getDate() - 2);
            const yesterdayForDayBefore = new Date(today);
            yesterdayForDayBefore.setDate(today.getDate() - 1);
            return { start: dayBefore.toISOString(), end: yesterdayForDayBefore.toISOString() };
        case 'custom':
            const startDate = customStart ? parseJalaliDate(customStart) : new Date(0);
            if(startDate) startDate.setHours(0,0,0,0);

            const endDate = customEnd ? parseJalaliDate(customEnd) : new Date();
            if(endDate) endDate.setHours(23,59,59,999);

            return { 
                start: (startDate || new Date(0)).toISOString(), 
                end: (endDate || new Date()).toISOString()
            };
    }
}

const ActivityLogSection: React.FC = () => {
    const [filter, setFilter] = useState<FilterType>('today');
    const [customRange, setCustomRange] = useState({ start: '', end: ''});
    const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
    const isOnline = useOnlineStatus();

    const dateRange = useMemo(() => getISODateRange(filter, customRange.start, customRange.end), [filter, customRange]);
    
    const [activities, setActivities] = useState<ActivityLog[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOnline) {
            setActivities([]);
            setError('شما آفلاین هستید. روزنامچه فعالیت‌ها در دسترس نیست.');
            setIsLoading(false);
            return;
        }

        const fetchActivities = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const { data, error: supabaseError } = await supabase
                    .from('activity_log')
                    .select('*')
                    .gte('timestamp', dateRange.start)
                    .lt('timestamp', dateRange.end)
                    .order('timestamp', { ascending: false })
                    .limit(100);

                if (supabaseError) throw supabaseError;

                const mappedData: ActivityLog[] = data.map((log: any) => ({
                    id: log.id,
                    timestamp: log.timestamp,
                    userId: log.user_id,
                    username: log.username,
                    actionType: log.action_type,
                    entity: log.entity,
                    entityId: log.entity_id,
                    details: log.details,
                }));
                setActivities(mappedData);
            } catch (err: any) {
                console.error("Error fetching activity log:", err);
                setError('خطا در بارگذاری روزنامچه فعالیت‌ها.');
                setActivities([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchActivities();
    }, [dateRange, isOnline]);

    const formatLogMessage = (log: ActivityLog): { icon: React.ReactNode, message: React.ReactNode } => {
        const userSpan = <span className="font-semibold text-blue-300">{log.username}</span>;
        const entityIdSpan = <span className="font-bold text-white">#{log.entityId}</span>;
        
        switch (log.entity) {
            case 'Authentication':
                 if (log.actionType === 'LOGIN') return { icon: <LogIn className="text-green-400" />, message: <>{userSpan} وارد سیستم شد.</> };
                 if (log.actionType === 'LOGOUT') return { icon: <LogOut className="text-gray-400" />, message: <>{userSpan} از سیستم خارج شد.</> };
                break;
            case 'SaleInvoice':
                if (log.actionType === 'CREATE') return { icon: <FilePlus className="text-green-400" />, message: <>{userSpan} فاکتور فروش {entityIdSpan} را ثبت کرد.</> };
                if (log.actionType === 'UPDATE') return { icon: <FilePen className="text-yellow-400" />, message: <>{userSpan} فاکتور فروش {entityIdSpan} را ویرایش کرد.</> };
                break;
            case 'PurchaseInvoice':
                const invNumber = log.details.invoice?.invoiceNumber || log.details.old?.invoiceNumber || log.entityId;
                if (log.actionType === 'CREATE') return { icon: <FilePlus className="text-green-400" />, message: <>{userSpan} فاکتور خرید <span className="font-bold text-white">#{invNumber}</span> را ثبت کرد.</> };
                if (log.actionType === 'UPDATE') return { icon: <FilePen className="text-yellow-400" />, message: <>{userSpan} فاکتور خرید <span className="font-bold text-white">#{invNumber}</span> را ویرایش کرد.</> };
                break;
            case 'Drug':
                 const drugName = log.details.newDrug?.name || log.details.new?.name || log.details.deletedDrug?.name || 'نامشخص';
                 if (log.actionType === 'CREATE') return { icon: <Package className="text-green-400" />, message: <>{userSpan} داروی جدید <span className="font-bold text-white">"{drugName}"</span> را اضافه کرد.</> };
                 if (log.actionType === 'UPDATE') return { icon: <Package className="text-yellow-400" />, message: <>{userSpan} داروی <span className="font-bold text-white">"{drugName}"</span> را ویرایش کرد.</> };
                 if (log.actionType === 'DELETE') return { icon: <FileX className="text-red-400" />, message: <>{userSpan} داروی <span className="font-bold text-white">"{drugName}"</span> را حذف کرد.</> };
                break;
            case 'Payment':
                 const amount = log.details.payment?.amount;
                 if (log.actionType === 'CREATE') return { icon: <CircleDollarSign className="text-green-400" />, message: <>{userSpan} مبلغ <span className="font-bold text-white">${amount.toFixed(2)}</span> را پرداخت کرد.</> };
                break;
            case 'User':
                // FIX: Handle password change logs, which have a different details structure.
                if (log.actionType === 'UPDATE' && typeof log.details.details === 'string' && log.details.details.includes('Password changed')) {
                    return { icon: <UserPlus className="text-yellow-400" />, message: <>{userSpan} رمز عبور خود را تغییر داد.</> };
                }
                const username = log.details.newUser?.username || log.details.deletedUser?.username || 'نامشخص';
                if (log.actionType === 'CREATE') return { icon: <UserPlus className="text-green-400" />, message: <>{userSpan} کاربر جدید <span className="font-bold text-white">"{username}"</span> را ایجاد کرد.</> };
                // FIX: Safely access old username to prevent crash if 'old' details are missing.
                if (log.actionType === 'UPDATE') return { icon: <UserPlus className="text-yellow-400" />, message: <>{userSpan} کاربر <span className="font-bold text-white">"{log.details.old?.username || 'نامشخص'}"</span> را ویرایش کرد.</> };
                if (log.actionType === 'DELETE') return { icon: <FileX className="text-red-400" />, message: <>{userSpan} کاربر <span className="font-bold text-white">"{username}"</span> را حذف کرد.</> };
                break;
            case 'Role':
                const roleName = log.details.newRole?.name || log.details.deletedRole?.name || 'نامشخص';
                if (log.actionType === 'CREATE') return { icon: <ShieldPlus className="text-green-400" />, message: <>{userSpan} نقش جدید <span className="font-bold text-white">"{roleName}"</span> را ایجاد کرد.</> };
                // FIX: Safely access old role name to prevent crash.
                if (log.actionType === 'UPDATE') return { icon: <ShieldAlert className="text-yellow-400" />, message: <>{userSpan} نقش <span className="font-bold text-white">"{log.details.old?.name || 'نامشخص'}"</span> را ویرایش کرد.</> };
                if (log.actionType === 'DELETE') return { icon: <FileX className="text-red-400" />, message: <>{userSpan} نقش <span className="font-bold text-white">"{roleName}"</span> را حذف کرد.</> };
                break;
            case 'Settings':
                 if (log.entityId === 'alerts') return { icon: <Save className="text-blue-400" />, message: <>{userSpan} تنظیمات هشدارها را به‌روزرسانی کرد.</> };
                 if (log.actionType === 'BACKUP') return { icon: <DatabaseBackup className="text-blue-400" />, message: <>{userSpan} یک نسخه پشتیبان از سیستم تهیه کرد.</> };
                break;
            default:
                return { icon: <List />, message: <>{userSpan} یک عملیات <span className="font-bold text-white">{log.actionType.toLowerCase()}</span> روی <span className="font-bold text-white">{log.entity}</span> انجام داد.</> };
        }
        return { icon: <List />, message: `رویداد ${log.actionType} روی ${log.entity}` };
    };

    return (
        <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
            <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                <h3 className="text-xl font-semibold text-white flex items-center gap-3">
                    <List className="text-blue-400" />
                    روزنامچه فعالیت‌ها
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => setFilter('today')} className={`btn-filter ${filter === 'today' && 'active'}`}>امروز</button>
                    <button onClick={() => setFilter('yesterday')} className={`btn-filter ${filter === 'yesterday' && 'active'}`}>دیروز</button>
                    <button onClick={() => setFilter('day_before')} className={`btn-filter ${filter === 'day_before' && 'active'}`}>پریروز</button>
                    <input type="text" placeholder="YYYY/MM/DD" value={customRange.start} onChange={e => { setFilter('custom'); setCustomRange(p => ({...p, start: e.target.value}))}} className="input-date"/>
                    <span className="text-gray-400">تا</span>
                    <input type="text" placeholder="YYYY/MM/DD" value={customRange.end} onChange={e => { setFilter('custom'); setCustomRange(p => ({...p, end: e.target.value}))}} className="input-date"/>
                </div>
            </div>
             <div className="max-h-96 overflow-y-auto space-y-2">
                 {isLoading ? (
                    <p className="text-gray-500 text-center py-8">در حال بارگذاری فعالیت‌ها...</p>
                ) : error ? (
                    <p className="text-yellow-400 text-center py-8">{error}</p>
                ) : activities && activities.length > 0 ? (
                    activities.map(log => {
                        const { icon, message } = formatLogMessage(log);
                        return (
                             <div key={log.id} className="flex justify-between items-center bg-gray-700/50 p-3 rounded-lg hover:bg-gray-700 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="flex-shrink-0">{icon}</div>
                                    <div>
                                        <p className="text-white text-sm">{message}</p>
                                        <p className="text-xs text-gray-400">{new Date(log.timestamp).toLocaleTimeString('fa-IR')}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedLog(log)} className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300">
                                    جزئیات <ChevronsRight size={14} />
                                </button>
                            </div>
                        )
                    })
                ) : (
                    <p className="text-gray-500 text-center py-8">هیچ فعالیتی برای این بازه زمانی یافت نشد.</p>
                )}
            </div>
             {selectedLog && (
                <ActivityDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
            )}
             <style>{`
                .btn-filter { font-size: 0.875rem; padding: 0.5rem 1rem; border-radius: 0.5rem; background-color: #374151; color: #d1d5db; transition: background-color 0.2s; }
                .btn-filter:hover { background-color: #4b5563; }
                .btn-filter.active { background-color: #2563eb; color: white; }
                .input-date { background-color: #374151; border: 1px solid #4b5563; color: #d1d5db; border-radius: 0.5rem; padding: 0.4rem; font-size: 0.875rem; width: 150px; text-align: center; }
             `}</style>
        </div>
    );
}

const ActivityDetailModal: React.FC<{ log: ActivityLog; onClose: () => void }> = ({ log, onClose }) => {
    const renderDetails = () => {
        const { entity, details } = log;
        switch(entity) {
            case 'SaleInvoice':
                const invoice = details.invoice || details.new || details.old;
                if (!invoice) return <p>جزئیات موجود نیست.</p>;
                return <InvoiceDetails invoice={invoice} />;
            case 'PurchaseInvoice':
                 const pInvoice = details.invoice || details.old;
                 if (!pInvoice) return <p>جزئیات موجود نیست.</p>;
                 return <PurchaseInvoiceDetails invoice={pInvoice} />;
            case 'Drug':
                if (log.actionType === 'CREATE') return <ObjectDetails title="داروی جدید" data={details.newDrug} />;
                if (log.actionType === 'UPDATE') return <CompareDetails title="تغییرات دارو" oldData={details.old} newData={details.new} />;
                if (log.actionType === 'DELETE') return <ObjectDetails title="داروی حذف شده" data={details.deletedDrug} />;
                break;
            case 'Payment':
                return <ObjectDetails title="جزئیات پرداخت" data={details.payment} />;
            case 'User':
                if (log.actionType === 'CREATE') return <ObjectDetails title="کاربر جدید" data={details.newUser} />;
                if (log.actionType === 'UPDATE') return <CompareDetails title="تغییرات کاربر" oldData={details.old} newData={details.new} />;
                if (log.actionType === 'DELETE') return <ObjectDetails title="کاربر حذف شده" data={details.deletedUser} />;
                break;
            case 'Role':
                if (log.actionType === 'CREATE') return <ObjectDetails title="نقش جدید" data={details.newRole} />;
                if (log.actionType === 'UPDATE') return <CompareDetails title="تغییرات نقش" oldData={details.old} newData={details.new} />;
                if (log.actionType === 'DELETE') return <ObjectDetails title="نقش حذف شده" data={details.deletedRole} />;
                break;
            case 'Settings':
                 if (log.entityId === 'alerts') return <CompareDetails title="تغییرات تنظیمات هشدار" oldData={details.old} newData={details.new} />;
                 return <pre className="text-xs bg-gray-900 p-2 rounded whitespace-pre-wrap">{JSON.stringify(details, null, 2)}</pre>;
            default:
                return <pre className="text-xs bg-gray-900 p-2 rounded whitespace-pre-wrap">{JSON.stringify(details, null, 2)}</pre>;
        }
        return <p>جزئیات برای این نوع رویداد پیاده‌سازی نشده است.</p>;
    }

    return (
        <Modal title={`جزئیات رویداد #${log.id}`} onClose={onClose}>
            <div className="space-y-4">
                <div className="p-3 bg-gray-700/50 rounded-lg text-sm">
                    <p><strong>کاربر:</strong> {log.username}</p>
                    <p><strong>عملیات:</strong> {log.actionType}</p>
                    <p><strong>موجودیت:</strong> {log.entity} (ID: {log.entityId})</p>
                    <p><strong>زمان:</strong> {new Date(log.timestamp).toLocaleString('fa-IR')}</p>
                </div>
                <div>{renderDetails()}</div>
                 <div className="flex justify-end pt-4"><button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">بستن</button></div>
            </div>
        </Modal>
    );
};
// --- Detail Renderers for Modal ---
const InvoiceDetails: React.FC<{ invoice: SaleInvoice }> = ({ invoice }) => (
    <div className="space-y-2">
        <h4 className="font-bold text-lg">فاکتور فروش #{invoice.id}</h4>
        <table className="w-full text-xs text-right">
            <thead className="border-b border-gray-600"><tr className="text-gray-400"><th>نام دارو</th><th>تعداد</th><th>قیمت واحد</th><th>جمع کل</th></tr></thead>
            <tbody className="divide-y divide-gray-700">
                {invoice.items.map((item, index) => <tr key={index}><td>{item.name}</td><td>{item.quantity}</td><td>${item.unitPrice.toFixed(2)}</td><td>${item.totalPrice.toFixed(2)}</td></tr>)}
            </tbody>
        </table>
        <p className="text-right font-bold pt-2 border-t border-gray-600">مجموع کل: ${invoice.totalAmount.toFixed(2)}</p>
    </div>
);
const PurchaseInvoiceDetails: React.FC<{ invoice: PurchaseInvoice }> = ({ invoice }) => (
    <div className="space-y-2">
        <h4 className="font-bold text-lg">فاکتور خرید #{invoice.invoiceNumber}</h4>
        <table className="w-full text-xs text-right">
            <thead className="border-b border-gray-600"><tr className="text-gray-400"><th>نام دارو</th><th>تعداد</th><th>قیمت خرید</th><th>جمع کل</th></tr></thead>
            <tbody className="divide-y divide-gray-700">
                {invoice.items.map((item, i) => <tr key={i}><td>{item.name}</td><td>{item.quantity}</td><td>${item.purchasePrice.toFixed(2)}</td><td>${(item.quantity * item.purchasePrice).toFixed(2)}</td></tr>)}
            </tbody>
        </table>
        <p className="text-right font-bold pt-2 border-t border-gray-600">مجموع کل: ${invoice.totalAmount.toFixed(2)}</p>
    </div>
);
const ObjectDetails: React.FC<{ title: string; data: any }> = ({ title, data }) => (
    <div className="space-y-1">
        <h4 className="font-bold text-lg mb-2">{title}</h4>
        {Object.entries(data).map(([key, value]) => {
            if (key === 'passwordHash') return null; // Don't show password hashes
            return <p key={key} className="text-sm"><strong>{key}:</strong> {String(value)}</p>
        })}
    </div>
);
const CompareDetails: React.FC<{ title: string; oldData: any; newData: any }> = ({ title, oldData, newData }) => (
    <div>
        <h4 className="font-bold text-lg mb-2">{title}</h4>
        {Object.keys(newData).map(key => {
             if (key === 'passwordHash') return null;
             const oldValue = oldData ? String(oldData[key]) : 'N/A';
             const newValue = String(newData[key]);
             if (oldValue === newValue) return null; // Don't show unchanged fields
             return (
                <div key={key} className="grid grid-cols-3 gap-2 text-sm even:bg-gray-700/50 p-1 rounded">
                    <strong className="text-gray-400">{key}</strong>
                    <span className="text-red-400">{oldValue}</span>
                    <span className="text-green-400">{newValue}</span>
                </div>
            )
        })}
    </div>
);



const Dashboard: React.FC = () => {
  // --- Data Fetching ---
  const settings = useLiveQuery(() => db.settings.toArray());
  const totalSuppliers = useLiveQuery(() => db.suppliers.count(), []);
  
  // --- Settings Memoization ---
  const lowStockThreshold = useMemo(() => 
    (settings?.find(s => s.key === 'lowStockThreshold')?.value as number) ?? 10, 
  [settings]);
  
  const expiryAlertThreshold: ExpiryThreshold = useMemo(() => 
    (settings?.find(s => s.key === 'expiryAlertThreshold')?.value as ExpiryThreshold) ?? { value: 3, unit: 'months' }, 
  [settings]);

  // --- Live Queries based on Settings ---
  const lowStockDrugs = useLiveQuery(() => db.drugs.where('totalStock').below(lowStockThreshold).toArray(), [lowStockThreshold]);

  const expiringDrugs = useLiveQuery(async () => {
    const { value, unit } = expiryAlertThreshold;
    const targetDate = new Date();
    if (unit === 'days') targetDate.setDate(targetDate.getDate() + value);
    if (unit === 'weeks') targetDate.setDate(targetDate.getDate() + value * 7);
    if (unit === 'months') targetDate.setMonth(targetDate.getMonth() + value);

    const expiringBatches = await db.drugBatches
      .where('expiryDate').between(new Date().toISOString(), targetDate.toISOString())
      .and(batch => batch.quantityInStock > 0)
      .toArray();

    if (!expiringBatches || expiringBatches.length === 0) return [];
    
    // Group batches by drugId and find the earliest expiry for each
    const expiryMap = new Map<number, string>();
    for (const batch of expiringBatches) {
      const existing = expiryMap.get(batch.drugId);
      if (!existing || new Date(batch.expiryDate) < new Date(existing)) {
        expiryMap.set(batch.drugId, batch.expiryDate);
      }
    }
    
    const drugIds = Array.from(expiryMap.keys());
    const drugs = await db.drugs.where('id').anyOf(drugIds).toArray();
    
    return drugs.map(drug => ({
      ...drug,
      earliestExpiry: expiryMap.get(drug.id!)!
    }));
  }, [expiryAlertThreshold]);

  // --- Real-time Today's Sales Calculation ---
  const todaySales = useLiveQuery(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const invoices = await db.saleInvoices
      .where('date')
      .between(today.toISOString(), tomorrow.toISOString())
      .toArray();

    const total = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

    // Format the number to Persian locale with two decimal places for currency.
    return new Intl.NumberFormat('fa-IR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(total);
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">خوش آمدید!</h2>
        <p className="text-gray-400">گزارش لحظه‌ای از وضعیت داروخانه شما.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard title="فروش امروز" value={`$${todaySales ?? '۰٫۰۰'}`} icon={<DollarSign size={28} className="text-white"/>} color="bg-green-500" />
        <StatCard title="کمبود موجودی" value={String(lowStockDrugs?.length ?? 0)} icon={<AlertTriangle size={28} className="text-white"/>} color="bg-yellow-500" />
        <StatCard title="داروهای رو به انقضا" value={String(expiringDrugs?.length ?? 0)} icon={<Clock size={28} className="text-white"/>} color="bg-red-500" />
        <StatCard title="تعداد کل تامین‌کنندگان" value={String(totalSuppliers ?? 0)} icon={<Users size={28} className="text-white"/>} color="bg-purple-500" />
      </div>

      <AlertsSection lowStockDrugs={lowStockDrugs ?? []} expiringDrugs={expiringDrugs ?? []} />
      
      <ActivityLogSection />

    </div>
  );
};

export default Dashboard;