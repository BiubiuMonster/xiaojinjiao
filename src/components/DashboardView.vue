<script setup>
import { computed } from 'vue'
import { now } from '../lib/clock.js'
import { store, getOpenSession, startSession, stopSession } from '../lib/store.js'
import {
  money,
  dayEarnings,
  getDailySalary,
  getWorkDaysInMonth,
  sumExpenses,
  getMonthStats,
  effectiveMinutes,
  getDayWindowEnd
} from '../lib/calculator.js'
import { formatDate } from '../lib/holidays.js'

const emit = defineEmits(['go'])

const today = computed(() => formatDate(new Date(now.value)))
const currentDate = computed(() => new Date(now.value))
const openSession = computed(() => Boolean(getOpenSession(today.value)))
const dailySalary = computed(() =>
  getDailySalary(store.settings, currentDate.value.getFullYear(), currentDate.value.getMonth())
)
const earnedToday = computed(() =>
  dayEarnings(today.value, store.sessions[today.value] || [], store.settings, now.value)
)
const spentToday = computed(() =>
  sumExpenses(store.expenses, (item) => item.date === today.value)
)
const netToday = computed(() => earnedToday.value - spentToday.value)

const workDays = computed(() =>
  getWorkDaysInMonth(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth(),
    store.settings.schedule,
    store.settings.dayOverrides
  )
)

const monthStats = computed(() =>
  getMonthStats(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth(),
    store.settings,
    store.sessions,
    store.expenses,
    now.value
  )
)

const activeMinutes = computed(() => {
  const session = getOpenSession(today.value)
  if (!session) return 0
  const end = Math.min(now.value, getDayWindowEnd(currentDate.value, store.settings))
  return effectiveMinutes(session.start, end, store.settings)
})

const progress = computed(() =>
  Math.min(100, (earnedToday.value / Math.max(dailySalary.value, 1)) * 100)
)

const wishPreview = computed(() => {
  return store.wishlist
    .slice()
    .sort((a, b) => a.price - b.price)
    .slice(0, 3)
    .map((item) => ({
      ...item,
      fragment: earnedToday.value / Math.max(item.price, 1),
      percent: Math.min(100, (earnedToday.value / Math.max(item.price, 1)) * 100)
    }))
})

function handleToggle() {
  if (openSession.value) {
    stopSession()
  } else if (window.electronAPI && window.electronAPI.openPunch) {
    window.electronAPI.openPunch()
  } else {
    startSession()
  }
}

</script>

<template>
  <div class="view dashboard">
    <section class="earn-hero">
      <div class="hero-left">
        <div class="hero-label">
          <span class="live-dot" :class="{ on: openSession }"></span>
          {{ openSession ? '正在为你计时赚钱' : '今天已经赚到' }}
        </div>
        <div class="hero-amount"><span>¥</span>{{ money(earnedToday) }}</div>
        <div class="hero-meta">
          <span>日薪 ¥{{ money(dailySalary) }}</span>
          <span class="divider"></span>
          <span>已完成 {{ progress.toFixed(1) }}%</span>
          <span class="divider"></span>
          <span>计时 {{ Math.floor(activeMinutes) }} 分钟</span>
        </div>
        <div class="hero-bar">
          <div class="hero-bar-fill" :style="{ width: progress + '%' }"></div>
        </div>
      </div>

      <div class="hero-right">
        <button class="earn-button" :class="{ running: openSession }" @click="handleToggle">
          <span class="earn-icon">{{ openSession ? '■' : '▶' }}</span>
          {{ openSession ? '结束赚钱' : '开始赚钱' }}
        </button>
        <p class="earn-hint">
          {{ store.settings.workStart }} - {{ store.settings.workEnd }}
          · 标准 {{ store.settings.standardHours }} 小时
          <template v-if="store.settings.lunchStart && store.settings.lunchEnd">
            · 午休 {{ store.settings.lunchStart }}-{{ store.settings.lunchEnd }}
          </template>
        </p>
        <p class="earn-hint sub">
          弹性上班 +{{ store.settings.flexStart }} 分 / 下班 +{{ store.settings.flexEnd }} 分
          <template v-if="store.settings.manualStart"> · 补填 {{ store.settings.manualStart }}</template>
          · 每天最多 ¥{{ money(dailySalary, 0) }}
        </p>
      </div>
    </section>

    <section class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">今日支出</div>
        <div class="stat-value expense">-¥{{ money(spentToday) }}</div>
        <div class="stat-foot">已从当日收益中扣除</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">今日结余</div>
        <div class="stat-value" :class="netToday < 0 ? 'expense' : 'income'">
          {{ netToday < 0 ? '-' : '' }}¥{{ money(Math.abs(netToday)) }}
        </div>
        <div class="stat-foot">赚到的钱减去花的钱</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">本月工作天</div>
        <div class="stat-value">{{ workDays }} <small>天</small></div>
        <div class="stat-foot">依据法定节假日与调休计算</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">本月结余</div>
        <div class="stat-value" :class="monthStats.net < 0 ? 'expense' : 'income'">
          {{ monthStats.net < 0 ? '-' : '' }}¥{{ money(Math.abs(monthStats.net)) }}
        </div>
        <div class="stat-foot">收入 ¥{{ money(monthStats.earned, 0) }} · 支出 ¥{{ money(monthStats.spent, 0) }}</div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>今日愿望碎片</h2>
          <p>你今天赚的钱，离想要的东西还有多远</p>
        </div>
        <button class="text-button" @click="emit('go', 'wishlist')">管理愿望 →</button>
      </div>

      <div v-if="wishPreview.length === 0" class="empty">
        <div class="empty-icon">◇</div>
        <p>还没有愿望清单，去添加一个想买的东西吧</p>
        <button class="primary-button small" @click="emit('go', 'wishlist')">添加愿望</button>
      </div>

      <div v-else class="wish-preview-list">
        <div v-for="item in wishPreview" :key="item.id" class="wish-preview-row">
          <div class="wish-preview-info">
            <strong>{{ item.name }}</strong>
            <span>¥{{ money(item.price, 0) }}</span>
          </div>
          <div class="wish-preview-bar">
            <div class="wish-preview-fill" :style="{ width: item.percent + '%' }"></div>
          </div>
          <div class="wish-preview-value">
            <strong>{{ item.fragment.toFixed(4) }}</strong>
            <span>个碎片 · {{ item.percent.toFixed(2) }}%</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
