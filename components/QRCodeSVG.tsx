/*
 * QR Code generator library (TypeScript)
 *
 * Copyright (c) Project Nayuki. (MIT License)
 * https://www.nayuki.io/page/qr-code-generator-library
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 * - The above copyright notice and this permission notice shall be included in
 *   all copies or substantial portions of the Software.
 * - The Software is provided "as is", without warranty of any kind, express or
 *   implied, including but not limited to the warranties of merchantability,
 *   fitness for a particular purpose and noninfringement. In no event shall the
 *   authors or copyright holders be liable for any claim, damages or other
 *   liability, whether in an action of contract, tort or otherwise, arising from,
 *   out of or in connection with the Software or the use or other dealings in the
 *   Software.
 */
import React from 'react';

// ---- BEGIN QR CODE GENERATOR LIBRARY (qrcodegen.ts) ----
namespace qrcodegen {
	
	type bit = number;
	type byte = number;
	type int = number;
	

	/*---- QR Code symbol class ----*/
	
	export class QrCode {
		
		public static readonly MIN_VERSION: int = 1;
		public static readonly MAX_VERSION: int = 40;
		
		
		// The version number of this QR Code, which is between 1 and 40 (inclusive).
		// This determines the size of this barcode.
		public readonly version: int;
		
		// The width and height of this QR Code, measured in modules, between
		// 21 and 177 (inclusive). This is equal to version * 4 + 17.
		public readonly size: int;
		
		// The error correction level used in this QR Code.
		public readonly errorCorrectionLevel: Ecc;
		
		// The mask pattern used in this QR Code, which is between 0 and 7 (inclusive).
		// Even if a QR Code is created with automatic masking, this property will still
		// be defined here.
		public readonly mask: int;
		
		// The modules of this QR Code (false = white, true = black).
		// Immutable after constructor finishes. Accessed through getModule().
		private readonly modules: Array<Array<boolean>> = [];
		
