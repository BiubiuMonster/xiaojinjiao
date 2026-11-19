import { shallowRef } from 'vue'

const pad = (n) => String(n).padStart(2, '0')

export function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function parseDate(text) {
  const [y, m, d] = text.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// 国务院办公厅公布的放假调休安排（仅含全体公民放假的节日）
const HOLIDAY_DATA = {
  2025: {
    holidays: [
      ['2025-01-01', '2025-01-01'],
      ['2025-01-28', '2025-02-04'],
      ['2025-04-04', '2025-04-06'],
      ['2025-05-01', '2025-05-05'],
      ['2025-05-31', '2025-06-02'],
      ['2025-10-01', '2025-10-08']
    ],
    makeups: ['2025-01-26', '2025-02-08', '2025-04-27', '2025-09-28', '2025-10-11']
  },
  2026: {
    holidays: [
      ['2026-01-01', '2026-01-03'],
      ['2026-02-15', '2026-02-23'],
      ['2026-04-04', '2026-04-06'],
      ['2026-05-01', '2026-05-05'],
      ['2026-06-19', '2026-06-21'],
      ['2026-09-25', '2026-09-27'],
      ['2026-10-01', '2026-10-07']
    ],
    makeups: ['2026-01-04', '2026-02-14', '2026-02-28', '2026-05-09', '2026-09-20', '2026-10-10']
  }
}

const cache = new Map()

// 启动时由主进程通过网络拉取的节假日数据，按年份覆盖内置数据。
// 结构：{ [year]: { holidays: [[start, end], ...], makeups: [date, ...] } }
const remoteData = shallowRef({})

export function applyRemoteHolidays(yearsData) {
  if (!yearsData || typeof yearsData !== 'object') return
  remoteData.value = { ...remoteData.value, ...yearsData }
  cache.clear()
}

function yearData(year) {
  // 读取远程数据以建立响应式依赖，保证拉取完成后相关 computed 会重新计算
  const remote = remoteData.value
  if (!cache.has(year)) {
    const raw = remote[year] || HOLIDAY_DATA[year] || { holidays: [], makeups: [] }
    const holidaySet = new Set()
    for (const [start, end] of raw.holidays || []) {
      const from = parseDate(start)
      const to = parseDate(end)
      const cursor = new Date(from)
      while (cursor <= to) {
        holidaySet.add(formatDate(cursor))
        cursor.setDate(cursor.getDate() + 1)
      }
    }
    cache.set(year, {
      holidaySet,
      makeupSet: new Set(raw.makeups || []),
      available: Boolean(remote[year] || HOLIDAY_DATA[year])
    })
  }
  return cache.get(year)
}

export function getDayType(date) {
  const key = formatDate(date)
  const data = yearData(date.getFullYear())
  if (data.makeupSet.has(key)) return 'makeup'
  if (data.holidaySet.has(key)) return 'holiday'
  return 'normal'
}

export function hasHolidayData(year) {
  return yearData(year).available
}

export function supportedYears() {
  const years = new Set(Object.keys(HOLIDAY_DATA).map(Number))
  for (const year of Object.keys(remoteData.value)) years.add(Number(year))
  return [...years].sort((a, b) => a - b)
}
