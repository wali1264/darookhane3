import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { PurchaseInvoice } from '../types';

interface PrintablePurchaseInvoiceProps {
  invoice: PurchaseInvoice;
  supplierName: string;
}

const PrintablePurchaseInvoice = React.forwardRef<HTMLDivElement, PrintablePurchaseInvoiceProps>(({ invoice, supplierName }, ref) => {
  const settings = useLiveQuery(() => db.settings.toArray());

  const pharmacyInfo = useMemo(() => {
    if (!settings) return { name: 'شفا-یار', logo: null };
    const name = settings.find(s => s.key === 'pharmacyName')?.value as string || 'شفا-یar';
    const logo = settings.find(s => s.key === 'pharmacyLogo')?.value as string || null;
    return { name, logo };
  }, [settings]);

  return (
    <div ref={ref} className="bg-white text-black p-6 printable-area">
      <div className="text-center mb-8 flex flex-col items-center border-b border-gray-200 pb-6">
        {pharmacyInfo.logo && <img src={pharmacyInfo.logo} alt="Pharmacy Logo" className="h-24 w-auto mb-3 object-contain" />}
        <h1 className="text-4xl font-bold text-gray-800">{pharmacyInfo.name}</h1>
        <p className="text-gray-500 mt-1">فاکتور خرید</p>
      </div>
      <div className="flex justify-between mb-6 text-base text-gray-700">
        <div>
          <p><span className="font-semibold text-gray-900">شماره فاکتور:</span> {invoice.invoiceNumber}</p>
          <p><span className="font-semibold text-gray-900">تامین‌کننده:</span> {supplierName}</p>
        </div>
        <div>
          <p><span className="font-semibold text-gray-900">تاریخ:</span> {new Date(invoice.date).toLocaleDateString('fa-IR')}</p>
        </div>
      </div>
      <table className="w-full text-base text-right border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-3 font-bold border text-gray-700">#</th>
            <th className="p-3 font-bold border text-gray-700 text-right">نام دارو</th>
            <th className="p-3 font-bold border text-gray-700 text-center">تعداد</th>
            <th className="p-3 font-bold border text-gray-700 text-center">قیمت واحد</th>
            <th className="p-3 font-bold border text-gray-700 text-center">شماره لات</th>
            <th className="p-3 font-bold border text-gray-700 text-center">تاریخ انقضا</th>
            <th className="p-3 font-bold border text-gray-700 text-left">قیمت کل</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, index) => (
            <tr key={index} className="border-b text-gray-800">
              <td className="p-3 border align-top">{index + 1}</td>
              <td className="p-3 border align-top font-medium text-right">{item.name}</td>
              <td className="p-3 border align-top text-center">{item.quantity}</td>
              <td className="p-3 border align-top text-center">${item.purchasePrice.toFixed(2)}</td>
              <td className="p-3 border align-top text-center">{item.lotNumber}</td>
              <td className="p-3 border align-top text-center">{new Date(item.expiryDate).toLocaleDateString('fa-IR')}</td>
              <td className="p-3 border align-top text-left">${(item.quantity * item.purchasePrice).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-8 flex justify-end">
        <div className="w-full max-w-xs text-right">
          <div className="flex justify-between items-center p-4 bg-gray-100 rounded-lg">
            <span className="font-bold text-xl text-gray-900">مبلغ کل:</span>
            <span className="font-bold text-xl text-gray-900">${invoice.totalAmount.toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div className="text-center text-xs text-gray-500 mt-10">
        <p>{window.location.host}</p>
      </div>
       <style>{`
        @media print {
          @page {
            size: A4;
            margin: 1cm;
          }
          .printable-area {
            font-size: 11pt;
          }
           .bg-gray-100 {
            background-color: #f3f4f6 !important;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
});

export default PrintablePurchaseInvoice;