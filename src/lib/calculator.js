import { formatDate, getDayType } from './holidays.js'

export const SCHEDULES = [
  { value: 'double', label: '双休', desc: '周一至周五上班', weekdays: [1, 2, 3, 4, 5] },
  { value: 'single', label: '单休', desc: '周一至周六上班', weekdays: [1, 2, 3, 4, 5, 6] },
  { value: 'fourthree', label: '上四休三', desc: '周一至周四上班', weekdays: [1, 2, 3, 4] }
]

export function timeToMinutes(text) {
  const [h, m] = String(text || '00:00').split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function isWorkday(date, scheduleValue, overrides = {}) {
  const key = formatDate(date)
  if (Object.prototype.hasOwnProperty.call(overrides, key)) return Boolean(overrides[key])
  const type = getDayType(date)
  if (type === 'makeup') return true
  if (type === 'holiday') return false
  const schedule = SCHEDULES.find((item) => item.value === scheduleValue) || SCHEDULES[0]
  return schedule.weekdays.includes(date.getDay())
}

export function getWorkDaysInMonth(year, month, scheduleValue, overrides = {}) {
  const total = new Date(year, month + 1, 0).getDate()
  let count = 0
  for (let day = 1; day <= total; day += 1) {
    if (isWorkday(new Date(year, month, day), scheduleValue, overrides)) count += 1
  }
  return count
}

export function getDailySalary(settings, year, month) {
  const days = getWorkDaysInMonth(year, month, settings.schedule, settings.dayOverrides || {})
  return days > 0 ? settings.monthlySalary / days : 0
}

export function getStandardMinutes(settings) {
  return Math.max(1, (Number(settings.standardHours) || 8) * 60)
}

function flexMinutes(settings, key) {
  return Math.max(0, Number(settings[key]) || 0)
}

// 返回当天可计薪的时间段（分钟数区间），已扣除午休、已包含下班弹性延伸
function getDaySegments(date, settings) {
  const base = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const toTs = (minute) => base + minute * 60000
  const startMin = timeToMinutes(settings.workStart)
  const endMin = timeToMinutes(settings.workEnd) + flexMinutes(settings, 'flexEnd')
  const endWithFlex = Math.max(startMin + 1, endMin)

  let lunchA = -1
  let lunchB = -1
  if (settings.lunchStart && settings.lunchEnd) {
    lunchA = Math.max(timeToMinutes(settings.lunchStart), startMin)
    lunchB = Math.min(timeToMinutes(settings.lunchEnd), endWithFlex)
    if (lunchB <= lunchA) {
      lunchA = -1
      lunchB = -1
    }
  }

  if (lunchA < 0) return [[toTs(startMin), toTs(endWithFlex)]]
  return [[toTs(startMin), toTs(lunchA)], [toTs(lunchB), toTs(endWithFlex)]]
}

export function getDayWindowEnd(date, settings) {
  const segments = getDaySegments(date, settings)
  return segments[segments.length - 1][1]
}

export function getLunchMinutes(settings) {
  if (!settings.lunchStart || !settings.lunchEnd) return 0
  return Math.max(0, timeToMinutes(settings.lunchEnd) - timeToMinutes(settings.lunchStart))
}

export function effectiveMinutes(startTs, endTs, settings) {
  if (!startTs || endTs <= startTs) return 0
  const graceMs = flexMinutes(settings, 'flexStart') * 60000
  let total = 0
  const cursor = new Date(startTs)
  cursor.setHours(0, 0, 0, 0)
  const last = new Date(endTs)
  last.setHours(0, 0, 0, 0)

  while (cursor <= last) {
    if (isWorkday(cursor, settings.schedule, settings.dayOverrides || {})) {
      const segments = getDaySegments(cursor, settings)
      const isStartDay = cursor.getTime() === new Date(startTs).setHours(0, 0, 0, 0)

      segments.forEach(([segStart, segEnd], index) => {
        let lower = Math.max(startTs, segStart)
        // 上班弹性仅作用于打卡当天的第一段（上午上班时段）：把打卡时间前移 grace 分钟但不早于上班起点。
        // 9:20 按 9:00 算，9:45 按 9:15 算（净扣迟到 15 分）；午休是第二段，不会误补偿。
        if (graceMs > 0 && isStartDay && index === 0 && startTs >= segStart && startTs <= segStart + graceMs) {
          lower = segStart
        }
        const upper = Math.min(endTs, segEnd)
        if (upper > lower) total += upper - lower
      })
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return total / 60000
}

function sessionEarnings(session, settings, nowTs = Date.now()) {
  const start = typeof session.start === 'number' ? session.start : new Date(session.start).getTime()
  if (!start || Number.isNaN(start)) return 0
  let end = session.end
    ? (typeof session.end === 'number' ? session.end : new Date(session.end).getTime())
    : nowTs
  if (!session.end) end = Math.min(end, getDayWindowEnd(new Date(start), settings))
  const minutes = effectiveMinutes(start, end, settings)
  const date = new Date(start)
  const daily = getDailySalary(settings, date.getFullYear(), date.getMonth())
  return (daily / getStandardMinutes(settings)) * minutes
}

export function dayEarnings(dateKey, sessions, settings, nowTs = Date.now()) {
  let sum = 0
  for (const session of sessions || []) {
    const start = typeof session.start === 'number' ? session.start : new Date(session.start).getTime()
    if (formatDate(new Date(start)) === dateKey) sum += sessionEarnings(session, settings, nowTs)
  }
  const [year, month] = dateKey.split('-').map(Number)
  const daily = getDailySalary(settings, year, month - 1)
  return Math.min(sum, daily)
}

export function sumExpenses(expenses, predicate) {
  return (expenses || [])
    .filter(predicate)
    .reduce((total, item) => total + (Number(item.amount) || 0), 0)
}

export function getMonthStats(year, month, settings, sessions, expenses, nowTs = Date.now()) {
  const todayKey = formatDate(new Date(nowTs))
  const monthPrefix = formatDate(new Date(year, month, 1)).slice(0, 7)
  let earned = 0

  const totalDays = new Date(year, month + 1, 0).getDate()
  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(year, month, day)
    const key = formatDate(date)
    if (key > todayKey) break
    if (!isWorkday(date, settings.schedule, settings.dayOverrides || {})) continue
    const list = sessions[key] || []
    if (key === todayKey) {
      earned += dayEarnings(key, list, settings, nowTs)
    } else if (list.length > 0) {
      earned += dayEarnings(key, list, settings, nowTs)
    } else if (settings.autoFullPast) {
      earned += getDailySalary(settings, year, month)
    }
  }

  const spent = sumExpenses(expenses, (item) => String(item.date).startsWith(monthPrefix))
  const workDays = getWorkDaysInMonth(year, month, settings.schedule, settings.dayOverrides || {})
  return { earned, spent, net: earned - spent, workDays }
}

export function money(value, digits = 2) {
  const number = Number(value) || 0
  return number.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
}
