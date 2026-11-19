<script setup>
import { computed, ref, watch } from 'vue'
import { store } from '../lib/store.js'
import { THEME_PRESETS } from '../lib/theme.js'
import {
  SCHEDULES,
  getWorkDaysInMonth,
  getDailySalary,
  isWorkday,
  getStandardMinutes,
  getLunchMinutes,
  minutesToTime,
  timeToMinutes
} from '../lib/calculator.js'
import { formatDate, hasHolidayData, supportedYears } from '../lib/holidays.js'

const monthOffset = ref(0)
const widgetWidth = ref(store.settings.widgetWidth || 250)
const widgetHeight = ref(store.settings.widgetHeight || 118)
const currentTheme = computed(() => (store.settings.themeColor || '#b07d18').toLowerCase())

function applySize() {
  const width = Number(widgetWidth.value) || 250
  const height = Number(widgetHeight.value) || 118
  if (window.electronAPI && window.electronAPI.setWidgetSize) {
    window.electronAPI.setWidgetSize(width, height)
  }
  store.settings.widgetWidth = width
  store.settings.widgetHeight = height
}

function resetSize() {
  widgetWidth.value = 250
  widgetHeight.value = 118
  applySize()
}

watch(() => [store.settings.widgetWidth, store.settings.widgetHeight], ([width, height]) => {
  widgetWidth.value = width || 250
  widgetHeight.value = height || 118
})
function pickTheme(color) {
  store.settings.themeColor = color
}
const calendar = computed(() => {
  const base = new Date()
  const target = new Date(base.getFullYear(), base.getMonth() + monthOffset.value, 1)
  const year = target.getFullYear()
  const month = target.getMonth()
  const total = new Date(year, month + 1, 0).getDate()
  const days = []
  for (let day = 1; day <= total; day += 1) {
    const date = new Date(year, month, day)
    const key = formatDate(date)
    days.push({
      key,
      day,
      weekday: date.getDay(),
      work: isWorkday(date, store.settings.schedule, store.settings.dayOverrides),
      overridden: Object.prototype.hasOwnProperty.call(store.settings.dayOverrides, key)
    })
  }
  return { year, month, days }
})

const monthDays = computed(() =>
  getWorkDaysInMonth(
    calendar.value.year,
    calendar.value.month,
    store.settings.schedule,
    store.settings.dayOverrides
  )
)

const previewDaily = computed(() =>
  getDailySalary(store.settings, calendar.value.year, calendar.value.month)
)
const perMinute = computed(() => previewDaily.value / getStandardMinutes(store.settings))
const lunchMinutes = computed(() => getLunchMinutes(store.settings))
const windowEndText = computed(() =>
  minutesToTime(timeToMinutes(store.settings.workEnd) + (Number(store.settings.flexEnd) || 0))
)

const calendarTitle = computed(() =>
  `${calendar.value.year}年${calendar.value.month + 1}月`
)

function shiftMonth(delta) {
  monthOffset.value += delta
}

function toggleDay(day) {
  store.settings.dayOverrides[day.key] = !day.work
}

function clearOverrides() {
  store.settings.dayOverrides = {}
}

function clearManual() {
  store.settings.manualStart = ''
}
</script>

