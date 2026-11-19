<script setup>
import { computed, onMounted, ref } from 'vue'
import { now } from '../lib/clock.js'
import { store, initStore, getOpenSession } from '../lib/store.js'
import { getDailySalary } from '../lib/calculator.js'
import { formatDate } from '../lib/holidays.js'

const punchTime = ref('')
const error = ref('')
const today = computed(() => formatDate(new Date(now.value)))
const daily = computed(() => {
  const d = new Date()
  return getDailySalary(store.settings, d.getFullYear(), d.getMonth())
})
const alreadyWorking = computed(() => Boolean(getOpenSession(today.value)))

function pad(n) {
  return String(n).padStart(2, '0')
}

function currentTime() {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function setQuick(offsetMinutes) {
  const d = new Date(Date.now() + offsetMinutes * 60000)
  punchTime.value = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  error.value = ''
}

function confirm() {
  if (!punchTime.value) {
    error.value = '请选择开始计费时间'
    return
  }
  if (alreadyWorking.value) {
    error.value = '今天已经开始赚钱了'
    return
  }
  if (!/^\d{1,2}:\d{2}$/.test(punchTime.value)) {
    error.value = '时间格式不正确'
    return
  }
  if (window.electronAPI && window.electronAPI.submitPunch) {
    window.electronAPI.submitPunch(punchTime.value)
  }
}

function cancel() {
  if (window.electronAPI && window.electronAPI.closePunch) window.electronAPI.closePunch()
}

function onKey(event) {
  if (event.key === 'Escape') cancel()
}

onMounted(() => {
  initStore()
  punchTime.value = currentTime()
  window.addEventListener('keydown', onKey)
})
</script>

<template>
  <div class="punch">
    <div class="punch-drag"></div>
    <div class="punch-head">
      <div class="punch-logo">金</div>
      <div>
        <h2>开始计费时间</h2>
        <p>从打卡到工位需要时间？填到工位的时间即可</p>
      </div>
      <button class="punch-close no-drag" title="取消" @click="cancel">×</button>
    </div>

    <div class="punch-body">
      <div class="punch-date">{{ today }}</div>
      <label class="punch-label">实际开始工作时间</label>
      <input v-model="punchTime" class="punch-time" type="time" step="60" />
      <div class="punch-quick">
        <button @click="setQuick(0)">现在</button>
        <button @click="setQuick(5)">5 分钟后</button>
        <button @click="setQuick(10)">10 分钟后</button>
        <button @click="setQuick(-15)">15 分钟前</button>
      </div>
      <p class="punch-hint">
        上班 {{ store.settings.workStart }} · 弹性 +{{ store.settings.flexStart }} 分 · 日薪 ¥{{ daily.toFixed(2) }}
      </p>
      <p v-if="error" class="punch-error">{{ error }}</p>
    </div>

    <div class="punch-foot">
      <button class="punch-cancel no-drag" @click="cancel">取消</button>
      <button class="punch-ok no-drag" @click="confirm">确认，开始赚钱</button>
    </div>
  </div>
</template>
