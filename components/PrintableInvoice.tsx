import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { SaleInvoice } from '../types';

interface PrintableInvoiceProps {
  invoice: SaleInvoice;
}

const PrintableInvoice = React.forwardRef<HTMLDivElement, PrintableInvoiceProps>(({ invoice }, ref) => {
  const settings = useLiveQuery(() => db.settings.toArray());

  const pharmacyInfo = useMemo(() => {
    if (!settings) return { name: 'شفا-یار', logo: null };
    const name = settings.find(s => s.key === 'pharmacyName')?.value as string || 'شفا-یار';
    const logo = settings.find(s => s.key === 'pharmacyLogo')?.value as string || null;
    return { name, logo };
  }, [settings]);

  return (
    <div ref={ref} className="bg-white text-black p-2 printable-area">
      <div className="text-center mb-4 flex flex-col items-center border-b border-gray-300 pb-2">
        {pharmacyInfo.logo && <img src={pharmacyInfo.logo} alt="Pharmacy Logo" className="h-16 w-auto mb-2 object-contain" />}
        <h1 className="text-lg font-bold text-gray-900">{pharmacyInfo.name}</h1>
        <p className="text-xs text-gray-600">فاکتور فروش</p>
      </div>
      <div className="mb-4 text-xs text-gray-800">
        <p><span className="font-semibold">شماره فاکتور:</span> {invoice.remoteId || invoice.id}</p>
        <p><span className="font-semibold">تاریخ:</span> {new Date(invoice.date).toLocaleString('fa-IR')}</p>
      </div>
      <table className="w-full text-xs text-right border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-1 font-semibold border text-gray-800 text-right">نام دارو</th>
            <th className="p-1 font-semibold border text-gray-800 text-center">تعداد</th>
            <th className="p-1 font-semibold border text-gray-800 text-center">قیمت</th>
            <th className="p-1 font-semibold border text-gray-800 text-left">جمع</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, index) => (
            <tr key={item.drugId} className="border-b text-gray-900">
              <td className="p-1 border align-top font-medium">{item.name}</td>
              <td className="p-1 border align-top text-center">{item.quantity}</td>
              <td className="p-1 border align-top text-center">${item.unitPrice.toFixed(2)}</td>
              <td className="p-1 border align-top text-left">${item.totalPrice.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex justify-end">
        <div className="w-full max-w-xs text-right">
          <div className="flex justify-between items-center p-2 bg-gray-100 rounded-md">
            <span className="font-bold text-sm text-gray-900">مبلغ کل:</span>
            <span className="font-bold text-sm text-gray-900">${invoice.totalAmount.toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div className="text-center text-2xs text-gray-500 mt-6">
        <p>از خرید شما سپاسگزاریم!</p>
        <p>{window.location.host}</p>
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
           .bg-gray-100 {
            background-color: #f3f4f6 !important;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          table, th, td {
             border-color: #999 !important;
          }
        }
      `}</style>
    </div>
  );
});

export default PrintableInvoice;