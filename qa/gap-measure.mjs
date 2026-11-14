// Measure last-item phase geometry + background coverage.
//   node qa/gap-measure.mjs --target=ref  --w=1440 --h=900 [--step=2]
//   node qa/gap-measure.mjs --target=mine --w=1920 --h=1080 [--step=1]
// Outputs:
//   qa/gap-reference.json -> per-frame geometry + bg scan (ref)
//   qa/gap-mine.json     -> per-1% geometry + gap runs (mine)
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'

const argv = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/)
    return m ? [m[1], m[2]] : [a, true]
  })
)
const TARGET = argv.target || 'mine'
const W = Number(argv.w || 1920)
const H = Number(argv.h || 1080)
const STEP = Number(argv.step || (TARGET === 'ref' ? 2 : 1))
const PORT = TARGET === 'ref' ? 9224 : 9225
const URL = TARGET === 'ref' ? 'https://normalisboring.es/' : 'http://127.0.0.1:5173/?debug=1'
const OUT = 'C:\\Users\\DK\\Desktop\\interior design\\qa'
const FILE = TARGET === 'ref' ? OUT + '\\gap-reference.json' : OUT + '\\gap-mine.json'
mkdirSync(OUT, { recursive: true })

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const prof = 'C:\\Users\\DK\\AppData\\Local\\Temp\\opencode\\chrome-gap-' + TARGET + '-' + Date.now()

const chrome = spawn(chromePath, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${prof}`,
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  `--window-size=${W},${H}`,
  '--hide-scrollbars',
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function evalJS(send, expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) {
    const txt = r.exceptionDetails.exception ? r.exceptionDetails.exception.description || r.exceptionDetails.exception.value : r.exceptionDetails.text
    throw new Error(String(txt))
  }
  return r.result.value
}

const { ws, send } = await connect()
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false })

const GEOM = `
(() => {
  const out = {}
  const R = (v) => Math.round(v * 100) / 100
  const rect = (el) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { l: R(r.left), r: R(r.right), t: R(r.top), b: R(r.bottom), w: R(r.width), h: R(r.height) }
  }
  const items = Array.from(document.querySelectorAll('.mod-scroll__projects__item'))
  const p04 = items[3]
  const last = document.querySelector('.mod-scroll__projects__item.last-item') || items[4]
  const car = last ? last.querySelector('.last-item__carousel') : null
  const content = last ? last.querySelector('.last-item__content') : null
  const wrap = last ? last.querySelector('.last-item__content__wrap') : null
  out.p04 = rect(p04)
  out.last = rect(last)
  out.carousel = rect(car)
  out.carItems = car ? Array.from(car.querySelectorAll('.last-item__carousel__item')).map(rect) : []
  out.content = rect(content)
  out.contentWrap = rect(wrap)
  out.iw = window.innerWidth
  out.sy = window.scrollY
  // effective background color at (x,y): walk up until non-transparent
  const bgAt = (x, y) => {
    let el = document.elementFromPoint(x, y)
    let depth = 0
    while (el && depth < 12) {
      const bg = getComputedStyle(el).backgroundColor
      if (bg && bg !== 'rgba(0, 0, 0, 0)') {
        return { color: bg, cls: String(el.className || el.tagName), depth }
      }
      el = el.parentElement
      depth++
    }
    return { color: 'none', cls: 'none', depth: -1 }
  }
  // scan the middle band of the viewport from x=0..iw
  const bandY = window.innerHeight / 2
  const hits = []
  const seen = new Set()
  for (let x = 0; x <= window.innerWidth; x += 2) {
    const b = bgAt(x, bandY)
    hits.push({ x, color: b.color, cls: b.cls })
    const key = b.color + '|' + b.cls
    if (!seen.has(key)) { seen.add(key); hits.push({ x, color: b.color, cls: b.cls, first: true }) }
  }
  out.band = hits
  out.bandY = bandY
  return JSON.stringify(out)
})()
`

async function readFrame(send) {
  for (let k = 0; k < 4; k++) {
    try {
      return JSON.parse(await evalJS(send, GEOM))
    } catch (e) {
      await sleep(250)
    }
  }
  return null
}

async function discoverPinRange(send) {
  if (TARGET === 'mine') {
    const v = await evalJS(send, `
(() => {
  const w = document.querySelector('.mod-scroll-wrap')
  if (!w) return null
  const r = w.getBoundingClientRect()
  const top = r.top + window.scrollY
  return JSON.stringify({ start: top, end: top + (w.offsetHeight - window.innerHeight) })
})()
`)
    return v ? JSON.parse(v) : null
  }
  // reference: the .mod-scroll section is pinned; the horizontal track is
  // the .mod-scroll__projects (or the flex children) — find the scroll range
  // during which the track translates.
  const scan = await evalJS(send, `
