import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Payment } from '../types';

interface PrintablePaymentReceiptProps {
  payment: Payment;
  supplierName: string;
}

const PrintablePaymentReceipt = React.forwardRef<HTMLDivElement, PrintablePaymentReceiptProps>(({ payment, supplierName }, ref) => {
  const settings = useLiveQuery(() => db.settings.toArray());

  const pharmacyInfo = useMemo(() => {
    if (!settings) return { name: 'شفا-یار', logo: null };
    const name = settings.find(s => s.key === 'pharmacyName')?.value as string || 'شفا-یار';
    const logo = settings.find(s => s.key === 'pharmacyLogo')?.value as string || null;
    return { name, logo };
  }, [settings]);

  return (
    <div ref={ref} className="bg-white text-black p-6 printable-area">
      <div className="text-center mb-8 border-b border-gray-200 pb-4 flex flex-col items-center">
        {pharmacyInfo.logo && <img src={pharmacyInfo.logo} alt="Pharmacy Logo" className="h-20 w-auto mb-2 object-contain" />}
        <h1 className="text-2xl font-bold text-gray-800">{pharmacyInfo.name}</h1>
        <p className="text-gray-500 mt-1">رسید پرداخت وجه</p>
      </div>
      
      <div className="space-y-3 text-sm mb-6 text-gray-800">
        <div className="flex justify-between">
            <span className="font-semibold text-gray-600">تاریخ و ساعت:</span>
            <span>{new Date(payment.date).toLocaleString('fa-IR')}</span>
        </div>
         <div className="flex justify-between">
            <span className="font-semibold text-gray-600">پرداخت به تامین‌کننده:</span>
            <span className="font-bold">{supplierName}</span>
        </div>
        <div className="flex justify-between">
            <span className="font-semibold text-gray-600">تحویل گیرنده:</span>
            <span className="font-bold">{payment.recipientName}</span>
        </div>
        {payment.description && (
          <div className="flex justify-between">
              <span className="font-semibold text-gray-600">شرح:</span>
              <span>{payment.description}</span>
          </div>
        )}
      </div>

      <div className="my-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
        <p className="text-gray-600 text-sm">مبلغ پرداخت شده</p>
        <p className="text-2xl font-bold text-green-700 tracking-wider">${payment.amount.toFixed(2)}</p>
      </div>
      
      <div className="mt-16 grid grid-cols-3 gap-8 text-center text-xs text-gray-700">
         <div className="flex flex-col items-center justify-between">
            <p className="mb-12 font-semibold">امضای پرداخت کننده</p>
            <div className="w-full border-t border-gray-400 border-dashed"></div>
        </div>
         <div className="flex flex-col items-center justify-between">
            <p className="mb-12 font-semibold">امضای تحویل گیرنده</p>
             <div className="w-full border-t border-gray-400 border-dashed"></div>
        </div>
        <div className="flex flex-col items-center">
            <p className="font-semibold">محل اثر انگشت</p>
            <div className="w-20 h-24 mt-2 border-2 border-dashed border-gray-400 rounded-md flex items-center justify-center">
                <span className="text-gray-300"></span>
            </div>
        </div>
      </div>
       <style>{`
        @media print {
          .printable-area {
            color: black !important;
            background: white !important;
          }
        }
      `}</style>
    </div>
  );
});

export default PrintablePaymentReceipt;