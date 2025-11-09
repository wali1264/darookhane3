import React from 'react';
import { Drug } from '../types';
import QRCodeSVG from './QRCodeSVG'; // Changed from BarcodeSVG to QRCodeSVG

interface PrintableSingleLabelSheetProps {
    drug: Drug;
    count: number;
}

const PrintableSingleLabelSheet: React.FC<PrintableSingleLabelSheetProps> = ({ drug, count }) => {
    return (
        <>
            {/* This container is for screen preview only. On print, each .label becomes its own page. */}
            <div className="label-preview-container">
                {Array.from({ length: count }).map((_, index) => (
                    <div key={index} className="label">
                        <div className="label-qrcode-wrapper">
                            {drug.internalBarcode && <QRCodeSVG value={drug.internalBarcode} />}
                        </div>
                    </div>
                ))}
            </div>
            <style>{`
                /* For screen preview only */
                .label-preview-container {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(6cm, 1fr));
                    gap: 0.5cm;
                }
                .label {
                    border: 1px dashed #ccc;
                    padding: 0.2cm;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    background-color: white;
                    aspect-ratio: 1 / 1; /* Square aspect ratio for QR Code */
                }
                .label-qrcode-wrapper {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                }
                .label-qrcode-wrapper svg {
                    max-width: 90%;
                    max-height: 90%;
                }

                @media print {
                    .label-preview-container {
                        display: block; /* Let labels flow naturally */
                    }

                    @page {
                        /* Size is inherited from user's printer settings. */
                        margin: 0;
                    }

                    body, html {
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                    }

                    .label {
                        width: 100vw;
                        height: 100vh;
                        border: none;
                        margin: 0;
                        padding: 0.2cm; /* Keep a small quiet zone */
                        box-sizing: border-box;
                    }

                    /* THE FIX: Create a new page BEFORE each label, except for the very first one. */
                    .label:not(:first-of-type) {
                        page-break-before: always;
                    }
                }
            `}</style>
        </>
    );
};

export default PrintableSingleLabelSheet;
