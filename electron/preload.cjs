const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  loadData: () => ipcRenderer.invoke('load-data'),
  saveData: (data) => ipcRenderer.invoke('save-data', data),
  openMain: () => ipcRenderer.invoke('open-main'),
  hideMain: () => ipcRenderer.invoke('hide-main'),
  minimizeMain: () => ipcRenderer.invoke('minimize-main'),
  closeMain: () => ipcRenderer.invoke('close-main'),
  toggleMaximizeMain: () => ipcRenderer.invoke('toggle-maximize-main'),
  hideWidget: () => ipcRenderer.invoke('hide-widget'),
  showWidget: () => ipcRenderer.invoke('show-widget'),
  openPunch: () => ipcRenderer.invoke('open-punch'),
  submitPunch: (time) => ipcRenderer.invoke('submit-punch', time),
  closePunch: () => ipcRenderer.invoke('close-punch'),
  onPunchConfirmed: (callback) => {
    const listener = (_event, time) => callback(time)
    ipcRenderer.on('punch-confirmed', listener)
    return () => ipcRenderer.removeListener('punch-confirmed', listener)
  },
  setOpacity: (value) => ipcRenderer.invoke('set-opacity', value),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  showWidgetMenu: () => ipcRenderer.invoke('show-widget-menu'),
  setCorner: (corner) => ipcRenderer.invoke('set-corner', corner),
  setWidgetSize: (width, height) => ipcRenderer.invoke('set-widget-size', width, height),
  onDataChanged: (callback) => {
    const listener = (_event, data) => callback(data)
    ipcRenderer.on('data-changed', listener)
    return () => ipcRenderer.removeListener('data-changed', listener)
  },
  onSettingsPatch: (callback) => {
    const listener = (_event, patch) => callback(patch)
    ipcRenderer.on('settings-patch', listener)
    return () => ipcRenderer.removeListener('settings-patch', listener)
  }
})
