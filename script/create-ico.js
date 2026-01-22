import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const width = 256;
const height = 256;

// Pixel Data Size (32bpp = 4 bytes per pixel)
const pixelDataSize = width * height * 4;

// AND Mask Size (1 bit per pixel, padded to 32 bits boundary)
const maskRowSize = Math.ceil(width / 32) * 4; 
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
// Background: #0F172A -> BGR: 2A 17 0F
const bgB = 0x2A; 
const bgG = 0x17;
const bgR = 0x0F;

// Stroke: White -> BGR: FF FF FF
const strB = 0xFF;
const strG = 0xFF;
const strR = 0xFF;

// SVG Logic
// ViewBox 0 0 24 24
// Path: M20 5H4v14h16v-7h-8
// Points: (20,5) -> (4,5) -> (4,19) -> (20,19) -> (20,12) -> (12,12)
const svgScale = width / 24;
const strokeWidth = 3 * svgScale;
const halfStroke = strokeWidth / 2;

const points = [
    {x: 20, y: 5},
    {x: 4, y: 5},
    {x: 4, y: 19},
    {x: 20, y: 19},
    {x: 20, y: 12},
    {x: 12, y: 12}
];

const segments = [];
for (let i = 0; i < points.length - 1; i++) {
    segments.push([points[i], points[i+1]]);
}

function distToSegment(p, v, w) {
    // p, v, w are in SVG coords
    const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
        const offset = dataOffset + (y * width + x) * 4;
        
        // Map pixel to SVG coords
        // y=0 is bottom in ICO/BMP, so y=height-1 is top.
        // SVG y=0 is top.
        // So svgY should be proportional to (height - 1 - y)
        const svgX = (x / width) * 24;
        const svgY = ((height - 1 - y) / height) * 24;
        
        let minDist = Infinity;
        
        for (const seg of segments) {
            const d = distToSegment({x: svgX, y: svgY}, seg[0], seg[1]);
            if (d < minDist) minDist = d;
        }
        
        // Anti-aliasing
        // Distance is in SVG units.
        // Stroke width is 3 SVG units.
        // Edge is at dist = 1.5.
        // We want to smooth between 1.5 - pixelSize and 1.5 + pixelSize
        // Pixel size in SVG units = 24 / width
        const pixelSize = 24 / width;
        const edge = 1.5; // half of stroke-width 3
        
        // Signed distance from edge: positive = outside, negative = inside
        const distFromEdge = minDist - edge;
        
        // Smoothstep or clamp for alpha
        // If distFromEdge < -pixelSize, alpha = 1 (inside)
        // If distFromEdge > pixelSize, alpha = 0 (outside)
        // Linear interpolation in between
        
        let strokeAlpha = 0;
        if (distFromEdge < -pixelSize) {
            strokeAlpha = 1;
        } else if (distFromEdge > pixelSize) {
            strokeAlpha = 0;
        } else {
            // Map [-pixelSize, pixelSize] to [1, 0]
            strokeAlpha = 0.5 - (distFromEdge / (2 * pixelSize));
        }
        
        // Background color
        let r = bgR, g = bgG, b = bgB;
        
        // Blend stroke
        // Final = Stroke * alpha + BG * (1 - alpha)
        r = Math.round(strR * strokeAlpha + bgR * (1 - strokeAlpha));
        g = Math.round(strG * strokeAlpha + bgG * (1 - strokeAlpha));
        b = Math.round(strB * strokeAlpha + bgB * (1 - strokeAlpha));
        
        // Alpha channel (ICO supports 32-bit with alpha)
        // We want full opacity for the icon square (rounded corners?)
        // Let's add rounded corners to the background too!
        
        // Background rounded corners
        // Center (12,12), size 24x24? No, SVG is 24x24.
        // Let's say we want a rounded rect filling the viewbox with some padding.
        // Or just fill the whole square? 
        // Standard icons usually have some transparency around.
        // Let's make it a rounded square.
        // Rect from (1,1) to (23,23) with radius 4.
        
        // Box distance
        // d = length(max(abs(p - center) - size, 0)) - radius
        // center = 12,12
        // size = 10 (half-width, 22 total width)
        // radius = 4
        // p relative to center
        const cx = Math.abs(svgX - 12);
        const cy = Math.abs(svgY - 12);
        // Rounded box SDF
        // q = abs(p) - b
        const bx = cx - 9; // 9 = 11 - 2 (radius) ? 
        // Let's just use simple logic:
        // x in [0, 24], y in [0, 24]
        // Alpha 0 if outside rounded rect.
        
        // Let's assume full opacity for now, 255.
        // Or better, make corners transparent.
        
        let alpha = 255;
        
        // Simple rounded corner mask for background
        // Radius 4 SVG units
        // Corners:
        // (4,4), (20,4), (4,20), (20,20)
        // If x<4 and y<4, check dist to (4,4) > 4
        
        let inCorner = false;
        let cornerDist = 0;
        
        if (svgX < 4 && svgY < 4) {
            cornerDist = Math.hypot(svgX - 4, svgY - 4);
            if (cornerDist > 4) inCorner = true;
        } else if (svgX > 20 && svgY < 4) {
            cornerDist = Math.hypot(svgX - 20, svgY - 4);
            if (cornerDist > 4) inCorner = true;
        } else if (svgX < 4 && svgY > 20) {
            cornerDist = Math.hypot(svgX - 4, svgY - 20);
            if (cornerDist > 4) inCorner = true;
        } else if (svgX > 20 && svgY > 20) {
            cornerDist = Math.hypot(svgX - 20, svgY - 20);
            if (cornerDist > 4) inCorner = true;
        }
        
        if (inCorner) {
            // Anti-alias the corner
            const cornerDistFromEdge = cornerDist - 4;
            let bgAlpha = 0;
             if (cornerDistFromEdge < -pixelSize) {
                bgAlpha = 1;
            } else if (cornerDistFromEdge > pixelSize) {
                bgAlpha = 0;
            } else {
                bgAlpha = 0.5 - (cornerDistFromEdge / (2 * pixelSize));
            }
            alpha = Math.round(255 * bgAlpha);
        }
        
        buffer.writeUInt8(b, offset);
        buffer.writeUInt8(g, offset + 1);
        buffer.writeUInt8(r, offset + 2);
        buffer.writeUInt8(alpha, offset + 3);
    }
}

// Write buffer
const outputPath = path.join(__dirname, '../client/public/icon.ico');
fs.writeFileSync(outputPath, buffer);
console.log(`Icon created at ${outputPath}`);
