/**
 * Generate PWA icons for Zault
 * Run with: bun scripts/generate-icons.js
 */

import { writeFileSync } from 'fs';
import sharp from 'sharp';

// Zault shield/lock icon as SVG
const generateSvg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e"/>
      <stop offset="100%" style="stop-color:#0f0f1a"/>
    </linearGradient>
    <linearGradient id="shield" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#8b5cf6"/>
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  
  <!-- Shield outline -->
  <path d="M256 72 L416 136 L416 256 C416 352 344 424 256 456 C168 424 96 352 96 256 L96 136 Z" 
        fill="none" 
        stroke="url(#shield)" 
        stroke-width="24"
        stroke-linejoin="round"/>
  
  <!-- Lock body -->
  <rect x="196" y="232" width="120" height="100" rx="12" fill="url(#shield)"/>
  
  <!-- Lock shackle -->
  <path d="M216 232 L216 192 C216 160 232 144 256 144 C280 144 296 160 296 192 L296 232" 
        fill="none" 
        stroke="url(#shield)" 
        stroke-width="20"
        stroke-linecap="round"/>
  
  <!-- Keyhole -->
  <circle cx="256" cy="272" r="16" fill="#0f0f1a"/>
  <rect x="250" y="272" width="12" height="32" rx="4" fill="#0f0f1a"/>
</svg>
`.trim();

async function generateIcons() {
  console.log('Generating PWA icons...');

  const svg512 = Buffer.from(generateSvg(512));

  // Generate PNGs
  await sharp(svg512).resize(512, 512).png().toFile('public/pwa-512x512.png');
  console.log('✓ public/pwa-512x512.png');

  await sharp(svg512).resize(192, 192).png().toFile('public/pwa-192x192.png');
  console.log('✓ public/pwa-192x192.png');

  await sharp(svg512).resize(180, 180).png().toFile('public/apple-touch-icon.png');
  console.log('✓ public/apple-touch-icon.png');

  await sharp(svg512).resize(32, 32).png().toFile('public/favicon-32x32.png');
  console.log('✓ public/favicon-32x32.png');

  await sharp(svg512).resize(16, 16).png().toFile('public/favicon-16x16.png');
  console.log('✓ public/favicon-16x16.png');

  // Write SVG versions
  writeFileSync('public/icon.svg', generateSvg(512));
  console.log('✓ public/icon.svg');

  writeFileSync('public/favicon.svg', generateSvg(32));
  console.log('✓ public/favicon.svg');

  console.log('\nDone! All icons generated.');
}

generateIcons().catch(console.error);

