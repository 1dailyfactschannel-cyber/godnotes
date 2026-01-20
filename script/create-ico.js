import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const width = 128;
const height = 128;

// Pixel Data Size (32bpp = 4 bytes per pixel)
const pixelDataSize = width * height * 4;

// AND Mask Size (1 bit per pixel, padded to 32 bits boundary)
const maskRowSize = width / 8; 
const maskSize = maskRowSize * height;

const biSizeImage = pixelDataSize + maskSize;
const totalSize = 40 + biSizeImage; // Header + Data

const buffer = Buffer.alloc(22 + totalSize);

// --- ICO Header ---
buffer.writeUInt16LE(0, 0); // Reserved
buffer.writeUInt16LE(1, 2); // Type (1 = Icon)
buffer.writeUInt16LE(1, 4); // Count (1 image)

// --- Directory Entry ---
buffer.writeUInt8(width === 256 ? 0 : width, 6);
buffer.writeUInt8(height === 256 ? 0 : height, 7);
buffer.writeUInt8(0, 8);
buffer.writeUInt8(0, 9);
buffer.writeUInt16LE(1, 10);
buffer.writeUInt16LE(32, 12);
buffer.writeUInt32LE(totalSize, 14);
buffer.writeUInt32LE(22, 18);

// --- DIB Header ---
const headerOffset = 22;
buffer.writeUInt32LE(40, headerOffset);
buffer.writeInt32LE(width, headerOffset + 4);
buffer.writeInt32LE(height * 2, headerOffset + 8);
buffer.writeUInt16LE(1, headerOffset + 12);
buffer.writeUInt16LE(32, headerOffset + 14);
buffer.writeUInt32LE(0, headerOffset + 16);
buffer.writeUInt32LE(pixelDataSize + maskSize, headerOffset + 20);
buffer.writeInt32LE(0, headerOffset + 24);
buffer.writeInt32LE(0, headerOffset + 28);
buffer.writeUInt32LE(0, headerOffset + 32);
buffer.writeUInt32LE(0, headerOffset + 36);

// --- Pixel Data (BGRA) ---
const dataOffset = headerOffset + 40;

// Theme Colors
const bgB = 0x2A; // #0F172A
const bgG = 0x17;
const bgR = 0x0F;

const lightningB = 0xFF; // White for the G
const lightningG = 0xFF;
const lightningR = 0xFF;

for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
        const offset = dataOffset + (y * width + x) * 4;
        
        const nx = (x / width) * 100;
        const ny = (y / height) * 100;

        let r = 0, g = 0, b = 0, a = 0;

        // 1. Background: Full Rounded Square
        // Radius ~ 20%
        const rPercent = 20;
        let inCorner = false;
        
        if (nx < rPercent && ny < rPercent) { // Bottom Left
             const cx = rPercent;
             const cy = rPercent;
             const dist = Math.sqrt(Math.pow(nx - cx, 2) + Math.pow(ny - cy, 2));
             if (dist > rPercent) inCorner = true;
        } else if (nx > (100-rPercent) && ny < rPercent) { // Bottom Right
             const cx = 100-rPercent;
             const cy = rPercent;
             const dist = Math.sqrt(Math.pow(nx - cx, 2) + Math.pow(ny - cy, 2));
             if (dist > rPercent) inCorner = true;
        } else if (nx < rPercent && ny > (100-rPercent)) { // Top Left
             const cx = rPercent;
             const cy = 100-rPercent;
             const dist = Math.sqrt(Math.pow(nx - cx, 2) + Math.pow(ny - cy, 2));
             if (dist > rPercent) inCorner = true;
        } else if (nx > (100-rPercent) && ny > (100-rPercent)) { // Top Right
             const cx = 100-rPercent;
             const cy = 100-rPercent;
             const dist = Math.sqrt(Math.pow(nx - cx, 2) + Math.pow(ny - cy, 2));
             if (dist > rPercent) inCorner = true;
        }

        if (!inCorner) {
            // Inside Background
            r = bgR; g = bgG; b = bgB; a = 255;
            
            // 2. Simple border
            if (nx < 3 || nx > 97 || ny < 3 || ny > 97) {
                 r = Math.min(255, bgR + 20);
                 g = Math.min(255, bgG + 20);
                 b = Math.min(255, bgB + 20);
            }

            // 3. Square G Logic (Bottom-Up coordinates)
            // Thickness ~ 12%
            // Top Bar: y ~ 80. x: 16 -> 84
            // Bottom Bar: y ~ 20. x: 16 -> 84
            // Left Bar: x ~ 16. y: 20 -> 80
            // Right Bar: x ~ 84. y: 20 -> 50
            // Middle Bar: y ~ 50. x: 50 -> 84

            const t = 6; // Half thickness
            
            const isTop = (ny >= 80 - t && ny <= 80 + t) && (nx >= 16 - t && nx <= 84 + t);
            const isBottom = (ny >= 20 - t && ny <= 20 + t) && (nx >= 16 - t && nx <= 84 + t);
            const isLeft = (nx >= 16 - t && nx <= 16 + t) && (ny >= 20 - t && ny <= 80 + t);
            const isRight = (nx >= 84 - t && nx <= 84 + t) && (ny >= 20 - t && ny <= 50 + t);
            const isMiddle = (ny >= 50 - t && ny <= 50 + t) && (nx >= 50 - t && nx <= 84 + t);

            if (isTop || isBottom || isLeft || isRight || isMiddle) {
                r = lightningR; g = lightningG; b = lightningB;
            }
        }

        buffer[offset] = b;
        buffer[offset + 1] = g;
        buffer[offset + 2] = r;
        buffer[offset + 3] = a;
    }
}

// --- AND Mask ---
const maskOffset = dataOffset + pixelDataSize;
for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
        const byteIndex = Math.floor((y * width + x) / 8);
        const bitIndex = 7 - ((y * width + x) % 8);
        const offset = dataOffset + (y * width + x) * 4;
        const alpha = buffer[offset + 3];
        
        if (alpha === 0) {
            buffer[maskOffset + byteIndex] |= (1 << bitIndex);
        }
    }
}

const outputPath = path.join(__dirname, '../client/public/icon.ico');
fs.writeFileSync(outputPath, buffer);
console.log(`ICO created at ${outputPath}`);
