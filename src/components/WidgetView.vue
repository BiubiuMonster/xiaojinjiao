<script setup>
import { computed, onMounted } from 'vue'
import { now } from '../lib/clock.js'
import { initStore, store, getOpenSession, startSession, stopSession } from '../lib/store.js'
import { money, dayEarnings, getDailySalary, effectiveMinutes, getDayWindowEnd } from '../lib/calculator.js'
import { formatDate } from '../lib/holidays.js'

const today = computed(() => formatDate(new Date(now.value)))
const currentDate = computed(() => new Date(now.value))
const openSession = computed(() => Boolean(getOpenSession(today.value)))
const dailySalary = computed(() =>
  getDailySalary(store.settings, currentDate.value.getFullYear(), currentDate.value.getMonth())
)
const earned = computed(() =>
  dayEarnings(today.value, store.sessions[today.value] || [], store.settings, now.value)
)
const progress = computed(() => Math.min(100, (earned.value / Math.max(dailySalary.value, 1)) * 100))

const activeMinutes = computed(() => {
  const session = getOpenSession(today.value)
  if (!session) return 0
  const end = Math.min(now.value, getDayWindowEnd(currentDate.value, store.settings))
  return effectiveMinutes(session.start, end, store.settings)
})

function toggle() {
  if (openSession.value) {
    stopSession()
  } else if (window.electronAPI && window.electronAPI.openPunch) {
    window.electronAPI.openPunch()
  } else {
    startSession()
  }
}

function showMenu() {
  if (window.electronAPI && window.electronAPI.showWidgetMenu) window.electronAPI.showWidgetMenu()
}

function openMain() {
  if (window.electronAPI && window.electronAPI.openMain) window.electronAPI.openMain()
}

function hideToTray() {
  if (window.electronAPI && window.electronAPI.hideWidget) window.electronAPI.hideWidget()
}

function quitApp() {
  if (window.electronAPI && window.electronAPI.quitApp) window.electronAPI.quitApp()
}

const OPACITY_STEPS = [1, 0.85, 0.7, 0.5, 0.3]
const opacityText = computed(() => `${Math.round((store.settings.widgetOpacity || 1) * 100)}%`)

function cycleOpacity() {
  const current = store.settings.widgetOpacity || 1
  const index = OPACITY_STEPS.findIndex((value) => Math.abs(value - current) < 0.01)
  const next = OPACITY_STEPS[(index + 1) % OPACITY_STEPS.length]
  if (window.electronAPI && window.electronAPI.setOpacity) window.electronAPI.setOpacity(next)
}

onMounted(initStore)
</script>

<template>
  <div class="widget" :style="{ '--widget-alpha': store.settings.widgetOpacity || 1 }" @contextmenu.prevent="showMenu">
    <div class="widget-top">
      <div class="widget-brand">
        <span class="widget-logo">金</span>
        <span class="widget-label">今日已赚</span>
      </div>
      <div class="widget-tools">
        <button class="widget-tool no-drag" :title="`透明度 ${opacityText}（点击切换）`" @click="cycleOpacity">◐</button>
        <button class="widget-tool no-drag" title="收进托盘" @click="hideToTray">—</button>
        <button class="widget-tool expand no-drag" title="打开主界面" @click="openMain">↗</button>
        <button class="widget-tool close no-drag" title="关闭程序" @click="quitApp">×</button>
      </div>
    </div>

    <div class="widget-amount"><span>¥</span>{{ money(earned) }}</div>

    <div class="widget-progress">
      <div class="widget-progress-fill" :style="{ width: progress + '%' }"></div>
    </div>

    <div class="widget-bottom">
      <button
        class="widget-action no-drag"
        :class="{ running: openSession }"
        @click="toggle"
      >
        <span>{{ openSession ? '■' : '▶' }}</span>
        {{ openSession ? '结束' : '开始赚钱' }}
      </button>
      <div class="widget-meta">
        <strong>{{ openSession ? `计时 ${Math.floor(activeMinutes)} 分` : `日薪 ¥${money(dailySalary, 0)}` }}</strong>
        <small>{{ progress.toFixed(1) }}% · 右键更多设置</small>
      </div>
    </div>
  </div>
</template>
