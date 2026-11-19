export const THEME_PRESETS = [
  { name: '金', color: '#b07d18' },
  { name: '青', color: '#0d9488' },
  { name: '蓝', color: '#2563eb' },
  { name: '朱', color: '#d1495b' },
  { name: '墨', color: '#334155' },
  { name: '紫', color: '#6c5ce7' }
]

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function hexToRgb(hex) {
  const text = String(hex || '').replace('#', '')
  const full = text.length === 3 ? text.split('').map((c) => c + c).join('') : text
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return [176, 125, 24]
  return [0, 2, 4].map((index) => parseInt(full.slice(index, index + 2), 16))
}

function mix(hex, target, ratio) {
  const [r, g, b] = hexToRgb(hex)
  return [r, g, b].map((value, index) => clamp(value + (target[index] - value) * ratio))
}

function toHex(rgb) {
  return `#${rgb.map((value) => clamp(value).toString(16).padStart(2, '0')).join('')}`
}

function normalize(color) {
  const text = String(color || '').replace('#', '')
  const full = text.length === 3 ? text.split('').map((c) => c + c).join('') : text
  return /^[0-9a-fA-F]{6}$/.test(full) ? `#${full.toUpperCase()}` : '#B07D18'
}

let lastColor = null

export function applyTheme(color) {
  const normalized = normalize(color)
  if (normalized === lastColor) return
  lastColor = normalized

  const root = document.documentElement.style
  const light = mix(normalized, [255, 255, 255], 0.3)
  const soft = mix(normalized, [255, 255, 255], 0.9)
  const dark = mix(normalized, [0, 0, 0], 0.22)
  const [r, g, b] = hexToRgb(normalized)
  const [lr, lg, lb] = light

  root.setProperty('--primary', normalized)
  root.setProperty('--primary-light', toHex(light))
  root.setProperty('--primary-soft', toHex(soft))
  root.setProperty('--primary-dark', toHex(dark))
  root.setProperty('--primary-rgb', `${r}, ${g}, ${b}`)
  root.setProperty('--primary-light-rgb', `${lr}, ${lg}, ${lb}`)
}