		// Indicates function modules that are not subjected to masking. Discarded when constructor finishes.
		private readonly isFunction: Array<Array<boolean>> = [];
		
		
		// Creates a new QR Code with the given version number,
		// error correction level, data segments, and mask pattern.
		// This is a advanced API that lets the user create a QR Code with
		// manual control over the parameters. Normally, the static factory
		// functions should be used instead.
		public constructor(
				// The version number to use, which must be in the range 1 to 40, inclusive.
				version: int,
				
				// The error correction level to use.
				errorCorrectionLevel: Ecc,
				
				// The data segments to encode.
				dataCodewords: Readonly<Array<byte>>,
				
				// The mask pattern to use, which is valued from 0 to 7.
				// If valued -1, then the best mask is chosen automatically.
				msk: int) {
			
			// Check arguments
			if (version < QrCode.MIN_VERSION || version > QrCode.MAX_VERSION)
				throw new RangeError("Version value out of range");
			if (msk < -1 || msk > 7)
				throw new RangeError("Mask value out of range");
			this.version = version;
			this.size = version * 4 + 17;
			this.errorCorrectionLevel = errorCorrectionLevel;
			
			// Initialize both grids to be size*size arrays of Boolean false
			let row: Array<boolean> = [];
			for (let i = 0; i < this.size; i++)
				row.push(false);
			for (let i = 0; i < this.size; i++) {
				this.modules.push(row.slice());  // Initially all white
				this.isFunction.push(row.slice());
			}
			
			// Compute ECC, draw modules
			this.drawFunctionPatterns();
			const allCodewords: Array<byte> = this.addEccAndInterleave(dataCodewords);
			this.drawCodewords(allCodewords);
			
			// Do masking
			if (msk == -1) {  // Automatically choose best mask
				let minPenalty: int = 1000000000;
				for (let i = 0; i < 8; i++) {
					this.applyMask(i);
					this.drawFormatBits(i);
					let penalty: int = this.getPenaltyScore();
					if (penalty < minPenalty) {
						msk = i;
						minPenalty = penalty;
					}
					this.applyMask(i);  // Undoes the mask due to XOR
				}
			}
			if (msk < 0 || msk > 7)
				throw new Error("Assertion error");
			this.mask = msk;
			this.applyMask(msk);  // Apply the final chosen mask
			this.drawFormatBits(msk);  // Overwrite old format bits
			
			// Discard old data
			this.isFunction = [];
		}
		
		
		// Returns the color of the module (pixel) at the given coordinates, which is false
		// for white or true for black. The top left corner has the coordinates (x=0, y=0).
		// If the given coordinates are out of bounds, then false (white) is returned.
		public getModule(x: int, y: int): boolean {
			return 0 <= x && x < this.size && 0 <= y && y < this.size && this.modules[y][x];
		}
		
		
		// Draws function patterns, indicating where they are.
		private drawFunctionPatterns(): void {
			// Draw horizontal and vertical timing patterns
			for (let i = 0; i < this.size; i++) {
				this.setFunctionModule(6, i, i % 2 == 0);
				this.setFunctionModule(i, 6, i % 2 == 0);
			}
			
			// Draw 3 finder patterns (all corners except bottom right; overwrites some timing patterns)
			this.drawFinderPattern(3, 3);
			this.drawFinderPattern(this.size - 4, 3);
			this.drawFinderPattern(3, this.size - 4);
			
			// Draw numerous alignment patterns
			const alignPatPos: Array<int> = this.getAlignmentPatternPositions();
			const numAlign: int = alignPatPos.length;
			for (let i = 0; i < numAlign; i++) {
				for (let j = 0; j < numAlign; j++) {
					// Don't draw on top of finder patterns
					if (!(i == 0 && j == 0 || i == 0 && j == numAlign - 1 || i == numAlign - 1 && j == 0))
						this.drawAlignmentPattern(alignPatPos[i], alignPatPos[j]);
				}
			}
			
			// Draw configuration data
			this.drawFormatBits(0);  // Dummy mask value; overwritten later
			this.drawVersion();
		}
		
		
		// Draws two copies of the format bits (with its own error correction code)
		// based on the given mask and this object's error correction level field.
		private drawFormatBits(mask: int): void {
			// Calculate error correction code and pack bits
			const data: int = this.errorCorrectionLevel.formatBits << 3 | mask;  // errCorrLvl is uint2, mask is uint3
			let rem: int = data;
			for (let i = 0; i < 10; i++)
				rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
			const bits = (data << 10 | rem) ^ 0x5412;  // uint15
			if (bits >>> 15 != 0)
				throw new Error("Assertion error");
			
			// Draw first copy
			for (let i = 0; i <= 5; i++)
				this.setFunctionModule(8, i, getBit(bits, i));
			this.setFunctionModule(8, 7, getBit(bits, 6));
			this.setFunctionModule(8, 8, getBit(bits, 7));
			this.setFunctionModule(7, 8, getBit(bits, 8));
			for (let i = 9; i < 15; i++)
				this.setFunctionModule(14 - i, 8, getBit(bits, i));
			
			// Draw second copy
			for (let i = 0; i < 8; i++)
				this.setFunctionModule(this.size - 1 - i, 8, getBit(bits, i));
			for (let i = 8; i < 15; i++)
				this.setFunctionModule(8, this.size - 15 + i, getBit(bits, i));
			this.setFunctionModule(8, this.size - 8, true);  // Always black
		}
		
		
		// Draws two copies of the version bits (with its own error correction code),
		// based on this object's version field, iff 7 <= version <= 40.
		private drawVersion(): void {
			if (this.version < 7)
				return;
			
			// Calculate error correction code and pack bits
			let rem: int = this.version;  // version is uint6, in the range [7, 40]
			for (let i = 0; i < 12; i++)
				rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
			const bits: int = this.version << 12 | rem;  // uint18
			if (bits >>> 18 != 0)
				throw new Error("Assertion error");
			
			// Draw two copies
			for (let i = 0; i < 18; i++) {
				const bit: boolean = getBit(bits, i);
				const a: int = this.size - 11 + i % 3;
				const b: int = Math.floor(i / 3);
				this.setFunctionModule(a, b, bit);
				this.setFunctionModule(b, a, bit);
			}
		}
		
		
		// Draws a 9*9 finder pattern including the border separator,
		// with the center module at (x, y). Modules can be out of bounds.
		private drawFinderPattern(x: int, y: int): void {
			for (let dy = -4; dy <= 4; dy++) {
				for (let dx = -4; dx <= 4; dx++) {
					const dist: int = Math.max(Math.abs(dx), Math.abs(dy));  // Chebyshev/infinity norm
					const xx: int = x + dx;
					const yy: int = y + dy;
					if (0 <= xx && xx < this.size && 0 <= yy && yy < this.size)
						this.setFunctionModule(xx, yy, dist != 2 && dist != 4);
				}
			}
		}
		
		
		// Draws a 5*5 alignment pattern, with the center module
		// at (x, y). All modules must be in bounds.
		private drawAlignmentPattern(x: int, y: int): void {
			for (let dy = -2; dy <= 2; dy++) {
				for (let dx = -2; dx <= 2; dx++)
					this.setFunctionModule(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) != 1);
			}
		}
		
		
		// Sets the color of a module and marks it as a function module.
		// Only used by the constructor. Coordinates must be in bounds.
		private setFunctionModule(x: int, y: int, isBlack: boolean): void {
			this.modules[y][x] = isBlack;
			this.isFunction[y][x] = true;
		}
		
		
		// Returns an ascending list of positions of alignment patterns for this version number.
		// Each position is in the range [0,177), and are used on both the x and y axes.
		// This could be implemented as lookup table of 40 variable-length lists of integers.
		private getAlignmentPatternPositions(): Array<int> {
			if (this.version == 1)
				return [];
			else {
				const numAlign: int = Math.floor(this.version / 7) + 2;
				const step: int = (this.version == 32) ? 26 :
					Math.ceil((this.size - 13) / (numAlign * 2 - 2)) * 2;
				const result: Array<int> = [6];
				for (let pos = this.size - 7; result.length < numAlign; pos -= step)
					result.splice(1, 0, pos);
				return result;
			}
		}
		
		
		// Returns the number of data bits that can be stored in a QR Code of the given version number, after
		// all function modules are excluded. This includes remainder bits, so it might not be a multiple of 8.
		// The result is in the range [208, 29648]. This could be implemented as a 40-entry lookup table.
		private getNumRawDataModules(): int {
			let result: int = (16 * this.version + 128) * this.version + 64;
			if (this.version >= 2) {
				const numAlign: int = Math.floor(this.version / 7) + 2;
				result -= (25 * numAlign - 10) * numAlign - 55;
				if (this.version >= 7)
					result -= 36;
			}
			return result;
		}
		
		
		// Returns a Reed-Solomon ECC generator polynomial for the given degree. This could be
		// implemented as a lookup table over all possible parameter values, instead of as an algorithm.
		private static reedSolomonGenerateDivisor(degree: int): Array<byte> {
			if (degree < 1 || degree > 255)
				throw new RangeError("Degree out of range");
			// Polynomial coefficients are stored from highest to lowest power, excluding the leading term which is always 1.
			// For example the polynomial x^3 + 255x^2 + 8x + 93 is represented as the array [255, 8, 93].
			const result: Array<byte> = [];
			for (let i = 0; i < degree - 1; i++)
				result.push(0);
			result.push(1);  // Start off with the monomial x^0
			
			// Compute the product polynomial (x - r^0) * (x - r^1) * (x - r^2) * ... * (x - r^{degree-1}),
			// and drop the highest monomial term which is always x^degree.
			// Note that r = 2 is the generator field element specified in the QR Code standard.
			let root = 1;
			for (let i = 0; i < degree; i++) {
				// Multiply the current product by (x - r^i)
				for (let j = 0; j < result.length; j++) {
					result[j] = QrCode.reedSolomonMultiply(result[j], root);
					if (j + 1 < result.length)
						result[j] ^= result[j + 1];
				}
				root = QrCode.reedSolomonMultiply(root, 0x02);
			}
			return result;
		}
		
		
		// Returns the Reed-Solomon error correction codeword for the given data and divisor polynomials.
		private static reedSolomonComputeRemainder(data: Readonly<Array<byte>>, divisor: Readonly<Array<byte>>): Array<byte> {
			const result: Array<byte> = divisor.map(_ => 0);
			for (const b of data) {  // Polynomial division
				const factor: byte = b ^ result.shift()!;
				result.push(0);
				for (let i = 0; i < divisor.length; i++)
					result[i] ^= QrCode.reedSolomonMultiply(divisor[i], factor);
			}
			return result;
		}
		
		
		// Returns the product of the two given field elements modulo GF(2^8/0x11D). The arguments and result
		// are unsigned 8-bit integers. This could be implemented as a lookup table of 256*256 entries of uint8.
		private static reedSolomonMultiply(x: byte, y: byte): byte {
			if (x >>> 8 != 0 || y >>> 8 != 0)
				throw new RangeError("Byte out of range");
			// Russian peasant multiplication
			let z: int = 0;
			for (let i = 7; i >= 0; i--) {
				z = (z << 1) ^ ((z >>> 7) * 0x11D);
				z ^= ((y >>> i) & 1) * x;
			}
			if (z >>> 8 != 0)
				throw new Error("Assertion error");
			return z;
		}
		
		
		// Appends the given number of Reed-Solomon error correction codewords to the given data, then interleaves
		// bits of the data and ECC streams together to form the final data stream.
		private addEccAndInterleave(data: Readonly<Array<byte>>): Array<byte> {
			const ver: int = this.version;
			const ecl: Ecc = this.errorCorrectionLevel;
			if (data.length != QrCode.getNumDataCodewords(ver, ecl))
				throw new RangeError("Invalid argument");
			
			// Calculate parameter numbers
			const numBlocks: int = QrCode.NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
			const blockEccLen: int = QrCode.ECC_CODEWORDS_PER_BLOCK  [ecl.ordinal][ver];
			const rawCodewords: int = Math.floor(this.getNumRawDataModules() / 8);
			const numShortBlocks: int = numBlocks - rawCodewords % numBlocks;
			const shortBlockLen: int = Math.floor(rawCodewords / numBlocks);
			
			// Split data into blocks and append ECC
			const blocks: Array<Array<byte>> = [];
			const divisor: Array<byte> = QrCode.reedSolomonGenerateDivisor(blockEccLen);
			let k = 0;
			for (let i = 0; i < numBlocks; i++) {
				const dat: Array<byte> = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
				k += dat.length;
				const ecc: Array<byte> = QrCode.reedSolomonComputeRemainder(dat, divisor);
				if (i < numShortBlocks)
					dat.push(0);
				blocks.push(dat.concat(ecc));
			}
			
			// Interleave (not concatenate) the bytes from every block into a single stream
			const result: Array<byte> = [];
			for (let i = 0; i < blocks[0].length; i++) {
				for (let j = 0; j < blocks.length; j++) {
					// Skip the padding byte in short blocks
					if (i != shortBlockLen - blockEccLen || j >= numShortBlocks)
						result.push(blocks[j][i]);
				}
			}
			if (result.length != rawCodewords)
				throw new Error("Assertion error");
			return result;
		}
		
		
		// Draws the given sequence of 8-bit codewords (data and error correction) onto the entire
		// data area of this QR Code. Function modules need to be marked off before this is called.
		private drawCodewords(data: Readonly<Array<byte>>): void {
			if (data.length != Math.floor(this.getNumRawDataModules() / 8))
				throw new RangeError("Invalid argument");
			let i: int = 0;  // Bit index into the data
			// Do the funny zigzag scan
			for (let right = this.size - 1; right >= 1; right -= 2) {  // Index of right column in each column pair
				if (right == 6)
					right = 5;
				for (let vert = 0; vert < this.size; vert++) {  // Vertical counter
					for (let j = 0; j < 2; j++) {
						const x: int = right - j;  // Actual x coordinate
						const upward: boolean = ((right + 1) & 2) == 0;
						const y: int = upward ? this.size - 1 - vert : vert;  // Actual y coordinate
						if (!this.isFunction[y][x] && i < data.length * 8) {
							this.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
							i++;
						}
						// If this QR Code has no remainder bits (e.g. version 20), then
						// i == data.length * 8 will be true at the bottom right corner, therefore we skip this area.
						// Otherwise, we will fill the remainder bits with white modules.
					}
				}
			}
			if (i != data.length * 8)
				throw new Error("Assertion error");
		}
		
		
		// XORs the codeword modules in this QR Code with the given mask pattern.
		// The function modules must be marked and the mask bits must be drawn
		// before masking. Due to the nature of XOR, calling this function twice
		// with the same mask is equivalent to no change at all.
		private applyMask(mask: int): void {
			if (mask < 0 || mask > 7)
				throw new RangeError("Mask value out of range");
			for (let y = 0; y < this.size; y++) {
				for (let x = 0; x < this.size; x++) {
					let invert: boolean;
					switch (mask) {
						case 0:  invert = (x + y) % 2 == 0;                    break;
						case 1:  invert = y % 2 == 0;                          break;
						case 2:  invert = x % 3 == 0;                          break;
						case 3:  invert = (x + y) % 3 == 0;                    break;
						case 4:  invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 == 0;  break;
						case 5:  invert = (x * y) % 2 + (x * y) % 3 == 0;      break;
						case 6:  invert = ((x * y) % 2 + (x * y) % 3) % 2 == 0;  break;
						case 7:  invert = ((x + y) % 2 + (x * y) % 3) % 2 == 0;  break;
						default:  throw new Error("Assertion error");
					}
					if (!this.isFunction[y][x] && invert)
						this.modules[y][x] = !this.modules[y][x];
				}
			}
		}
		
		
		// Calculates and returns the penalty score based on state of this QR Code's modules.
		// This is used by the automatic mask choice algorithm to find the mask pattern that yields the lowest score.
		private getPenaltyScore(): int {
			let result: int = 0;
			
			// Adjacent modules in row having same color, and finder-like patterns
			for (let y = 0; y < this.size; y++) {
				let runColor = false;
				let runX = 0;
				const runHistory: Array<int> = [0,0,0,0,0,0,0];
				for (let x = 0; x < this.size; x++) {
					if (this.modules[y][x] == runColor) {
						runX++;
						if (runX == 5)
							result += 3;
						else if (runX > 5)
							result++;
					} else {
						this.finderPenaltyAddHistory(runX, runHistory);
						if (!runColor)
							result += this.finderPenaltyCountPatterns(runHistory) * 40;
						runColor = this.modules[y][x];
						runX = 1;
					}
				}
				result += this.finderPenaltyTerminateAndCount(runColor, runX, runHistory) * 40;
			}
			// Adjacent modules in column having same color, and finder-like patterns
			for (let x = 0; x < this.size; x++) {
				let runColor = false;
				let runY = 0;
				const runHistory: Array<int> = [0,0,0,0,0,0,0];
				for (let y = 0; y < this.size; y++) {
					if (this.modules[y][x] == runColor) {
						runY++;
						if (runY == 5)
							result += 3;
						else if (runY > 5)
							result++;
					} else {
						this.finderPenaltyAddHistory(runY, runHistory);
						if (!runColor)
							result += this.finderPenaltyCountPatterns(runHistory) * 40;
						runColor = this.modules[y][x];
						runY = 1;
					}
				}
				result += this.finderPenaltyTerminateAndCount(runColor, runY, runHistory) * 40;
			}
			
			// 2*2 blocks of modules having same color
			for (let y = 0; y < this.size - 1; y++) {
				for (let x = 0; x < this.size - 1; x++) {
					const color: boolean = this.modules[y][x];
					if (  color == this.modules[y][x + 1] &&
					      color == this.modules[y + 1][x] &&
					      color == this.modules[y + 1][x + 1])
						result += 3;
				}
			}
			
			// Balance of black and white modules
			let black: int = 0;
			for (const row of this.modules) {
				for (const color of row) {
					if (color)
						black++;
				}
			}
			const total: int = this.size * this.size;  // Note that size is odd, so black/total != 1/2
			// Compute the smallest integer k >= 0 such that (45-5k)% <= black/total <= (55+5k)%
			const k: int = Math.ceil(Math.abs(black * 20 - total * 10) / total) - 1;
			result += k * 10;
			
			return result;
		}
		
		
		// Can only be called immediately after a white run is added, and returns either 0, 1, or 2.
		private finderPenaltyCountPatterns(runHistory: Readonly<Array<int>>): int {
			const n = runHistory[1];
			if (n > this.size * 3)
				return 0;
			const core = n > 0 && runHistory[2] == n && runHistory[3] == n * 3 && runHistory[4] == n && runHistory[5] == n;
			return (core && runHistory[0] >= n * 4 && runHistory[6] >= n ? 1 : 0)
			     + (core && runHistory[6] >= n * 4 && runHistory[0] >= n ? 1 : 0);
		}
		
		
		// Must be called at the end of a line (row or column) of modules.
		private finderPenaltyTerminateAndCount(currentRunColor: boolean, currentRunLength: int, runHistory: Array<int>): int {
			if (currentRunColor) {  // Terminate black run
				this.finderPenaltyAddHistory(currentRunLength, runHistory);
				currentRunLength = 0;
			}
			currentRunLength += this.size;  // Add virtual white run to prevent horizontal detection of vertical patterns
			this.finderPenaltyAddHistory(currentRunLength, runHistory);
			return this.finderPenaltyCountPatterns(runHistory);
		}
		
		
		// Pushes the given value to the front and drops the last value. A helper for getPenaltyScore().
		private finderPenaltyAddHistory(currentRunLength: int, runHistory: Array<int>): void {
			if (runHistory[0] == 0)
				currentRunLength += this.size;  // Add virtual white run to prevent horizontal detection of vertical patterns
			runHistory.pop();
			runHistory.unshift(currentRunLength);
		}
		
		
		
