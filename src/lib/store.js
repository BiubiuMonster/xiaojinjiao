import { reactive, watch } from 'vue'
import { formatDate, applyRemoteHolidays } from './holidays.js'
import { applyTheme } from './theme.js'

const STORAGE_KEY = 'xiaojinjiao-v1'

function defaults() {
  return {
    settings: {
      monthlySalary: 10000,
      schedule: 'double',
      standardHours: 8,
      workStart: '09:00',
      workEnd: '18:30',
      lunchStart: '12:00',
      lunchEnd: '13:30',
      flexStart: 30,
      flexEnd: 30,
      manualStart: '',
      autoFullPast: true,
      widgetCorner: 'bottom-right',
      cornerMigrated: false,
      widgetOpacity: 1,
      widgetWidth: 250,
      widgetHeight: 118,
      themeColor: '#b07d18',
      dayOverrides: {}
    },
    sessions: {},
    expenses: [],
    wishlist: []
  }
}

export const store = reactive(defaults())

let ready = false
let saveTimer = null
let applyingRemote = false

function persist() {
  const data = JSON.parse(JSON.stringify(store))
  if (window.electronAPI && window.electronAPI.saveData) {
    window.electronAPI.saveData(data)
  } else {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.error('保存数据失败:', error)
    }
  }
}

function applyData(data) {
  if (!data) return
  const base = defaults()
  Object.assign(base, data)
  base.settings = { ...base.settings, ...(data.settings || {}) }
  base.settings.dayOverrides = { ...(data.settings && data.settings.dayOverrides) }
  if (!base.settings.themeColor) base.settings.themeColor = defaults().settings.themeColor
  if (base.settings.widgetCorner === 'top-right' && !base.settings.cornerMigrated) {
    base.settings.widgetCorner = 'bottom-right'
    base.settings.cornerMigrated = true
  }
  Object.assign(store, base)
}

export async function initStore() {
  let data = null
  if (window.electronAPI && window.electronAPI.loadHolidays) {
    try {
      const yearsData = await window.electronAPI.loadHolidays()
      if (yearsData) applyRemoteHolidays(yearsData)
      window.electronAPI.onHolidaysUpdated((incoming) => applyRemoteHolidays(incoming))
    } catch (error) {
      console.error('读取节假日数据失败:', error)
    }
  }
  if (window.electronAPI && window.electronAPI.loadData) {
    try {
      data = await window.electronAPI.loadData()
      if (window.electronAPI.onDataChanged) {
        window.electronAPI.onDataChanged((remote) => {
          applyingRemote = true
          applyData(remote)
          setTimeout(() => { applyingRemote = false }, 0)
        })
      }
      if (window.electronAPI.onSettingsPatch) {
        window.electronAPI.onSettingsPatch((patch) => {
          applyingRemote = true
          Object.assign(store.settings, patch)
          setTimeout(() => { applyingRemote = false }, 0)
        })
      }
      if (window.electronAPI.onPunchConfirmed) {
        window.electronAPI.onPunchConfirmed((time) => {
          if (!getOpenSession(formatDate(new Date()))) startSession(time)
        })
      }
    } catch (error) {
      console.error('读取本地数据失败:', error)
    }
  }
  if (!data) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) data = JSON.parse(raw)
    } catch (error) {
      console.error('读取缓存数据失败:', error)
    }
  }
  applyData(data)
  applyTheme(store.settings.themeColor)
  ready = true
  watch(() => store.settings.themeColor, (color) => applyTheme(color))
  watch(store, () => {
    if (!ready || applyingRemote) return
    clearTimeout(saveTimer)
    saveTimer = setTimeout(persist, 250)
  }, { deep: true })
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function getOpenSession(dateKey = formatDate(new Date())) {
  return ((store.sessions && store.sessions[dateKey]) || []).find((item) => !item.end) || null
}

export function startSession(punchTime) {
  let start = Date.now()
  if (punchTime) {
    const [hour, minute] = String(punchTime).split(':').map(Number)
    const punchDate = new Date(start)
    punchDate.setHours(hour || 0, minute || 0, 0, 0)
    start = punchDate.getTime()
  } else {
    const manual = store.settings.manualStart
    if (manual) {
      const [hour, minute] = manual.split(':').map(Number)
      const manualDate = new Date()
      manualDate.setHours(hour || 0, minute || 0, 0, 0)
      if (manualDate.getTime() < start) start = manualDate.getTime()
    }
  }
  const key = formatDate(new Date(start))
  if (!store.sessions[key]) store.sessions[key] = []
  store.sessions[key].push({ start, end: null })
}

export function stopSession() {
  const key = formatDate(new Date())
  const open = getOpenSession(key)
  if (open) open.end = Date.now()
}

export function addExpense({ date, amount, category, note }) {
  store.expenses.unshift({
    id: uid(),
    date,
    amount: Number(amount) || 0,
    category: category || '其他',
    note: note || '',
    createdAt: Date.now()
  })
}

export function removeExpense(id) {
  const index = store.expenses.findIndex((item) => item.id === id)
  if (index >= 0) store.expenses.splice(index, 1)
}

export function addWish({ name, price }) {
  store.wishlist.push({ id: uid(), name, price: Number(price) || 0 })
}

export function removeWish(id) {
  const index = store.wishlist.findIndex((item) => item.id === id)
  if (index >= 0) store.wishlist.splice(index, 1)
}
