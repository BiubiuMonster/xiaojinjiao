<script setup>
import { computed, ref } from 'vue'
import { now } from '../lib/clock.js'
import { store, addExpense, removeExpense } from '../lib/store.js'
import { money, dayEarnings, getMonthStats, sumExpenses } from '../lib/calculator.js'
import { formatDate } from '../lib/holidays.js'

const categories = ['餐饮', '交通', '购物', '居住', '娱乐', '医疗', '学习', '其他']

const amount = ref('')
const category = ref('餐饮')
const note = ref('')
const expenseDate = ref(formatDate(new Date(now.value)))
const monthOffset = ref(0)

const today = computed(() => formatDate(new Date(now.value)))
const currentDate = computed(() => new Date(now.value))

const viewingMonth = computed(() => {
  const d = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + monthOffset.value, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
})
const monthPrefix = computed(() =>
  formatDate(new Date(viewingMonth.value.year, viewingMonth.value.month, 1)).slice(0, 7)
)
const monthLabel = computed(() =>
  `${viewingMonth.value.year}年${viewingMonth.value.month + 1}月`
)

const earnedToday = computed(() =>
  dayEarnings(today.value, store.sessions[today.value] || [], store.settings, now.value)
)
const spentToday = computed(() =>
  sumExpenses(store.expenses, (item) => item.date === today.value)
)
const monthStats = computed(() =>
  getMonthStats(
    viewingMonth.value.year,
    viewingMonth.value.month,
    store.settings,
    store.sessions,
    store.expenses,
    now.value
  )
)

const todayExpenses = computed(() =>
  store.expenses
    .filter((item) => item.date === today.value)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
)
const monthExpenses = computed(() =>
  store.expenses
    .filter((item) => String(item.date).startsWith(monthPrefix.value))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0))
)

function submit() {
  const value = Number(amount.value)
  if (!(value > 0)) return
  addExpense({ date: expenseDate.value || today.value, amount: value, category: category.value, note: note.value })
  amount.value = ''
  note.value = ''
}

function remove(id) {
  removeExpense(id)
}
</script>

<template>
  <div class="view ledger">
    <section class="ledger-form-panel">
      <div class="panel-head">
        <div>
          <h2>记一笔支出</h2>
          <p>花掉的钱会从当天的收益里扣除</p>
        </div>
      </div>
      <div class="ledger-form">
        <div class="field compact">
          <label>金额（元）</label>
          <input v-model.number="amount" type="number" min="0.01" step="0.01" placeholder="0.00" />
        </div>
        <div class="field compact">
          <label>分类</label>
          <select v-model="category">
            <option v-for="item in categories" :key="item" :value="item">{{ item }}</option>
          </select>
        </div>
        <div class="field compact">
          <label>日期</label>
          <input v-model="expenseDate" type="date" />
        </div>
        <div class="field compact grow">
          <label>备注</label>
          <input v-model="note" placeholder="买了什么" @keyup.enter="submit" />
        </div>
        <button class="primary-button" :disabled="!(Number(amount) > 0)" @click="submit">记一笔</button>
      </div>
    </section>

    <section class="bill-grid">
      <div class="bill-card today">
        <div class="bill-head">
          <h3>今日账单</h3>
          <span>{{ today }}</span>
        </div>
        <div class="bill-row">
          <span>今日已赚</span>
          <strong class="income">+¥{{ money(earnedToday) }}</strong>
        </div>
        <div class="bill-row">
          <span>今日已花</span>
          <strong class="expense">-¥{{ money(spentToday) }}</strong>
        </div>
        <div class="bill-row total">
          <span>今日结余</span>
          <strong :class="earnedToday - spentToday < 0 ? 'expense' : 'income'">
            {{ earnedToday - spentToday < 0 ? '-' : '' }}¥{{ money(Math.abs(earnedToday - spentToday)) }}
          </strong>
        </div>
        <div class="bill-progress">
          <div
            class="bill-progress-fill"
            :style="{ width: Math.min(100, (spentToday / Math.max(earnedToday, 1)) * 100) + '%' }"
          ></div>
        </div>
        <p class="bill-tip">
          {{ earnedToday > 0
            ? `已花掉今日收益的 ${((spentToday / earnedToday) * 100).toFixed(1)}%`
            : (spentToday > 0 ? '今日尚未产生收益，支出已计入结余' : '今天还没有支出') }}
        </p>
      </div>

      <div class="bill-card">
        <div class="bill-head">
          <h3>月账单</h3>
          <div class="month-switch">
            <button class="ghost-button" @click="monthOffset -= 1">‹</button>
            <strong>{{ monthLabel }}</strong>
            <button class="ghost-button" @click="monthOffset += 1">›</button>
          </div>
        </div>
        <div class="bill-row">
          <span>本月收入</span>
          <strong class="income">+¥{{ money(monthStats.earned) }}</strong>
        </div>
        <div class="bill-row">
          <span>本月支出</span>
          <strong class="expense">-¥{{ money(monthStats.spent) }}</strong>
        </div>
        <div class="bill-row total">
          <span>本月结余</span>
          <strong :class="monthStats.net < 0 ? 'expense' : 'income'">
            {{ monthStats.net < 0 ? '-' : '' }}¥{{ money(Math.abs(monthStats.net)) }}
          </strong>
        </div>
        <div class="bill-progress">
          <div
            class="bill-progress-fill"
            :style="{ width: Math.min(100, (monthStats.spent / Math.max(monthStats.earned, 1)) * 100) + '%' }"
          ></div>
        </div>
        <p class="bill-tip">
          本月工作日 {{ monthStats.workDays }} 天 ·
          {{ monthStats.earned > 0
            ? `支出占比 ${((monthStats.spent / monthStats.earned) * 100).toFixed(1)}%`
            : '本月暂无收入记录' }}
        </p>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>{{ monthLabel }}支出明细</h2>
          <p>共 {{ monthExpenses.length }} 笔，合计 ¥{{ money(monthStats.spent) }}</p>
        </div>
        <div v-if="todayExpenses.length" class="today-tag">今日 {{ todayExpenses.length }} 笔</div>
      </div>

      <div v-if="monthExpenses.length === 0" class="empty">
        <div class="empty-icon">▤</div>
        <p>这个月还没有支出记录</p>
      </div>

      <div v-else class="expense-list">
        <div v-for="item in monthExpenses" :key="item.id" class="expense-row">
          <div class="expense-cat">{{ item.category }}</div>
          <div class="expense-detail">
            <strong>{{ item.note || item.category }}</strong>
            <span>{{ item.date }}</span>
          </div>
          <div class="expense-amount">-¥{{ money(item.amount) }}</div>
          <button class="delete-button" title="删除" @click="remove(item.id)">×</button>
        </div>
      </div>
    </section>
  </div>
</template>
