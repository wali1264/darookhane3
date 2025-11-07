import React, { useState, useMemo, FormEvent, useCallback, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { User, Role, Permission, PERMISSIONS, Supplier, SupplierAccount, ExpiryThreshold, AppSetting } from '../types';
import Modal from '../components/Modal';
import { Plus, Edit, Trash2, Users, Shield, BookHeart, DatabaseBackup, UploadCloud, AlertTriangle, Bell, Save, Store, Image, Trash } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { logActivity } from '../lib/activityLogger';
import { supabase } from '../lib/supabaseClient';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

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

const Settings: React.FC = () => {
    const { hasPermission, currentUser } = useAuth();
    const availableTabs = useMemo(() => {
        const tabs: ('profile' | 'users' | 'roles' | 'portal' | 'backup' | 'alerts')[] = [];
        const isSuperAdmin = currentUser?.username === 'admin';

        // The new tab was not showing because the 'settings:profile:manage' permission,
        // while defined in the code, was not present in the admin role's permission list in the database.
        // This check ensures the admin *always* sees this tab.
        if (hasPermission('settings:profile:manage') || isSuperAdmin) tabs.push('profile');
        if (hasPermission('settings:users:view')) tabs.push('users');
        if (hasPermission('settings:roles:view')) tabs.push('roles');
        if (hasPermission('settings:portal:manage')) tabs.push('portal');
        if (hasPermission('settings:backup:manage')) tabs.push('backup');
        if (hasPermission('settings:alerts:manage')) tabs.push('alerts');
        return tabs;
    }, [hasPermission, currentUser]);

    const [activeTab, setActiveTab] = useState<(typeof availableTabs)[number] | null>(null);

    // This effect correctly sets the initial active tab and handles cases where tabs appear after the initial render (e.g., after login).
    useEffect(() => {
        if (availableTabs.length > 0 && !activeTab) {
            setActiveTab(availableTabs[0]);
        }
    }, [availableTabs, activeTab]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-white">تنظیمات</h2>
                <div className="flex items-center gap-3 p-1 bg-gray-800 rounded-lg">
                    {availableTabs.includes('profile') && <TabButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<Store size={18} />} text="مشخصات داروخانه" />}
                    {availableTabs.includes('users') && <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<Users size={18} />} text="مدیریت کاربران" />}
                    {availableTabs.includes('roles') && <TabButton active={activeTab === 'roles'} onClick={() => setActiveTab('roles')} icon={<Shield size={18} />} text="مدیریت نقش‌ها" />}
                    {availableTabs.includes('portal') && <TabButton active={activeTab === 'portal'} onClick={() => setActiveTab('portal')} icon={<BookHeart size={18} />} text="پورتال تامین‌کنندگان" />}
                    {availableTabs.includes('backup') && <TabButton active={activeTab === 'backup'} onClick={() => setActiveTab('backup')} icon={<DatabaseBackup size={18} />} text="پشتیبان‌گیری و بازیابی" />}
                    {availableTabs.includes('alerts') && <TabButton active={activeTab === 'alerts'} onClick={() => setActiveTab('alerts')} icon={<Bell size={18} />} text="مدیریت هشدارها" />}
                </div>
            </div>
            {activeTab === 'profile' && <PharmacyProfileManagement />}
            {activeTab === 'users' && <UserManagement />}
            {activeTab === 'roles' && <RoleManagement />}
            {activeTab === 'portal' && <SupplierPortalManagement />}
            {activeTab === 'backup' && <BackupRestoreSection />}
            {activeTab === 'alerts' && <AlertManagement />}
            {activeTab === null && <div className="text-center text-gray-500 py-10">شما به هیچ بخشی از تنظیمات دسترسی ندارید.</div>}
        </div>
    );
};

