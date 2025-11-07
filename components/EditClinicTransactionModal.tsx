import React, { useState, FormEvent } from 'react';
import { ClinicTransaction } from '../types';
import { db } from '../db';
import Modal from './Modal';

interface EditClinicTransactionModalProps {
  transaction: ClinicTransaction;
  onClose: () => void;
  onSave: () => void;
}

const EditClinicTransactionModal: React.FC<EditClinicTransactionModalProps> = ({ transaction, onClose, onSave }) => {
  const [patientName, setPatientName] = useState(transaction.patientName || '');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await db.clinicTransactions.update(transaction.id!, {
        patientName: patientName.trim(),
      });
      onSave();
    } catch (error) {
      console.error("Failed to update transaction:", error);
      alert("خطا در ذخیره تغییرات.");
    }
  };

  return (
    <Modal title={`ویرایش نوبت #${transaction.ticketNumber}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="patientName" className="block mb-2 text-sm font-medium text-gray-400">
            نام بیمار
          </label>
          <input
            id="patientName"
            type="text"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            placeholder="نام بیمار"
            className="input-style"
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">
            لغو
          </button>
          <button type="submit" className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700">
            ذخیره تغییرات
          </button>
        </div>
      </form>
       <style>{`
        .input-style { background-color: #1f2937; border: 1px solid #4b5563; color: #d1d5db; border-radius: 0.5rem; padding: 0.75rem; width: 100%; }
      `}</style>
    </Modal>
  );
};

export default EditClinicTransactionModal;
