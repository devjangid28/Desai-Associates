// Animation-state + hover verification for ScrollSection (panels 1-4).
// Usage: node qa/anim-test.mjs [url]
import { spawn } from 'node:child_process'

const PORT = 9334
const SRC = process.argv[2] || 'http://127.0.0.1:5175/?debug=1'

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const prof = 'C:\\Users\\DK\\AppData\\Local\\Temp\\opencode\\chrome-anim-' + Date.now()
const chrome = spawn(chromePath, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${prof}`,
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--window-size=1440,900',
  '--hide-scrollbars',
  'about:blank',
], { stdio: 'ignore' })
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

async function gotoF(f) {
  const r = await evalJS(`
  (() => {
    const w = document.querySelector('.mod-scroll-wrap')
    const rect = w.getBoundingClientRect()
    const top = rect.top + window.scrollY
    return { top, end: top + w.offsetHeight - window.innerHeight }
  })()
  `)
  const y = Math.round(r.top + f * (r.end - r.top))
  await evalJS(`(() => { const L = window.__lenis; if (L) { try { L.stop() } catch(e){} }; window.scrollTo(0, ${y}); })()`)
  await sleep(700)
  return y
}

console.log('=== STATE TABLE (progress 0..100%) ===')
for (const f of [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.75, 1]) {
  await gotoF(f)
  const s = await evalJS(`
  (() => {
    const items = Array.from(document.querySelectorAll('.mod-scroll__projects__item'))
    const terms = Array.from(document.querySelectorAll('.mod-scroll__terms__term'))
    const firstChars = Array.from(document.querySelectorAll('.mod-scroll__projects__item__text__title .char')).slice(0, 3)
    return {
      p: (window.__SCROLL_P__ ? window.__SCROLL_P__().p : -1).toFixed(3),
      terms: terms.map((t) => [parseFloat(getComputedStyle(t).paddingLeft).toFixed(1), parseFloat(getComputedStyle(t).paddingRight).toFixed(1)]),
      itemW: items.slice(0, 4).map((e) => Math.round(e.getBoundingClientRect().width)),
      imgH: items.slice(0, 4).map((e) => Math.round(e.querySelector('.media__source')?.getBoundingClientRect().height || 0)),
      btnOp: items.slice(0, 4).map((e) => parseFloat(getComputedStyle(e.querySelector('a.btn')).opacity).toFixed(2)),
      charY: firstChars.map((e) => Math.round(new DOMMatrix(getComputedStyle(e).transform).f)),
      introY: Array.from(document.querySelectorAll('.mod-scroll__projects__text span')).map((e) => Math.round(new DOMMatrix(getComputedStyle(e).transform).f)),
      followOp: parseFloat(getComputedStyle(document.querySelector('.follow__mouse')).opacity).toFixed(2),
    }
  })()
  `)
  console.log(`f=${f}`, JSON.stringify(s))
}

console.log('=== HOVER TERMS (real CDP mouse) ===')
await gotoF(0.05)
const termsBox = await evalJS(`
(() => {
  const t = document.querySelector('.mod-scroll__terms')
  const r = t.getBoundingClientRect()
  const terms = Array.from(t.querySelectorAll('.mod-scroll__terms__term')).map((el) => {
    const rr = el.getBoundingClientRect()
    return { top: rr.top, bottom: rr.bottom }
  })
  return { left: r.left, right: r.right, top: r.top, terms }
})()
`)
const t2 = termsBox.terms[1]
const mx = Math.round(Math.min(termsBox.right - 100, Math.max(50, (termsBox.left + termsBox.right) / 2)))
const my = Math.round((t2.top + t2.bottom) / 2)
async function mouseMove(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
}
async function mouseOut() {
  const outX = Math.min(1439, Math.round(termsBox.right + 200))
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: outX, y: 300 })
}

await mouseMove(mx, my)
await sleep(800)
let hover = await evalJS(`
(() => {
  const f = document.querySelector('.follow__mouse')
  const imgs = Array.from(f.querySelectorAll('img'))
  return {
    op: parseFloat(getComputedStyle(f).opacity).toFixed(2),
    on: imgs.findIndex((i) => i.classList.contains('on')),
    prev: imgs.findIndex((i) => i.classList.contains('prev')),
    x: Math.round(new DOMMatrix(getComputedStyle(f).transform).e),
    y: Math.round(new DOMMatrix(getComputedStyle(f).transform).f),
    cursorX: ${mx}, cursorY: ${my},
  }
})()
`)
console.log('over term 2:', JSON.stringify(hover))
await mouseOut()
await sleep(700)
hover = await evalJS(`(() => {
  const f = document.querySelector('.follow__mouse')
  return { op: parseFloat(getComputedStyle(f).opacity).toFixed(2) }
})()`)
console.log('after leave:', JSON.stringify(hover))

console.log('=== HOVER BUTTON (panel 1) ===')
let btnBox = null
for (const f of [0.4, 0.45, 0.5, 0.55, 0.6]) {
  await gotoF(f)
  btnBox = await evalJS(`
(() => {
  const b = document.querySelector('.mod-scroll__projects__item a.btn:not(.disabled)')
  const r = b.getBoundingClientRect()
  if (r.left < 0 || r.left > 1400 || r.top < 0 || r.top > 880) return null
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
})()
`)
  if (btnBox) break
}
console.log('btn at', JSON.stringify(btnBox))
await mouseMove(btnBox.x, btnBox.y)
await sleep(500)
let btnHover = await evalJS(`
(() => {
  const b = document.querySelector('.mod-scroll__projects__item a.btn:not(.disabled)')
  const spans = b.querySelectorAll('.btn--label > span')
  return {
    cls: b.className,
    first: new DOMMatrix(getComputedStyle(spans[0]).transform).f.toFixed(1),
    second: new DOMMatrix(getComputedStyle(spans[1]).transform).f.toFixed(1),
    bg: getComputedStyle(b).backgroundColor,
  }
})()
`)
console.log('btn over:', JSON.stringify(btnHover))
await mouseOut()
await sleep(500)
btnHover = await evalJS(`
(() => {
  const b = document.querySelector('.mod-scroll__projects__item a.btn:not(.disabled)')
  const spans = b.querySelectorAll('.btn--label > span')
  return {
    first: new DOMMatrix(getComputedStyle(spans[0]).transform).f.toFixed(1),
    second: new DOMMatrix(getComputedStyle(spans[1]).transform).f.toFixed(1),
  }
})()
`)
console.log('btn out:', JSON.stringify(btnHover))

console.log('=== REVERSE TEST (0 -> 50% -> 0) ===')
await gotoF(0.5)
const mid = await evalJS(`(() => ({
  w: Math.round(document.querySelectorAll('.mod-scroll__projects__item')[0].getBoundingClientRect().width)
}))()`)
await gotoF(0)
const back = await evalJS(`(() => {
  const items = Array.from(document.querySelectorAll('.mod-scroll__projects__item'))
  return {
    w: Math.round(items[0].getBoundingClientRect().width),
    termPads: Array.from(document.querySelectorAll('.mod-scroll__terms__term')).map((t) => [parseFloat(getComputedStyle(t).paddingLeft).toFixed(1), parseFloat(getComputedStyle(t).paddingRight).toFixed(1)]),
    introY: Math.round(new DOMMatrix(getComputedStyle(document.querySelector('.mod-scroll__projects__text span')).transform).f),
    btnOp: parseFloat(getComputedStyle(document.querySelector('.mod-scroll__projects__item a.btn')).opacity).toFixed(2),
  }
})()`)
console.log('at 50%:', JSON.stringify(mid))
console.log('back at 0%:', JSON.stringify(back))

ws.close()
chrome.kill()
