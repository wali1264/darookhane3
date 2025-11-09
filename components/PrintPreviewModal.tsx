import React from 'react';
import Modal from './Modal';
import { Printer } from 'lucide-react';

interface PrintPreviewModalProps {
    title: string;
    onClose: () => void;
    children: React.ReactNode;
}

const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({ title, onClose, children }) => {
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
                }
            `}</style>
        </Modal>
    );
};

export default PrintPreviewModal;