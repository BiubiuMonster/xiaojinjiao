<script setup>
import { computed, ref } from 'vue'
import { now } from '../lib/clock.js'
import { store, addWish, removeWish } from '../lib/store.js'
import { money, dayEarnings, getMonthStats } from '../lib/calculator.js'
import { formatDate } from '../lib/holidays.js'

const name = ref('')
const price = ref('')

const today = computed(() => formatDate(new Date(now.value)))
const currentDate = computed(() => new Date(now.value))
const earnedToday = computed(() =>
  dayEarnings(today.value, store.sessions[today.value] || [], store.settings, now.value)
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

const items = computed(() =>
  store.wishlist
    .slice()
    .sort((a, b) => a.price - b.price)
    .map((item) => {
      const fragment = earnedToday.value / Math.max(item.price, 1)
      const monthFragment = monthStats.value.earned / Math.max(item.price, 1)
      return {
        ...item,
        fragment,
        percent: Math.min(100, fragment * 100),
        monthFragment,
        remain: Math.max(0, item.price - earnedToday.value)
      }
    })
)

function submit() {
  if (!name.value.trim() || !(Number(price.value) > 0)) return
  addWish({ name: name.value.trim(), price: price.value })
  name.value = ''
  price.value = ''
}
</script>

<template>
  <div class="view wishlist">
    <section class="wish-top">
      <div class="wish-top-item">
        <span>今日已赚</span>
        <strong>¥{{ money(earnedToday) }}</strong>
      </div>
      <div class="wish-top-item">
        <span>本月已赚</span>
        <strong>¥{{ money(monthStats.earned) }}</strong>
      </div>
      <div class="wish-top-item">
        <span>愿望数量</span>
        <strong>{{ items.length }} <small>件</small></strong>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>添加想买的东西</h2>
          <p>把价格填进去，看看今天赚的钱能换多少个它</p>
        </div>
      </div>
      <div class="wish-form">
        <input v-model="name" placeholder="例如：30万的车" @keyup.enter="submit" />
        <input v-model.number="price" type="number" min="1" placeholder="价格 ¥" @keyup.enter="submit" />
        <button class="primary-button" :disabled="!name.trim() || !(Number(price) > 0)" @click="submit">
          添加愿望
        </button>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>我的愿望</h2>
          <p>碎片 = 当日收益 ÷ 商品价格，攒够 1 个就等于赚回一件</p>
        </div>
      </div>

      <div v-if="items.length === 0" class="empty">
        <div class="empty-icon">◇</div>
        <p>愿望清单还是空的，先添加一个吧</p>
      </div>

      <div v-else class="wish-list">
        <div v-for="item in items" :key="item.id" class="wish-card">
          <div class="wish-card-main">
            <div>
              <div class="wish-name">{{ item.name }}</div>
              <div class="wish-price">目标 ¥{{ money(item.price, 0) }}</div>
            </div>
            <button class="delete-button" title="删除" @click="removeWish(item.id)">×</button>
          </div>

          <div class="wish-numbers">
            <div>
              <span>今日可得</span>
              <strong class="accent">{{ item.fragment.toFixed(4) }}<small> 个</small></strong>
            </div>
            <div>
              <span>本月可得</span>
              <strong>{{ item.monthFragment.toFixed(3) }}<small> 个</small></strong>
            </div>
            <div>
              <span>今日进度</span>
              <strong>{{ item.percent.toFixed(2) }}<small>%</small></strong>
            </div>
          </div>

          <div class="wish-bar">
            <div class="wish-bar-fill" :style="{ width: item.percent + '%' }"></div>
          </div>
          <div class="wish-foot">今天还差 ¥{{ money(item.remain) }} 才能赚回一个</div>
        </div>
      </div>
    </section>
  </div>
</template>
