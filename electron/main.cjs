const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, screen } = require('electron')
const path = require('path')
const fs = require('fs')

let mainWindow = null
let widgetWindow = null
let punchWindow = null
let punchRequesterId = null
let tray = null
let isQuitting = false
let currentCorner = 'bottom-right'
let currentOpacity = 1
let widgetWidth = 250
let widgetHeight = 118

function normalizeSize(value, fallback, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.round(Math.max(min, Math.min(max, number)))
}

const CORNERS = [
  ['top-left', '左上角'],
  ['top-right', '右上角'],
  ['bottom-left', '左下角'],
  ['bottom-right', '右下角']
]

const OPACITIES = [
  [1, '100%（不透明）'],
  [0.85, '85%'],
  [0.7, '70%'],
  [0.5, '50%'],
  [0.3, '30%']
]

function dataFile() {
  return path.join(app.getPath('userData'), 'ledger-data.json')
}

function oldDataFile() {
  return path.join(app.getPath('appData'), 'salary-ledger', 'ledger-data.json')
}

function readData() {
  try {
    const file = dataFile()
    const source = fs.existsSync(file) ? file : oldDataFile()
    if (fs.existsSync(source)) return JSON.parse(fs.readFileSync(source, 'utf8'))
  } catch (err) {
    console.error('读取账本数据失败:', err)
  }
  return null
}

function writeData(data) {
  try {
    const file = dataFile()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8')
    return true
  } catch (err) {
    console.error('保存账本数据失败:', err)
    return false
  }
}

function broadcast(channel, payload, excludeWebContents) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.webContents !== excludeWebContents && !win.webContents.isDestroyed()) {
      win.webContents.send(channel, payload)
    }
  }
}

function pageUrl(mode) {
  const base = process.env.VITE_DEV_SERVER_URL
    ? process.env.VITE_DEV_SERVER_URL
    : `file://${path.join(__dirname, '..', 'dist', 'index.html')}`
  return `${base}?mode=${mode}`
}

function positionWidget(corner) {
  if (!widgetWindow || widgetWindow.isDestroyed()) return
  const area = screen.getPrimaryDisplay().workArea
  const [width, height] = widgetWindow.getSize()
  const margin = 14
  const positions = {
    'top-left': [area.x + margin, area.y + margin],
    'top-right': [area.x + area.width - width - margin, area.y + margin],
    'bottom-left': [area.x + margin, area.y + area.height - height - margin],
    'bottom-right': [area.x + area.width - width - margin, area.y + area.height - height - margin]
  }
  const [x, y] = positions[corner] || positions['bottom-right']
  widgetWindow.setPosition(Math.round(x), Math.round(y))
}

function applyOpacity(value) {
  currentOpacity = Math.min(1, Math.max(0.2, Number(value) || 1))
  // 透明度改由渲染进程的 CSS 背景 alpha 控制，避免整窗 setOpacity 与透明圆角叠加产生四角色差
}

function patchSettings(patch) {
  const data = readData() || {}
  data.settings = { ...(data.settings || {}), ...patch }
  writeData(data)
  broadcast('settings-patch', patch)
}

function setOpacity(value) {
  applyOpacity(value)
  patchSettings({ widgetOpacity: currentOpacity })
  refreshTrayMenu()
}

function setCorner(corner) {
  currentCorner = corner
  patchSettings({ widgetCorner: corner })
  positionWidget(corner)
  refreshTrayMenu()
}

function setWidgetSize(width, height) {
  widgetWidth = normalizeSize(width, 250, 180, 600)
  widgetHeight = normalizeSize(height, 118, 80, 400)
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.setSize(widgetWidth, widgetHeight)
    positionWidget(currentCorner)
  }
  patchSettings({ widgetWidth, widgetHeight })
}