// Pharmacy Profile Management
const PharmacyProfileManagement: React.FC = () => {
    const { showNotification } = useNotification();
    const dbSettings = useLiveQuery(() => db.settings.toArray());

    const [pharmacyName, setPharmacyName] = useState('');
    const [pharmacyLogo, setPharmacyLogo] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (dbSettings) {
            const nameSetting = dbSettings.find(s => s.key === 'pharmacyName');
            if (nameSetting) setPharmacyName(nameSetting.value as string);
            
            const logoSetting = dbSettings.find(s => s.key === 'pharmacyLogo');
            if (logoSetting) setPharmacyLogo(logoSetting.value as string);
        }
    }, [dbSettings]);

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 512 * 1024) { // 512KB limit
                showNotification('حجم فایل لوگو باید کمتر از 512 کیلوبایت باشد.', 'error');
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                setPharmacyLogo(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const settingsToSave: AppSetting[] = [
                { key: 'pharmacyName', value: pharmacyName.trim() || 'شفا-یار' },
                { key: 'pharmacyLogo', value: pharmacyLogo || '' }
            ];
            await db.settings.bulkPut(settingsToSave);
            showNotification('مشخصات داروخانه با موفقیت ذخیره شد.', 'success');
        } catch (error) {
            console.error("Failed to save pharmacy profile:", error);
            showNotification('خطا در ذخیره مشخصات.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="bg-gray-800 rounded-lg p-6 border border-gray-700 max-w-2xl mx-auto space-y-8">
            <div>
                <h3 className="text-xl font-bold text-white mb-2">نام داروخانه</h3>
                <p className="text-gray-400 text-sm mb-4">
                    این نام در تمام بخش‌های برنامه و اسناد چاپی نمایش داده خواهد شد.
                </p>
                <input
                    type="text"
                    value={pharmacyName}
                    onChange={(e) => setPharmacyName(e.target.value)}
                    className="input-style w-full"
                    placeholder="نام داروخانه خود را وارد کنید"
                />
            </div>

            <div className="border-t border-gray-700 pt-8">
                <h3 className="text-xl font-bold text-white mb-4">لوگوی داروخانه</h3>
                <div className="flex items-center gap-6">
                    <div className="w-32 h-32 bg-gray-700/50 rounded-lg flex items-center justify-center border border-gray-600">
                        {pharmacyLogo ? (
                            <img src={pharmacyLogo} alt="پیش‌نمایش لوگو" className="w-full h-full object-contain rounded-lg" />
                        ) : (
                            <Image size={40} className="text-gray-500" />
                        )}
                    </div>
                    <div className="flex-1 space-y-3">
                        <input type="file" accept="image/png, image/jpeg, image/svg+xml" ref={fileInputRef} onChange={handleLogoUpload} className="hidden" />
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-secondary w-full">تغییر لوگو</button>
                        <button type="button" onClick={() => setPharmacyLogo(null)} className="btn-danger w-full">
                            <Trash size={16} className="ml-2" />
                            حذف لوگو
                        </button>
                        <p className="text-xs text-gray-500">فایل‌های PNG, JPG یا SVG با حجم کمتر از ۵۱۲ کیلوبایت.</p>
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-6 border-t border-gray-700">
                <button
                    type="submit"
                    disabled={isSaving}
                    className="btn-primary flex items-center justify-center gap-2"
                >
                    <Save size={18} />
                    {isSaving ? "در حال ذخیره..." : "ذخیره تغییرات"}
                </button>
            </div>
             <style>{`
                .input-style { background-color: #1f2937; border: 1px solid #4b5563; color: #d1d5db; border-radius: 0.5rem; padding: 0.75rem; }
                .btn-primary { padding: 0.6rem 1.5rem; background-color: #2563eb; color: white; border-radius: 0.5rem; font-size: 0.875rem; transition: background-color 0.2s; }
                .btn-primary:hover { background-color: #1d4ed8; }
                .btn-secondary { display: flex; align-items: center; justify-content: center; padding: 0.6rem 1.5rem; background-color: #4b5563; color: white; border-radius: 0.5rem; font-size: 0.875rem; transition: background-color 0.2s; }
                .btn-secondary:hover { background-color: #6b7280; }
                .btn-danger { display: flex; align-items: center; justify-content: center; padding: 0.6rem 1.5rem; background-color: transparent; color: #f87171; border: 1px solid #f87171; border-radius: 0.5rem; font-size: 0.875rem; transition: all 0.2s; }
                .btn-danger:hover { background-color: #f87171; color: white; }
            `}</style>
        </form>
    );
};


// Alert Management Section
const AlertManagement: React.FC = () => {
    const { showNotification } = useNotification();
    const dbSettings = useLiveQuery(() => db.settings.toArray());
    const isOnline = useOnlineStatus();
    
    const [lowStockThreshold, setLowStockThreshold] = useState<number | ''>(10);
    const [expiryValue, setExpiryValue] = useState<number | ''>(3);
    const [expiryUnit, setExpiryUnit] = useState<'days' | 'weeks' | 'months'>('months');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (dbSettings) {
            const lowStockSetting = dbSettings.find(s => s.key === 'lowStockThreshold');
            if (lowStockSetting) setLowStockThreshold(lowStockSetting.value as number);
            
            const expirySetting = dbSettings.find(s => s.key === 'expiryAlertThreshold');
            if (expirySetting) {
                const { value, unit } = expirySetting.value as ExpiryThreshold;
                setExpiryValue(value);
                setExpiryUnit(unit);
            }
        }
    }, [dbSettings]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const oldSettings = {
                lowStock: dbSettings?.find(s => s.key === 'lowStockThreshold')?.value,
                expiry: dbSettings?.find(s => s.key === 'expiryAlertThreshold')?.value,
            };

            const settingsToSave: AppSetting[] = [
                { key: 'lowStockThreshold', value: Number(lowStockThreshold) || 10 },
                { key: 'expiryAlertThreshold', value: { value: Number(expiryValue) || 3, unit: expiryUnit } }
            ];
            // ONLINE-FIRST: These settings are purely local, so we just write to Dexie.
            await db.settings.bulkPut(settingsToSave);

            const newSettings = {
                lowStock: settingsToSave[0].value,
                expiry: settingsToSave[1].value,
            };

            // We can still log this action to the remote server if online.
            if (navigator.onLine) {
                 await logActivity('UPDATE', 'Settings', 'alerts', { old: oldSettings, new: newSettings });
            }

            showNotification('تنظیمات با موفقیت ذخیره شد.', 'success');
        } catch (error) {
            console.error("Failed to save settings:", error);
            showNotification('خطا در ذخیره تنظیمات.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleSave();
    };

    return (
        <form onSubmit={handleFormSubmit} className="bg-gray-800 rounded-lg p-6 border border-gray-700 max-w-2xl mx-auto space-y-8">
            <div>
                <h3 className="text-xl font-bold text-white mb-2">هشدار کمبود موجودی</h3>
                <p className="text-gray-400 text-sm mb-4">
                    زمانی که موجودی کل یک دارو از عدد مشخص شده کمتر شود، در داشبورد به شما هشدار داده خواهد شد.
                </p>
                <div className="flex items-center gap-4">
                    <label htmlFor="lowStock" className="text-gray-300">آستانه هشدار:</label>
                    <input
                        id="lowStock"
                        type="number"
                        value={lowStockThreshold}
                        onChange={(e) => setLowStockThreshold(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                        className="input-style w-32"
                    />
                    <span className="text-gray-400">عدد</span>
                </div>
            </div>

             <div className="border-t border-gray-700 pt-8">
                <h3 className="text-xl font-bold text-white mb-2">هشدار انقضای دارو</h3>
                <p className="text-gray-400 text-sm mb-4">
                    داروهایی که تاریخ انقضای آنها در محدوده زمانی مشخص شده قرار دارد، در داشبورد نمایش داده خواهند شد.
                </p>
                <div className="flex items-center gap-4">
                     <label className="text-gray-300">هشدار بده اگر کمتر از</label>
                     <input
                        type="number"
                        value={expiryValue}
                        onChange={(e) => setExpiryValue(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                        className="input-style w-24"
                    />
                    <select
                        value={expiryUnit}
                        onChange={(e) => setExpiryUnit(e.target.value as any)}
                        className="input-style"
                    >
                        <option value="days">روز</option>
                        <option value="weeks">هفته</option>
                        <option value="months">ماه</option>
                    </select>
                    <span className="text-gray-400">به تاریخ انقضا باقی مانده بود.</span>
                </div>
            </div>

            <div className="flex justify-end pt-6 border-t border-gray-700">
                <button
                    type="submit"
                    disabled={isSaving || !isOnline}
                    title={!isOnline ? "این عملیات در حالت آفلاین در دسترس نیست" : "ذخیره تنظیمات"}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-500"
                >
                    <Save size={18} />
                    {isSaving ? "در حال ذخیره..." : "ذخیره تنظیمات"}
                </button>
            </div>
             <style>{`.input-style { background-color: #1f2937; border: 1px solid #4b5563; color: #d1d5db; border-radius: 0.5rem; padding: 0.5rem 0.75rem; }`}</style>
        </form>
    );
};


// Backup and Restore Section
const BackupRestoreSection: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showNotification } = useNotification();
    const isOnline = useOnlineStatus();

    const handleBackup = async () => {
        setIsLoading(true);
        try {
            const backupData: { [key: string]: any[] } = {};
            const tableNames = db.tables.map(table => table.name);

            await Promise.all(tableNames.map(async (name) => {
                if (name !== 'sync_queue') { // Don't back up the sync queue
                    const tableData = await db.table(name).toArray();
                    backupData[name] = tableData;
                }
            }));
            
            const jsonString = JSON.stringify(backupData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            const date = new Date().toISOString().split('T')[0];
            a.href = url;
            a.download = `shafayar-backup-${date}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            await logActivity('BACKUP', 'Settings', 'database', { filename: a.download });
            showNotification('فایل پشتیبان با موفقیت ایجاد شد.', 'success');
        } catch (error) {
            console.error("Backup failed:", error);
            showNotification('خطا در ایجاد نسخه پشتیبان.', 'error');
        } finally {
            setIsLoading(false);
        }
    };
    
    const processRestoreFile = (file: File) => {
        if (!file || !file.type.includes('json')) {
            showNotification('لطفاً یک فایل پشتیبان با فرمت JSON انتخاب کنید.', 'error');
            return;
        }

        const confirmation = window.confirm(
            "*** هشدار بسیار مهم! ***\n\n" +
            "آیا مطمئن هستید که می‌خواهید اطلاعات را بازیابی کنید؟\n\n" +
            "این عمل تمام داده‌های فعلی برنامه را به طور کامل پاک کرده و با اطلاعات موجود در فایل پشتیبان جایگزین می‌کند. این عملیات غیرقابل بازگشت است!"
        );

        if (!confirmation) return;
        
        setIsRestoring(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const backupData = JSON.parse(event.target?.result as string);
                
                const requiredTables = ['drugs', 'suppliers', 'users', 'roles'];
                if (!requiredTables.every(table => backupData.hasOwnProperty(table))) {
                    throw new Error("فایل پشتیبان نامعتبر است یا ساختار صحیحی ندارد.");
                }
                
                // In Online-First, restore is a complex operation.
                // It would require clearing remote tables and then bulk inserting,
                // preferably via a dedicated backend function.
                // This client-side-only restore is now DANGEROUS as it will de-sync local and remote.
                showNotification('بازیابی در این نسخه پشتیبانی نمی‌شود. این یک عملیات پیچیده سمت سرور است.', 'error');
                setIsRestoring(false);
                return;

            } catch (error) {
                console.error("Restore failed:", error);
                showNotification(`خطا در بازیابی اطلاعات: ${error}`, 'error');
                setIsRestoring(false);
            }
        };
        reader.readAsText(file);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            processRestoreFile(e.target.files[0]);
        }
    };
    
     const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processRestoreFile(e.dataTransfer.files[0]);
            e.dataTransfer.clearData();
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-4">
            {/* Backup Card */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 flex flex-col items-center text-center">
                <DatabaseBackup size={48} className="text-blue-400 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">ایجاد نسخه پشتیبان</h3>
                <p className="text-gray-400 text-sm mb-6">
                    از تمام اطلاعات برنامه (داروها، فاکتورها، کاربران و...) یک فایل پشتیبان با فرمت JSON در کامپیوتر خود ذخیره کنید.
                </p>
                <button
                    onClick={handleBackup}
                    disabled={isLoading}
                    className="w-full max-w-xs flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-500 disabled:cursor-wait"
                >
                    {isLoading ? "در حال ایجاد..." : "شروع پشتیبان‌گیری"}
                </button>
            </div>

            {/* Restore Card */}
             <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 flex flex-col items-center text-center">
                <UploadCloud size={48} className="text-green-400 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">بازیابی اطلاعات</h3>
                <p className="text-gray-400 text-sm mb-6">
                    اطلاعات را از یک فایل پشتیبان JSON که قبلاً ذخیره کرده‌اید، بازیابی کنید.
                </p>
                <div
                    onDrop={handleDrop}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }}
                    onClick={() => isOnline && fileInputRef.current?.click()}
                    className={`w-full p-8 border-2 border-dashed rounded-lg transition-colors ${!isOnline ? 'cursor-not-allowed bg-gray-900/50' : (dragOver ? 'border-blue-400 bg-blue-900/20' : 'border-gray-600 hover:border-gray-500 cursor-pointer')}`}
                >
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" disabled={!isOnline}/>
                    {isRestoring ? (
                        <p>در حال بازیابی...</p>
                    ) : (
                         <p className={!isOnline ? 'text-gray-500' : ''}>
                            {isOnline ? 'فایل پشتیبان را اینجا بکشید یا برای انتخاب کلیک کنید' : 'بازیابی فقط در حالت آنلاین امکان‌پذیر است'}
                        </p>
                    )}
                </div>
                 <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg flex items-start gap-3 text-right">
                    <AlertTriangle size={32} className="text-yellow-400 flex-shrink-0 mt-1" />
                    <p className="text-xs text-yellow-300">
                        <span className="font-bold">هشدار:</span> عمل بازیابی تمام داده‌های فعلی شما را حذف خواهد کرد. این کار غیرقابل بازگشت است.
                    </p>
                </div>
            </div>
        </div>
    );
};

// Supplier Portal Management
const SupplierPortalManagement: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const { showNotification } = useNotification();
    const isOnline = useOnlineStatus();

    const suppliers = useLiveQuery(() => db.suppliers.orderBy('name').toArray());
    const supplierAccounts = useLiveQuery(() => db.supplierAccounts.toArray());
    
    // FIX: Explicitly typed useMemo to prevent TypeScript from inferring map values as 'unknown'.
    const accountsMap = useMemo<Map<number, SupplierAccount>>(() => {
        if (!supplierAccounts) return new Map();
        return new Map(supplierAccounts.map(acc => [acc.supplierId, acc]));
    }, [supplierAccounts]);

    const openModal = (supplier: Supplier) => {
        setSelectedSupplier(supplier);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setSelectedSupplier(null);
        setIsModalOpen(false);
    };

    const handleDeleteAccount = async (supplierId?: number) => {
        if (!supplierId || !window.confirm('آیا از حذف حساب پورتال این تامین‌کننده مطمئن هستید؟')) return;
        
        const { error } = await supabase.rpc('delete_supplier_account', { p_supplier_id: supplierId });
        
        if (error) {
            console.error("Error deleting supplier account:", error);
            showNotification(`خطا در حذف حساب: ${error.message}`, 'error');
            return;
        }

        const account = await db.supplierAccounts.where({ supplierId }).first();
        if (account?.id) {
            await db.supplierAccounts.delete(account.id);
            await logActivity('DELETE', 'SupplierAccount', account.remoteId!, { deletedAccount: account });
            showNotification('حساب پورتال با موفقیت حذف شد.', 'success');
        }
    };

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
            <table className="w-full text-sm text-right text-gray-300">
                <thead className="text-xs text-gray-400 uppercase bg-gray-700/50">
                    <tr>
                        <th scope="col" className="px-6 py-3">نام تامین‌کننده</th>
                        <th scope="col" className="px-6 py-3">نام کاربری پورتال</th>
                        <th scope="col" className="px-6 py-3 text-center">عملیات</th>
                    </tr>
                </thead>
                <tbody>
                    {suppliers?.map(supplier => {
                        const account = accountsMap.get(supplier.id!);
                        return (
                             <tr key={supplier.id} className="bg-gray-800 border-b border-gray-700 hover:bg-gray-700/50">
                                <td className="px-6 py-4 font-medium text-white">{supplier.name}</td>
                                <td className="px-6 py-4">{account ? account.username : <span className="text-gray-500">ایجاد نشده</span>}</td>
                                <td className="px-6 py-4 flex items-center justify-center gap-4">
                                    {account ? (
                                        <>
                                            <button onClick={() => openModal(supplier)} disabled={!isOnline} className="text-blue-400 hover:text-blue-300 disabled:text-gray-600" title="بازنشانی رمز عبور"><Edit size={18} /></button>
                                            <button onClick={() => handleDeleteAccount(supplier.remoteId)} disabled={!isOnline} className="text-red-400 hover:text-red-300 disabled:text-gray-600" title="حذف حساب"><Trash2 size={18} /></button>
                                        </>
                                    ) : (
                                        <button onClick={() => openModal(supplier)} disabled={!isOnline} className="flex items-center gap-2 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed">
                                            <Plus size={14} />
                                            <span>ایجاد حساب</span>
                                        </button>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            {isModalOpen && selectedSupplier && (
                <SupplierAccountFormModal 
                    supplier={selectedSupplier}
                    account={accountsMap.get(selectedSupplier.id!)}
                    onClose={closeModal}
                />
            )}
        </div>
    );
};

// User Management Component
const UserManagement: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const { hasPermission } = useAuth();
    const { showNotification } = useNotification();
    const isOnline = useOnlineStatus();

    const users = useLiveQuery(() => db.users.toArray(), []);
    const roles = useLiveQuery(() => db.roles.toArray(), []);
    // FIX: Explicitly typed useMemo to prevent TypeScript from inferring map values as 'unknown'.
    const rolesMap = useMemo<Map<number, string>>(() => {
        if (!roles) return new Map();
        return new Map(roles.map(role => [role.id!, role.name]));
    }, [roles]);

    const openModalForNew = () => {
        setEditingUser(null);
        setIsModalOpen(true);
    };

    const openModalForEdit = (user: User) => {
        setEditingUser(user);
        setIsModalOpen(true);
    };

    const handleDelete = async (userId?: number) => {
        if (!userId || !window.confirm('آیا از حذف این کاربر مطمئن هستید؟')) return;
        
        const user = await db.users.get(userId);
        if (user?.username.toLowerCase() === 'admin') {
            showNotification('کاربر ادمین قابل حذف نیست.', 'error');
            return;
        }
        
        // Call RPC to delete user from Supabase auth and users table
        const { error } = await supabase.rpc('delete_user', { p_user_id: user?.remoteId });
        if (error) {
            showNotification(`خطا در حذف کاربر: ${error.message}`, 'error');
            return;
        }

        // On success, delete from local DB
        await db.users.delete(userId);
        await logActivity('DELETE', 'User', String(user?.remoteId), { deletedUser: user });
        showNotification('کاربر با موفقیت حذف شد.', 'success');
    };
    
    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                {hasPermission('settings:users:manage') && (
                    <button onClick={openModalForNew} disabled={!isOnline} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed">
                        <Plus size={20} /> افزودن کاربر جدید
                    </button>
                )}
            </div>
             <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
                <table className="w-full text-sm text-right text-gray-300">
                    <thead className="text-xs text-gray-400 uppercase bg-gray-700/50">
                        <tr>
                            <th scope="col" className="px-6 py-3">نام کاربری</th>
                            <th scope="col" className="px-6 py-3">نقش</th>
                            <th scope="col" className="px-6 py-3">عملیات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users?.map(user => (
                            <tr key={user.id} className="bg-gray-800 border-b border-gray-700 hover:bg-gray-700/50">
                                <td className="px-6 py-4 font-medium text-white">{user.username}</td>
                                <td className="px-6 py-4">{rolesMap.get(user.roleId) || 'ناشناخته'}</td>
                                <td className="px-6 py-4 flex items-center gap-4">
                                    {hasPermission('settings:users:manage') && (
                                        <>
                                            <button onClick={() => openModalForEdit(user)} disabled={!isOnline} className="text-blue-400 hover:text-blue-300 disabled:text-gray-600"><Edit size={18} /></button>
                                            <button onClick={() => handleDelete(user.id)} disabled={!isOnline} className="text-red-400 hover:text-red-300 disabled:text-gray-600"><Trash2 size={18} /></button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
             {isModalOpen && <UserFormModal user={editingUser} onClose={() => setIsModalOpen(false)} />}
        </div>
    );
};

// Role Management Component
const RoleManagement: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const { hasPermission } = useAuth();
    const { showNotification } = useNotification();
    const isOnline = useOnlineStatus();
    
    const roles = useLiveQuery(() => db.roles.toArray(), []);

    const openModalForNew = () => {
        setEditingRole(null);
        setIsModalOpen(true);
    };
    
    const openModalForEdit = (role: Role) => {
        if (!role.isEditable) {
            showNotification('نقش ادمین قابل ویرایش نیست.', 'info');
            return;
        }
        setEditingRole(role);
        setIsModalOpen(true);
    };

    const handleDelete = async (roleId?: number) => {
        if (!roleId || !window.confirm('آیا از حذف این نقش مطمئن هستید؟')) return;
        
        const role = await db.roles.get(roleId);
        if (!role?.isEditable) {
            showNotification('نقش ادمین قابل حذف نیست.', 'error');
            return;
        }

        const usersWithRole = await db.users.where({ roleId }).count();
        if (usersWithRole > 0) {
            showNotification('این نقش به یک یا چند کاربر اختصاص داده شده و قابل حذف نیست.', 'error');
            return;
        }
        
        // ONLINE-FIRST
        if (role.remoteId) {
            const { error } = await supabase.from('roles').delete().eq('id', role.remoteId);
            if (error) {
                showNotification(`خطا در حذف از سرور: ${error.message}`, 'error');
                return;
            }
        }
        await db.roles.delete(roleId);
        await logActivity('DELETE', 'Role', String(role.remoteId), { deletedRole: role });
        showNotification('نقش با موفقیت حذف شد.', 'success');
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                {hasPermission('settings:roles:manage') && (
                    <button onClick={openModalForNew} disabled={!isOnline} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed">
                        <Plus size={20} /> افزودن نقش جدید
                    </button>
                )}
            </div>
             <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
                <table className="w-full text-sm text-right text-gray-300">
                    <thead className="text-xs text-gray-400 uppercase bg-gray-700/50">
                        <tr>
                            <th scope="col" className="px-6 py-3">نام نقش</th>
                            <th scope="col" className="px-6 py-3">تعداد دسترسی‌ها</th>
                            <th scope="col" className="px-6 py-3">عملیات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {roles?.map(role => (
                            <tr key={role.id} className="bg-gray-800 border-b border-gray-700 hover:bg-gray-700/50">
                                <td className="px-6 py-4 font-medium text-white">{role.name}</td>
                                <td className="px-6 py-4">{role.permissions.length}</td>
                                <td className="px-6 py-4 flex items-center gap-4">
                                     {hasPermission('settings:roles:manage') && role.isEditable && (
                                        <>
                                            <button onClick={() => openModalForEdit(role)} disabled={!isOnline} className="text-blue-400 hover:text-blue-300 disabled:text-gray-600"><Edit size={18} /></button>
                                            <button onClick={() => handleDelete(role.id)} disabled={!isOnline} className="text-red-400 hover:text-red-300 disabled:text-gray-600"><Trash2 size={18} /></button>
                                        </>
                                     )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
             {isModalOpen && <RoleFormModal role={editingRole} onClose={() => setIsModalOpen(false)} />}
        </div>
    );
};

// Supplier Account Form Modal (Already Online-First via RPC)
const SupplierAccountFormModal: React.FC<{ supplier: Supplier; account: SupplierAccount | undefined; onClose: () => void; }> = ({ supplier, account, onClose }) => {
    const [username, setUsername] = useState(account?.username || '');
    const [password, setPassword] = useState('');
    const { showNotification } = useNotification();
    const isEditing = !!account;

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!username.trim() || (!isEditing && !password.trim())) {
            showNotification('لطفا نام کاربری و رمز عبور را وارد کنید.', 'error');
            return;
        }

        try {
            const { data, error } = await supabase.rpc('create_or_update_supplier_account', {
                p_supplier_id: supplier.remoteId,
                p_username: username.trim(),
                p_password: password.trim() // Send empty string if not changing
            });

            // FIX: Cast untyped RPC response to 'any' to prevent 'unknown' type errors.
            const typedData = data as any;

            if (error || !typedData?.success) {
                showNotification(typedData?.message || error?.message || 'خطا در ذخیره حساب.', 'error');
                return;
            }

            // On success, update local Dexie DB for immediate UI feedback
            const localAccountData: SupplierAccount = {
                id: account?.id,
                remoteId: typedData.remote_id,
                supplierId: supplier.id!,
                username: username.trim(),
            };
            await db.supplierAccounts.put(localAccountData); 

            await logActivity(isEditing ? 'UPDATE' : 'CREATE', 'SupplierAccount', typedData.remote_id, {
                account: { supplierId: supplier.remoteId, username: username.trim() }
            });
            
            showNotification(typedData.message, 'success');
            onClose();
        } catch (err) {
            console.error("Error saving supplier account:", err);
            showNotification("یک خطای پیش‌بینی نشده رخ داد.", 'error');
        }
    };

    return (
        <Modal title={isEditing ? `ویرایش حساب برای ${supplier.name}` : `ایجاد حساب برای ${supplier.name}`} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input value={username} onChange={e => setUsername(e.target.value)} placeholder="نام کاربری" required className="input-style" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={isEditing ? 'رمز عبور جدید (برای تغییر وارد کنید)' : 'رمز عبور'} required={!isEditing} className="input-style" />
                <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={onClose} className="btn-secondary">لغو</button>
                    <button type="submit" className="btn-primary">{isEditing ? 'ذخیره تغییرات' : 'ایجاد حساب'}</button>
                </div>
            </form>
            <style>{`
                .input-style { background-color: #1f2937; border: 1px solid #4b5563; color: #d1d5db; border-radius: 0.5rem; padding: 0.75rem; width: 100%; }
                .btn-primary { padding: 0.5rem 1rem; background-color: #2563eb; border-radius: 0.5rem; }
                .btn-secondary { padding: 0.5rem 1rem; background-color: #4b5563; border-radius: 0.5rem; }
            `}</style>
        </Modal>
    );
};


// User Form Modal (Already Online-First via RPC)
const UserFormModal: React.FC<{ user: User | null; onClose: () => void; }> = ({ user, onClose }) => {
    const [username, setUsername] = useState(user?.username || '');
    const [password, setPassword] = useState('');
    const [roleId, setRoleId] = useState<number | ''>(user?.roleId || '');
    const { showNotification } = useNotification();
    const isEditing = !!user;

    const roles = useLiveQuery(() => db.roles.toArray(), []);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!username.trim() || (!isEditing && !password.trim()) || !roleId) {
            showNotification('لطفا تمام فیلدها را پر کنید.', 'error');
            return;
        }
        
        try {
            if (isEditing && user?.id) {
                // --- UPDATE USER ---
                const { data, error } = await supabase.rpc('admin_update_user', {
                    p_user_id: user.remoteId,
                    p_username: username.trim(),
                    p_role_id: Number(roleId), // This should be the role's remoteId
                    p_new_password: password.trim() // Send empty string if not changing
                });
                
                const typedData = data as any;
                if (error || !typedData?.success) {
                    showNotification(typedData?.message || error?.message || 'خطا در ویرایش کاربر.', 'error');
                    return;
                }
                
                const oldUser = await db.users.get(user.id);
                const updatedData = { username: username.trim(), roleId: Number(roleId) };
                await db.users.update(user.id, updatedData);
                await logActivity('UPDATE', 'User', user.remoteId!, { old: oldUser, new: updatedData });
                showNotification(typedData.message, 'success');

            } else {
                // --- CREATE USER ---
                const localRole = await db.roles.get(Number(roleId));
                if (!localRole?.remoteId) {
                    showNotification('نقش انتخاب شده هنوز با سرور همگام‌سازی نشده است.', 'error');
                    return;
                }

                const { data, error } = await supabase.rpc('create_new_user', {
                    p_username: username.trim(),
                    p_password: password.trim(),
                    p_role_id: localRole.remoteId
                });

                const typedData = data as any;
                if (error || !typedData?.success) {
                    showNotification(typedData?.message || error?.message || 'خطا در ایجاد کاربر.', 'error');
                    return;
                }

                const newUser: User = {
                    remoteId: typedData.new_user_id,
                    username: username.trim(),
                    roleId: Number(roleId),
                };
                await db.users.add(newUser); // Add to local DB for UI update
                await logActivity('CREATE', 'User', newUser.remoteId!, { newUser });
                showNotification(typedData.message, 'success');
            }
            onClose();
        } catch (err) {
            console.error("Error saving user:", err);
            showNotification("یک خطای پیش‌بینی نشده رخ داد.", 'error');
        }
    };
    
    return (
        <Modal title={isEditing ? 'ویرایش کاربر' : 'افزودن کاربر جدید'} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input value={username} onChange={e => setUsername(e.target.value)} placeholder="نام کاربری" required className="input-style" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={isEditing ? 'رمز عبور جدید (اختیاری)' : 'رمز عبور'} required={!isEditing} className="input-style" />
                <select value={roleId} onChange={e => setRoleId(Number(e.target.value))} required className="input-style">
                    <option value="" disabled>-- انتخاب نقش --</option>
                    {roles?.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select>
                <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={onClose} className="btn-secondary">لغو</button>
                    <button type="submit" className="btn-primary">{isEditing ? 'ذخیره تغییرات' : 'افزودن'}</button>
                </div>
            </form>
            <style>{`
                .input-style { background-color: #1f2937; border: 1px solid #4b5563; color: #d1d5db; border-radius: 0.5rem; padding: 0.75rem; width: 100%; }
                .btn-primary { padding: 0.5rem 1rem; background-color: #2563eb; border-radius: 0.5rem; }
                .btn-secondary { padding: 0.5rem 1rem; background-color: #4b5563; border-radius: 0.5rem; }
            `}</style>
        </Modal>
    );
};

// Role Form Modal
const RoleFormModal: React.FC<{ role: Role | null; onClose: () => void; }> = ({ role, onClose }) => {
    const [name, setName] = useState(role?.name || '');
    const [selectedPermissions, setSelectedPermissions] = useState<Set<Permission>>(new Set(role?.permissions || []));
    const { showNotification } = useNotification();
    const isEditing = !!role;

    const handlePermissionToggle = (permission: Permission) => {
        const newSet = new Set(selectedPermissions);
        if (newSet.has(permission)) {
            newSet.delete(permission);
        } else {
            newSet.add(permission);
        }
        setSelectedPermissions(newSet);
    };
    
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            showNotification('نام نقش نمی‌تواند خالی باشد.', 'error');
            return;
        }
        
        const permissionsArray: Permission[] = Array.from(selectedPermissions);
        const roleData = { name: name.trim(), permissions: permissionsArray, is_editable: true };

        try {
            if (isEditing && role?.id) {
                const oldRole = await db.roles.get(role.id);
                // ONLINE-FIRST Update
                const { error } = await supabase.from('roles').update(roleData).eq('id', role.remoteId);
                if (error) throw error;
                // Update local
                await db.roles.update(role.id, { name: roleData.name, permissions: roleData.permissions });
                await logActivity('UPDATE', 'Role', role.remoteId!, { old: oldRole, new: roleData });
                showNotification('نقش با موفقیت ویرایش شد.', 'success');
            } else {
                // ONLINE-FIRST Create
                const { data: newData, error } = await supabase.from('roles').insert(roleData).select().single();
                if (error) throw error;
                // Create local
                const newRole: Role = {
                    name: newData.name,
                    permissions: newData.permissions,
                    isEditable: newData.is_editable,
                    remoteId: newData.id,
                };
                await db.roles.add(newRole);
                await logActivity('CREATE', 'Role', newData.id, { newRole: newData });
                showNotification('نقش با موفقیت ایجاد شد.', 'success');
            }
            onClose();
        } catch (error) {
            console.error("Error saving role:", error);
            showNotification("خطا در ذخیره نقش.", 'error');
        }
    };
    
    const permissionGroups = Object.keys(PERMISSIONS).reduce((acc, key) => {
        const groupKey = key.split(':')[0];
        if (!acc[groupKey]) {
            acc[groupKey] = [];
        }
        acc[groupKey].push(key as Permission);
        return acc;
    }, {} as Record<string, Permission[]>);

    return (
        <Modal title={isEditing ? 'ویرایش نقش' : 'افزودن نقش جدید'} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-6">
                <input value={name} onChange={e => setName(e.target.value)} placeholder="نام نقش" required className="input-style" />
                
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">دسترسی‌ها</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-h-64 overflow-y-auto p-2">
                        {Object.entries(permissionGroups).map(([groupName, permissions]) => (
                            <div key={groupName}>
                                <h4 className="font-bold text-gray-300 capitalize border-b border-gray-600 pb-1 mb-2">{groupName}</h4>
                                <div className="space-y-2">
                                    {permissions.map(permission => (
                                        <label key={permission} className="flex items-center gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedPermissions.has(permission)}
                                                onChange={() => handlePermissionToggle(permission)}
                                                className="w-4 h-4 rounded bg-gray-600 border-gray-500 text-blue-500 focus:ring-blue-600"
                                            />
                                            <span className="text-sm text-gray-300">{PERMISSIONS[permission]}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                    <button type="button" onClick={onClose} className="btn-secondary">لغو</button>
                    <button type="submit" className="btn-primary">{isEditing ? 'ذخیره تغییرات' : 'افزودن'}</button>
                </div>
            </form>
             <style>{`
                .input-style { background-color: #1f2937; border: 1px solid #4b5563; color: #d1d5db; border-radius: 0.5rem; padding: 0.75rem; width: 100%; }
                .btn-primary { padding: 0.5rem 1rem; background-color: #2563eb; border-radius: 0.5rem; }
                .btn-secondary { padding: 0.5rem 1rem; background-color: #4b5563; border-radius: 0.5rem; }
            `}</style>
        </Modal>
    );
};

export default Settings;