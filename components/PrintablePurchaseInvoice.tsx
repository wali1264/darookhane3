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
    <div ref={ref} className="bg-white text-black p-2 printable-area">
      <div className="text-center mb-4 flex flex-col items-center border-b border-gray-300 pb-2">
        {pharmacyInfo.logo && <img src={pharmacyInfo.logo} alt="Pharmacy Logo" className="h-16 w-auto mb-2 object-contain" />}
        <h1 className="text-lg font-bold text-gray-900">{pharmacyInfo.name}</h1>
        <p className="text-xs text-gray-600">فاکتور خرید</p>
      </div>
      <div className="mb-4 text-xs text-gray-800">
        <p><span className="font-semibold">شماره فاکتور:</span> {invoice.invoiceNumber}</p>
        <p><span className="font-semibold">تامین‌کننده:</span> {supplierName}</p>
        <p><span className="font-semibold">تاریخ:</span> {new Date(invoice.date).toLocaleDateString('fa-IR')}</p>
      </div>
      
      {/* New Vertical Layout */}
      <div className="w-full text-xs text-right space-y-1">
        {/* Header */}
        <div className="flex font-semibold bg-gray-100 p-1 border-y border-gray-300">
            <div style={{ width: '65%' }}>شرح</div>
            <div style={{ width: '35%', textAlign: 'left' }}>جمع کل</div>
        </div>
        {/* Items */}
        <div className="space-y-2 pt-1">
            {invoice.items.map((item, index) => (
                <div key={index} className="border-b border-dashed border-gray-200 pb-2">
                    <div className="flex justify-between items-start">
                        <span className="font-medium" style={{ width: '65%', wordBreak: 'break-word' }}>{item.name}</span>
                        <span className="font-mono text-left" style={{ width: '35%' }}>${(item.quantity * item.purchasePrice).toFixed(2)}</span>
                    </div>
                    <div className="text-gray-600 text-2xs pr-2 mt-1">
                        <span>تعداد: {item.quantity}</span>
                        <span className="mx-1">|</span>
                        <span>قیمت: ${item.purchasePrice.toFixed(2)}</span>
                        <br/>
                        <span>لات: {item.lotNumber}</span>
                        <span className="mx-1">|</span>
                        <span>انقضا: {new Date(item.expiryDate).toLocaleDateString('fa-IR')}</span>
                    </div>
                </div>
            ))}
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <div className="w-full max-w-xs text-right">
          <div className="flex justify-between items-center p-2 bg-gray-100 rounded-md">
            <span className="font-bold text-sm text-gray-900">مبلغ کل:</span>
            <span className="font-bold text-sm text-gray-900">${invoice.totalAmount.toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div className="text-center text-2xs text-gray-500 mt-6">
        <p>{window.location.host}</p>
      </div>
       <style>{`
        .text-2xs {
            font-size: 0.7rem;
            line-height: 1.4;
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

export default PrintablePurchaseInvoice;