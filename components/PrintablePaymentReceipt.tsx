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
    <div ref={ref} className="bg-white text-black p-2 printable-area">
      <div className="text-center mb-4 border-b border-gray-300 pb-2 flex flex-col items-center">
        {pharmacyInfo.logo && <img src={pharmacyInfo.logo} alt="Pharmacy Logo" className="h-12 w-auto mb-1 object-contain" />}
        <h1 className="text-base font-bold text-gray-800">{pharmacyInfo.name}</h1>
        <p className="text-xs text-gray-600">رسید پرداخت وجه</p>
      </div>
      
      <div className="space-y-1 text-xs mb-4 text-gray-900">
        <div className="flex justify-between">
            <span className="font-semibold text-gray-700">تاریخ:</span>
            <span>{new Date(payment.date).toLocaleString('fa-IR')}</span>
        </div>
         <div className="flex justify-between">
            <span className="font-semibold text-gray-700">به:</span>
            <span className="font-bold">{supplierName}</span>
        </div>
        <div className="flex justify-between">
            <span className="font-semibold text-gray-700">گیرنده:</span>
            <span className="font-bold">{payment.recipientName}</span>
        </div>
        {payment.description && (
          <div className="flex justify-between">
              <span className="font-semibold text-gray-700">شرح:</span>
              <span>{payment.description}</span>
          </div>
        )}
      </div>

      <div className="my-4 p-2 bg-gray-100 border-y border-dashed border-gray-400 text-center">
        <p className="text-gray-700 text-xs">مبلغ پرداخت شده</p>
        <p className="text-lg font-bold text-black tracking-wider">${payment.amount.toFixed(2)}</p>
      </div>
      
      <div className="mt-8 grid grid-cols-2 gap-4 text-center text-2xs text-gray-700">
         <div className="flex flex-col items-center justify-between">
            <p className="mb-8 font-semibold">امضای پرداخت کننده</p>
            <div className="w-full border-t border-gray-500"></div>
        </div>
         <div className="flex flex-col items-center justify-between">
            <p className="mb-8 font-semibold">امضای تحویل گیرنده</p>
             <div className="w-full border-t border-gray-500"></div>
        </div>
      </div>
       <style>{`
        .text-2xs {
          font-size: 0.65rem;
        }
        @media print {
          @page {
            margin: 0.5cm;
          }
          .printable-area {
            font-size: 9pt;
            width: 100%;
            padding: 0.5cm;
            box-sizing: border-box;
            background: white !important;
            color: black !important;
          }
        }
      `}</style>
    </div>
  );
});

export default PrintablePaymentReceipt;