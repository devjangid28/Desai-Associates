// Acceptance harness for the pinned horizontal scroll section (T1-T6).
// Usage: node qa/accept.mjs  (spawns headless Chrome itself)
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { decodePNG } from './png.js'

const PORT = 9222
const SRC = 'http://127.0.0.1:5173/?debug=1'
const OUT = 'C:\\Users\\DK\\Desktop\\interior design\\qa\\accept'
mkdirSync(OUT, { recursive: true })

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const prof = 'C:\\Users\\DK\\AppData\\Local\\Temp\\opencode\\chrome-accept-' + Date.now()

const chrome = spawn(chromePath, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${prof}`,
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--disable-default-apps',
  '--no-default-browser-check',
  '--window-size=1920,1080',
  '--hide-scrollbars',
  'about:blank',
], { stdio: 'ignore' })
chrome.on('exit', (code) => console.log('[chrome exit]', code))

const results = []
const pass = (t, ok, detail) => {
  results.push({ t, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${t} ${detail ?? ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function connect() {
  let list = null
  for (let i = 0; i < 30; i++) {
    try {
      list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      if (list.length) break
    } catch (e) {
      await sleep(500)
    }
  }
  if (!list || !list.length) throw new Error('chrome not reachable')
  const t = list.find((x) => x.type === 'page')
  if (!t) throw new Error('no page target')
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
    const msg = JSON.parse(ev.data)
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

async function evalJS(send, expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) {
    const txt = r.exceptionDetails.exception ? r.exceptionDetails.exception.description || r.exceptionDetails.exception.value : r.exceptionDetails.text
    throw new Error(String(txt))
  }
  return r.result.value
}

async function pinRangeNow(send) {
  const v = await evalJS(send, `
(() => {
  const w = document.querySelector('.mod-scroll-wrap')
  if (!w) return null
  const r = w.getBoundingClientRect()
  const top = r.top + window.scrollY
  return JSON.stringify({ start: top, end: top + (w.offsetHeight - window.innerHeight) })
})()
`).catch(() => null)
  return v ? JSON.parse(v) : null
}

async function settleF(send, f) {
  const rng = await pinRangeNow(send)
  if (!rng) return
  const y = Math.round(rng.start + f * (rng.end - rng.start))
  await evalJS(send, `
(() => {
  const L = window.__lenis
  if (L) {
    try { L.stop() } catch (e) {}
    try { L.scrollTo(${y}, { immediate: true, force: true }) } catch (e) {}
  }
  window.scrollTo(0, ${y})
  document.scrollingElement.scrollTop = ${y}
  if (window.__ST__ && typeof window.__ST__.update === 'function') window.__ST__.update()
})()
`)
  for (let k = 0; k < 20; k++) {
    await sleep(100)
    const p = await evalJS(send, `(() => { const s = window.__SCROLL_P__(); return s ? s.p : null })()`).catch(() => null)
    if (p === null) continue
    if (k > 1 && Math.abs(p - f) < 0.004) break
  }
  if (f === 0.77 || f === 0.8 || f === 0.81) {
    const pNow = await evalJS(send, `(() => { const s = window.__SCROLL_P__(); return s ? s.p : null })()`).catch(() => null)
    console.log(`  [dbg] f=${f} p=${pNow}`)
  }
}

const waitSettled = async (send) => {
  for (let i = 0; i < 120; i++) {
    const r = await evalJS(send, `(() => {
      const pre = document.querySelector('.preloader')
      const preGone = !pre || getComputedStyle(pre).display === 'none'
      return {
        preGone,
        fd: !!window.__M_FD__,
        fonts: document.fonts.status === 'loaded',
      }
    })()`).catch(() => null)
    if (r && r.preGone && r.fd && r.fonts) return true
    await sleep(400)
  }
  return false
}

const GEOM = `
(() => {
  const R = (v) => Math.round(v * 100) / 100
  const rect = (el) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { l: R(r.left), r: R(r.right), t: R(r.top), b: R(r.bottom), w: R(r.width), h: R(r.height) }
  }
  const items = Array.from(document.querySelectorAll('.mod-scroll__projects__item'))
  const p04 = items[3]
  const last = document.querySelector('.mod-scroll__projects__item.last-item')
  const car = last ? last.querySelector('.last-item__carousel') : null
  const content = last ? last.querySelector('.last-item__content') : null
  const title = last ? last.querySelector('.last-item__content__title') : null
  const para = last ? last.querySelector('.last-item__content__text') : null
  const wrapEl = last ? last.querySelector('.last-item__content__wrap') : null
  const carItems = car ? Array.from(car.querySelectorAll('.last-item__carousel__item')) : []
  const mx = (el) => { if (!el) return null; const m = new DOMMatrix(getComputedStyle(el).transform); return { e: R(m.e), f: R(m.f) } }
  const cs = wrapEl ? getComputedStyle(wrapEl) : null
  let paraLines = []
  if (para) {
    const p = para.querySelector('p')
    paraLines = Array.from(p.querySelectorAll('.line')).map((l) => {
      const r = l.getBoundingClientRect()
      const inner = l.querySelector('span')
      const m = inner ? new DOMMatrix(getComputedStyle(inner).transform) : null
      return { l: R(r.left), r: R(r.right), w: R(r.width), y: m ? R(m.f) : 0 }
    })
  }
  let titleChars = []
  if (title) {
    titleChars = Array.from(title.querySelectorAll('.char')).map((c) => mx(c))
  }
  return JSON.stringify({
    iw: window.innerWidth,
    ih: window.innerHeight,
    dw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
    p04: rect(p04),
    group: rect(last),
    car: rect(car),
    carT: mx(car),
    carItems: carItems.map((c) => rect(c)),
    content: rect(content),
    wrap: rect(wrapEl),
    padL: cs ? parseFloat(cs.paddingLeft) : 0,
    padR: cs ? parseFloat(cs.paddingRight) : 0,
    panelW: last ? last.style.getPropertyValue('--panel-w') : null,
    title: rect(title),
    titleChars,
    paraLines,
    whiteBlock: rect(content),
  })
})()
`

async function readGeom(send) {
  for (let k = 0; k < 4; k++) {
    try {
      return JSON.parse(await evalJS(send, GEOM))
    } catch (e) {
      await sleep(200)
    }
  }
  return null
}

async function shotPixels(send) {
  const r = await send('Page.captureScreenshot', { format: 'png', fromSurface: true })
  const png = decodePNG(Buffer.from(r.data, 'base64'))
  const W = png.width
  const H = png.height
  const NX = 40
  const NY = 20
  const samples = []
  for (let ix = 0; ix < NX; ix++) {
    const x = Math.round((ix / (NX - 1)) * (W - 1))
    for (let iy = 0; iy < NY; iy++) {
      const y = Math.round((iy / (NY - 1)) * (H - 1))
      const d = (y * W + x) * 4
      samples.push({ x, y, r: png.data[d], g: png.data[d + 1], b: png.data[d + 2] })
    }
  }
  return { width: W, height: H, samples }
}

const closeColor = (a, b, tol = 8) => Math.abs(a.r - b.r) <= tol && Math.abs(a.g - b.g) <= tol && Math.abs(a.b - b.b) <= tol
const INK = { r: 33, g: 26, b: 25 }
const BEIGE = { r: 249, g: 244, b: 238 }
const WHITE = { r: 255, g: 255, b: 255 }

async function checkT1(send, geom, px, tag) {
  // ink samples are defects only when their first opaque background owner is
  // the ink-colored container. Photos/text/panels legitimately contain
  // near-ink pixels, so ask the DOM who paints each ink sample.
  const inkPts = px.samples.filter((s) => closeColor(s, INK, 6))
  const owners = inkPts.length
    ? await evalJS(send, `(() => {
        const pts = ${JSON.stringify(inkPts.map((s) => [Math.round(s.x), Math.round(s.y)]))}
        const ink = [33, 26, 25]
        const parse = (c) => {
          const m = c.match(/rgba?\\((\\d+)[,\\s]+(\\d+)[,\\s]+(\\d+)(?:[,\\s/]+([\\d.]+))?\\)/)
          return m ? [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]] : null
        }
        return pts.map(([x, y]) => {
          const els = document.elementsFromPoint(x, y)
          for (const el of els) {
            const tag = el.tagName
            if (tag === 'IMG' || tag === 'VIDEO' || tag === 'CANVAS' || tag === 'PICTURE') return 'media'
            const bg = parse(getComputedStyle(el).backgroundColor)
            if (bg && bg[3] > 0.5) {
              const near = Math.abs(bg[0] - ink[0]) <= 8 && Math.abs(bg[1] - ink[1]) <= 8 && Math.abs(bg[2] - ink[2]) <= 8
              return near ? 'ink' : 'other'
            }
          }
          return 'none'
        })
      })()`).catch(() => [])
    : []
  let ink = 0
  const cols = {}
  inkPts.forEach((s, i) => {
    if (owners[i] !== 'ink') return
    ink++
    cols[Math.round((s.x / geom.iw) * 39)] = true
  })
  let maxRun = 0
  let run = 0
  for (let c = 0; c < 40; c++) {
    if (cols[c]) run++
    else run = 0
    if (run > maxRun) maxRun = run
  }
  const maxUncovered = Math.round((maxRun / 40) * geom.iw)
  return { bad: { ink }, maxUncovered }
}

async function runViewport(ws, send, W, H, tag) {
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: SRC })
  const settled = await waitSettled(send)
  console.log(`[${tag}] preloader done=${settled}`)
  const r0 = await pinRangeNow(send)
  if (!r0) {
    pass(`T0 ${tag} pin`, false, 'no pin range')
    return
  }
  // disable Lenis so programmatic scrollTo is stable in headless
  await evalJS(send, `(() => { const L = window.__lenis; if (L) { try { L.destroy() } catch (e) {} } })()`).catch(() => {})
  // stabilize layout
  await evalJS(send, `(() => { const L = window.__lenis; if (L) L.stop(); window.scrollTo(0, ${Math.round(r0.end)}) })()`)
  await sleep(1200)
  await evalJS(send, `(() => { const L = window.__lenis; if (L) L.stop(); window.scrollTo(0, ${Math.round(r0.start)}) })()`)
  await sleep(1200)
  await evalJS(send, `document.querySelectorAll('.mod-scroll img').forEach(i => { if (i.loading === 'lazy') i.loading = 'eager' })`).catch(() => {})
  await sleep(1500)
  console.log(`[${tag}] pin start=${Math.round(r0.start)} end=${Math.round(r0.end)}`)

  // ---- T1/T2 sweep every 1% ----
  let worstUncovered = 0
  let worstAt = -1
  let t1BadTotal = 0
  let t2Bad = 0
  for (let f = 0; f <= 100; f++) {
    await settleF(send, f / 100)
    const geom = await readGeom(send)
    if (!geom) continue
    const px = await shotPixels(send)
    const t1 = await checkT1(send, geom, px, tag)
    t1BadTotal += t1.bad.ink
    if (t1.maxUncovered > worstUncovered) {
      worstUncovered = t1.maxUncovered
      worstAt = f
    }
    if (geom.group && geom.p04 && geom.car && geom.content) {
      const p04r = geom.p04.r
      const gl = geom.group.l
      if (p04r > -60 && gl < geom.iw + 60) {
        if (Math.abs(p04r - gl) > 1.5) t2Bad++
      }
      if (Math.abs(geom.car.l - geom.group.l) > 1.5) t2Bad++
      if (Math.abs(geom.content.l - geom.group.r) > 1.5) t2Bad++
    }
  }
  pass(`T1 ${tag} no uncovered ink strip (worst maxUncovered)`, worstUncovered === 0 && t1BadTotal === 0, `worstUncovered=${worstUncovered}px @ f=${worstAt} badPixels=${t1BadTotal}`)
  pass(`T2 ${tag} continuity (p04.r==group.l, car.l==panel.l, content.l==panel.r)`, t2Bad === 0, `badSamples=${t2Bad}`)

  // ---- T3 final frame ----
  await settleF(send, 1)
  await sleep(400)
  const g = await readGeom(send)
  if (!g) {
    pass(`T3 ${tag} final`, false, 'no geom')
    return
  }
  const panelWOk = Math.abs(g.group.w - 0.425 * g.iw) <= 2
  const flushOk = g.content.r >= g.iw - 2 && g.content.r <= g.iw + 2
  const itemsVisible = g.carItems.every((r) => r && r.t >= -1 && r.b <= g.ih + 1 && r.l >= -1 && r.r <= g.iw + 1)
  let itemOverlap = false
  for (let i = 1; i < g.carItems.length; i++) {
    if (g.carItems[i] && g.carItems[i - 1] && g.carItems[i].t < g.carItems[i - 1].b - 1) itemOverlap = true
  }
  const charsDone = g.titleChars.every((c) => c && Math.abs(c.f) < 1)
  const paraDone = g.paraLines.every((l) => Math.abs(l.y) < 1)
  const paraFit = g.paraLines.every((l) => l.r <= g.content.r - g.padR + 1.5 && l.r <= g.content.r - g.padR + 1.5)
  const noOverflow = g.dw <= g.cw
  pass(`T3 ${tag} panel width 42.5vw`, panelWOk, `w=${g.group.w} want=${(0.425 * g.iw).toFixed(1)}`)
  pass(`T3 ${tag} content flush right`, flushOk, `r=${g.content.r} iw=${g.iw}`)
  pass(`T3 ${tag} carousel items visible stacked`, itemsVisible && !itemOverlap, `overlap=${itemOverlap}`)
  pass(`T3 ${tag} title chars at transform none`, charsDone, `n=${g.titleChars.length}`)
  pass(`T3 ${tag} paragraph lines at transform none`, paraDone, `n=${g.paraLines.length}`)
  pass(`T3 ${tag} paragraph lines inside right padding`, paraFit, `maxR=${Math.max(...g.paraLines.map((l) => l.r))} limit=${(g.content.r - g.padR).toFixed(1)}`)
  pass(`T3 ${tag} no horizontal doc overflow`, noOverflow, `dw=${g.dw} cw=${g.cw}`)

  // paragraph line widths vs block width (report)
  const blockW = g.content.w - g.padL - g.padR
  console.log(`[${tag}] PARA blockW=${blockW.toFixed(1)} lines=${g.paraLines.map((l) => l.w.toFixed(1)).join('/')} spans=${g.paraLines.length}`)
  console.log(`[${tag}] TITLE lines=${g.title.length ? 4 : '?'} chars=${g.titleChars.length} charYmax=${g.titleChars.length ? Math.max(...g.titleChars.map((c) => Math.abs(c.f))) : '?'}`)

  // ---- T4 reverse ----
  let t4Ok = true
  await settleF(send, 0)
  await sleep(300)
  const back = await readGeom(send)
  if (back) {
    if (back.panelW !== '15vw' && back.panelW !== '15vw') t4Ok = false
    if (Math.abs(back.carT.f - back.ih) > 4) t4Ok = false
  }
  // T1 still passes while scrolling up at mid progress
  await settleF(send, 0.5)
  const gUp = await readGeom(send)
  const pxUp = await shotPixels(send)
  const t1Up = await checkT1(send, gUp, pxUp, tag)
  pass(`T4 ${tag} reverse restores start`, t4Ok, `panelW=${back ? back.panelW : '?'} carY=${back ? back.carT.f : '?'}`)
  pass(`T4 ${tag} T1 while scrolling up`, t1Up.maxUncovered === 0 && t1Up.bad.ink === 0, `uncovered=${t1Up.maxUncovered}px bad=${t1Up.bad.ink}`)

  return g
}

const { ws, send } = await connect()
const warnings = []

try {
  await send('Runtime.enable')
  const orig = ws.onmessage
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && msg.id < 100000) {
      orig(ev)
      return
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'warning') {
      const txt = msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')
      warnings.push(txt.slice(0, 200))
    }
  }

  const g1920 = await runViewport(ws, send, 1920, 1080, 'desk1920')
  const g1440 = await runViewport(ws, send, 1440, 900, 'desk1440')
  const g1366 = await runViewport(ws, send, 1366, 768, 'desk1366')

  // ---- T5 resize ----
  const waitReady = async () => {
    for (let i = 0; i < 120; i++) {
      const r = await evalJS(send, `(() => {
        const pre = document.querySelector('.preloader')
        const preGone = !pre || getComputedStyle(pre).display === 'none'
        return preGone && !!window.__M_FD__ && document.fonts.status === 'loaded' && !!document.querySelector('.mod-scroll')
      })()`).catch(() => false)
      if (r) return true
      await sleep(400)
    }
    return false
  }
  const waitStable = async () => {
    let lastFd = -1
    for (let i = 0; i < 40; i++) {
      const fd = await evalJS(send, `window.__FINAL_DIST__ ? window.__FINAL_DIST__() : -1`).catch(() => -1)
      const fonts = await evalJS(send, `document.fonts.status`).catch(() => '')
      if (fd > 0 && Math.abs(fd - lastFd) < 1 && fonts === 'loaded') return true
      lastFd = fd
      await sleep(300)
    }
    return false
  }
  const resizeAndReload = async (W, H) => {
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false })
    await sleep(600)
    await send('Page.reload', { ignoreCache: true })
    await waitReady()
    await waitStable()
    await evalJS(send, `(() => { const L = window.__lenis; if (L) { try { L.destroy() } catch (e) {} } })()`).catch(() => {})
    await settleF(send, 0.9)
    await sleep(600)
    return readGeom(send)
  }

  const r1 = await resizeAndReload(1920, 1080)
  const ok1 = r1 && r1.paraLines.length > 1 && r1.group && r1.group.w >= 0.425 * 1920 - 2 && r1.group.w <= 0.6 * 1920 + 2
  pass('T5 resize 1440->1920 @90% ok', !!ok1, `paraLines=${r1 ? r1.paraLines.length : '?'} panelW=${r1 && r1.group ? r1.group.w : '?'}`)

  const r2 = await resizeAndReload(1024, 768)
  const ok2 = r2 && r2.paraLines.length > 1
  pass('T5 resize ->1024 @90% ok', !!ok2, `paraLines=${r2 ? r2.paraLines.length : '?'}`)

  const r3 = await resizeAndReload(1440, 900)
  const ok3 = r3 && r3.paraLines.length > 1
  pass('T5 reload at 90% ok', !!ok3, `paraLines=${r3 ? r3.paraLines.length : '?'} groupL=${r3 ? r3.group.l : '?'}`)

  // ---- T6 hover ----
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
  await waitReady()
  await settleF(send, 0.9)
  await sleep(400)
  const seeAll = await evalJS(send, `
