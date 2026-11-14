// Investigate why animations don't run in the real browser.
// Usage: node qa/investigate.mjs [url]
import { spawn } from 'node:child_process'

const PORT = 9333
const SRC = process.argv[2] || 'http://127.0.0.1:5175/?debug=1'

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const prof = 'C:\\Users\\DK\\AppData\\Local\\Temp\\opencode\\chrome-inv-' + Date.now()
const chrome = spawn(
  chromePath,
  [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${prof}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,900',
    '--hide-scrollbars',
    'about:blank',
  ],
  { stdio: 'ignore' },
)
chrome.on('exit', (c) => console.log('[chrome exit]', c))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function connect() {
  let list = null
  for (let i = 0; i < 40; i++) {
    try {
      list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      if (list.length) break
    } catch {}
    await sleep(400)
  }
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
  await new Promise((res, rej) => {
    ws.onopen = res
    ws.onerror = rej
  })
  return { ws, send }
}

const { ws, send } = await connect()
await send('Page.enable')
await send('Runtime.enable')

async function evalJS(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) {
    const txt = r.exceptionDetails.exception
      ? r.exceptionDetails.exception.description || r.exceptionDetails.exception.value
      : r.exceptionDetails.text
    throw new Error(String(txt))
  }
  return r.result.value
}

await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `try { sessionStorage.setItem('hasVisited','true') } catch(e) {}`,
})
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: SRC })

for (let i = 0; i < 100; i++) {
  const ok = await evalJS(`!!document.querySelector('.mod-scroll') && !!window.__M_FD__`).catch(() => false)
  if (ok) break
  await sleep(300)
}
await sleep(1500)

const p = await evalJS(`
(() => {
  const g = (sel) => document.querySelector(sel)
  const n = (sel) => document.querySelectorAll(sel).length
  const all = window.__ST__ ? window.__ST__.getAll() : []
  return {
    stCount: all.length,
    st: all.map((t) => {
      let trig = null
      try { trig = t.trigger ? (t.trigger.className || '') : null } catch {}
      return {
        trig: String(trig).slice(0, 70),
        start: t.start, end: t.end,
        scrub: t.scrub && t.scrub.duration ? t.scrub.duration : t.scrub,
        hasContainer: !!t.containerAnimation,
        dur: t.animation && t.animation.duration ? t.animation.duration() : null,
        progress: t.progress,
        pin: !!t.pin,
      }
    }),
    fd: window.__FINAL_DIST__ ? window.__FINAL_DIST__() : null,
    trackTlDur: window.__TRACK_TL__ ? window.__TRACK_TL__.duration() : null,
    trackTlTime: window.__TRACK_TL__ ? window.__TRACK_TL__.time() : null,
    trackTlPaused: window.__TRACK_TL__ ? window.__TRACK_TL__.paused() : null,
    trackX: (() => {
      const sc = document.querySelector('.mod-scroll')
      return sc ? getComputedStyle(sc).transform : null
    })(),
    secX: (() => {
      const els = Array.from(document.querySelectorAll('.mod-scroll > div'))
      return els.map((e) => getComputedStyle(e).transform)
    })(),
    itemWidths: Array.from(document.querySelectorAll('.mod-scroll__projects__item')).map((e) => e.getBoundingClientRect().width),
    termPads: Array.from(document.querySelectorAll('.mod-scroll__terms__term')).map((e) => [e.style.paddingLeft, e.style.paddingRight]),
    introY: Array.from(document.querySelectorAll('.mod-scroll__projects__text span')).map((e) => e.style.transform || getComputedStyle(e).transform),
    p: window.__SCROLL_P__ ? window.__SCROLL_P__() : null,
    wrapH: document.querySelector('.mod-scroll-wrap')?.offsetHeight,
    sy: window.scrollY,
    lenis: !!window.__lenis,
    follow: (() => { const f = document.querySelector('.follow__mouse'); return f ? { op: getComputedStyle(f).opacity, pe: getComputedStyle(f).pointerEvents, tr: getComputedStyle(f).transform } : null })(),
    gsapScrollTriggered: Array.from(document.querySelectorAll('.mod-scroll__projects__item')).map((e) => ({ w: getComputedStyle(e).width, op: getComputedStyle(e).opacity })),
  }
})()
`)
console.log(JSON.stringify(p, null, 2))

// now scroll to 20%, 50%, 100%
const r = await evalJS(`
(() => {
  const w = document.querySelector('.mod-scroll-wrap')
  const rect = w.getBoundingClientRect()
  const top = rect.top + window.scrollY
  return { top, h: w.offsetHeight, ih: window.innerHeight, end: top + w.offsetHeight - window.innerHeight }
})()
`)
console.log('range', r)
for (const f of [0, 0.1, 0.25, 0.5, 0.75, 1]) {
  const y = Math.round(r.top + f * (r.end - r.top))
  await evalJS(`(() => { const L = window.__lenis; if (L) { try { L.stop() } catch(e){} }; window.scrollTo(0, ${y}); })()`)
  await sleep(600)
  const s = await evalJS(`
(() => {
  const sc = document.querySelector('.mod-scroll')
  const items = Array.from(document.querySelectorAll('.mod-scroll__projects__item'))
  const terms = Array.from(document.querySelectorAll('.mod-scroll__terms__term'))
  return {
    sy: Math.round(window.scrollY),
    p: window.__SCROLL_P__ ? window.__SCROLL_P__().p : null,
    trackTlTime: window.__TRACK_TL__ ? window.__TRACK_TL__.time() : null,
    trackX: Array.from(document.querySelectorAll('.mod-scroll > div')).map((e) => new DOMMatrix(getComputedStyle(e).transform).e),
    terms: terms.map((t) => [parseFloat(getComputedStyle(t).paddingLeft), parseFloat(getComputedStyle(t).paddingRight)]),
    titleColors: terms.map((t) => getComputedStyle(t.querySelector('.mod-scroll__terms__term__title__color')).color),
    itemW: items.map((e) => Math.round(e.getBoundingClientRect().width)),
    itemOp: items.map((e) => getComputedStyle(e).opacity),
    imgH: items.map((e) => Math.round(e.querySelector('.media__source')?.getBoundingClientRect().height || 0)),
    intro: Array.from(document.querySelectorAll('.mod-scroll__projects__text span')).map((e) => new DOMMatrix(getComputedStyle(e).transform).f),
    btn: Array.from(document.querySelectorAll('.mod-scroll__projects__item a.btn')).map((e) => getComputedStyle(e).opacity),
    chars: Array.from(document.querySelectorAll('.mod-scroll__projects__item__text__title .char')).slice(0, 3).map((e) => new DOMMatrix(getComputedStyle(e).transform).f),
    car: (() => { const c = document.querySelector('.last-item__carousel'); return c ? new DOMMatrix(getComputedStyle(c).transform).f : null })(),
  }
})()
`)
  console.log(`f=${f}`, JSON.stringify(s))
}

ws.close()
chrome.kill()
