import { spawn } from 'node:child_process'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--remote-debugging-port=9229', `--user-data-dir=C:\\Users\\DK\\AppData\\Local\\Temp\\opencode\\chrome-qp-${Date.now()}`,
  '--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1920,1080', 'about:blank',
], { stdio: 'ignore' })
await sleep(3000)
const list = await (await fetch('http://127.0.0.1:9229/json/list')).json()
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
await send('Page.navigate', { url: 'http://127.0.0.1:5173/?debug=1' })
for (let i = 0; i < 30; i++) {
  if (await ev('!!window.__M_FD__')) break
  await sleep(500)
}
await sleep(1500)
console.log('M_FD', await ev('typeof window.__M_FD__'))
console.log('wrap', await ev('!!document.querySelector(".mod-scroll-wrap")'))
console.log('sc', await ev('!!document.querySelector(".mod-scroll")'))
console.log('fdist', await ev('window.__FINAL_DIST__ ? window.__FINAL_DIST__() : null'))
console.log('bodyText', (await ev('document.body.innerText')).slice(0, 120))
console.log('errBoundary', await ev('!!document.querySelector("[style*=b00020]")'))
ws.close(); chrome.kill()
