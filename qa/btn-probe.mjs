import { spawn } from 'node:child_process'
const PORT = 9230
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=C:\\Users\\DK\\AppData\\Local\\Temp\\opencode\\chrome-btnprobe',
  '--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const t = list.find((x) => x.type === 'page')
const ws = new WebSocket(t.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
const send = (method, params = {}) => new Promise((res, rej) => {
  const mid = ++id
  pending.set(mid, { res, rej })
  ws.send(JSON.stringify({ id: mid, method, params }))
})
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id)
    pending.delete(m.id)
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result)
  }
}
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function evalJS(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text)
  return r.result.value
}
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: 'http://127.0.0.1:5173/?debug=1' })
await sleep(14000)

// scroll to a panel reveal area
await evalJS(`window.scrollTo(0, 16500)`)
await sleep(900)
console.log('dispatch enter...')
await evalJS(`
(() => {
  const G = window.__GSAP__ || window.gsap
  const btn = document.querySelector('.mod-scroll__projects__item a.btn:not(.disabled)')
  if (!btn || !G) return 'none'
  const first = btn.querySelector('.btn--label > span:first-child')
  const second = btn.querySelector('.btn--label > span:last-child')
  G.killTweensOf(first)
  G.killTweensOf(second)
  G.set(first, { yPercent: 0 })
  G.set(second, { yPercent: 100 })
  btn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
  return 'ok'
})()
`)
await sleep(700)
const raw = await evalJS(`
(() => {
  const G = window.__GSAP__ || window.gsap
  const b = document.querySelector('.mod-scroll__projects__item a.btn:not(.disabled)')
  const first = b.querySelector('.btn--label > span:first-child')
  G.to(first, { yPercent: -100, duration: 0.4, ease: 'power3.inOut' })
  return 'raw tween started'
})()
`)
console.log(raw)
await sleep(1200)
const v = await evalJS(`
(() => {
  const b = document.querySelector('.mod-scroll__projects__item a.btn:not(.disabled)')
  const first = b.querySelector('.btn--label > span:first-child')
  const m1 = new DOMMatrix(getComputedStyle(first).transform)
  const r = first.getBoundingClientRect()
  const cs = getComputedStyle(first)
  return JSON.stringify({
    f: m1.f,
    inline: first.style.transform,
    h: r.height,
    fs: cs.fontSize,
    lh: cs.lineHeight,
    disp: cs.display,
    pos: cs.position,
    parentOf: b.querySelector('.btn--label') ? getComputedStyle(b.querySelector('.btn--label')).overflow : null,
    will: cs.willChange,
  })
})()
`)
console.log(`raw details=${v}`)
ws.close()
chrome.kill()
