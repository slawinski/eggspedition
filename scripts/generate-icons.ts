import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const publicDir = 'public'
const sourceDir = 'scripts/icon-assets'

const installSvg = await readFile(`${sourceDir}/icon-square.svg`)
const faviconSvg = await readFile(`${sourceDir}/favicon.svg`)

// ── Install icons (full-bleed, opaque, for PWA + Apple) ──
const installOutputs = [
  { file: 'pwa-icon-192.png', size: 192 },
  { file: 'pwa-icon-512.png', size: 512 },
  { file: 'pwa-maskable-192.png', size: 192 },
  { file: 'pwa-maskable-512.png', size: 512 },
  { file: 'apple-touch-icon-v2.png', size: 180 },
]

for (const { file, size } of installOutputs) {
  await sharp(installSvg)
    .resize(size, size, { fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toFile(`${publicDir}/${file}`)
  console.log(`Generated ${publicDir}/${file} (${size}×${size})`)
}

// ── Favicons (simplified, small-size optimized) ──
const faviconOutputs = [
  { file: 'favicon-16.png', size: 16 },
  { file: 'favicon-32.png', size: 32 },
  { file: 'favicon-48.png', size: 48 },
]

for (const { file, size } of faviconOutputs) {
  await sharp(faviconSvg)
    .resize(size, size, { fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toFile(`${publicDir}/${file}`)
  console.log(`Generated ${publicDir}/${file} (${size}×${size})`)
}

// ── Real ICO from multi-size favicons ──
const ico = await pngToIco([
  `${publicDir}/favicon-16.png`,
  `${publicDir}/favicon-32.png`,
  `${publicDir}/favicon-48.png`,
])
await writeFile(`${publicDir}/favicon.ico`, ico)
console.log(`Generated ${publicDir}/favicon.ico (multi-size ICO)`)

// ── Copy favicon SVG to public ──
await writeFile(`${publicDir}/favicon.svg`, faviconSvg)
console.log(`Copied ${publicDir}/favicon.svg`)

console.log('\n✅ All PWA icons generated!')
