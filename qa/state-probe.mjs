import { spawn } from 'node:child_process'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const PORT = 9225
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const prof = 'C:\\Users\\DK\\AppData\\Local\\Temp\\opencode\\chrome-stateprobe-' + Date.now()
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
await send('Page.navigate', { url: 'http://127.0.0.1:5173/?debug=1' })
for (let i = 0; i < 30; i++) {
  const ok = await evalJS(`!!window.__M_FD__ && document.fonts.status === 'loaded'`).catch(() => false)
  if (ok) break
  await sleep(500)
}
// stabilize
const r0 = JSON.parse(await evalJS(`(() => { const w = document.querySelector('.mod-scroll-wrap'); const r = w.getBoundingClientRect(); const top = r.top + window.scrollY; return JSON.stringify({ start: top, end: top + (w.offsetHeight - window.innerHeight) }) })()`))
await evalJS(`window.scrollTo(0, ${Math.round(r0.end)})`)
await sleep(1500)
await evalJS(`window.scrollTo(0, ${Math.round(r0.start)})`)
await sleep(1500)
await evalJS(`document.querySelectorAll('.mod-scroll img').forEach(i => { if (i.loading === 'lazy') i.loading = 'eager' })`).catch(() => {})
await sleep(2000)

const READ = `
(() => {
  const last = document.querySelector('.mod-scroll__projects__item.last-item')
  const car = last.querySelector('.last-item__carousel')
  const content = last.querySelector('.last-item__content')
  const carItems = Array.from(car.querySelectorAll('.last-item__carousel__item:not(.last-item__carousel__item--link)'))
  const items = Array.from(document.querySelectorAll('.mod-scroll__projects__item'))
  const p04 = items[3]
  const proj = document.querySelector('.mod-scroll__projects')
  const mx = (el) => { const m = new DOMMatrix(getComputedStyle(el).transform); return { e: +m.e.toFixed(2), f: +m.f.toFixed(2) } }
  const rect = (el) => { const r = el.getBoundingClientRect(); return { l: +r.left.toFixed(1), r: +r.right.toFixed(1), w: +r.width.toFixed(1) } }
  const p = window.__SCROLL_P__ ? window.__SCROLL_P__() : null
  return JSON.stringify({
    sy: window.scrollY,
    p: p ? +p.p.toFixed(4) : null,
    natX: typeof window.__NAT_X__ === 'function' ? window.__NAT_X__() : null,
    fd: typeof window.__FINAL_DIST__ === 'function' ? Math.round(window.__FINAL_DIST__()) : null,
    trackT: window.__TRACK_TL__ ? +window.__TRACK_TL__.time().toFixed(2) : null,
    projX: proj ? mx(proj).e : null,
    p04Rect: rect(p04),
    lastRect: rect(last),
    carRect: rect(car),
    contentRect: rect(content),
    itemHs: carItems.map((i) => i.style.height),
    pW: items.map((it) => it.style.width || it.style.getPropertyValue('--panel-w')),
    projT: window.__PROJ_TL__ ? +window.__PROJ_TL__.time().toFixed(2) : null,
    projTrigger: (() => {
      if (!window.__PROJ_TRIGGER__) return null
      const t = window.__PROJ_TRIGGER__()
      if (!t) return null
      return { start: t.start, end: t.end, p: +t.progress.toFixed(3) }
    })(),
    layout: (() => {
      const sc = document.querySelector('.mod-scroll')
      const proj = document.querySelector('.mod-scroll__projects')
      const wt = document.querySelector('.mod-scroll__projects__wrap-text')
      const terms = document.querySelector('.mod-scroll__terms')
      const wrap = document.querySelector('.mod-scroll-wrap')
      const mxE = (el) => { try { return new DOMMatrix(getComputedStyle(el).transform).e } catch { return null } }
      return {
        termsW: terms ? terms.offsetWidth : null,
        projW: proj ? proj.offsetWidth : null,
        wtW: wt ? wt.offsetWidth : null,
        itemsOff: items.map((it) => it.offsetLeft),
        lastOff: last.offsetLeft,
        lastOffW: last.offsetWidth,
        wrapLeft: wrap ? wrap.getBoundingClientRect().left : null,
        scLeft: sc ? sc.getBoundingClientRect().left : null,
        scX: mxE(sc),
        termsLeft: terms ? terms.getBoundingClientRect().left : null,
        termsX: mxE(terms),
        projLeft: proj ? proj.getBoundingClientRect().left : null,
      }
    })(),
    title: (() => {
      const t = last.querySelector('.last-item__content__title')
      const lines = Array.from(t.querySelectorAll('.line'))
      const chars = Array.from(t.querySelectorAll('.char'))
      const mx1 = (el) => { const m = new DOMMatrix(getComputedStyle(el).transform); return +m.f.toFixed(1) }
      const rect = (el) => { const r = el.getBoundingClientRect(); return { l: +r.left.toFixed(1), r: +r.right.toFixed(1), b: +r.bottom.toFixed(1), t: +r.top.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) } }
      return {
        nLines: lines.length,
        chars: chars.length,
        charY: chars.slice(0, 8).map((c) => mx1(c)),
        lineChars: lines.map((l) => l.querySelectorAll('.char').length),
        lineRects: lines.map((l) => rect(l)),
        titleRect: rect(t),
      }
    })(),
    lastTl: (() => {
      const tl = window.__LAST_TL__
      if (!tl) return null
      return {
        time: +tl.time().toFixed(2),
        progress: +tl.progress().toFixed(3),
        children: tl.getChildren().map((t) => ({
          target: t.target ? (t.target.className || t.target.tagName).slice(0, 40) : null,
          prop: t.vars && t.vars['--panel-w'] ? '--panel-w' : (t.vars && t.vars.y ? 'y' : 'height'),
          dur: +t.duration().toFixed(2),
        })),
      }
    })(),
    contentTl: (() => {
      const g = window.__CONTENT_TL__
      const tl = typeof g === 'function' ? g() : g
      if (!tl) return null
      return {
        time: +tl.time().toFixed(2),
        progress: +tl.progress().toFixed(3),
        dur: +tl.duration().toFixed(2),
        active: tl.isActive(),
        paused: tl.paused(),
      }
    })(),
    para: (() => {
      const p = last.querySelector('.last-item__content__text p')
      const block = last.querySelector('.last-item__content')
      const wrapEl = last.querySelector('.last-item__content__wrap')
      const lines = Array.from(p.querySelectorAll('.line'))
      const rect = (el) => { const r = el.getBoundingClientRect(); return { l: +r.left.toFixed(1), r: +r.right.toFixed(1), w: +r.width.toFixed(1) } }
      const cs = getComputedStyle(wrapEl)
      const mx1 = (el) => { const m = new DOMMatrix(getComputedStyle(el).transform); return +m.f.toFixed(1) }
      return {
        nLines: lines.length,
        lineRects: lines.map((l) => rect(l)),
        spanY: lines.map((l) => mx1(l.querySelector('span'))),
        blockRect: rect(block),
        padL: parseFloat(cs.paddingLeft),
        padR: parseFloat(cs.paddingRight),
        contentW: block.clientWidth,
      }
    })(),
  })
})()
`

const r1 = JSON.parse(await evalJS(`(() => { const w = document.querySelector('.mod-scroll-wrap'); const r = w.getBoundingClientRect(); const top = r.top + window.scrollY; return JSON.stringify({ start: top, end: top + (w.offsetHeight - window.innerHeight) }) })()`))
console.log('POST-STAB RANGE', JSON.stringify(r1))
for (const f of [0, 0.01, 0.05, 0.2, 0.5, 0.78, 0.8, 0.82, 0.85, 0.9, 0.95, 0.98, 1]) {
  const y = Math.round(r1.start + f * (r1.end - r1.start))
  await evalJS(`(() => { const L = window.__lenis; if (L) L.stop(); window.scrollTo(0, ${y}) })()`)
  await sleep(350)
  const sy = await evalJS(`window.scrollY`)
  console.log('f=' + f, 'y=' + y, 'syNow=' + sy, await evalJS(READ))
}
ws.close(); chrome.kill()
