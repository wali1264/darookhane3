import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import QRCodeSVG from './QRCodeSVG'; // Changed from BarcodeSVG to QRCodeSVG
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
                    <div className="label-qrcode-svg">
                        {drug.internalBarcode && <QRCodeSVG value={drug.internalBarcode} size={150} />}
                    </div>
                    <div className="label-barcode-text">{drug.internalBarcode}</div>
                </div>
            ))}
            <style>{`
                .printable-labels-container {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(5cm, 1fr));
                    gap: 0.5cm;
                    padding: 0.5cm;
                }
                .label {
                    border: 1px dashed #ccc;
                    padding: 0.3cm;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    page-break-inside: avoid;
                    background-color: white;
                    aspect-ratio: 1 / 1; /* Make it square */
                }
                .label-drug-name {
                    font-size: 8pt;
                    font-weight: bold;
                    margin-bottom: 0.2cm;
                    word-break: break-word;
                    color: black;
                }
                .label-qrcode-svg {
                    flex-grow: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 100%;
                    max-width: 4cm;
                    margin-bottom: 0.2cm;
                }
                .label-barcode-text {
                    font-family: monospace;
                    font-size: 7pt;
                    letter-spacing: 0.5px;
                    color: black;
                }
                @media print {
                    .printable-labels-container {
                        padding: 0;
                        gap: 0;
                    }
                    .label {
                        border: 1px solid #000; /* Use a solid border for cutting guides */
                    }
                }
            `}</style>
        </div>
    );
}

export default PrintableBarcodeLabels;