(async () => {
  const sc = document.querySelector('.mod-scroll')
  if (!sc) return null
  const track = document.querySelector('.mod-scroll__projects') || sc.firstElementChild
  const docH = document.documentElement.scrollHeight - window.innerHeight
  let started = -1, ended = -1, lastX = -1, stable = 0
  for (let y = 0; y <= docH; y += 80) {
    window.scrollTo(0, y)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const m = new DOMMatrix(getComputedStyle(track).transform)
    const x = m.e
    if (started < 0 && x < -0.5) started = y
    if (started >= 0) {
      if (Math.abs(x - lastX) < 0.5) stable++
      else stable = 0
      if (stable > 6) { ended = y; break }
      lastX = x
    }
  }
  if (started < 0) return null
  if (ended < 0) ended = docH
  return { start: started, end: ended }
})()
`)
  return scan
}

await send('Page.navigate', { url: URL })
let ready = false
for (let attempt = 0; attempt < 8 && !ready; attempt++) {
  await sleep(TARGET === 'ref' ? 14000 : 3000)
  ready = await evalJS(send, TARGET === 'ref' ? `!!document.querySelector('.mod-scroll') && typeof ScrollTrigger !== 'undefined'` : `!!document.querySelector('.mod-scroll')`).catch(() => false)
  if (!ready && TARGET === 'ref') {
    await send('Page.reload', { ignoreCache: true })
    await sleep(8000)
  }
}
if (!ready) {
  console.log('FATAL: page not ready')
  ws.close(); chrome.kill(); process.exit(1)
}
if (TARGET === 'ref') {
  await evalJS(send, `(() => { const b = document.querySelector('.cky-btn-accept, .cky-btn-reject'); if (b) b.click(); })()`).catch(() => {})
  await sleep(1200)
}
if (TARGET === 'mine') {
  for (let i = 0; i < 120; i++) {
    const ok = await evalJS(send, `(() => {
      const pre = document.querySelector('.preloader')
      const gone = !pre || getComputedStyle(pre).display === 'none'
      return gone && !!window.__M_FD__ && document.fonts.status === 'loaded'
    })()`).catch(() => false)
    if (ok) break
    await sleep(500)
  }
  // fully stabilize layout (lazy images change trackW -> finalDist) by doing
  // a slow trip through the whole pinned range before measuring
  const r0 = await discoverPinRange(send)
  if (r0) {
    await evalJS(send, `window.scrollTo(0, ${Math.round(r0.end)})`)
    await sleep(1500)
    await evalJS(send, `window.scrollTo(0, ${Math.round(r0.start)})`)
    await sleep(1500)
    // wait for all imgs in the section to be complete
    await evalJS(send, `document.querySelectorAll('.mod-scroll img').forEach(i => { if (i.loading === 'lazy') i.loading = 'eager' })`).catch(() => {})
    await sleep(2500)
  }
}

async function rangeNow(send) {
  if (TARGET === 'ref') return range
  const v = await evalJS(send, `
(() => {
  const w = document.querySelector('.mod-scroll-wrap')
  if (!w) return null
  const r = w.getBoundingClientRect()
  const top = r.top + window.scrollY
  return JSON.stringify({ start: top, end: top + (w.offsetHeight - window.innerHeight) })
})()
`).catch(() => null)
  return v ? JSON.parse(v) : range
}

const range = await discoverPinRange(send)
if (!range || !Number.isFinite(range.start) || !Number.isFinite(range.end)) {
  console.log('FATAL: no pin range')
  ws.close(); chrome.kill(); process.exit(1)
}
console.log('PIN RANGE', JSON.stringify(range), 'dist', Math.round(range.end - range.start))

async function settleF(send, f) {
  const rng = await rangeNow(send)
  const y = Math.round(rng.start + f * (rng.end - rng.start))
  await evalJS(send, `
(() => {
  const L = window.__lenis
  if (L) L.stop()
  window.scrollTo(0, ${y})
  if (window.__ST__ && typeof window.__ST__.update === 'function') window.__ST__.update()
})()
`)
  if (TARGET === 'mine') {
    for (let k = 0; k < 18; k++) {
      await sleep(110)
      const p = await evalJS(send, `(() => { const s = window.__SCROLL_P__(); return s ? s.p : null })()`).catch(() => null)
      if (p === null) continue
      if (k > 1 && Math.abs(p - f) < 0.004) break
    }
    await sleep(60)
  } else {
    await sleep(260)
  }
}

const frames = []
for (let f = 0; f <= 100; f += STEP) {
  await settleF(send, f)
  const frame = await readFrame(send)
  if (!frame) continue
  frame.f = f
  frames.push(frame)
  const g = frame.band ? frame.band.filter((h) => h.color === 'rgb(33, 26, 25)') : []
  const gapRun = g.length ? (g[g.length - 1].x - g[0].x) : 0
  console.log(
    `f=${String(f).padStart(3, ' ')} p04=${frame.p04 ? frame.p04.r : '?'} last=${frame.last ? frame.last.l + '/' + frame.last.r : '?'} ` +
    `car=${frame.carousel ? frame.carousel.l + '/' + frame.carousel.r : '?'} content=${frame.content ? frame.content.l + '/' + frame.content.r : '?'} inkGap=${gapRun}`
  )
}

writeFileSync(FILE, JSON.stringify({ target: TARGET, w: W, h: H, step: STEP, range, frames }, null, 1))
console.log('saved', FILE, frames.length, 'frames')
ws.close()
chrome.kill()
