import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Supplier } from '../types';

export interface Transaction {
  date: string;
  description: string;
  detail?: string; // For recipient name
  debit: number; // Purchase
  credit: number; // Payment
  balance: number;
  isOpeningBalance?: boolean;
}

interface PrintableSupplierLedgerProps {
  supplier: Supplier;
  transactions: Transaction[];
}

const PrintableSupplierLedger = React.forwardRef<HTMLDivElement, PrintableSupplierLedgerProps>(({ supplier, transactions }, ref) => {
    const finalBalance = transactions.length > 0 ? transactions[transactions.length - 1].balance : 0;
    const settings = useLiveQuery(() => db.settings.toArray());

    const pharmacyInfo = useMemo(() => {
        if (!settings) return { name: 'شفا-یار', logo: null };
        const name = settings.find(s => s.key === 'pharmacyName')?.value as string || 'شفا-یار';
        const logo = settings.find(s => s.key === 'pharmacyLogo')?.value as string || null;
        return { name, logo };
    }, [settings]);
    
    return (
        <div ref={ref} className="bg-white text-black p-6 printable-area">
            <div className="header-placeholder">
                 <div className="text-center mb-6 flex flex-col items-center">
                    {pharmacyInfo.logo && <img src={pharmacyInfo.logo} alt="Pharmacy Logo" className="h-20 w-auto mb-2 object-contain" />}
                    <h1 className="text-2xl font-bold text-gray-800">{pharmacyInfo.name}</h1>
                    <p className="text-gray-500">صورت حساب تامین‌کننده</p>
                </div>

                <div className="flex justify-between mb-4 text-sm border-b border-gray-200 pb-4 text-gray-700">
                    <div>
                        <p><span className="font-semibold text-gray-900">تامین‌کننده:</span> {supplier.name}</p>
                        {supplier.contactPerson && <p><span className="font-semibold text-gray-900">شخص مسئول:</span> {supplier.contactPerson}</p>}
                    </div>
                    <div>
                        <p><span className="font-semibold text-gray-900">تاریخ گزارش:</span> {new Date().toLocaleDateString('fa-IR')}</p>
                    </div>
                </div>
            </div>

            <table className="w-full text-sm text-right main-table border-collapse">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="p-2 border">تاریخ</th>
                        <th className="p-2 border text-right">شرح</th>
                        <th className="p-2 border text-right">تحویل گیرنده</th>
                        <th className="p-2 border text-center">بدهکار (افزایش بدهی)</th>
                        <th className="p-2 border text-center">بستانکار (کاهش بدهی)</th>
                        <th className="p-2 border text-left">مانده حساب</th>
                    </tr>
                </thead>
                <tbody>
                    {transactions.map((t, index) => (
                        <tr key={index} className={`row-item ${t.isOpeningBalance ? 'font-bold bg-gray-50' : ''}`}>
                            <td className="p-2 border whitespace-nowrap">
                                {!t.isOpeningBalance ? new Date(t.date).toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }) : ''}
                            </td>
                            <td className="p-2 border text-right">{t.description}</td>
                             <td className="p-2 border text-right text-gray-500">{t.detail || '-'}</td>
                            <td className="p-2 border text-center text-red-600">{t.debit > 0 ? `$${t.debit.toFixed(2)}` : '-'}</td>
                            <td className="p-2 border text-center text-green-600">{t.credit > 0 ? `$${t.credit.toFixed(2)}` : '-'}</td>
                            <td className={`p-2 border text-left font-semibold ${t.balance < 0 ? 'text-green-700' : 'text-gray-800'}`}>
                                ${Math.abs(t.balance).toFixed(2)}
                                {t.balance < 0 && <span className="text-xs"> (بستانکار)</span>}
                            </td>
                        </tr>
                    ))}
                    {transactions.length === 0 && (
                        <tr>
                            <td colSpan={6} className="text-center py-10 text-gray-500 border">هیچ تراکنشی برای نمایش وجود ندارد.</td>
                        </tr>
                    )}
                </tbody>
            </table>

            <div className="footer-placeholder">
                <div className="mt-6 flex justify-end">
                    <div className="w-full max-w-xs text-right">
                        <div className="flex justify-between py-2 border-t-2 border-gray-400">
                            <span className="font-bold text-lg text-gray-900">مانده نهایی:</span>
                            <span className={`font-bold text-lg ${finalBalance > 0 ? 'text-yellow-600' : 'text-green-700'}`}>
                            ${Math.abs(finalBalance).toFixed(2)}
                            {finalBalance < 0 ? ' (بستانکار)' : ' (بدهکار)'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            
            <style>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 1.5cm;
                    }
                    .printable-area {
                        font-size: 9pt;
                    }
                    .main-table thead {
                        display: table-header-group; /* This is key for repeating headers */
                    }
                     .main-table tbody tr {
                        page-break-inside: avoid;
                    }
                    .bg-gray-100, .bg-gray-50 {
                        background-color: #f9fafb !important;
                         -webkit-print-color-adjust: exact !important;
                        color-adjust: exact !important;
                    }
                }
            `}</style>
        </div>
    );
});

export default PrintableSupplierLedger;