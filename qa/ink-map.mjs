import { spawn } from 'node:child_process'
import { decodePNG } from './png.js'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const PORT = 9230
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  `--remote-debugging-port=${PORT}`, `--user-data-dir=C:\\Users\\DK\\AppData\\Local\\Temp\\opencode\\chrome-ink-${Date.now()}`,
  '--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1920,1080', '--hide-scrollbars', 'about:blank',
], { stdio: 'ignore' })
await sleep(3200)
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const t = list.find((x) => x.type === 'page')
const ws = new WebSocket(t.webSocketDebuggerUrl)
let id = 0
const pend = new Map()
const send = (m, p = {}) => new Promise((res, rej) => {
  const mid = ++id
  pend.set(mid, { res, rej })
  ws.send(JSON.stringify({ id: mid, method: m, params: p }))
})
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pend.has(msg.id)) {
    const { res, rej } = pend.get(msg.id)
    pend.delete(msg.id)
    msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result)
  }
}
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
const ev = async (e) => {
  const r = await send('Runtime.evaluate', { expression: e, returnByValue: true })
  return r.result.value
}

await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
await send('Page.enable')
await send('Page.navigate', { url: 'http://127.0.0.1:5173/?debug=1' })
for (let i = 0; i < 60; i++) { if (await ev('!!window.__M_FD__ && document.fonts.status==="loaded"')) break; await sleep(400) }
await sleep(1500)
const rng = await ev('window.__PROJ_TRIGGER__ ? (() => { const st = window.__ST__ ? window.__ST__.get_state() : null; const tr = window.__PROJ_TRIGGER__; return { start: tr.start, end: tr.end } })() : null')
console.log('range', JSON.stringify(rng))
await ev('(() => { const L = window.__lenis; if (L) { try { L.destroy() } catch(e){} } })()')
const pin = rng || (await ev('(() => { const el = document.querySelector(".mod-scroll-wrap"); const r = el.getBoundingClientRect(); return { start: scrollY + r.top, end: scrollY + r.top + r.height - innerHeight } })()'))
const F = Number(process.argv[2] || 0.78)
const y = Math.round(pin.start + F * (pin.end - pin.start))
await ev(`window.scrollTo(0, ${y})`)
for (let i = 0; i < 20; i++) { await sleep(120); const p = await ev('window.__SCROLL_P__().p'); if (Math.abs(p - F) < 0.002) break }
const p = await ev('window.__SCROLL_P__().p')
console.log('target', F, 'p', p, 'y', y)

const shot = await send('Page.captureScreenshot', { format: 'png' })
const img = decodePNG(Buffer.from(shot.data, 'base64'))
const COLS = 80, ROWS = 24
const near = (r, g, b, tr, tg, tb, tol) => Math.abs(r - tr) <= tol && Math.abs(g - tg) <= tol && Math.abs(b - tb) <= tol
const classify = (r, g, b) => {
  if (near(r, g, b, 33, 26, 25, 6)) return 'I'
  if (near(r, g, b, 249, 244, 238, 6)) return 'B'
  if (near(r, g, b, 255, 255, 255, 6)) return 'W'
  return '.'
}
const raw = await ev(`(() => {
  const pts = []
  const iw = innerWidth, ih = innerHeight
  for (let ry = 0; ry < ${ROWS}; ry++) for (let rx = 0; rx < ${COLS}; rx++) {
    const x = Math.round((rx + 0.5) * iw / ${COLS}), y = Math.round((ry + 0.5) * ih / ${ROWS})
    const els = document.elementsFromPoint(x, y)
    const top = els[0]
    pts.push(top ? (top.tagName + '.' + String(top.className || '').split(' ').slice(0,2).join('.')) : null)
  }
  return pts
})()`)
let ink = 0, bad = 0
const lines = []
for (let ry = 0; ry < ROWS; ry++) {
  let s = ''
  for (let rx = 0; rx < COLS; rx++) {
    const px = Math.round((rx + 0.5) * img.width / COLS), py = Math.round((ry + 0.5) * img.height / ROWS)
    const i = (py * img.width + px) * 4
    const c = classify(img.data[i], img.data[i + 1], img.data[i + 2])
    s += c
    if (c === 'I') ink++
    if (c !== '.') bad++
  }
  lines.push(String(ry).padStart(2) + ' ' + s)
}
console.log(lines.join('\n'))
console.log('ink', ink, 'flagged', bad)
const uniq = {}
for (let k = 0; k < raw.length; k++) if (raw[k]) uniq[raw[k]] = (uniq[raw[k]] || 0) + 1
console.log('topElements', JSON.stringify(Object.entries(uniq).sort((a, b) => b[1] - a[1]).slice(0, 12)))
ws.close(); chrome.kill()