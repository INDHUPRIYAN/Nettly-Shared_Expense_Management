// Generates the PWA / Apple touch icons from the brand mark using headless Chromium.
// Usage: npm run icons
import { chromium } from '@playwright/test'
import { writeFile } from 'node:fs/promises'

const mark = (size, padding) => `<!doctype html><html><body style="margin:0;background:transparent">
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fb7185"/><stop offset=".5" stop-color="#e11d48"/><stop offset="1" stop-color="#dc2626"/>
  </linearGradient></defs>
  <rect width="64" height="64" rx="${padding ? 0 : 14}" fill="url(#g)"/>
  <g transform="translate(${padding ? 8 : 0} ${padding ? 8 : 0}) scale(${padding ? 0.75 : 1})">
    <path d="M18 46V18h6l16 18V18h6v28h-6L24 28v18z" fill="#fff"/>
  </g>
</svg></body></html>`

const targets = [
  { file: 'public/pwa-192x192.png', size: 192, padding: false },
  { file: 'public/pwa-512x512.png', size: 512, padding: true },
  { file: 'public/apple-touch-icon.png', size: 180, padding: true },
]

const browser = await chromium.launch()
try {
  for (const { file, size, padding } of targets) {
    const page = await browser.newPage({ viewport: { width: size, height: size } })
    await page.setContent(mark(size, padding))
    const buffer = await page.locator('svg').screenshot({ omitBackground: true })
    await writeFile(file, buffer)
    await page.close()
    console.log(`wrote ${file}`)
  }
} finally {
  await browser.close()
}
