import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import BarcodeSVG from './BarcodeSVG';
import { Dna } from 'lucide-react';

const PrintableBarcodeLabels: React.FC = () => {
    const drugsWithBarcodes = useLiveQuery(() => 
        db.drugs.where('internalBarcode').notEqual('').toArray()
    , []);

    if (!drugsWithBarcodes) {
        return (
            <div className="flex flex-col items-center justify-center p-10 text-center text-gray-500">
                <Dna size={32} className="animate-spin mb-4" />
                <span>در حال بارگذاری لیست داروها...</span>
            </div>
        );
    }
    
    if (drugsWithBarcodes.length === 0) {
        return <p className="text-center p-10 text-gray-500">هیچ دارویی با بارکد داخلی برای چاپ یافت نشد.</p>;
    }

    return (
        <div className="printable-labels-container">
            {drugsWithBarcodes.map(drug => (
                <div key={drug.id} className="label">
                    <div className="label-drug-name">{drug.name}</div>
                    <div className="label-barcode-svg">
                        {drug.internalBarcode && <BarcodeSVG value={drug.internalBarcode} />}
                    </div>
                    <div className="label-barcode-text">{drug.internalBarcode}</div>
                </div>
            ))}
            <style>{`
                .printable-labels-container {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(6cm, 1fr));
                    gap: 1cm;
                    padding: 1cm;
                }
                .label {
                    border: 1px dashed #ccc;
                    padding: 0.5cm;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: space-between;
                    text-align: center;
                    page-break-inside: avoid;
                    background-color: white; /* Ensure it prints on colored backgrounds */
                }
                .label-drug-name {
                    font-size: 10pt;
                    font-weight: bold;
                    margin-bottom: 0.5cm;
                    word-break: break-word;
                    color: black;
                }
                .label-barcode-svg {
                    margin-bottom: 0.25cm;
                }
                .label-barcode-svg svg {
                    max-width: 100%;
                    height: 2.5cm;
                }
                .label-barcode-text {
                    font-family: monospace;
                    font-size: 8pt;
                    letter-spacing: 1px;
                    color: black;
                }
                @media print {
                    /* The modal's print styles will handle hiding other elements */
                    .printable-labels-container {
                        padding: 0;
                    }
                }
            `}</style>
        </div>
    );
}

export default PrintableBarcodeLabels;
