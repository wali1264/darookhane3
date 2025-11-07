import React, { useState, FormEvent, useRef, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Drug, DrugBatch, DrugType, ExpiryThreshold } from '../types';
import Modal from '../components/Modal';
import { Plus, Edit, Trash2, Sparkles, PackageOpen } from 'lucide-react';
import { useVoiceInput } from '../hooks/useVoiceInput';
import VoiceControlHeader from '../components/VoiceControlHeader';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { logActivity } from '../lib/activityLogger';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { supabase } from '../lib/supabaseClient';

const Inventory: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [selectedDrugForBatches, setSelectedDrugForBatches] = useState<Drug | null>(null);
  const [editingDrug, setEditingDrug] = useState<Drug | null>(null);
  const { hasPermission } = useAuth();
  const { showNotification } = useNotification();
  const isOnline = useOnlineStatus();

  const drugs = useLiveQuery(() => db.drugs.toArray(), []);
  const drugBatches = useLiveQuery(() => db.drugBatches.toArray(), []);
  const settings = useLiveQuery(() => db.settings.toArray());

  const expiryAlertThreshold: ExpiryThreshold = useMemo(() => 
    (settings?.find(s => s.key === 'expiryAlertThreshold')?.value as ExpiryThreshold) ?? { value: 3, unit: 'months' }, 
  [settings]);

  const earliestExpiryDates = useMemo(() => {
    if (!drugBatches) return new Map<number, string>();

    const expiryMap = new Map<number, string>();

    for (const batch of drugBatches) {
      if (batch.quantityInStock <= 0) continue; // Only consider batches with stock

      const existingExpiry = expiryMap.get(batch.drugId);
      if (!existingExpiry || new Date(batch.expiryDate) < new Date(existingExpiry)) {
        expiryMap.set(batch.drugId, batch.expiryDate);
      }
    }
    return expiryMap;
  }, [drugBatches]);
  
  const getExpiryTargetDate = useMemo(() => {
    const { value, unit } = expiryAlertThreshold;
    const targetDate = new Date();
    if (unit === 'days') targetDate.setDate(targetDate.getDate() + value);
    if (unit === 'weeks') targetDate.setDate(targetDate.getDate() + value * 7);
    if (unit === 'months') targetDate.setMonth(targetDate.getMonth() + value);
    return targetDate;
  }, [expiryAlertThreshold]);

  const openModalForNew = () => {
    setEditingDrug(null);
    setIsModalOpen(true);
  };

  const openModalForEdit = (drug: Drug) => {
    setEditingDrug(drug);
    setIsModalOpen(true);
  };
  
  const openBatchModal = (drug: Drug) => {
    setSelectedDrugForBatches(drug);
    setIsBatchModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsBatchModalOpen(false);
    setEditingDrug(null);
    setSelectedDrugForBatches(null);
  };

  const handleDelete = async (id?: number) => {
    if (!id || !isOnline) {
      showNotification('این عملیات در حالت آفلاین امکان‌پذیر نیست.', 'info');
      return;
    }
    if (window.confirm('آیا از حذف این دارو و تمام بچ‌های موجودی آن مطمئن هستید؟')) {
      try {
        const drugToDelete = await db.drugs.get(id);
        if (!drugToDelete || !drugToDelete.remoteId) {
          showNotification('دارو یافت نشد یا هنوز همگام‌سازی نشده است.', 'error');
          return;
        }

        // --- ONLINE-FIRST: Delete from Supabase first ---
        const { error: batchError } = await supabase.from('drug_batches').delete().eq('drug_id', drugToDelete.remoteId);
        if (batchError) throw batchError;

        const { error: drugError } = await supabase.from('drugs').delete().eq('id', drugToDelete.remoteId);
        if (drugError) throw drugError;

        // --- On success, delete from local cache ---
        await db.transaction('rw', db.drugs, db.drugBatches, async () => {
          await db.drugBatches.where({ drugId: id }).delete();
          await db.drugs.delete(id);
        });
        
        await logActivity('DELETE', 'Drug', String(drugToDelete.remoteId), { deletedDrug: drugToDelete });
        showNotification('دارو با موفقیت حذف شد.', 'success');
      } catch (error) {
        console.error("Failed to delete drug:", error);
        showNotification('خطا در حذف دارو.', 'error');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-white">مدیریت انبار</h2>
        {hasPermission('inventory:create') && (
            <button
            onClick={openModalForNew}
            disabled={!isOnline}
            title={!isOnline ? "این عملیات در حالت آفلاین در دسترس نیست" : "افزودن داروی جدید"}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
            >
            <Plus size={20} />
            <span>افزودن داروی جدید</span>
            </button>
        )}
      </div>
      <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right text-gray-300">
            <thead className="text-xs text-gray-400 uppercase bg-gray-700/50">
              <tr>
                <th scope="col" className="px-6 py-3">نام دارو</th>
                <th scope="col" className="px-6 py-3">شرکت</th>
                <th scope="col" className="px-6 py-3">موجودی کل</th>
                <th scope="col" className="px-6 py-3">قیمت فروش</th>
                <th scope="col" className="px-6 py-3">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {drugs?.map(drug => {
                const earliestExpiry = earliestExpiryDates.get(drug.id!);
                const expiryDate = earliestExpiry ? new Date(earliestExpiry) : null;
                const isSoonToExpire = expiryDate && expiryDate < getExpiryTargetDate;

                return (
                    <tr key={drug.id} className="bg-gray-800 border-b border-gray-700 hover:bg-gray-700/50">
                        <td className={`px-6 py-4 font-medium whitespace-nowrap ${isSoonToExpire ? 'text-yellow-400' : 'text-white'}`}>{drug.name}</td>
                        <td className="px-6 py-4">{drug.company}</td>
                        <td className="px-6 py-4">{drug.totalStock}</td>
                        <td className="px-6 py-4">${drug.salePrice.toFixed(2)}</td>
                        <td className="px-6 py-4 flex items-center gap-4">
                            <button onClick={() => openBatchModal(drug)} className="text-gray-400 hover:text-white" title="مشاهده بچ‌ها"><PackageOpen size={18} /></button>
                            {hasPermission('inventory:edit') && <button onClick={() => openModalForEdit(drug)} disabled={!isOnline} className="text-blue-400 hover:text-blue-300 disabled:text-gray-500 disabled:cursor-not-allowed" title={!isOnline ? "این عملیات در حالت آفلاین در دسترس نیست" : "ویرایش"}><Edit size={18} /></button>}
                            {hasPermission('inventory:delete') && <button onClick={() => handleDelete(drug.id)} disabled={!isOnline} className="text-red-400 hover:text-red-300 disabled:text-gray-500 disabled:cursor-not-allowed" title={!isOnline ? "این عملیات در حالت آفلاین در دسترس نیست" : "حذف"}><Trash2 size={18} /></button>}
                        </td>
                    </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {isModalOpen && (
        <DrugFormModal drug={editingDrug} onClose={closeModal} />
      )}
      {isBatchModalOpen && selectedDrugForBatches && (
        <BatchDetailsModal drug={selectedDrugForBatches} onClose={closeModal} />
      )}
    </div>
  );
};

const BatchDetailsModal: React.FC<{ drug: Drug; onClose: () => void }> = ({ drug, onClose }) => {
    const batches = useLiveQuery(() => db.drugBatches.where('drugId').equals(drug.id!).filter(b => b.quantityInStock > 0).toArray(), [drug.id]);

    return (
        <Modal title={`بچ‌های موجود برای: ${drug.name}`} onClose={onClose}>
            <div className="max-h-96 overflow-y-auto">
                {batches && batches.length > 0 ? (
                    <table className="w-full text-sm text-right text-gray-300">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-700/50 sticky top-0">
                            <tr>
                                <th scope="col" className="px-4 py-2">شماره لات</th>
                                <th scope="col" className="px-4 py-2">تعداد موجود</th>
                                <th scope="col" className="px-4 py-2">تاریخ انقضا</th>
                                <th scope="col" className="px-4 py-2">قیمت خرید</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {batches.map(batch => (
                                <tr key={batch.id}>
                                    <td className="px-4 py-3 font-medium text-white">{batch.lotNumber}</td>
                                    <td className="px-4 py-3">{batch.quantityInStock}</td>
                                    <td className="px-4 py-3">{new Date(batch.expiryDate).toLocaleDateString('fa-IR')}</td>
                                    <td className="px-4 py-3">${batch.purchasePrice.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="text-center text-gray-500 py-8">هیچ بچ با موجودی برای این دارو یافت نشد.</p>
                )}
            </div>
             <div className="flex justify-end pt-4 mt-4 border-t border-gray-600">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">بستن</button>
            </div>
        </Modal>
    );
};

// This form now handles the definition of a drug AND its initial batch.
type DrugFormData = Omit<Drug, 'id' | 'purchasePrice' | 'salePrice' | 'totalStock'> & {
  purchasePrice: number | '';
  salePrice: number | '';
  totalStock: number | ''; // Represents the stock of the initial batch
  lotNumber: string;
  expiryDate: string;
};


const DrugFormModal: React.FC<{ drug: Drug | null; onClose: () => void; }> = ({ drug, onClose }) => {
  const { showNotification } = useNotification();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<DrugFormData>({
    name: drug?.name || '',
    company: drug?.company || '',
    purchasePrice: drug?.purchasePrice ?? '',
    salePrice: drug?.salePrice ?? '',
    totalStock: '', // Always empty for editing, only for new
    type: drug?.type || DrugType.TABLET,
    barcode: drug?.barcode || undefined,
    internalBarcode: drug?.internalBarcode || undefined,
    // Batch-specific info for the *first* batch
    lotNumber: '',
    expiryDate: '',
  });

  const [isExpiryDateValid, setIsExpiryDateValid] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);
  
  const focusOrder = [
    'name',
    'company',
    'purchasePrice',
    'salePrice',
    'lotNumber',
    'expiryDate',
    'totalStock',
    'barcode',
    'internalBarcode'
  ];

  const handleVoiceTranscript = (transcript: string) => {
    const form = formRef.current;
    if (!form) return;

    const activeElement = document.activeElement as HTMLElement;
    if (!activeElement || !form.contains(activeElement) || !('name' in activeElement && activeElement.name)) {
        return;
    }
    const currentFocusedInputName = (activeElement as HTMLInputElement).name;


    const normalizeTranscript = (text: string, fieldName: string) => {
      const persianDigitsMap: { [key: string]: string } = { '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };
      let normalized = text;
      
      const numericFields = ['purchasePrice', 'salePrice', 'totalStock', 'lotNumber', 'expiryDate', 'barcode', 'internalBarcode'];
      if (numericFields.includes(fieldName)) {
        for (const key in persianDigitsMap) {
          normalized = normalized.replace(new RegExp(key, 'g'), persianDigitsMap[key]);
        }
        // Remove spaces for purely numeric fields
        if (['purchasePrice', 'salePrice', 'totalStock'].includes(fieldName)) {
            normalized = normalized.replace(/ /g, '');
        }
      }
      return normalized.trim();
    };
    
    const processedTranscript = normalizeTranscript(transcript, currentFocusedInputName);
    
    if (currentFocusedInputName === 'expiryDate') {
        setIsExpiryDateValid(validateExpiry(processedTranscript));
    }

    setFormData(prev => ({ ...prev, [currentFocusedInputName]: processedTranscript }));

    let currentIndex = focusOrder.indexOf(currentFocusedInputName);
    if (currentIndex > -1) {
        for (let i = currentIndex + 1; i < focusOrder.length; i++) {
            const nextInputName = focusOrder[i];
            const nextElement = form.elements.namedItem(nextInputName) as HTMLElement & { disabled?: boolean };
            if (nextElement && !nextElement.disabled) {
                setTimeout(() => nextElement.focus(), 100);
                break;
            }
        }
    }
  };

  const voiceControls = useVoiceInput({ onTranscript: handleVoiceTranscript });

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const target = e.target as HTMLElement;

        if (target.nodeName === 'INPUT' && 'name' in target && target.name) {
             // FIX: The `in` operator confirms `name` exists, but TypeScript infers its type
             // on a generic HTMLElement as `unknown`. Casting to `string` is needed for `indexOf`.
             let currentIndex = focusOrder.indexOf(target.name as string);
             if (currentIndex > -1) {
                for (let i = currentIndex + 1; i < focusOrder.length; i++) {
                    const nextInputName = focusOrder[i];
                    const nextElement = form.elements.namedItem(nextInputName) as HTMLElement & { disabled?: boolean };
                    if (nextElement && !nextElement.disabled) {
                        nextElement.focus();
                        return; // Exit after focusing the correct element
                    }
                }
             }
        }
        // Fallback for elements not in focusOrder or for the last element
        const focusable = Array.from(
          form.querySelectorAll('input, select, button')
        ) as HTMLElement[];
        const index = focusable.indexOf(target);
        if (index > -1 && index < focusable.length - 1) {
          focusable[index + 1].focus();
        }
      }
    };
    
    form.addEventListener('keydown', handleKeyDown);
    return () => {
      form.removeEventListener('keydown', handleKeyDown);
    };
  }, [focusOrder]);

  const validateExpiry = (value: string): boolean => {
      const trimmedValue = value.trim();
      if (!trimmedValue) return true;

      const yyyy_mm_dd_regex = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/;
      const yyyy_mm_dd_match = trimmedValue.match(yyyy_mm_dd_regex);
      if (yyyy_mm_dd_match) {
          const year = parseInt(yyyy_mm_dd_match[1]);
          const month = parseInt(yyyy_mm_dd_match[2]);
          const day = parseInt(yyyy_mm_dd_match[3]);
          const date = new Date(year, month - 1, day);
          return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day && year > 2000 && year < 2100;
      }

      const regex = /^(?:(\d{1,2})[\s\/-]?)(\d{4})$|^(\d{4})[\s\/-]?(\d{1,2})$/;
      const match = trimmedValue.match(regex);
      let monthStr, yearStr;

      if (match) {
        monthStr = match[1] || match[4];
        yearStr = match[2] || match[3];
      } else if (/^\d{5,6}$/.test(trimmedValue)) {
        monthStr = trimmedValue.slice(0, -4);
        yearStr = trimmedValue.slice(-4);
      } else if (/^\d{1,4}$/.test(trimmedValue)) { // Handle incomplete voice inputs like "22"
        return false;
      }

      if (monthStr && yearStr) {
        const year = parseInt(yearStr);
        const month = parseInt(monthStr);
        return (month >= 1 && month <= 12 && year > 2000 && year < 2100);
      }
      return false;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'expiryDate') {
      setIsExpiryDateValid(validateExpiry(value));
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleExpiryDateBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    if (!value || !isExpiryDateValid) return;

    const regex = /^(?:(\d{1,2})[\s\/-]?)(\d{4})$|^(\d{4})[\s\/-]?(\d{1,2})$/;
    const match = value.match(regex);

    let monthStr: string | undefined, yearStr: string | undefined;

    if (match) {
      monthStr = match[1] || match[4];
      yearStr = match[2] || match[3];
    } else if (/^\d{5,6}$/.test(value)) {
      monthStr = value.slice(0, -4);
      yearStr = value.slice(-4);
    }

    if (monthStr && yearStr) {
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);

      if (month >= 1 && month <= 12 && year > 2000 && year < 2100) {
        const lastDay = new Date(year, month, 0).getDate();
        const formattedDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        setFormData(prev => ({ ...prev, expiryDate: formattedDate }));
        setIsExpiryDateValid(true);
      }
    }
  };

  const generateInternalBarcode = () => {
    const newBarcode = `INT-${Date.now()}`;
    setFormData(prev => ({...prev, internalBarcode: newBarcode}));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    if (!isExpiryDateValid) {
        showNotification('فرمت تاریخ انقضا نامعتبر است.', 'error');
        setIsSaving(false);
        return;
    }
    
    if (!drug && formData.expiryDate) {
        const expiry = new Date(formData.expiryDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0); 
        if (expiry < today) {
            showNotification('تاریخ انقضا نمی‌تواند در گذشته باشد.', 'error');
            setIsSaving(false);
            return;
        }
    } else if (!drug && (!formData.lotNumber || !formData.expiryDate || formData.totalStock === '')) {
        showNotification('لطفاً اطلاعات بچ اولیه را وارد کنید.', 'error');
        setIsSaving(false);
        return;
    }
    
    try {
      if (drug && drug.id) { // --- EDITING LOGIC ---
        const dataToUpdate = {
          name: formData.name,
          company: formData.company,
          sale_price: Number(formData.salePrice) || 0,
          purchase_price: Number(formData.purchasePrice) || 0,
          type: formData.type,
          barcode: formData.barcode || null,
          internal_barcode: formData.internalBarcode || null,
        };
        const oldDrug = await db.drugs.get(drug.id);

        // ONLINE-FIRST: Update Supabase
        const { error } = await supabase.from('drugs').update(dataToUpdate).eq('id', drug.remoteId);
        if (error) throw error;

        // On success, update local cache
        await db.drugs.update(drug.id, {
            ...dataToUpdate,
            salePrice: dataToUpdate.sale_price,
            purchasePrice: dataToUpdate.purchase_price,
            internalBarcode: dataToUpdate.internal_barcode
        });

        await logActivity('UPDATE', 'Drug', String(drug.remoteId), { old: oldDrug, new: dataToUpdate });
        showNotification('تغییرات با موفقیت ذخیره شد.', 'success');

      } else { // --- ADDING NEW DRUG LOGIC ---
        const drugToSave = {
            name: formData.name,
            company: formData.company,
            purchase_price: Number(formData.purchasePrice) || 0,
            sale_price: Number(formData.salePrice) || 0,
            total_stock: Number(formData.totalStock) || 0,
            type: formData.type,
            barcode: formData.barcode || null,
            internal_barcode: formData.internalBarcode || null,
        };

        // ONLINE-FIRST: Insert into Supabase and get the new record
        const { data: newDrugData, error: drugError } = await supabase.from('drugs').insert(drugToSave).select().single();
        if (drugError) throw drugError;

        const batchToSave = {
            drug_id: newDrugData.id,
            lot_number: formData.lotNumber,
            expiry_date: formData.expiryDate,
            quantity_in_stock: Number(formData.totalStock) || 0,
            purchase_price: Number(formData.purchasePrice) || 0,
        };

        const { data: newBatchData, error: batchError } = await supabase.from('drug_batches').insert(batchToSave).select().single();
        
        if (batchError) {
            // Rollback: delete the drug that was just created
            await supabase.from('drugs').delete().eq('id', newDrugData.id);
            throw batchError;
        }

        // The local cache will be updated by the real-time subscription in App.tsx.
        // No local writes are needed here.

        await logActivity('CREATE', 'Drug', newDrugData.id, { newDrug: newDrugData, newBatch: newBatchData });
        showNotification(`داروی "${formData.name}" با موفقیت اضافه شد.`, 'success');
      }
      onClose();
    } catch (error) {
       console.error("Failed to save drug:", error);
       showNotification('خطا در ذخیره دارو.', 'error');
    } finally {
        setIsSaving(false);
    }
  };
  
  const isEditing = !!drug;

  return (
    <Modal 
      title={isEditing ? 'ویرایش دارو' : 'افزودن داروی جدید'} 
      onClose={onClose}
      headerContent={<VoiceControlHeader {...voiceControls} />}
    >
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <input name="name" value={formData.name} onChange={handleChange} placeholder="نام دارو (مثال: Amoxicillin 500mg)" required className="input-style" autoFocus/>
          </div>
          <input name="company" value={formData.company} onChange={handleChange} placeholder="شرکت سازنده" required className="input-style" />
          <select name="type" value={formData.type} onChange={handleChange} className="input-style">
            {Object.values(DrugType).map(type => <option key={type} value={type}>{type}</option>)}
          </select>
          <input name="purchasePrice" value={formData.purchasePrice} onChange={handleChange} type="text" placeholder="قیمت خرید پیش‌فرض" required className="input-style" />
          <input name="salePrice" value={formData.salePrice} onChange={handleChange} type="text" placeholder="قیمت فروش" required className="input-style" />
          
           <div className="lg:col-span-3 border-t border-gray-600 pt-4 mt-2">
             <h3 className="text-sm font-semibold text-gray-400 mb-2">{isEditing ? 'کدهای شناسایی' : 'اطلاعات اولین بچ و موجودی اولیه'}</h3>
           </div>
          
          <input name="lotNumber" value={formData.lotNumber} onChange={handleChange} placeholder="شماره لات" required={!isEditing} disabled={isEditing} className={`input-style ${isEditing ? 'bg-gray-700' : ''}`} />
          <input name="expiryDate" value={formData.expiryDate} onChange={handleChange} onBlur={handleExpiryDateBlur} type="text" placeholder="تاریخ انقضا (مثال: 2027-12)" required={!isEditing} disabled={isEditing} className={`input-style ${isEditing ? 'bg-gray-700' : ''} ${!isExpiryDateValid ? '!border-red-500' : ''}`} />
          <input name="totalStock" value={formData.totalStock} onChange={handleChange} type="text" placeholder="موجودی اولیه" required={!isEditing} disabled={isEditing} className={`input-style ${isEditing ? 'bg-gray-700' : ''}`} />
          
          <div className="lg:col-span-3">
             <input name="barcode" value={formData.barcode} onChange={handleChange} placeholder="کد محصول (بارکد یا QR با اسکنر وارد شود)" className="input-style" />
          </div>
           <div className="lg:col-span-3">
             <div className="relative">
              <input name="internalBarcode" value={formData.internalBarcode} onChange={handleChange} placeholder="بارکد داخلی (در صورت نبود کد خارجی)" className="input-style pr-32" />
              <button type="button" onClick={generateInternalBarcode} className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-2 text-xs bg-blue-600 text-white rounded-md px-2 py-1.5 hover:bg-blue-700">
                <Sparkles size={14} />
                ایجاد بارکد
              </button>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">لغو</button>
          <button type="submit" disabled={isSaving} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-500">{isSaving ? 'در حال ذخیره...' : (isEditing ? 'ذخیره تغییرات' : 'افزودن')}</button>
        </div>
      </form>
      <style>{`
        .input-style {
          background-color: #1f2937;
          border: 1px solid #4b5563;
          color: #d1d5db;
          border-radius: 0.5rem;
          padding: 0.75rem;
          width: 100%;
          font-size: 0.875rem;
        }
        .input-style::placeholder {
            color: #6b7280;
        }
        .input-style:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.4);
        }
        .input-style:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }
      `}</style>
    </Modal>
  );
};

export default Inventory;