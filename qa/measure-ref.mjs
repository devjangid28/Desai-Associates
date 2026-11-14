// Measure the live reference https://normalisboring.es/ at 1440x900.
// Produces:
//   qa/reference-states.json  – animated states at 2% steps (0..100)
//   qa/reference-frames/qa_pNNN.png – screenshots
//   qa/reference-triggers.json – ScrollTrigger instance metadata (timings)
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'

const PORT = 9224
const URL = 'https://normalisboring.es/'
const OUT_BASE = 'C:\\Users\\DK\\Desktop\\interior design\\qa'
const FRAMES = OUT_BASE + '\\reference-frames'
mkdirSync(FRAMES, { recursive: true })

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const prof = 'C:\\Users\\DK\\AppData\\Local\\Temp\\opencode\\chrome-ref'

const chrome = spawn(chromePath, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${prof}`,
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--window-size=1440,900',
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

const { ws, send } = await connect()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function evalJS(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) {
    const txt = r.exceptionDetails.exception ? r.exceptionDetails.exception.description || r.exceptionDetails.exception.value : r.exceptionDetails.text
    throw new Error(String(txt))
  }
  return r.result.value
}

await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

// load with retries: the site can be slow / flaky
let loadedOk = false
for (let attempt = 0; attempt < 3 && !loadedOk; attempt++) {
  await send('Page.navigate', { url: URL })
  await sleep(15000)
  loadedOk = await evalJS(`typeof ScrollTrigger !== 'undefined' && !!document.querySelector('.mod-scroll')`).catch(() => false)
  if (!loadedOk && attempt < 2) {
    console.log('retry load', attempt + 1)
    await send('Page.reload', { ignoreCache: true })
    await sleep(12000)
  }
}

// dismiss cookie banner (does not affect the measured section)
await evalJS(`(() => { const b = document.querySelector('.cky-btn-accept, .cky-btn-reject'); if (b) b.click(); })()`).catch(() => {})
await sleep(1500)

// wait for the horizontal section triggers to exist
let trig = null
for (let i = 0; i < 90; i++) {
  trig = await evalJS(`
(() => {
  try {
    const all = ScrollTrigger.getAll()
    const arr = all.map((t, i) => {
      let o = {}
      try { o.trigger = t.trigger ? (t.trigger.className || t.trigger.id || String(t.trigger)) : null } catch (e) { o.trigger = '?trigger?' }
      try { o.start = t.start } catch (e) { o.start = null }
      try { o.end = t.end } catch (e) { o.end = null }
      try { o.scrollStart = t.scrollStart } catch (e) { o.scrollStart = null }
      try { o.scrollEnd = t.scrollEnd } catch (e) { o.scrollEnd = null }
      try { o.scrub = (t.scrub && t.scrub.duration) ? t.scrub.duration : t.scrub } catch (e) { o.scrub = null }
      try { o.animation = t.animation ? (t.animation.duration ? t.animation.duration() : 'tl') : null } catch (e) { o.animation = null }
      try { o.pin = !!t.pin } catch (e) { o.pin = null }
      return o
    })
    writeFileSync(OUT_BASE + '\\reference-triggers-all.json', JSON.stringify(arr, null, 1))
    return JSON.stringify(arr.filter((x) => x.trigger && String(x.trigger).includes('mod-scroll')))
  } catch (e) { return 'ERR:' + e.message }
})()
`)
  if (trig && !String(trig).startsWith('ERR') && JSON.parse(trig).length) break
  await sleep(700)
}

let triggers = []
try { triggers = JSON.parse(trig) } catch { triggers = [] }
console.log('TRIGGERS', JSON.stringify(triggers, null, 1))
writeFileSync(OUT_BASE + '\\reference-triggers.json', JSON.stringify(triggers, null, 1))

// find main horizontal trigger (pin on the .mod-scroll)
const main =
  triggers.find((t) => t.trigger && String(t.trigger).trim() === 'mod-scroll') ||
  triggers.find((t) => t.pin && t.scrollStart < t.scrollEnd && Number.isFinite(t.scrollStart))
let range = main ? { start: main.scrollStart, end: main.scrollEnd } : null
console.log('MAIN RANGE', JSON.stringify(range))

// fallback: scan the document to find where the track actually moves
if (!range || !Number.isFinite(range.start) || !Number.isFinite(range.end)) {
  console.log('no main trigger — scanning scroll range empirically')
  const scan = await evalJS(`
(async () => {
  const sc = document.querySelector('.mod-scroll')
  if (!sc) return null
  const docH = document.documentElement.scrollHeight - window.innerHeight
  let started = -1, ended = -1, lastX = -1, stable = 0
  for (let y = 0; y <= docH; y += 60) {
    window.scrollTo(0, y)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const m = new DOMMatrix(getComputedStyle(sc).transform)
    const x = m.e
    if (started < 0 && x < -0.5) started = y
    if (started >= 0) {
      if (Math.abs(x - lastX) < 0.5) stable++
      else stable = 0
      if (stable > 8) { ended = y; break }
      lastX = x
    }
  }
  if (started < 0) return null
  if (ended < 0) ended = docH
  return { start: started, end: ended }
})()
`)
  if (scan) range = scan
}
console.log('FINAL RANGE', JSON.stringify(range))
if (!range || !Number.isFinite(range.start) || !Number.isFinite(range.end) || range.end <= range.start) {
  console.log('FATAL: could not measure scroll range')
  ws.close(); chrome.kill(); process.exit(1)
}

const READ_STATE = `
(() => {
  const s = {}
  const $ = (q) => document.querySelector(q)
  const $$ = (q) => Array.from(document.querySelectorAll(q))
  const mx = (el) => { try { return new DOMMatrix(getComputedStyle(el).transform) } catch (e) { return null } }
  const mat = (el) => {
    const m = mx(el)
    if (!m) return null
    return { e: m.e, f: m.f, a: m.a, d: m.d, tx: m.e, ty: m.f }
  }
  const terms = $$('.mod-scroll__terms__term')
  s.terms = terms.map((t) => ({ pl: t.style.paddingLeft || '', pr: t.style.paddingRight || '' }))
  s.titleColor = terms.map((t) => { const c = t.querySelector('.mod-scroll__terms__term__title__color'); return c ? getComputedStyle(c).color : null })
  s.titleFilter = terms.map((t) => { const f = t.querySelector('.mod-scroll__terms__term__title__filter'); return f ? getComputedStyle(f).filter : null })
  const F = $('.mod-scroll__terms .follow__mouse')
  s.followOp = F ? Number(getComputedStyle(F).opacity) : null
  s.followM = F ? mat(F) : null
  s.followClasses = $$('.mod-scroll__terms .follow__mouse > img').map((i) => i.className)
  s.followClip = $$('.mod-scroll__terms .follow__mouse > img').map((i) => getComputedStyle(i).clipPath)
  s.followImgM = $$('.mod-scroll__terms .follow__mouse > img').map((i) => mat(i))
  s.introSpans = $$('.mod-scroll__projects__text span').map((x) => mat(x))
  s.introLabel = (() => { const l = $('.mod-scroll__projects__section'); return l ? mat(l) : null })()
  s.items = $$('.mod-scroll__projects__item:not(.last-item)').map((it) => ({
    w: Math.round(it.getBoundingClientRect().width * 100) / 100,
    imgH: it.querySelector('.media__source') ? Math.round(it.querySelector('.media__source').getBoundingClientRect().height * 100) / 100 : null,
    btnOp: it.querySelector('a.btn') ? Number(getComputedStyle(it.querySelector('a.btn')).opacity) : null,
    char0: (() => { const c = it.querySelector('.mod-scroll__projects__item__text__title [class*=char]'); return c ? mat(c) : null })(),
  }))
  const last = $('.mod-scroll__projects__item.last-item')
  if (last) {
    const car = last.querySelector('.last-item__carousel')
    const cont = last.querySelector('.last-item__content')
    s.last = {
      w: Math.round(last.getBoundingClientRect().width * 100) / 100,
      car: car ? mat(car) : null,
      content: cont ? mat(cont) : null,
      contentW: cont ? Math.round(cont.getBoundingClientRect().width * 100) / 100 : null,
      itemsH: Array.from(last.querySelectorAll('.last-item__carousel__item:not(.last-item__carousel__item--link)')).map((e) => Math.round(e.getBoundingClientRect().height * 100) / 100),
      section: (() => { const sec = last.querySelector('.last-item__content__section'); return sec ? mat(sec) : null })(),
      chars: Array.from(last.querySelectorAll('.last-item__content__title .char')).slice(0, 3).map((e) => mat(e)),
      textSpans: Array.from(last.querySelectorAll('.last-item__content__text span')).map((e) => mat(e)),
    }
  }
  const ci = $('.mod-scroll__cierre')
  if (ci) {
    const cont = ci.querySelector('.mod-scroll__cierre__content')
    s.cierre = {
      w: Math.round(ci.getBoundingClientRect().width * 100) / 100,
      content: cont ? mat(cont) : null,
      imgs: Array.from(ci.querySelectorAll('.mod-scroll__cierre__content__image .flipMedia__media')).map((e) => mat(e)),
      mediaSrcM: Array.from(ci.querySelectorAll('.mod-scroll__cierre__content__image .media__source')).map((e) => mat(e)),
    }
  }
  s.sy = window.scrollY
  s.iw = window.innerWidth
  return JSON.stringify(s)
})()
`

// warm up once at start so ScrollTrigger refresh settles
await evalJS(`window.scrollTo(0, ${Math.round(range.start)})`)
await sleep(1200)

const states = []
const step = 2
for (let f = 0; f <= 100; f += step) {
  const y = Math.round(range.start + (f / 100) * (range.end - range.start))
  await evalJS(`window.scrollTo(0, ${y})`)
  await sleep(300)
  let st = null
  for (let k = 0; k < 3; k++) {
    try { st = JSON.parse(await evalJS(READ_STATE)); break } catch (e) { await sleep(300) }
  }
  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true })
  const name = `qa_p${String(f).padStart(3, '0')}.png`
  writeFileSync(FRAMES + '\\' + name, Buffer.from(shot.data, 'base64'))
  states.push({ f, y, ...st })
  console.log(`f=${f} terms=${st ? st.terms.map((t) => t.pl || t.pr).join('/') : 'ERR'} lastW=${st && st.last ? st.last.w : '-'} cierre=${st && st.cierre ? st.cierre.content.tx : '-'} followOp=${st ? st.followOp : '-'}`)
}

writeFileSync(OUT_BASE + '\\reference-states.json', JSON.stringify(states, null, 1))
console.log('total frames', states.length)

// ---- per-element window-normalized sampling ----
// For each behavior we map MY build's own trigger window onto the reference's
// corresponding trigger window, so layout differences (extra sections on the
// reference site) don't desync the comparisons.
const WINDOWS = {
  wTerms: 'mod-scroll__terms',
  wIntro: 'mod-scroll__projects__text',
  wProj: 'mod-scroll__projects__item',
  wLast: 'mod-scroll__projects__item.last-item',
  wCierre: 'mod-scroll__cierre',
}
const winStates = {}
for (const [key, cls] of Object.entries(WINDOWS)) {
  const t = triggers.find((x) => x.trigger && String(x.trigger).includes(cls) && Number.isFinite(x.scrollStart))
  if (!t) { console.log('window', key, 'no trigger'); continue }
  const s = t.scrollStart
  const e = t.scrollEnd
  const arr = []
  for (let i = 0; i <= 10; i++) {
    const f = i / 10
    const y = Math.round(s + f * (e - s))
    await evalJS(`window.scrollTo(0, ${y})`)
    await sleep(250)
    let st = null
    for (let k = 0; k < 3; k++) {
      try { st = JSON.parse(await evalJS(READ_STATE)); break } catch (err) { await sleep(250) }
    }
    arr.push({ f, y, ...st })
  }
  winStates[key] = { triggerStart: s, triggerEnd: e, samples: arr }
  console.log('window', key, 'done', arr.length)
}
writeFileSync(OUT_BASE + '\\reference-window-states.json', JSON.stringify(winStates, null, 1))
console.log('window states saved')
ws.close()
chrome.kill()
