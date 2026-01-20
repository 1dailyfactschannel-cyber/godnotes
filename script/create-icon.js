import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const width = 128;
const height = 128;
// BMP rows must be padded to multiple of 4 bytes
const rowSize = Math.floor((24 * width + 31) / 32) * 4; 
const pixelArraySize = rowSize * height;
const fileSize = 54 + pixelArraySize;

const buffer = Buffer.alloc(fileSize);

// Bitmap File Header
buffer.write('BM');
buffer.writeUInt32LE(fileSize, 2);
buffer.writeUInt32LE(54, 10); // Offset to pixel array

// DIB Header
buffer.writeUInt32LE(40, 14); // Header size
buffer.writeInt32LE(width, 18);
buffer.writeInt32LE(height, 22); // Positive height = bottom-up
buffer.writeUInt16LE(1, 26); // Planes
buffer.writeUInt16LE(24, 28); // Bits per pixel

// Draw the icon
// Background: Dark Blue (Godnotes Theme) - #0F172A -> BGR: 2A 17 0F
// Foreground: White Lightning/G
const bgB = 0x2A;
const bgG = 0x17;
const bgR = 0x0F;

for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
        const offset = 54 + y * rowSize + x * 3;
        
        let isForeground = false;
        
        // Coordinates normalized to 0-100
        const nx = (x / width) * 100;
        const ny = (y / height) * 100;

        // Draw a "Page" shape
        const isPage = (nx > 20 && nx < 80) && (ny > 10 && ny < 90);
        
        // Draw a "Lightning" shape inside
        // Simple zigzag: (40, 70) -> (60, 50) -> (45, 50) -> (65, 30)
        // Check distance to line segments for thickness
        
        // Let's just draw a big "G" for simplicity and recognition
        // Or a simple filled square for the page
        
        if (isPage) {
             // White Page
             buffer[offset] = 255;
             buffer[offset+1] = 255;
             buffer[offset+2] = 255;
             
             // Add a blue border to the page
             if (nx < 25 || nx > 75 || ny < 15 || ny > 85) {
                 buffer[offset] = bgB;
                 buffer[offset+1] = bgG;
                 buffer[offset+2] = bgR;
             }
        } else {
            // Background
            buffer[offset] = bgB;
            buffer[offset+1] = bgG;
            buffer[offset+2] = bgR;
        }
        
        // Draw a lightning bolt in the middle (Yellow/Gold: 00 D7 FF -> BGR: 00 D7 FF)
        // Approximate shape check
        // We'll simulate a diagonal stroke
        if (nx > 40 && nx < 60 && ny > 30 && ny < 70) {
             // Yellowish
             buffer[offset] = 0x00; // B
             buffer[offset+1] = 0xD7; // G
             buffer[offset+2] = 0xFF; // R
        }
    }
}

const outputPath = path.join(__dirname, '../client/public/icon.bmp');
fs.writeFileSync(outputPath, buffer);
console.log(`Icon created at ${outputPath}`);
