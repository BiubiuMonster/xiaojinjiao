import { createApp } from 'vue'
import App from './App.vue'
import WidgetView from './components/WidgetView.vue'
import PunchView from './components/PunchView.vue'
import './styles.css'

const mode = new URLSearchParams(window.location.search).get('mode')
document.documentElement.classList.add(`${mode || 'main'}-html`)
document.body.classList.add(`${mode || 'main'}-mode`)

const views = {
  widget: WidgetView,
  punch: PunchView,
  main: App
}

createApp(views[mode] || App).mount('#app')