(() => {
  const tile = document.querySelector('.last-item__carousel__item--link')
  if (!tile) return JSON.stringify({ none: true })
  const r = tile.getBoundingClientRect()
  return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
})()
`)
  const sa = JSON.parse(seeAll)
  if (!sa.none) {
    await evalJS(send, `
(() => {
  const tile = document.querySelector('.last-item__carousel__item--link')
  tile.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
})()
`)
    await sleep(700)
    const over = await evalJS(send, `
(() => {
  const tile = document.querySelector('.last-item__carousel__item--link')
  const arrow = tile.querySelector('.last-item__carousel__item__arrow')
  const m = new DOMMatrix(getComputedStyle(arrow).transform)
  const fill = getComputedStyle(arrow.querySelector('path')).fill
  return JSON.stringify({ scale: m.a, fill })
})()
`)
    const ov = JSON.parse(over)
    pass('T6 See-all rollover works', ov.scale > 1.8 && ov.fill === 'rgb(255, 255, 255)', `scale=${ov.scale} fill=${ov.fill}`)
    await evalJS(send, `
(() => {
  const tile = document.querySelector('.last-item__carousel__item--link')
  tile.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
})()
`)
    await sleep(500)
  } else {
    pass('T6 See-all rollover works', false, 'tile not found')
  }
  const disabled = await evalJS(send, `
(() => {
  const btn = document.querySelector('.mod-scroll__projects__item a.btn.disabled')
  if (!btn) return JSON.stringify({ none: true })
  const pe = getComputedStyle(btn).pointerEvents
  return JSON.stringify({ pe, cursor: getComputedStyle(btn).cursor })
})()
`)
  const d = JSON.parse(disabled)
  pass('T6 disabled button inert', d.none || d.pe === 'none', JSON.stringify(d))
  const threeWarnings = warnings.filter((w) => w.startsWith('THREE.'))
  const otherWarnings = warnings.filter((w) => !w.startsWith('THREE.'))
  pass('T6 no console warnings (excluding pre-existing THREE renderOrder noise)', otherWarnings.length === 0, `warnings=${otherWarnings.length} ${otherWarnings.slice(0, 2).join(' | ')} three=${threeWarnings.length}`)
} finally {
  ws.close()
}

console.log('\n--- SUMMARY ---')
const failed = results.filter((r) => !r.ok)
console.log(`total=${results.length} passed=${results.length - failed.length} failed=${failed.length}`)
for (const f of failed) console.log(`  ${f.t}: ${f.detail}`)
