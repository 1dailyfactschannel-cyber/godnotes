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

const lightningB = 0x00; // #FFD700 (Gold) -> 00 D7 FF
const lightningG = 0xD7;
const lightningR = 0xFF;

// Helper: Point in Polygon
function insidePolygon(point, vs) {
    // ray-casting algorithm based on
    // https://github.com/substack/point-in-polygon
    var x = point[0], y = point[1];
    var inside = false;
    for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        var xi = vs[i][0], yi = vs[i][1];
        var xj = vs[j][0], yj = vs[j][1];
        var intersect = ((yi > y) != (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};

// Lightning Bolt Polygon (Normalized 0-100)
// A thicker, more prominent bolt
const boltPolygon = [
    [55, 10], // Top Leftish
    [90, 10], // Top Right
    [60, 55], // Middle Right (Inner)
    [85, 55], // Middle Right (Outer)
    [40, 95], // Bottom Tip
    [55, 50], // Middle Left (Inner)
    [25, 50], // Middle Left (Outer)
    [55, 10]  // Back to start
];

for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
        const offset = dataOffset + (y * width + x) * 4;
        
        const nx = (x / width) * 100;
        const ny = (y / height) * 100;

        let r = 0, g = 0, b = 0, a = 0;

        // 1. Background: Full Rounded Square
        // Radius ~ 20%
        // Check corners
        const rPercent = 20;
        let inCorner = false;
        
        // Check 4 corners
        if (nx < rPercent && ny < rPercent) { // Bottom Left (ICO is bottom-up? No, ny is 0-100 based on y loop. y=0 is bottom usually in BMP, but let's check loop)
             // Standard loop 0..height is usually top-down in memory, but BMP stores bottom-up.
             // Wait, standard BMP is bottom-up.
             // So y=0 is BOTTOM.
             // If I use standard ny = y/height*100, then ny=0 is BOTTOM.
             
             // Distance from center of corner circle
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
            
            // 2. Add subtle gradient/border for depth?
            // Simple border
            if (nx < 3 || nx > 97 || ny < 3 || ny > 97) {
                 // Slightly lighter border
                 r = Math.min(255, bgR + 20);
                 g = Math.min(255, bgG + 20);
                 b = Math.min(255, bgB + 20);
            }

            // 3. Lightning Bolt
            if (insidePolygon([nx, ny], boltPolygon)) {
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
