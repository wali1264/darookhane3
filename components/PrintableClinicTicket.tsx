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
    <div ref={ref} className="bg-white text-black p-2 printable-area">
      <div className="text-center mb-3 border-b-2 border-dashed border-gray-400 pb-2 flex flex-col items-center">
        {pharmacyInfo.logo && <img src={pharmacyInfo.logo} alt="Pharmacy Logo" className="h-12 w-auto mb-1 object-contain" />}
        <h1 className="text-base font-bold text-gray-800">کلینیک {pharmacyInfo.name}</h1>
      </div>
      
      <div className="flex justify-between items-center mb-2 text-gray-800">
          <div className="text-right">
            <p className="text-xs text-gray-600">تاریخ:</p>
            <p className="text-xs font-semibold">{new Date(transaction.date).toLocaleString('fa-IR')}</p>
          </div>
          <div className="text-left">
            <p className="text-sm text-gray-600">شماره نوبت</p>
            <p className="text-3xl font-bold text-black">{transaction.ticketNumber}</p>
          </div>
      </div>
      
      <div className="space-y-1 text-xs mb-3 border-t border-gray-300 pt-2 text-gray-800">
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

      <div className="my-3 p-2 bg-gray-100 border-y border-dashed border-gray-400 text-center">
        <p className="text-gray-700 text-xs">مبلغ پرداخت شده</p>
        <p className="text-lg font-bold text-black">${transaction.amount.toFixed(2)}</p>
      </div>
      
      <div className="text-center text-2xs text-gray-600 mt-3">
        <p>با آرزوی سلامتی</p>
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
            font-size: 10pt;
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

export default PrintableClinicTicket;