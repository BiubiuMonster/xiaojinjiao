const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const size = 32
const pixels = Buffer.alloc(size * size * 4)

function setPixel(x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= size || y >= size) return
  const i = (y * size + x) * 4
  pixels[i] = r
  pixels[i + 1] = g
  pixels[i + 2] = b
  pixels[i + 3] = a
}

function roundedRect(x0, y0, x1, y1, radius, color) {
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const cx = Math.min(Math.max(x, x0 + radius), x1 - radius)
      const cy = Math.min(Math.max(y, y0 + radius), y1 - radius)
      const dx = x - cx
      const dy = y - cy
      if (x < x0 + radius && y < y0 + radius && dx * dx + dy * dy > radius * radius) continue
      if (x > x1 - radius && y < y0 + radius && dx * dx + dy * dy > radius * radius) continue
      if (x < x0 + radius && y > y1 - radius && dx * dx + dy * dy > radius * radius) continue
      if (x > x1 - radius && y > y1 - radius && dx * dx + dy * dy > radius * radius) continue
      setPixel(x, y, ...color, 255)
    }
  }
}

function line(x0, y0, x1, y1, color, thickness = 0) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 3
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const x = Math.round(x0 + (x1 - x0) * t)
    const y = Math.round(y0 + (y1 - y0) * t)
    for (let dx = -thickness; dx <= thickness; dx += 1) {
      for (let dy = -thickness; dy <= thickness; dy += 1) setPixel(x + dx, y + dy, ...color, 255)
    }
  }
}

roundedRect(0, 0, 31, 31, 8, [108, 92, 231])
const white = [255, 255, 255]
line(9, 8, 16, 16, white)
line(23, 8, 16, 16, white)
line(16, 15, 16, 26, white)
line(10, 19, 22, 19, white)
line(10, 23, 22, 23, white)

function crc32(buffer) {
  let c = ~0
  for (let i = 0; i < buffer.length; i += 1) {
    c ^= buffer[i]
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const name = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([length, name, data, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(size, 0)
ihdr.writeUInt32BE(size, 4)
ihdr[8] = 8
ihdr[9] = 6

const stride = size * 4 + 1
const raw = Buffer.alloc(stride * size)
for (let y = 0; y < size; y += 1) {
  pixels.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4)
}

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0))
])

const output = path.join(__dirname, '..', 'electron', 'tray.png')
fs.writeFileSync(output, png)
console.log(`已生成 ${output} (${png.length} bytes)`)
