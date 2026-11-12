import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
const PORT = 9228
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=C:\\Users\\DK\\AppData\\Local\\Temp\\opencode\\chrome-refdbg',
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
  const r = await send('Runtime.evaluate', { expression, returnByValue: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text)
  return r.result.value
}
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: 'https://normalisboring.es/' })
await sleep(20000)
const diag = await evalJS(`JSON.stringify({ title: document.title, gsap: !!window.gsap, sc: !!document.querySelector('.mod-scroll'), terms: !!document.querySelector('.mod-scroll__terms'), lenis: !!window.__lenis, sm: !!document.querySelector('#smooth-wrapper'), body: document.body.innerText.slice(0, 300) })`)
console.log('DIAG', diag)

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
  return JSON.stringify({ started, ended, docH, lastX })
})()
`)
console.log('SCAN', scan)

const wheelSeries = []
await evalJS(`(() => { const b = document.querySelector('.cky-btn-accept, .cky-btn-reject'); if (b) b.click(); })()`).catch(() => {})
await sleep(1000)
for (let i = 0; i < 40; i++) {
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 720, y: 450, deltaX: 0, deltaY: -600 })
  await sleep(350)
  const x = await evalJS(`(() => { const m = new DOMMatrix(getComputedStyle(document.querySelector('.mod-scroll')).transform); return m.e })()`)
  wheelSeries.push(Math.round(x * 10) / 10)
}
console.log('WHEEL X SERIES', wheelSeries.join(','))
const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true })
writeFileSync('C:\\Users\\DK\\AppData\\Local\\Temp\\opencode\\ref-dbg.png', Buffer.from(shot.data, 'base64'))
console.log('shot saved')
ws.close()
chrome.kill()
