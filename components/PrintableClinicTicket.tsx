import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { ClinicTransaction } from '../types';

interface PrintableClinicTicketProps {
  transaction: ClinicTransaction;
  serviceName: string;
  providerName?: string;
}

const PrintableClinicTicket = React.forwardRef<HTMLDivElement, PrintableClinicTicketProps>(({ transaction, serviceName, providerName }, ref) => {
  const settings = useLiveQuery(() => db.settings.toArray());

  const pharmacyInfo = useMemo(() => {
    if (!settings) return { name: 'شفا-یار', logo: null };
    const name = settings.find(s => s.key === 'pharmacyName')?.value as string || 'شفا-یار';
    const logo = settings.find(s => s.key === 'pharmacyLogo')?.value as string || null;
    return { name, logo };
  }, [settings]);

  return (
    <div ref={ref} className="bg-white text-black p-6 printable-area">
      <div className="text-center mb-6 border-b border-gray-200 pb-4 flex flex-col items-center">
        {pharmacyInfo.logo && <img src={pharmacyInfo.logo} alt="Pharmacy Logo" className="h-20 w-auto mb-2 object-contain" />}
        <h1 className="text-2xl font-bold text-gray-800">کلینیک {pharmacyInfo.name}</h1>
        <p className="text-gray-500 mt-1">برگه نوبت</p>
      </div>
      
      <div className="flex justify-between items-center mb-4 text-gray-800">
          <div>
            <p className="text-sm text-gray-500">تاریخ و ساعت:</p>
            <p className="font-semibold">{new Date(transaction.date).toLocaleString('fa-IR')}</p>
          </div>
          <div className="text-left">
            <p className="text-sm text-gray-500">شماره نوبت</p>
            <p className="text-4xl font-bold text-blue-600">{transaction.ticketNumber}</p>
          </div>
      </div>
      
      <div className="space-y-3 text-sm mb-6 border-t border-gray-200 pt-4 text-gray-800">
        <div className="flex justify-between">
            <span className="font-semibold text-gray-600">نام بیمار:</span>
            <span className="font-bold">{transaction.patientName || 'عمومی'}</span>
        </div>
         <div className="flex justify-between">
            <span className="font-semibold text-gray-600">خدمت:</span>
            <span className="font-bold">{serviceName}</span>
        </div>
        {providerName && (
          <div className="flex justify-between">
              <span className="font-semibold text-gray-600">متخصص:</span>
              <span className="font-bold">{providerName}</span>
          </div>
        )}
      </div>

      <div className="my-6 p-4 bg-gray-100 border border-gray-200 rounded-lg text-center">
        <p className="text-gray-600 text-sm">مبلغ پرداخت شده</p>
        <p className="text-2xl font-bold text-green-700">${transaction.amount.toFixed(2)}</p>
      </div>
      
      <div className="text-center text-xs text-gray-500 mt-6">
        <p>لطفاً این برگه را تا زمان مراجعه به بخش مربوطه نزد خود نگهدارید.</p>
        <p>با آرزوی سلامتی</p>
      </div>

       <style>{`
        @media print {
          .printable-area {
            font-size: 12pt;
          }
        }
      `}</style>
    </div>
  );
});

export default PrintableClinicTicket;