<template>
  <div class="view settings">
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>外观主题</h2>
          <p>选一个喜欢的颜色，主界面和角标会一起变色</p>
        </div>
      </div>
      <div class="theme-block">
        <div class="theme-presets">
          <button
            v-for="item in THEME_PRESETS"
            :key="item.color"
            class="theme-swatch"
            :class="{ active: currentTheme === item.color.toLowerCase() }"
            :title="item.name"
            :style="{ background: item.color }"
            @click="pickTheme(item.color)"
          >
            <span v-if="currentTheme === item.color.toLowerCase()">✓</span>
          </button>
        </div>
        <div class="theme-custom">
          <label>自定义</label>
          <input :value="currentTheme" type="color" @input="pickTheme($event.target.value)" />
          <code>{{ currentTheme }}</code>
        </div>
      </div>

      <div class="widget-size-block">
        <div class="block-title">角标尺寸（像素）</div>
        <div class="widget-size-row">
          <div class="field compact">
            <label>宽度</label>
            <input v-model.number="widgetWidth" type="number" min="180" max="600" step="10" @change="applySize" />
          </div>
          <div class="field compact">
            <label>高度</label>
            <input v-model.number="widgetHeight" type="number" min="80" max="400" step="10" @change="applySize" />
          </div>
          <button class="ghost-button" @click="resetSize">恢复默认</button>
          <small>也可以直接拖动角标边缘调整大小</small>
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>收入与工作制</h2>
          <p>薪资和工作节奏决定了每一分钟值多少钱</p>
        </div>
      </div>

      <div class="form-grid">
        <div class="field">
          <label>月薪（元）</label>
          <input v-model.number="store.settings.monthlySalary" type="number" min="0" step="100" />
          <small>填写税前或税后均可，按自己口径记账</small>
        </div>
        <div class="field">
          <label>标准工时（小时/天）</label>
          <input v-model.number="store.settings.standardHours" type="number" min="0.5" max="24" step="0.5" />
          <small>决定每分钟值多少钱，默认 8 小时制</small>
        </div>
        <div class="field">
          <label>上班时间</label>
          <input v-model="store.settings.workStart" type="time" />
        </div>
        <div class="field">
          <label>下班时间</label>
          <input v-model="store.settings.workEnd" type="time" />
        </div>
        <div class="field">
          <label>午休开始</label>
          <input v-model="store.settings.lunchStart" type="time" />
          <small>午休时段不计费</small>
        </div>
        <div class="field">
          <label>午休结束</label>
          <input v-model="store.settings.lunchEnd" type="time" />
        </div>
        <div class="field">
          <label>上班弹性（分钟）</label>
          <input v-model.number="store.settings.flexStart" type="number" min="0" max="180" step="5" />
          <small>晚到不超过该时长，仍从上班时间算起</small>
        </div>
        <div class="field">
          <label>下班弹性（分钟）</label>
          <input v-model.number="store.settings.flexEnd" type="number" min="0" max="180" step="5" />
          <small>下班时间后延长计薪的时长</small>
        </div>
        <div class="field">
          <label>补填开始时间（可选）</label>
          <div class="inline-field">
            <input v-model="store.settings.manualStart" type="time" />
            <button class="ghost-button" @click="clearManual">清除</button>
          </div>
          <small>忘记点按钮时，可指定今天从几点开始计费</small>
        </div>
      </div>

      <div class="calc-preview">
        按当前设置：日薪 ¥{{ previewDaily.toFixed(2) }} ÷ {{ store.settings.standardHours }} 小时 = 每分钟 ¥{{ perMinute.toFixed(4) }}
        <span v-if="lunchMinutes > 0"> · 午休扣除 {{ lunchMinutes }} 分钟</span>
        <span> · 计薪窗口 {{ store.settings.workStart }} - {{ windowEndText }}</span>
      </div>

      <div class="schedule-block">
        <div class="block-title">工作制</div>
        <div class="schedule-list">
          <button
            v-for="item in SCHEDULES"
            :key="item.value"
            class="schedule-card"
            :class="{ active: store.settings.schedule === item.value }"
            @click="store.settings.schedule = item.value"
          >
            <div class="schedule-radio"></div>
            <div>
              <strong>{{ item.label }}</strong>
              <small>{{ item.desc }}</small>
            </div>
          </button>
        </div>
      </div>

      <label class="toggle-row">
        <input v-model="store.settings.autoFullPast" type="checkbox" />
        <span class="toggle-ui"></span>
        <span>
          <strong>未记录的工作日按全天计入月收入</strong>
          <small>打开后，过去没有点过"开始赚钱"的工作日会自动按日薪计入月账单</small>
        </span>
      </label>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>工作日历校正</h2>
          <p>法定节假日已自动载入，你也可以点击日期手动标记上班或休息</p>
        </div>
        <div class="calendar-nav">
          <button class="ghost-button" @click="shiftMonth(-1)">‹</button>
          <strong>{{ calendarTitle }}</strong>
          <button class="ghost-button" @click="shiftMonth(1)">›</button>
        </div>
      </div>

      <div class="calendar-summary">
        <span>本月工作日 <strong>{{ monthDays }}</strong> 天</span>
        <span>日薪约 <strong>¥{{ previewDaily.toFixed(2) }}</strong></span>
        <span :class="hasHolidayData(calendar.year) ? 'ok' : 'warn'">
          {{ hasHolidayData(calendar.year) ? '已应用国务院放假安排' : '该年份按周末估算，请手动校正' }}
        </span>
        <button class="text-button" @click="clearOverrides">清除手动标记</button>
      </div>

      <div class="calendar-grid">
        <div v-for="name in ['日','一','二','三','四','五','六']" :key="name" class="calendar-week">{{ name }}</div>
        <div
          v-for="day in calendar.days"
          :key="day.key"
          class="calendar-day"
          :class="{ work: day.work, rest: !day.work, overridden: day.overridden }"
          :title="`${day.key} ${day.work ? '上班' : '休息'}${day.overridden ? '（手动标记）' : ''}`"
          @click="toggleDay(day)"
        >
          <span>{{ day.day }}</span>
          <i></i>
        </div>
      </div>

      <p class="calendar-tip">紫色为工作日，灰色为休息日；点击可切换。内置节假日年份：{{ supportedYears().join('、') }}。</p>
    </section>
  </div>
</template>
