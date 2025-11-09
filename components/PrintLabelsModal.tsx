import React, { useState } from 'react';
import { Drug } from '../types';
import Modal from './Modal';
import PrintPreviewModal from './PrintPreviewModal';
import PrintableSingleLabelSheet from './PrintableSingleLabelSheet';
import { Printer } from 'lucide-react';

interface PrintLabelsModalProps {
    drug: Drug;
    onClose: () => void;
}

const PrintLabelsModal: React.FC<PrintLabelsModalProps> = ({ drug, onClose }) => {
    const [count, setCount] = useState<number | ''>(100);
    const [showPreview, setShowPreview] = useState(false);

    const handlePrint = () => {
        if (!count || Number(count) <= 0) {
            alert("لطفاً تعداد برچسب‌ها را به درستی وارد کنید.");
            return;
        }
        setShowPreview(true);
    };

    if (showPreview) {
        return (
            <PrintPreviewModal 
                title={`پیش‌نمایش چاپ برچسب برای: ${drug.name}`} 
                onClose={() => setShowPreview(false)}
            >
                <PrintableSingleLabelSheet 
                    drug={drug} 
                    count={Number(count)}
                />
            </PrintPreviewModal>
        );
    }
    
    return (
        <Modal title={`تنظیمات چاپ برچسب برای: ${drug.name}`} onClose={onClose}>
            <div className="space-y-6">
                <p className="text-sm text-gray-400">
                    تعداد برچسب‌های مورد نیاز را وارد کنید. اندازه برچسب باید از قبل در تنظیمات پرینتر شما به عنوان یک سایز کاغذ سفارشی تعریف شده باشد.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">تعداد برچسب</label>
                        <input 
                            type="number" 
                            value={count} 
                            onChange={e => setCount(e.target.value === '' ? '' : parseInt(e.target.value))} 
                            className="input-style w-full" 
                            autoFocus
                        />
                    </div>
                </div>
                 <div className="flex justify-end gap-3 pt-4 border-t border-gray-600">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">لغو</button>
                    <button type="button" onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700">
                        <Printer size={18} />
                        پیش‌نمایش و چاپ
                    </button>
                </div>
                 <style>{`.input-style { background-color: #1f2937; border: 1px solid #4b5563; color: #d1d5db; border-radius: 0.5rem; padding: 0.75rem; }`}</style>
            </div>
        </Modal>
    );
};

export default PrintLabelsModal;