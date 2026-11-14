// Minimal PNG decoder (8-bit RGB/RGBA) using node zlib.
import { inflateSync } from 'node:zlib'

const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function readU32(b, o) {
  return b[o] * 0x1000000 + b[o + 1] * 0x10000 + b[o + 2] * 0x100 + b[o + 3]
}

export function decodePNG(buf) {
  if (buf.length < 8 || SIG.some((v, i) => buf[i] !== v)) throw new Error('not a PNG')
  let o = 8
  let width = 0
  let height = 0
  let colorType = 0
  let depth = 0
  const idat = []
  while (o < buf.length) {
    const len = readU32(buf, o)
    const type = buf.toString('ascii', o + 4, o + 8)
    const data = buf.subarray(o + 8, o + 8 + len)
    if (type === 'IHDR') {
      width = readU32(data, 0)
      height = readU32(data, 4)
      depth = data[8]
      colorType = data[9]
      const interlace = data[12]
      if (interlace !== 0) throw new Error('interlaced PNG unsupported')
      if (depth !== 8) throw new Error(`bit depth ${depth} unsupported`)
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }
    o += 12 + len
  }
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 1
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * bpp
  const out = Buffer.alloc(width * height * 4)
  const paeth = (a, b, c) => {
    const p = a + b - c
    const pa = Math.abs(p - a)
    const pb = Math.abs(p - b)
    const pc = Math.abs(p - c)
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
  }
  let pos = 0
  let prev = Buffer.alloc(stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++]
    const line = raw.subarray(pos, pos + stride)
    pos += stride
    const cur = Buffer.alloc(stride)
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0
      const b = prev[x]
      const c = x >= bpp ? prev[x - bpp] : 0
      let v
      switch (filter) {
        case 0: v = line[x]; break
        case 1: v = line[x] + a; break
        case 2: v = line[x] + b; break
        case 3: v = line[x] + ((a + b) >> 1); break
        case 4: v = line[x] + paeth(a, b, c); break
        default: throw new Error(`unknown filter ${filter}`)
      }
      cur[x] = v & 0xff
    }
    for (let x = 0; x < width; x++) {
      const s = x * bpp
      const d = (y * width + x) * 4
      if (bpp === 4) {
        out[d] = cur[s]; out[d + 1] = cur[s + 1]; out[d + 2] = cur[s + 2]; out[d + 3] = cur[s + 3]
      } else if (bpp === 3) {
        out[d] = cur[s]; out[d + 1] = cur[s + 1]; out[d + 2] = cur[s + 2]; out[d + 3] = 255
      } else {
        out[d] = cur[s]; out[d + 1] = cur[s]; out[d + 2] = cur[s]; out[d + 3] = 255
      }
    }
    prev = cur
  }
  return { width, height, data: out }
}
