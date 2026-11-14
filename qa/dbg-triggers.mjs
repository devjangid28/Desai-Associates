import { spawn } from 'node:child_process'
const PORT = 9227
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=C:\\Users\\DK\\AppData\\Local\\Temp\\opencode\\chrome-dbg',
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
await send('Page.navigate', { url: 'http://127.0.0.1:5173/?debug=1' })
await sleep(14000)

console.log('STATE', await evalJS(`JSON.stringify({ md: !!window.__M_FD__, st: !!window.__ST__, wrap: !!document.querySelector('.mod-scroll-wrap'), sc: !!document.querySelector('.mod-scroll') })`))
const EXPR = `
(() => {
  const ST = window.__ST__ || window.ScrollTrigger
  if (!ST) return JSON.stringify({ noST: true })
  const all = ST.getAll()
  const out = all.map((t) => {
    const o = {}
    try { o.cls = t.trigger ? String(t.trigger.className || '').slice(0, 60) : null } catch (e) {}
    try { o.start = t.start } catch (e) {}
    try { o.end = t.end } catch (e) {}
    try { o.progress = t.progress } catch (e) {}
    try { o.isActive = t.isActive } catch (e) {}
    try { o.animProg = t.animation ? t.animation.progress() : null } catch (e) {}
    try { o.animPaused = t.animation ? t.animation.paused() : null } catch (e) {}
    if (t.trigger && String(t.trigger.className || '').includes('projects__text')) {
      try {
        const spans = t.trigger.querySelectorAll('span')
        o.spans = Array.from(spans).slice(0, 3).map((x) => getComputedStyle(x).transform)
      } catch (e) {}
    }
    return o
  })
  return JSON.stringify(out.filter((x) => x.cls && x.cls.includes('mod-scroll')))
})()
`
console.log('ALL', await evalJS(EXPR))

for (const f of [0, 0.25, 0.5, 0.75, 1]) {
  const r = JSON.parse(await evalJS(`(() => { const w = document.querySelector('.mod-scroll-wrap'); const rr = w.getBoundingClientRect(); const top = rr.top + scrollY; return JSON.stringify({ start: top, end: top + (w.offsetHeight - innerHeight) }) })()`))
  const y = Math.round(r.start + f * (r.end - r.start))
  await evalJS(`window.scrollTo(0, ${y})`)
  await sleep(600)
  const p = await evalJS(EXPR)
  console.log(`--- f=${f} y=${y} ---`)
  console.log(p)
}
ws.close()
chrome.kill()
