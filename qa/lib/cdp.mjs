// Shared headless-Chrome CDP helper for qa tooling.
// Node >= 22 (built-in fetch / WebSocket). Chrome path is Windows default.
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

export const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function launchChrome(port, profileTag, viewport = { w: 1920, h: 1080 }) {
  const prof = join(process.env.TEMP || 'C:\\Users\\DK\\AppData\\Local\\Temp', 'opencode', `chrome-${profileTag}-${Date.now()}`)
  mkdirSync(prof, { recursive: true })
  const chrome = spawn(CHROME, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${prof}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--disable-default-apps',
    '--no-default-browser-check',
    `--window-size=${viewport.w},${viewport.h}`,
    '--hide-scrollbars',
    'about:blank',
  ], { stdio: 'ignore' })
  return chrome
}

export async function connectCDP(port, timeoutMs = 30000) {
  const t0 = Date.now()
  let list = null
  while (Date.now() - t0 < timeoutMs) {
    try {
      list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      if (list.length) break
    } catch { /* retry */ }
    await sleep(300)
  }
  if (!list || !list.length) throw new Error(`CDP not reachable on ${port}`)
  const t = list.find((x) => x.type === 'page') || list[0]
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
    if (typeof ev.data !== 'string') return
    let msg
    try { msg = JSON.parse(ev.data) } catch { return }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(JSON.stringify(msg.error)))
      else resolve(msg.result)
    }
  }
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  return { ws, send }
}

export async function evalJS(send, expression, allowNull = false) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) {
    const txt = r.exceptionDetails.exception ? r.exceptionDetails.exception.description || r.exceptionDetails.exception.value : r.exceptionDetails.text
    throw new Error(String(txt))
  }
  if (r.result && r.result.value === undefined && !allowNull) return null
  return r.result.value
}

export async function setViewport(send, w, h) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false })
}

// Real wheel event via CDP Input.dispatchMouseEvent (deltaY in CSS px).
export async function wheel(send, deltaY, x = 960, y = 540) {
  await send('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x,
    y,
    deltaX: 0,
    deltaY,
  })
}

export async function mouseMove(send, x, y, buttons = 0) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons })
}

/** Wait until a promise-based predicate is stable (true for `stableFor` ms). */
export async function waitStable(check, stableFor = 400, timeoutMs = 10000, every = 80) {
  const t0 = Date.now()
  let stableSince = 0
  while (Date.now() - t0 < timeoutMs) {
    const ok = await check()
    if (ok) {
      if (!stableSince) stableSince = Date.now()
      else if (Date.now() - stableSince >= stableFor) return true
    } else {
      stableSince = 0
    }
    await sleep(every)
  }
  return false
}

export { sleep }
