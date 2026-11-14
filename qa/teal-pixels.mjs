import { decodePNG } from './png.js'
import { readFileSync } from 'node:fs'
const png = decodePNG(readFileSync('qa/teal-frame.png'))
const W = png.width
const H = png.height
console.log('size', W, 'x', H)
for (const [x, y] of [[1129, 708], [950, 450], [1129, 500], [700, 700], [1800, 800], [1129, 650], [1129, 750]]) {
  const i = (y * W + x) * 4
  console.log(x, y, 'rgb(' + png.data[i] + ',' + png.data[i + 1] + ',' + png.data[i + 2] + ')')
}
// scan whole frame for teal-ish (g>r+30, g>b+30, g>120)
let hits = []
for (let y = 0; y < H; y += 4) {
  for (let x = 0; x < W; x += 4) {
    const i = (y * W + x) * 4
    const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2]
    if (g > 110 && g > r + 25 && g > b + 25) hits.push([x, y, r, g, b])
  }
}
console.log('teal-ish hits', hits.length, hits.slice(0, 20))
