<script setup>
import { computed, onMounted, ref } from 'vue'
import { initStore, store } from './lib/store.js'
import { formatDate, hasHolidayData } from './lib/holidays.js'
import { now } from './lib/clock.js'
import DashboardView from './components/DashboardView.vue'
import SettingsView from './components/SettingsView.vue'
import WishlistView from './components/WishlistView.vue'
import LedgerView from './components/LedgerView.vue'

const view = ref('dashboard')
const today = computed(() => formatDate(new Date(now.value)))
const timeText = computed(() => new Date(now.value).toLocaleTimeString('zh-CN', { hour12: false }))
const weekNames = ['日', '一', '二', '三', '四', '五', '六']
const dateText = computed(() => {
  const d = new Date(now.value)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${weekNames[d.getDay()]}`
})
const holidayReady = computed(() => hasHolidayData(new Date(now.value).getFullYear()))

const navItems = [
  { key: 'dashboard', label: '今日总览', icon: '◧' },
  { key: 'wishlist', label: '愿望清单', icon: '◇' },
  { key: 'ledger', label: '我的账本', icon: '▤' },
  { key: 'settings', label: '设置', icon: '⚙' }
]

function collapse() {
  if (window.electronAPI && window.electronAPI.hideMain) window.electronAPI.hideMain()
}
function minimize() {
  if (window.electronAPI && window.electronAPI.minimizeMain) window.electronAPI.minimizeMain()
}
function closeWindow() {
  if (window.electronAPI && window.electronAPI.closeMain) window.electronAPI.closeMain()
}
function toggleMaximize() {
  if (window.electronAPI && window.electronAPI.toggleMaximizeMain) window.electronAPI.toggleMaximizeMain()
}

onMounted(initStore)
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">金</div>
        <div>
          <div class="brand-name">小金角</div>
          <div class="brand-sub">把时间攒成小金库</div>
        </div>
      </div>

      <nav class="nav">
        <button
          v-for="item in navItems"
          :key="item.key"
          class="nav-item"
          :class="{ active: view === item.key }"
          @click="view = item.key"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </button>
      </nav>

      <div class="sidebar-foot">
        <div class="salary-chip">
          <span>当前月薪</span>
          <strong>¥ {{ store.settings.monthlySalary }}</strong>
        </div>
        <div class="holiday-note" :class="{ warn: !holidayReady }">
          {{ holidayReady ? '已载入本年法定节假日' : '本年节假日数据未内置，按周末估算' }}
        </div>
      </div>
    </aside>

    <main class="main">
      <header class="topbar" @dblclick="toggleMaximize">
        <div>
          <h1 class="page-title">{{ navItems.find((item) => item.key === view).label }}</h1>
          <p class="page-sub">{{ dateText }}</p>
        </div>
        <div class="topbar-right" @dblclick.stop>
          <button class="collapse-button" title="收起到屏幕角标" @click="collapse">
            ↙ 收起到角标
          </button>
          <div class="clock">
            <span class="clock-time">{{ timeText }}</span>
            <span class="clock-date">{{ today }}</span>
          </div>
          <div class="window-controls">
            <button class="window-button" title="最小化" @click="minimize">−</button>
            <button class="window-button close" title="关闭" @click="closeWindow">×</button>
          </div>
        </div>
      </header>

      <div class="content">
        <DashboardView v-if="view === 'dashboard'" @go="view = $event" />
        <WishlistView v-else-if="view === 'wishlist'" />
        <LedgerView v-else-if="view === 'ledger'" />
        <SettingsView v-else />
      </div>
    </main>
  </div>
</template>
