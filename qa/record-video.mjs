// Records a ~5s screen capture (sequence of screenshots) while scrolling
// through the horizontal section, plus a hover interaction at the end.
// Usage: node qa/record-video.mjs <url> <outdir> [rangeStart] [rangeEnd]
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'

const URL = process.argv[2]
const OUT = process.argv[3]
const RANGE_START = Number(process.argv[4] || 0)
const RANGE_END = Number(process.argv[5] || 0)
mkdirSync(OUT, { recursive: true })

const PORT = 9229
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=C:\\Users\\DK\\AppData\\Local\\Temp\\opencode\\chrome-video',
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
await send('Page.navigate', { url: URL })
await sleep(15000)

// dismiss cookie banner if present (reference site)
await evalJS(`(() => { const b = document.querySelector('.cky-btn-accept, .cky-btn-reject'); if (b) b.click(); })()`).catch(() => {})
await sleep(1200)

let start = RANGE_START
let end = RANGE_END
if (!start || !end) {
  const r = await evalJS(`
(() => {
  const w = document.querySelector('.mod-scroll-wrap')
  if (!w) return null
  const rr = w.getBoundingClientRect()
  const top = rr.top + window.scrollY
  return JSON.stringify({ start: top, end: top + (w.offsetHeight - innerHeight) })
})()
`)
  if (!r) { console.log('no range found'); process.exit(1) }
  const p = JSON.parse(r)
  start = p.start
  end = p.end
}
console.log('range', start, end)

const FRAMES = 120
const HOVER_AT = 0.05 // terms are on screen at the very start of the range
const t0 = Date.now()
for (let i = 0; i < FRAMES; i++) {
  const u = i / (FRAMES - 1)
  const y = start + u * (end - start)
  if (u >= HOVER_AT && u < HOVER_AT + 0.12) {
    // hover over term 2 center while the track keeps moving
    const info = JSON.parse(await evalJS(`
(() => {
  const terms = document.querySelectorAll('.mod-scroll__terms__term')
  const t = terms[Math.min(1, terms.length - 1)]
  const r = t.getBoundingClientRect()
  return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
})()
`))
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: info.x, y: info.y })
  } else if (u >= HOVER_AT + 0.12 && u < HOVER_AT + 0.2) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 20, y: 20 })
  }
  await evalJS(`window.scrollTo(0, ${Math.round(y)})`)
  await sleep(1000 * 5 / FRAMES)
  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true })
  writeFileSync(`${OUT}/v${String(i).padStart(4, '0')}.png`, Buffer.from(shot.data, 'base64'))
}
console.log('done in', Date.now() - t0, 'ms; frames:', FRAMES)
ws.close()
chrome.kill()
