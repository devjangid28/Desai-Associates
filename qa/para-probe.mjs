import { spawn } from 'node:child_process'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const PORT = 9231
const W = Number(process.argv[2] || 1024)
const H = Number(process.argv[3] || 768)
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  `--remote-debugging-port=${PORT}`, `--user-data-dir=C:\\Users\\DK\\AppData\\Local\\Temp\\opencode\\chrome-para-${Date.now()}`,
  '--headless=new', '--disable-gpu', '--no-first-run', `--window-size=${W},${H}`, '--hide-scrollbars', 'about:blank',
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
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: 'http://127.0.0.1:5173/?debug=1' })
for (let i = 0; i < 120; i++) {
  const ok = await ev(`(() => { const p = document.querySelector('.preloader'); return (!p || getComputedStyle(p).display === 'none') && !!window.__M_FD__ && document.fonts.status === 'loaded' })()`)
  if (ok) break
  await sleep(400)
}
await sleep(1200)
const out = await ev(`(() => {
  const para = document.querySelector('.last-item__content__text')
  const p = para ? para.querySelector('p') : null
  const lines = p ? Array.from(p.querySelectorAll('.line')) : []
  const cs = p ? getComputedStyle(p) : null
  return JSON.stringify({
    iw: innerWidth,
    fontSize: cs ? cs.fontSize : null,
    fontFamily: cs ? cs.fontFamily : null,
    lineHeight: cs ? cs.lineHeight : null,
    pW: p ? p.getBoundingClientRect().width : null,
    pH: p ? p.getBoundingClientRect().height : null,
    n: lines.length,
    texts: lines.map((l) => (l.textContent || '').slice(0, 40)), all: lines.map((l) => l.textContent || '').join(' ').replace(/\\s+/g, ' ').trim(),
    heights: lines.map((l) => Math.round(l.getBoundingClientRect().height)),
    contentW: (() => { const c = document.querySelector('.last-item__content'); return c ? c.getBoundingClientRect().width : null })(),
  })
})()`)
console.log(out)
ws.close(); chrome.kill()