		/*---- Tables for error correction codwords ----*/
		
		// For use in getNumRawDataModules()
		private static readonly PENALTY_N1: int = 3;
		private static readonly PENALTY_N2: int = 3;
		private static readonly PENALTY_N3: int = 40;
		private static readonly PENALTY_N4: int = 10;
		
		
		private static readonly ECC_CODEWORDS_PER_BLOCK: Array<Array<int>> = [  // Version: (index+1)
			// L, M, Q, H
			[-1, -1, -1, -1],  // Version 0
			[ 7, 10, 13, 17],  // Version 1
			[10, 16, 22, 28],
			[15, 26, 36, 44],
			[20, 36, 52, 64],
			[26, 48, 72, 88],
			[36, 64, 96, 112],  // Version 6
			[40, 72, 108, 130],
			[48, 88, 132, 156],
			[60, 110, 160, 192],
			[72, 130, 192, 224],  // Version 10
			[80, 150, 224, 264],
			[96, 176, 260, 308],
			[104, 198, 288, 352],
			[120, 216, 320, 384],
			[132, 240, 360, 432],  // Version 15
			[144, 280, 408, 480],
			[168, 308, 448, 532],
			[180, 338, 504, 588],
			[196, 364, 546, 650],
			[224, 416, 600, 700],  // Version 20
			[224, 442, 644, 750],
			[252, 476, 690, 816],
			[270, 504, 750, 900],
			[300, 560, 810, 960],
			[312, 588, 870, 1050],  // Version 25
			[336, 644, 952, 1110],
			[360, 700, 1020, 1200],
			[390, 728, 1050, 1260],
			[420, 784, 1140, 1350],
			[450, 812, 1200, 1440],  // Version 30
			[480, 868, 1290, 1530],
			[510, 924, 1350, 1620],
			[540, 980, 1440, 1710],
			[570, 1036, 1530, 1800],
			[570, 1064, 1590, 1890],  // Version 35
			[600, 1120, 1680, 1980],
			[630, 1204, 1770, 2100],
			[660, 1260, 1860, 2220],
			[720, 1316, 1950, 2310],
			[750, 1372, 2040, 2430],  // Version 40
		];
		
