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
        <div ref={ref} className="bg-white text-black p-2 printable-area">
            <div className="header-placeholder">
                 <div className="text-center mb-2 flex flex-col items-center">
                    {pharmacyInfo.logo && <img src={pharmacyInfo.logo} alt="Pharmacy Logo" className="h-12 w-auto mb-1 object-contain" />}
                    <h1 className="text-base font-bold text-gray-800">{pharmacyInfo.name}</h1>
                    <p className="text-xs text-gray-600">صورت حساب تامین‌کننده</p>
                </div>

                <div className="mb-2 text-xs border-y border-gray-300 py-2 text-gray-800">
                    <p><span className="font-semibold">تامین‌کننده:</span> {supplier.name}</p>
                    <p><span className="font-semibold">تاریخ گزارش:</span> {new Date().toLocaleDateString('fa-IR')}</p>
                </div>
            </div>

            <table className="w-full text-2xs text-right main-table border-collapse">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="p-1 border" style={{ width: '18%' }}>تاریخ</th>
                        <th className="p-1 border text-right" style={{ width: '34%' }}>شرح</th>
                        <th className="p-1 border text-center" style={{ width: '16%' }}>بدهکار</th>
                        <th className="p-1 border text-center" style={{ width: '16%' }}>بستانکار</th>
                        <th className="p-1 border text-right" style={{ width: '16%' }}>مانده</th>
                    </tr>
                </thead>
                <tbody>
                    {transactions.map((t, index) => (
                        <tr key={index} className={`row-item ${t.isOpeningBalance ? 'font-bold bg-gray-50' : ''}`}>
                            <td className="p-1 border whitespace-nowrap">
                                {!t.isOpeningBalance ? new Date(t.date).toLocaleDateString('fa-IR', { month: '2-digit', day: '2-digit' }) : ''}
                            </td>
                            <td className="p-1 border text-right">{t.description} {t.detail ? `(${t.detail})` : ''}</td>
                            <td className="p-1 border text-center text-red-700">{t.debit > 0 ? `$${t.debit.toFixed(2)}` : '-'}</td>
                            <td className="p-1 border text-center text-green-700">{t.credit > 0 ? `$${t.credit.toFixed(2)}` : '-'}</td>
                            <td className={`p-1 border text-right font-semibold ${t.balance < 0 ? 'text-green-800' : 'text-gray-900'}`}>
                                ${Math.abs(t.balance).toFixed(2)}
                            </td>
                        </tr>
                    ))}
                    {transactions.length === 0 && (
                        <tr>
                            <td colSpan={5} className="text-center py-10 text-gray-500 border">هیچ تراکنشی برای نمایش وجود ندارد.</td>
                        </tr>
                    )}
                </tbody>
            </table>

            <div className="footer-placeholder">
                <div className="mt-4 flex justify-end">
                    <div className="w-full text-right">
                        <div className="flex justify-between py-1 border-t-2 border-gray-400">
                            <span className="font-bold text-xs text-gray-900">مانده نهایی:</span>
                            <span className={`font-bold text-xs ${finalBalance > 0 ? 'text-red-700' : 'text-green-700'}`}>
                            ${Math.abs(finalBalance).toFixed(2)}
                            {finalBalance < 0 ? ' (بستانکار)' : ' (بدهکار)'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            
            <style>{`
                .text-2xs {
                    font-size: 0.7rem;
                    line-height: 1.3;
                }
                @media print {
                    @page {
                        margin: 0.5cm;
                    }
                    .printable-area {
                        font-size: 8pt;
                        width: 100%;
                        padding: 0.5cm;
                        box-sizing: border-box;
                        background: white !important;
                        color: black !important;
                    }
                    .main-table {
                        table-layout: fixed;
                    }
                    .main-table td, .main-table th {
                        word-break: break-word;
                    }
                    .main-table thead {
                        display: table-header-group;
                    }
                     .main-table tbody tr {
                        page-break-inside: avoid;
                    }
                    .bg-gray-100, .bg-gray-50 {
                        background-color: #f9fafb !important;
                         -webkit-print-color-adjust: exact !important;
                        color-adjust: exact !important;
                    }
                    table, th, td {
                        border-color: #aaa !important;
                    }
                }
            `}</style>
        </div>
    );
});

export default PrintableSupplierLedger;