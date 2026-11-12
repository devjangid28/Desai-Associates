// Probe: reads ANIMATED states across scroll progress on the local build.
// Uses CDP directly (no test framework).
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const PORT = 9223
const SRC = 'http://127.0.0.1:5173/?debug=1'
const OUT = 'C:\\Users\\DK\\AppData\\Local\\Temp\\opencode\\probe'

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const prof = 'C:\\Users\\DK\\AppData\\Local\\Temp\\opencode\\chrome-probe'

import { once } from 'node:events'

const chrome = spawn(chromePath, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${prof}`,
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--window-size=1440,900',
  'about:blank',
], { stdio: 'ignore' })

await new Promise((r) => setTimeout(r, 2500))

async function connect() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
  const t = list.find((x) => x.type === 'page')
  const ws = new WebSocket(t.webSocketDebuggerUrl)
  let id = 0
  const pending = new Map()
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const mid = ++id
      pending.set(mid, { resolve, reject })
      ws.send(JSON.stringify({ id: mid, method, params }))
    })
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(JSON.stringify(msg.error)))
      else resolve(msg.result)
    }
  }
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  return { ws, send }
}

const { ws, send } = await connect()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function evalJS(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true })
  if (r.exceptionDetails) {
    const desc = r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text
    throw new Error(desc + ' :: ' + expression.slice(0, 120))
  }
  return r.result.value
}

await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: SRC })
await sleep(12000)
for (let i = 0; i < 40; i++) {
  const ready = await evalJS(`!!window.__M_FD__ && document.fonts.status === 'loaded'`)
  if (ready) break
  await sleep(500)
}

const range = JSON.parse(await evalJS(`
(() => {
  const w = document.querySelector('.mod-scroll-wrap')
  const r = w.getBoundingClientRect()
  const top = r.top + window.scrollY
  const vh = window.innerHeight
  return JSON.stringify({ start: top, end: top + (w.offsetHeight - vh), dist: w.offsetHeight - vh })
})()
`))
console.log('RANGE', JSON.stringify(range))

const STATE = `
(() => {
  const s = {}
  const terms = Array.from(document.querySelectorAll('.mod-scroll__terms__term'))
  s.terms = terms.map((t) => ({ pl: t.style.paddingLeft, pr: t.style.paddingRight }))
  s.titleColors = terms.map((t) => {
    const c = t.querySelector('.mod-scroll__terms__term__title__color')
    return c ? getComputedStyle(c).color : null
  })
  s.followOp = document.querySelector('.mod-scroll__terms .follow__mouse') ? getComputedStyle(document.querySelector('.mod-scroll__terms .follow__mouse')).opacity : null
  s.followClasses = Array.from(document.querySelectorAll('.mod-scroll__terms .follow__mouse > img')).map((i) => i.className)
  s.followX = (() => { const f = document.querySelector('.mod-scroll__terms .follow__mouse'); if (!f) return null; try { return new DOMMatrix(getComputedStyle(f).transform).e } catch { return null } })()
  const items = Array.from(document.querySelectorAll('.mod-scroll__projects__item:not(.last-item)'))
  s.items = items.map((it) => ({
    w: it.style.width,
    imgH: it.querySelector('.media__source') ? it.querySelector('.media__source').style.height : null,
    btnOp: it.querySelector('a.btn') ? getComputedStyle(it.querySelector('a.btn')).opacity : null,
    char0: it.querySelector('.mod-scroll__projects__item__text__title > div') ? it.querySelector('.mod-scroll__projects__item__text__title > div').style.transform : null,
  }))
  s.intro = Array.from(document.querySelectorAll('.mod-scroll__projects__text span')).map((x) => x.style.transform)
  s.introLabel = (() => { const l = document.querySelector('.mod-scroll__projects__section'); return l ? l.style.transform : null })()
  const last = document.querySelector('.last-item')
  if (last) {
    s.last = {
      w: last.style.width,
      car: (last.querySelector('.last-item__carousel') || { style: {} }).style.transform,
      contentT: (last.querySelector('.last-item__content') || { style: {} }).style.transform,
      contentW: (last.querySelector('.last-item__content') || { style: {} }).style.width,
      itemsH: Array.from(last.querySelectorAll('.last-item__carousel__item:not(.last-item__carousel__item--link)')).map((e) => e.style.height),
      section: (last.querySelector('.last-item__content__section') || { style: {} }).style.transform,
      chars: Array.from(last.querySelectorAll('.last-item__content__title .char')).slice(0, 3).map((e) => e.style.transform),
    }
  }
  const ci = document.querySelector('.mod-scroll__cierre')
  if (ci) {
    s.cierre = {
      w: ci.style.width,
      contentT: ci.querySelector('.mod-scroll__cierre__content').style.transform,
      imgs: Array.from(ci.querySelectorAll('.mod-scroll__cierre__content__image .flipMedia__media')).map((e) => e.style.transform),
      mediaSrcY: Array.from(ci.querySelectorAll('.mod-scroll__cierre__content__image .media__source')).map((e) => e.style.transform),
    }
  }
  s.scrollY = window.scrollY
  return JSON.stringify(s)
})()
`

const lines = []
for (let i = 0; i <= 10; i++) {
  const f = i / 10
  const y = Math.round(range.start + f * (range.end - range.start))
  await evalJS(`window.scrollTo(0, ${y})`)
  await sleep(450)
  const st = JSON.parse(await evalJS(STATE))
  lines.push(`--- progress ${f} ---`)
  lines.push(JSON.stringify(st))
}
writeFileSync(OUT + '.json', lines.join('\n'))
console.log(lines.join('\n'))

ws.close()
chrome.kill()
