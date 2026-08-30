import sharp from 'sharp'
import { readFile } from 'node:fs/promises'

const publicDir = 'public'
const sourceDir = 'scripts/icon-assets'

const splashSvg = await readFile(`${sourceDir}/splash.svg`)

// iPhone portrait launch-screen sizes (points × @scale).
// fit: 'cover' keeps the egg undistorted across differing aspect ratios.
const splashOutputs = [
  { file: 'splash-640x1136.png', width: 640, height: 1136 },   // iPhone 5 / SE 1st gen
  { file: 'splash-750x1334.png', width: 750, height: 1334 },   // iPhone 8 / SE 2nd–3rd gen
  { file: 'splash-828x1792.png', width: 828, height: 1792 },   // iPhone XR / 11
  { file: 'splash-1125x2436.png', width: 1125, height: 2436 }, // iPhone X / XS / 11 Pro
  { file: 'splash-1170x2532.png', width: 1170, height: 2532 }, // iPhone 12 / 13 / 14
  { file: 'splash-1179x2556.png', width: 1179, height: 2556 }, // iPhone 14 Pro / 15 / 16
  { file: 'splash-1242x2688.png', width: 1242, height: 2688 }, // iPhone XS Max / 11 Pro Max
  { file: 'splash-1284x2778.png', width: 1284, height: 2778 }, // iPhone 12 / 13 Pro Max, 14 Plus
  { file: 'splash-1290x2796.png', width: 1290, height: 2796 }, // iPhone 14 Pro Max / 15 Plus
]

for (const { file, width, height } of splashOutputs) {
  await sharp(splashSvg)
    .resize(width, height, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toFile(`${publicDir}/${file}`)
  console.log(`Generated ${publicDir}/${file} (${width}×${height})`)
}

console.log('\n✅ All iOS splash images generated!')
