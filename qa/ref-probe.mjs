import { spawn } from 'node:child_process'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const PORT = 9224
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const prof = 'C:\\Users\\DK\\AppData\\Local\\Temp\\opencode\\chrome-refprobe'
const chrome = spawn(chromePath, [
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, '--headless=new',
  '--disable-gpu', '--no-first-run', '--window-size=1440,900', '--hide-scrollbars', 'about:blank',
], { stdio: 'ignore' })
await sleep(2500)
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const t = list.find((x) => x.type === 'page')
const ws = new WebSocket(t.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const mid = ++id; pending.set(mid, { resolve, reject })
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
async function evalJS(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
  return r.result.value
}
await send('Page.navigate', { url: 'https://normalisboring.es/' })
await sleep(16000)
console.log('ready?', await evalJS(`!!document.querySelector('.mod-scroll')`).catch(() => 'err'))
console.log('triggers:', await evalJS(`typeof ScrollTrigger !== 'undefined' ? ScrollTrigger.getAll().length : 'no ST'`).catch(() => 'err'))
await evalJS(`(() => { const b = document.querySelector('.cky-btn-accept, .cky-btn-reject'); if (b) b.click(); })()`).catch(() => {})
await sleep(1000)
const info = await evalJS(`
(() => {
  const sc = document.querySelector('.mod-scroll')
  const html = document.documentElement
  const body = document.body
  const out = {
    scH: html.scrollHeight, vh: innerHeight,
    bodyScrollH: body.scrollHeight,
    scFound: !!sc,
  }
  if (sc) {
    out.scPos = getComputedStyle(sc).position
    out.scParent = sc.parentElement ? sc.parentElement.tagName + '.' + (sc.parentElement.className || '') : null
    const m = new DOMMatrix(getComputedStyle(sc).transform)
    out.x0 = m.e
  }
  return JSON.stringify(out)
})()
`)
console.log('info', info)
const trigs = await evalJS(`
(() => {
  const all = ScrollTrigger.getAll().map((t, i) => {
    const o = { i }
    try { o.trigger = t.trigger ? (t.trigger.className || t.trigger.id || String(t.trigger)).slice(0, 80) : null } catch { o.trigger = '?' }
    try { o.pin = t.pin ? (t.pin.className || t.pin.id || String(t.pin)).slice(0, 80) : null } catch { o.pin = null }
    try { o.start = t.start } catch {}
    try { o.end = t.end } catch {}
    try { o.scrollStart = t.scrollStart } catch {}
    try { o.scrollEnd = t.scrollEnd } catch {}
    try { o.scrub = t.scrub ? (t.scrub.duration || t.scrub) : null } catch {}
    return o
  })
  return JSON.stringify(all)
})()
`)
console.log('TRIGGERS\n' + trigs)
const moves = await evalJS(`
(async () => {
  const main = document.querySelector('main')
  const q = (el) => el.querySelectorAll('*')
  const sel = main ? q(main) : []
  let found = []
  for (let y = 0; y <= 13718; y += 300) {
    window.scrollTo(0, y)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    for (let i = 0; i < sel.length; i++) {
      const m = new DOMMatrix(getComputedStyle(sel[i]).transform)
      if (m.e !== 0 || m.f !== 0) {
        found.push({ y, cls: String(sel[i].className || sel[i].tagName).slice(0, 70), x: Math.round(m.e), f: Math.round(m.f) })
      }
    }
  }
  // dedupe
  const uniq = {}
  for (const f of found) uniq[f.cls + '@' + f.x + '@' + f.f] = f
  return JSON.stringify(Object.values(uniq).slice(0, 60))
})()
`)
console.log('MOVERS\n' + moves)
ws.close(); chrome.kill()