function createWidget() {
  widgetWindow = new BrowserWindow({
    width: widgetWidth,
    height: widgetHeight,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: true,
    hasShadow: false,
    skipTaskbar: true,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  widgetWindow.loadURL(pageUrl('widget'))
  widgetWindow.setAlwaysOnTop(true, 'screen-saver')
  widgetWindow.setOpacity(1)
  applyOpacity(currentOpacity)
  positionWidget(currentCorner)

  widgetWindow.on('resized', () => {
    if (widgetWindow.isDestroyed()) return
    const [width, height] = widgetWindow.getSize()
    if (width === widgetWidth && height === widgetHeight) return
    widgetWidth = normalizeSize(width, 250, 180, 600)
    widgetHeight = normalizeSize(height, 118, 80, 400)
    patchSettings({ widgetWidth, widgetHeight })
  })

  widgetWindow.on('closed', () => {
    widgetWindow = null
    if (!isQuitting && !tray) app.quit()
  })
}

function showWidget() {
  if (!widgetWindow || widgetWindow.isDestroyed()) {
    createWidget()
    return
  }
  widgetWindow.show()
  widgetWindow.setAlwaysOnTop(true, 'screen-saver')
  applyOpacity(currentOpacity)
  positionWidget(currentCorner)
  refreshTrayMenu()
}

function hideWidget() {
  if (widgetWindow && !widgetWindow.isDestroyed()) widgetWindow.hide()
  refreshTrayMenu()
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 820,
      minWidth: 980,
      minHeight: 640,
      title: '小金角',
      frame: false,
      hasShadow: true,
      backgroundColor: '#f4f6fb',
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false
      }
    })
    mainWindow.loadURL(pageUrl('main'))
    mainWindow.on('close', (event) => {
      if (!isQuitting) {
        event.preventDefault()
        mainWindow.hide()
      }
    })
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function openPunchWindow(requesterId) {
  punchRequesterId = requesterId
  if (punchWindow && !punchWindow.isDestroyed()) {
    punchWindow.focus()
    return
  }
  punchWindow = new BrowserWindow({
    width: 360,
    height: 430,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  punchWindow.loadURL(pageUrl('punch'))
  punchWindow.center()
  punchWindow.on('closed', () => {
    punchWindow = null
  })
}

function submitPunch(punchTime) {
  const requester = punchRequesterId ? BrowserWindow.fromId(punchRequesterId) : null
  if (requester && !requester.webContents.isDestroyed()) {
    requester.webContents.send('punch-confirmed', punchTime)
  }
  closePunchWindow()
}

function closePunchWindow() {
  if (punchWindow && !punchWindow.isDestroyed()) punchWindow.close()
}

function cornerMenuItems() {
  return CORNERS.map(([value, label]) => ({
    label,
    type: 'radio',
    checked: currentCorner === value,
    click: () => setCorner(value)
  }))
}

function opacityMenuItems() {
  return OPACITIES.map(([value, label]) => ({
    label,
    type: 'radio',
    checked: Math.abs(currentOpacity - value) < 0.01,
    click: () => setOpacity(value)
  }))
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: '唤出角标', click: () => showWidget() },
    { label: '打开主界面', click: () => showMainWindow() },
    { type: 'separator' },
    { label: '角标位置', submenu: cornerMenuItems() },
    { label: '角标透明度', submenu: opacityMenuItems() },
    { type: 'separator' },
    { label: '退出小金角', click: () => app.quit() }
  ])
}

function refreshTrayMenu() {
  if (tray && !tray.isDestroyed()) tray.setContextMenu(buildTrayMenu())
}

function showWidgetMenu() {
  Menu.buildFromTemplate([
    { label: '收进托盘', click: () => hideWidget() },
    { label: '打开主界面', click: () => showMainWindow() },
    { type: 'separator' },
    { label: '角标位置', submenu: cornerMenuItems() },
    { label: '角标透明度', submenu: opacityMenuItems() },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ]).popup({ window: widgetWindow })
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  const saved = readData()
  if (saved && saved.settings) {
    let corner = saved.settings.widgetCorner
    if (corner === 'top-right' && !saved.settings.cornerMigrated) {
      corner = 'bottom-right'
      const migrated = readData() || {}
      migrated.settings = { ...(migrated.settings || {}), widgetCorner: corner, cornerMigrated: true }
      writeData(migrated)
    }
    if (corner) currentCorner = corner
    if (saved.settings.widgetOpacity != null) currentOpacity = saved.settings.widgetOpacity
    widgetWidth = normalizeSize(saved.settings.widgetWidth, 250, 180, 600)
    widgetHeight = normalizeSize(saved.settings.widgetHeight, 118, 80, 400)
  }

  ipcMain.handle('load-data', () => readData())

  ipcMain.handle('save-data', (event, data) => {
    const ok = writeData(data)
    if (ok) broadcast('data-changed', data, event.sender)
    return ok
  })

  ipcMain.handle('open-main', () => showMainWindow())
  ipcMain.handle('hide-main', () => mainWindow && mainWindow.hide())
  ipcMain.handle('minimize-main', () => mainWindow && mainWindow.minimize())
  ipcMain.handle('close-main', () => mainWindow && mainWindow.close())
  ipcMain.handle('toggle-maximize-main', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.handle('open-punch', (event) => openPunchWindow(BrowserWindow.fromWebContents(event.sender)?.id))
  ipcMain.handle('submit-punch', (_event, punchTime) => submitPunch(punchTime))
  ipcMain.handle('close-punch', () => closePunchWindow())
  ipcMain.handle('hide-widget', () => hideWidget())
  ipcMain.handle('show-widget', () => showWidget())
  ipcMain.handle('set-opacity', (_event, value) => setOpacity(value))
  ipcMain.handle('quit-app', () => app.quit())
  ipcMain.handle('show-widget-menu', () => showWidgetMenu())
  ipcMain.handle('set-corner', (_event, corner) => setCorner(corner))
  ipcMain.handle('set-widget-size', (_event, width, height) => setWidgetSize(width, height))

  const icon = nativeImage.createFromPath(path.join(__dirname, 'tray.png'))
  tray = new Tray(icon)
  tray.setToolTip('小金角')
  tray.setContextMenu(buildTrayMenu())
  tray.on('double-click', () => showWidget())

  createWidget()

  app.on('activate', () => showMainWindow())
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !tray) app.quit()
})
