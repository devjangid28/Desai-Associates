import { spawn } from 'node:child_process'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const PORT = 9225
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const prof = 'C:\\Users\\DK\\AppData\\Local\\Temp\\opencode\\chrome-mineprobe'
const chrome = spawn(chromePath, [
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, '--headless=new',
  '--disable-gpu', '--no-first-run', '--window-size=1920,1080', '--hide-scrollbars', 'about:blank',
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
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
await send('Runtime.enable')
const origOnmessage = ws.onmessage
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    origOnmessage(ev)
    return
  }
  if (msg.method === 'Runtime.consoleAPICalled') {
    const txt = msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')
    if (/error|fail|warn|boundary|crash/i.test(txt)) console.log('CONSOLE:', txt.slice(0, 300))
  }
}
await send('Page.navigate', { url: 'http://127.0.0.1:5173/?debug=1' })
await sleep(12000)
console.log('mod-scroll?', await evalJS(`!!document.querySelector('.mod-scroll')`).catch((e) => 'ERR ' + e.message))
console.log('M_FD?', await evalJS(`typeof window.__M_FD__`).catch((e) => 'ERR ' + e.message))
console.log('fonts', await evalJS(`document.fonts.status`).catch((e) => 'ERR ' + e.message))
console.log('scrollH', await evalJS(`document.documentElement.scrollHeight`).catch((e) => 'ERR ' + e.message))
console.log('boundary text', await evalJS(`document.body.innerText.slice(0, 300)`).catch((e) => 'ERR ' + e.message))
console.log('html scroll ok', await evalJS(`(() => { try { window.scrollTo(0, 500); return window.scrollY } catch (e) { return 'ERR ' + e.message } })()`).catch((e) => 'ERR ' + e.message))
ws.close(); chrome.kill()
