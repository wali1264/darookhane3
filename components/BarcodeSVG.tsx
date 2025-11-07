import React from 'react';

// Code 39 character encodings (narrow bar/space = 0, wide bar/space = 1)
// Bar, Space, Bar, Space, Bar, Space, Bar, Space, Bar
const CODE39_CHARS: { [key: string]: string } = {
  '0': '001100100', '1': '100010001', '2': '001010001', '3': '101010000',
  '4': '000110001', '5': '100110000', '6': '001110000', '7': '000010101',
  '8': '100010100', '9': '001010100', 'A': '100001001', 'B': '001001001',
  'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
  'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
  'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
  'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
  'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
  'W': '111000000', 'X': '010100001', 'Y': '110100000', 'Z': '011100000',
  '-': '010000101', '.': '110000100', ' ': '011000100', '$': '010101000',
  '/': '010100010', '+': '010001010', '%': '000101010',
  '*': '010010100' // Start/Stop character
};

interface BarcodeSVGProps {
  value: string;
  height?: number;
  barWidthRatio?: number; // wide to narrow ratio
  narrowBarWidth?: number; // width of a narrow bar in pixels
}

const BarcodeSVG: React.FC<BarcodeSVGProps> = ({
  value,
  height = 50,
  barWidthRatio = 3,
  narrowBarWidth = 1,
}) => {
  if (!value) return null;

  const validValue = `*${value.toUpperCase().replace(/[^0-9A-Z-.\s$*\/+%]/g, '')}*`;
  let totalWidth = 0;
  const bars: { x: number; width: number }[] = [];
  let currentX = 0;

  for (const char of validValue) {
    const encoding = CODE39_CHARS[char];
    if (!encoding) {
      console.warn(`Character "${char}" is not valid for Code 39 and will be skipped.`);
      continue;
    }
    
    for (let i = 0; i < encoding.length; i++) {
      const isBar = i % 2 === 0;
      const isWide = encoding[i] === '1';
      const width = (isWide ? barWidthRatio : 1) * narrowBarWidth;

      if (isBar) {
        bars.push({ x: currentX, width });
      }
      currentX += width;
    }
    // Add inter-character gap (a single narrow space)
    currentX += narrowBarWidth;
  }
  totalWidth = currentX - narrowBarWidth; // Remove last inter-character gap

  return (
    <svg width={totalWidth} height={height} aria-label={`Barcode for value ${value}`} preserveAspectRatio="none" viewBox={`0 0 ${totalWidth} ${height}`}>
      {bars.map((bar, index) => (
        <rect key={index} x={bar.x} y="0" width={bar.width} height={height} fill="black" />
      ))}
    </svg>
  );
};

export default BarcodeSVG;