		private static readonly NUM_ERROR_CORRECTION_BLOCKS: Array<Array<int>> = [  // Version: (index+1)
			// L, M, Q, H
			[-1, -1, -1, -1],  // Version 0
			[1, 1, 1, 1],  // Version 1
			[1, 1, 1, 1],
			[1, 1, 2, 2],
			[1, 2, 2, 4],
			[1, 2, 4, 4],
			[2, 4, 4, 4],  // Version 6
			[2, 4, 6, 5],
			[2, 4, 6, 6],
			[2, 5, 8, 8],
			[4, 5, 8, 8],  // Version 10
			[4, 5, 8, 11],
			[4, 6, 10, 11],
			[4, 6, 10, 12],
			[4, 7, 12, 14],
			[4, 8, 12, 16],  // Version 15
			[4, 9, 14, 16],
			[4, 9, 14, 18],
			[5, 10, 16, 19],
			[5, 10, 17, 21],
			[5, 11, 19, 23],  // Version 20
			[5, 11, 19, 25],
			[6, 12, 21, 25],
			[6, 12, 22, 28],
			[6, 13, 24, 29],
			[7, 14, 26, 31],  // Version 25
			[7, 14, 26, 34],
			[7, 15, 28, 35],
			[8, 16, 29, 37],
			[8, 16, 31, 40],
			[8, 17, 33, 42],  // Version 30
			[9, 18, 35, 45],
			[9, 18, 35, 48],
			[9, 19, 37, 50],
			[9, 19, 38, 53],
			[10, 20, 40, 56],  // Version 35
			[10, 21, 42, 59],
			[10, 21, 43, 62],
			[11, 22, 45, 65],
			[11, 22, 47, 68],
			[12, 24, 49, 72],  // Version 40
		];
		
		
		// Returns the number of data bits that can be stored in a QR Code of the given version number and
		// error correction level, without the remainder bits. This is always a multiple of 8.
		// The result is in the range [128, 23648]. This could be implemented as a 40*4 lookup table.
		public static getNumDataCodewords(ver: int, ecl: Ecc): int {
			return Math.floor(QrCode.prototype.getNumRawDataModules.call({version:ver}) / 8)
				- QrCode.ECC_CODEWORDS_PER_BLOCK    [ecl.ordinal][ver]
				* QrCode.NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
		}
		
		
		public static encodeText(text: string, ecl: Ecc): QrCode {
			const segs: Array<QrSegment> = QrSegment.makeSegments(text);
			return QrCode.encodeSegments(segs, ecl);
		}
		
		
		public static encodeBinary(data: Readonly<Array<byte>>, ecl: Ecc): QrCode {
			const seg: QrSegment = QrSegment.makeBytes(data);
			return QrCode.encodeSegments([seg], ecl);
		}
		
		
		public static encodeSegments(segs: Readonly<Array<QrSegment>>,
				ecl: Ecc, minVersion: int = 1, maxVersion: int = 40,
				mask: int = -1, boostEcl: boolean = true): QrCode {
			
			if (!(QrCode.MIN_VERSION <= minVersion && minVersion <= maxVersion && maxVersion <= QrCode.MAX_VERSION) || mask < -1 || mask > 7)
				throw new RangeError("Invalid value");
			
			// Find the minimal version number to use
			let version: int;
			let dataUsedBits: int;
			for (version = minVersion; ; version++) {
				const dataCapacityBits: int = QrCode.getNumDataCodewords(version, ecl) * 8;
				const usedBits: number = QrSegment.getTotalBits(segs, version);
				if (usedBits <= dataCapacityBits) {
					dataUsedBits = usedBits;
					break;  // This version number is suitable
				}
				if (version >= maxVersion)  // All versions in the range could not fit the given data
					throw new RangeError("Data too long");
			}
			
			// Increase the error correction level while the data still fits in the current version number
			for (const newEcl of [Ecc.MEDIUM, Ecc.QUARTILE, Ecc.HIGH]) {  // From low to high
				if (boostEcl && dataUsedBits <= QrCode.getNumDataCodewords(version, newEcl) * 8)
					ecl = newEcl;
			}
			
			// Concatenate all segments to create the data bit string
			let bb: Array<bit> = [];
			for (const seg of segs) {
				appendBits(seg.mode.modeBits, 4, bb);
				appendBits(seg.numChars, seg.mode.numCharCountBits(version), bb);
				for (const b of seg.getData())
					bb.push(b);
			}
			if (bb.length != dataUsedBits)
				throw new Error("Assertion error");
			
			// Add terminator and pad up to a byte if applicable
			const dataCapacityBits: int = QrCode.getNumDataCodewords(version, ecl) * 8;
			if (bb.length > dataCapacityBits)
				throw new Error("Assertion error");
			appendBits(0, Math.min(4, dataCapacityBits - bb.length), bb);
			appendBits(0, (8 - bb.length % 8) % 8, bb);
			if (bb.length % 8 != 0)
				throw new Error("Assertion error");
			
			// Pad with alternating bytes until data capacity is reached
			for (let padByte = 0xEC; bb.length < dataCapacityBits; padByte ^= 0xEC ^ 0x11)
				appendBits(padByte, 8, bb);
			
			// Pack bits into bytes in big-endian
			let dataCodewords: Array<byte> = [];
			while (dataCodewords.length * 8 < bb.length)
				dataCodewords.push(0);
			bb.forEach((b: bit, i: int) =>
				dataCodewords[i >>> 3] |= b << (7 - (i & 7)));
			
			// Create the QR Code object
			return new QrCode(version, ecl, dataCodewords, mask);
		}
		
	}
	
	
	/*---- Data segment class ----*/
	
	export class QrSegment {
		
		// The mode indicator of this segment.
		public readonly mode: Mode;
		
		// The length of this segment's unencoded data. Measured in characters for
		// numeric/alphanumeric/kanji mode, bytes for byte mode, and 0 for ECI mode.
		// Always zero or positive.
		public readonly numChars: int;
		
		// The data bits of this segment.
		private readonly bitData: Array<bit>;
		
		
		public constructor(
				// The mode indicator for this segment.
				mode: Mode,
				
				// The number of characters in the data.
				numChars: int,
				
				// The data bits.
				bitData: Array<bit>) {
			
			if (numChars < 0)
				throw new RangeError("Invalid argument");
			this.mode = mode;
			this.numChars = numChars;
			this.bitData = bitData.slice();  // Make defensive copy
		}
		
		
		// Returns a new array of segments representing the given text string.
		public static makeSegments(text: string): Array<QrSegment> {
			// Select the most efficient segment encoding automatically
			if (text == "")
				return [];
			else if (/^[0-9]*$/.test(text))
				return [QrSegment.makeNumeric(text)];
			else if (/^[A-Z0-9 $%*+.\/:-]*$/.test(text))
				return [QrSegment.makeAlphanumeric(text)];
			else
				return [QrSegment.makeBytes(QrSegment.toUtf8ByteArray(text))];
		}
		
		
		// Returns a new segment representing the given numeric string.
		public static makeNumeric(digits: string): QrSegment {
			if (!/^[0-9]*$/.test(digits))
				throw new RangeError("String contains non-numeric characters");
			let bb: Array<bit> = [];
			for (let i = 0; i < digits.length; ) {  // Consume up to 3 digits per iteration
				const n: int = Math.min(digits.length - i, 3);
				appendBits(parseInt(digits.substring(i, i + n), 10), n * 3 + 1, bb);
				i += n;
			}
			return new QrSegment(Mode.NUMERIC, digits.length, bb);
		}
		
		
		// Returns a new segment representing the given alphanumeric string.
		public static makeAlphanumeric(text: string): QrSegment {
			if (!/^[A-Z0-9 $%*+.\/:-]*$/.test(text))
				throw new RangeError("String contains unencodable characters in alphanumeric mode");
			let bb: Array<bit> = [];
			let i: int;
			for (i = 0; i + 2 <= text.length; i += 2) {  // Process groups of 2
				let temp: int = QrSegment.ALPHANUMERIC_CHARSET.indexOf(text.charAt(i)) * 45;
				temp += QrSegment.ALPHANUMERIC_CHARSET.indexOf(text.charAt(i + 1));
				appendBits(temp, 11, bb);
			}
			if (i < text.length)  // Process last char
				appendBits(QrSegment.ALPHANUMERIC_CHARSET.indexOf(text.charAt(i)), 6, bb);
			return new QrSegment(Mode.ALPHANUMERIC, text.length, bb);
		}
		
		
		// Returns a new segment representing the given byte array.
		public static makeBytes(data: Readonly<Array<byte>>): QrSegment {
			let bb: Array<bit> = [];
			for (const b of data)
				appendBits(b, 8, bb);
			return new QrSegment(Mode.BYTE, data.length, bb);
		}
		
		
		public getData(): Array<bit> {
			return this.bitData.slice();  // Make defensive copy
		}
		
		
		// Returns the total number of bits needed to encode the given segments at the given version.
		public static getTotalBits(segs: Readonly<Array<QrSegment>>, version: int): number {
			let result: number = 0;
			for (const seg of segs) {
				const ccbits: int = seg.mode.numCharCountBits(version);
				if (seg.numChars >= (1 << ccbits))
					return Infinity;  // The segment's length doesn't fit the field's bit width
				result += 4 + ccbits + seg.bitData.length;
			}
			return result;
		}
		
		
		// Returns a new array of bytes representing the given string encoded in UTF-8.
		public static toUtf8ByteArray(str: string): Array<byte> {
			str = encodeURI(str);
			let result: Array<byte> = [];
			for (let i = 0; i < str.length; i++) {
				if (str.charAt(i) != '%')
					result.push(str.charCodeAt(i));
				else {
					result.push(parseInt(str.substring(i + 1, i + 3), 16));
					i += 2;
				}
			}
			return result;
		}
		
		
		public static readonly ALPHANUMERIC_CHARSET: string = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
		
	}
	
	
	
	/*---- Public helper enumeration ----*/
	
	// Describes the error correction level used in a QR Code symbol.
	export class Ecc {
		
		public static readonly LOW      = new Ecc(0, 1);  // The QR Code can tolerate about  7% erroneous codewords
		public static readonly MEDIUM   = new Ecc(1, 0);  // The QR Code can tolerate about 15% erroneous codewords
		public static readonly QUARTILE = new Ecc(2, 3);  // The QR Code can tolerate about 25% erroneous codewords
		public static readonly HIGH     = new Ecc(3, 2);  // The QR Code can tolerate about 30% erroneous codewords
		
		
		private constructor(
			// In the range 0 to 3 (unsigned 2-bit integer).
			public readonly ordinal: int,
			// (Public) In the range 0 to 3 (unsigned 2-bit integer).
			public readonly formatBits: int) {}
		
	}
	
	
	
	/*---- Public helper enumeration ----*/
	
	// Describes the segment mode used in a QR Code symbol.
	export class Mode {
		
		public static readonly NUMERIC      = new Mode(0x1, [10, 12, 14]);
		public static readonly ALPHANUMERIC = new Mode(0x2, [ 9, 11, 13]);
		public static readonly BYTE         = new Mode(0x4, [ 8, 16, 16]);
		public static readonly KANJI        = new Mode(0x8, [ 8, 10, 12]);
		
		
		private constructor(
			// The mode indicator bits, which is a 4-bit value.
			public readonly modeBits: int,
			// Number of character count bits for three different version ranges.
			private readonly numBits: [int,int,int]) {}
		
		
		// Returns the bit width of the character count field for a segment in this mode
		// in a QR Code at the given version number. The result is in the range [0, 16].
		public numCharCountBits(ver: int): int {
			return this.numBits[Math.floor((ver + 7) / 17)];
		}
		
	}
	
	
	// Appends the given number of low-order bits of the given value to the given buffer.
	// Requires 0 <= len <= 31 and 0 <= val < 2^len.
	function appendBits(val: int, len: int, bb: Array<bit>): void {
		if (len < 0 || len > 31 || val >>> len != 0)
			throw new RangeError("Value out of range");
		for (let i = len - 1; i >= 0; i--)  // Append bit by bit
			bb.push((val >>> i) & 1);
	}
	
	
	// Returns true iff the i'th bit of x is set to 1.
	function getBit(x: int, i: int): boolean {
		return ((x >>> i) & 1) != 0;
	}

}
// ---- END QR CODE GENERATOR LIBRARY ----


