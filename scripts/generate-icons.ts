import sharp from 'sharp'
import { readFileSync } from 'fs'

const svg = readFileSync('public/icon.svg')

const sizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon-32.png', size: 32 },
  { name: 'favicon-16.png', size: 16 },
]

for (const { name, size } of sizes) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(`public/${name}`)
  console.log(`Generated public/${name} (${size}x${size})`)
}

// Generate multi-size ICO: just use the 48x48 PNG as favicon (browsers accept PNG favicons)
await sharp(svg)
  .resize(48, 48)
  .png()
  .toFile('public/favicon.ico')
console.log('Generated public/favicon.ico (48x48)')

console.log('\n✅ All PWA icons generated!')
