import sharp from 'sharp'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const publicDir = 'public'

interface Check {
  file: string
  expectedSize: number
}

const installIcons: Check[] = [
  { file: 'pwa-icon-192.png', expectedSize: 192 },
  { file: 'pwa-icon-512.png', expectedSize: 512 },
  { file: 'pwa-maskable-192.png', expectedSize: 192 },
  { file: 'pwa-maskable-512.png', expectedSize: 512 },
  { file: 'apple-touch-icon-v2.png', expectedSize: 180 },
]

const favicons: Check[] = [
  { file: 'favicon-16.png', expectedSize: 16 },
  { file: 'favicon-32.png', expectedSize: 32 },
  { file: 'favicon-48.png', expectedSize: 48 },
]

let errors = 0

// Check file existence
for (const { file } of [...installIcons, ...favicons]) {
  if (!existsSync(`${publicDir}/${file}`)) {
    console.error(`❌ Missing: ${publicDir}/${file}`)
    errors++
  }
}
if (!existsSync(`${publicDir}/favicon.ico`)) {
  console.error(`❌ Missing: ${publicDir}/favicon.ico`)
  errors++
}
if (!existsSync(`${publicDir}/favicon.svg`)) {
  console.error(`❌ Missing: ${publicDir}/favicon.svg`)
  errors++
}

// Check dimensions
for (const { file, expectedSize } of [...installIcons, ...favicons]) {
  try {
    const meta = await sharp(`${publicDir}/${file}`).metadata()
    if (meta.width !== expectedSize || meta.height !== expectedSize) {
      console.error(`❌ ${file}: expected ${expectedSize}×${expectedSize}, got ${meta.width}×${meta.height}`)
      errors++
    } else {
      console.log(`✅ ${file}: ${meta.width}×${meta.height}`)
    }
  } catch {
    // Already reported missing above
  }
}

// Check ICO format (must start with 00 00 01 00)
try {
  const icoBuf = await readFile(`${publicDir}/favicon.ico`)
  const header = icoBuf.subarray(0, 4)
  const isIco = header[0] === 0x00 && header[1] === 0x00 && header[2] === 0x01 && header[3] === 0x00
  if (isIco) {
    console.log(`✅ favicon.ico: valid ICO format`)
  } else {
    console.error(`❌ favicon.ico: not a valid ICO (header: ${Array.from(header).map(b => b.toString(16).padStart(2, '0')).join(' ')})`)
    errors++
  }
} catch {
  // Already reported missing
}

// Check install icon opacity (must be fully opaque — alpha=255 everywhere)
for (const { file } of installIcons) {
  try {
    const { data, info } = await sharp(`${publicDir}/${file}`)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    let transparentPixels = 0
    const totalPixels = info.width * info.height
    // RGBA: alpha channel is every 4th byte
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) transparentPixels++
    }

    if (transparentPixels > 0) {
      console.error(`❌ ${file}: ${transparentPixels}/${totalPixels} transparent pixels (must be fully opaque)`)
      errors++
    } else {
      console.log(`✅ ${file}: fully opaque (${totalPixels} pixels, alpha=255)`)
    }
  } catch {
    // Already reported missing
  }
}

// Check foreground centering at 512px
// The egg is white (#ffffff) on a colored gradient background.
// We find the center of mass of white-ish pixels to verify centering.
try {
  const { data, info } = await sharp(`${publicDir}/pwa-icon-512.png`)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  let sumX = 0, sumY = 0, count = 0
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
      // White-ish pixel: high RGB, fully opaque
      if (a === 255 && r > 200 && g > 200 && b > 200) {
        sumX += x
        sumY += y
        count++
      }
    }
  }

  if (count > 0) {
    const cx = sumX / count
    const cy = sumY / count
    const centerX = (info.width - 1) / 2
    const centerY = (info.height - 1) / 2
    const dx = Math.abs(cx - centerX)
    const dy = Math.abs(cy - centerY)
    const ok = dx <= 5 && dy <= 5
    console.log(`${ok ? '✅' : '❌'} pwa-icon-512.png foreground center: (${cx.toFixed(1)}, ${cy.toFixed(1)}) — offset (${dx.toFixed(1)}, ${dy.toFixed(1)}) from canvas center (${centerX.toFixed(1)}, ${centerY.toFixed(1)})`)
    if (!ok) errors++
  } else {
    console.error('❌ pwa-icon-512.png: could not detect foreground pixels')
    errors++
  }
} catch {
  // Already reported missing
}

console.log(errors > 0 ? `\n❌ ${errors} check(s) failed` : '\n✅ All checks passed')
process.exit(errors > 0 ? 1 : 0)