interface QRCodeSVGProps {
    value: string;
    size?: number;
    level?: 'LOW' | 'MEDIUM' | 'QUARTILE' | 'HIGH';
    bgColor?: string;
    fgColor?: string;
}

const QRCodeSVG: React.FC<QRCodeSVGProps> = ({
    value,
    size = 256,
    level = 'MEDIUM',
    bgColor = '#FFFFFF',
    fgColor = '#000000',
}) => {
    if (!value) return null;

    try {
        // FIX: The Ecc class is a direct member of the qrcodegen namespace, not a static property of QrCode.
        const ecl = qrcodegen.Ecc[level];
        const qr = qrcodegen.QrCode.encodeText(value, ecl);

        const quietZone = 4; // Standard quiet zone is 4 modules.
        const moduleCount = qr.size;
        const totalSize = moduleCount + quietZone * 2;

        let paths = '';
        for (let y = 0; y < moduleCount; y++) {
            for (let x = 0; x < moduleCount; x++) {
                if (qr.getModule(x, y)) {
                    // M = move to, h = horizontal line, v = vertical line, z = close path
                    paths += `M${x + quietZone},${y + quietZone}h1v1h-1z `;
                }
            }
        }

        return (
            <svg
                viewBox={`0 0 ${totalSize} ${totalSize}`}
                width={size}
                height={size}
                shapeRendering="crispEdges"
                aria-label={`QR Code for value ${value}`}
                style={{ width: '100%', height: '100%' }}
            >
                <rect width="100%" height="100%" fill={bgColor} />
                <path d={paths} fill={fgColor} />
            </svg>
        );
    } catch (e) {
        console.error("Failed to generate QR Code:", e);
        // Provide a user-friendly error display in the UI
        return (
            <div style={{ 
                color: 'red', 
                border: '2px solid red', 
                padding: '10px', 
                backgroundColor: '#fee',
                width: size,
                height: size,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                fontSize: '12px'
            }}>
                خطا در ایجاد QR Code. ممکن است متن ورودی بیش از حد طولانی باشد.
            </div>
        );
    }
};

export default QRCodeSVG;
