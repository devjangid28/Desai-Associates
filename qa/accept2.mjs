// Acceptance tests T1-T5 for the Projects panels fix (live left-edge driven).
// Usage: node qa/accept2.mjs [1917x916|1920x1080|1440x900 ...]
import { readFileSync, writeFileSync } from 'node:fs'
import { launchChrome, connectCDP, evalJS, setViewport, sleep } from './lib/cdp.mjs'

const SRC = 'http://127.0.0.1:5173/?debug=1'
const PORT = 9250
const VIEWPORTS = process.argv.slice(2).length
  ? process.argv.slice(2).map((s) => s.split('x').map(Number))
  : [[1917, 916], [1920, 1080], [1440, 900]]
const Q = 'C:\\Users\\DK\\Desktop\\interior design\\qa'

const results = []
const pass = (t, ok, detail) => {
  results.push({ t, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${t} ${detail ?? ''}`)
}

const READ = `
(() => {
  const R = (v) => Math.round(v * 100) / 100
  const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { l: R(r.left), r: R(r.right), t: R(r.top), b: R(r.bottom), w: R(r.width), h: R(r.height) } }
  const mx = (el) => { if (!el) return null; const m = new DOMMatrix(getComputedStyle(el).transform); return { e: R(m.e), f: R(m.f), a: R(m.a), d: R(m.d) } }
  const cs = (el, p) => { if (!el) return null; return getComputedStyle(el)[p] }
  const s = {}
  s.sy = window.scrollY
  s.iw = window.innerWidth
  s.ih = window.innerHeight
  s.dw = document.documentElement.scrollWidth
  s.cw = document.documentElement.clientWidth
  const wrap = document.querySelector('.mod-scroll-wrap')
  if (wrap) { const r = wrap.getBoundingClientRect(); s.wrap = { top: R(r.top + window.scrollY), h: R(wrap.offsetHeight) } }
  const proj = document.querySelector('.mod-scroll__projects')
  s.trackX = proj ? (() => { const m = mx(proj); return m ? m.e : null })() : null
  const terms = Array.from(document.querySelectorAll('.mod-scroll__terms__term'))
  s.terms = terms.map((t) => ({ pl: R(parseFloat(cs(t, 'paddingLeft') || '0')), pr: R(parseFloat(cs(t, 'paddingRight') || '0')) }))
  s.intro = (() => { const el = document.querySelector('.mod-scroll__projects__wrap-text'); return el ? { ...rect(el), bg: cs(el, 'backgroundColor') } : null })()
  s.introLabel = (() => { const el = document.querySelector('.mod-scroll__projects__section'); return el ? mx(el) : null })()
  s.introLines = (() => { const el = document.querySelector('.mod-scroll__projects__text'); return el ? Array.from(el.querySelectorAll('span')).map((x) => mx(x)) : [] })()
  const items = Array.from(document.querySelectorAll('.mod-scroll__projects__item:not(.last-item)'))
  s.panels = items.map((p) => {
    const media = p.querySelector('.media__source')
    const btn = p.querySelector('a.btn')
    const ds = Array.from(p.querySelectorAll('.mod-scroll__projects__item__text__data span:not(.data-number)')).map((el) => mx(el))
    const words = Array.from(p.querySelectorAll('.mod-scroll__projects__item__text__title div div')).slice(0, 8).map((c) => mx(c))
    return { ...rect(p), imgH: media ? R(media.getBoundingClientRect().height) : null, ds, btn: btn ? { op: R(parseFloat(cs(btn, 'opacity'))) } : null, words }
  })
  const last = document.querySelector('.mod-scroll__projects__item.last-item')
  if (last) {
    const car = last.querySelector('.last-item__carousel')
    const content = last.querySelector('.last-item__content')
    const title = last.querySelector('.last-item__content__title')
    const para = last.querySelector('.last-item__content__text')
    const titleChars = title ? Array.from(title.querySelectorAll('.char')).map((c) => mx(c)) : []
    let paraLines = []
    if (para) {
      const p = para.querySelector('p')
      paraLines = Array.from(p ? p.querySelectorAll('.line') : []).map((l) => {
        const r = rect(l)
        const inner = l.querySelector('span')
        const m = inner ? mx(inner) : null
        return { ...r, y: m ? m.f : 0 }
      })
    }
    s.group = rect(last)
    s.car = rect(car)
    s.carT = mx(car)
    s.content = rect(content)
    s.contentT = mx(content)
    s.titleChars = titleChars
    s.paraLines = paraLines
    s.panelW = last.style.getPropertyValue('--panel-w')
  }
  return JSON.stringify(s)
})()
`

const chrome = launchChrome(PORT, 'accept2', { w: 1920, h: 1080 })
const { ws, send } = await connectCDP(PORT)
await send('Runtime.enable')
const warnings = []
{
  const orig = ws.onmessage
  ws.onmessage = (ev) => {
    let msg
    try { msg = JSON.parse(ev.data) } catch { return }
    if (msg.id && msg.id < 100000) { orig(ev); return }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'warning') {
      const txt = msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')
      if (!txt.startsWith('THREE.')) warnings.push(txt.slice(0, 200))
    }
  }
}

async function waitReady() {
  for (let i = 0; i < 150; i++) {
    const r = await evalJS(send, `(() => {
      const pre = document.querySelector('.preloader')
      const preGone = !pre || getComputedStyle(pre).display === 'none'
      return preGone && !!window.__M_FD__ && document.fonts.status === 'loaded' && !!document.querySelector('.mod-scroll-wrap')
    })()`).catch(() => null)
    if (r) return true
    await sleep(400)
  }
  return false
}

async function readState() {
  for (let k = 0; k < 5; k++) {
    try { return JSON.parse(await evalJS(send, READ)) } catch { await sleep(200) }
  }
  return null
}

async function settleF(f, extraWait = 300) {
  const st0 = await readState()
  if (!st0 || !st0.wrap) return null
  const y = Math.round(st0.wrap.top + f * (st0.wrap.h - st0.ih))
  await evalJS(send, `
(() => { window.scrollTo(0, ${y}); document.scrollingElement.scrollTop = ${y}; if (window.__ST__ && typeof window.__ST__.update === 'function') window.__ST__.update(); return new Promise((rs) => requestAnimationFrame(() => requestAnimationFrame(() => rs(true)))) })()`)
  await sleep(extraWait)
  // poll until stable (absorbs slow fonts/layout settles)
  let last = null
  for (let k = 0; k < 10; k++) {
    const st = await readState()
    if (!st || !st.intro) { await sleep(100); continue }
    const il = st.intro.l / st.iw * 100
    if (last !== null && Math.abs(il - last) < 0.2) return st
    last = il
    await sleep(80)
  }
  return readState()
}

const visibleCount = (st) => st.panels.filter((p) => {
  const l = Math.max(p.l, 0)
  const r = Math.min(p.r, st.iw)
  return r - l >= 100
}).length

const refExpect = (W) => {
  const size = `${W}x${W === 1917 ? 916 : W === 1920 ? 1080 : 900}`
  let d = null
  try { d = JSON.parse(readFileSync(`${Q}\\ref\\states-${size}.json`, 'utf8')) } catch { return null }
  return (p1LVw) => {
    let best = null
    let bd = 1e9
    for (const st of d.samples) {
      const dd = Math.abs(st.panels[0].l / W * 100 - p1LVw)
      if (dd < bd) { bd = dd; best = st }
    }
    if (!best) return null
    return best.panels.filter((p) => { const r = Math.min(p.l + p.w, W); const l = Math.max(p.l, 0); return r - l >= 100 }).length
  }
}

async function findFrameByIntroLeft(targetVw, lo0, hi0) {
  let lo = lo0, hi = hi0
  let st = null
  for (let k = 0; k < 18; k++) {
    const mid = (lo + hi) / 2
    st = await settleF(mid, 120)
    if (!st || !st.intro || !st.panels[0]) { hi = mid; continue }
    const il = st.intro.l / st.iw * 100
    if (Math.abs(il - targetVw) < 0.15) return st
    if (il > targetVw) lo = mid; else hi = mid
  }
  st = await settleF((lo + hi) / 2, 350)
  return st
}

async function runViewport(W, H, tag) {
  await setViewport(send, W, H)
  await send('Page.navigate', { url: SRC })
  const ok = await waitReady()
  console.log(`[${tag}] ready=${ok}`)
  if (!ok) { pass(`T0 ${tag} ready`, false, 'not ready'); return }
  await evalJS(send, `(() => { const L = window.__lenis; if (L) { try { L.destroy() } catch (e) {} } })()`).catch(() => {})
  await sleep(600)
  const st0 = await readState()
  if (!st0 || !st0.wrap) { pass(`T0 ${tag} pin`, false, 'no wrap'); return }
  console.log(`[${tag}] pin ${Math.round(st0.wrap.top)}..${Math.round(st0.wrap.top + st0.wrap.h - st0.ih)} iw=${st0.iw} ih=${st0.ih}`)

  // ---- T1 fixture (intro left = 38.4vw) ----
  const fix = await findFrameByIntroLeft(38.4, 0, 0.5)
  if (fix && fix.intro && fix.panels[0] && fix.panels[1]) {
    const il = fix.intro.l / fix.iw * 100
    const p1 = fix.panels[0]
    const p2 = fix.panels[1]
    const p1L = p1.l / fix.iw * 100
    const p1W = p1.w / fix.iw * 100
    const p1H = p1.imgH / fix.ih * 100
    const p2L = p2.l / fix.iw * 100
    const p2W = p2.w / fix.iw * 100
    const linesDone = fix.introLines.every((x) => x && Math.abs(x.f) < 1)
    const labelOK = fix.introLabel && Math.abs(fix.introLabel.f) < 1
    const bgOK = fix.intro.bg === 'rgb(255, 255, 255)' || fix.intro.bg === 'white'
    const wordsAbs = p1.words.map((c) => c && Math.abs(c.f)).filter((v) => v !== null && v !== undefined)
    const textHidden = p1.ds && p1.ds[0] && p1.ds[1] && Math.abs(p1.ds[0].f) > 12 && Math.abs(p1.ds[1].f) > 12 && p1.btn && p1.btn.op === 0 && wordsAbs.length > 0 && Math.min(...wordsAbs) > 10 && Math.max(...wordsAbs) > 30
    pass(`T1 ${tag} intro left 38.4vw`, Math.abs(il - 38.4) <= 0.5, `il=${il.toFixed(2)}`)
    pass(`T1 ${tag} p1 left 64.5 (+-1.5)`, Math.abs(p1L - 64.5) <= 1.5, `p1L=${p1L.toFixed(2)}`)
    pass(`T1 ${tag} p1 width 21.1 (+-1.5)`, Math.abs(p1W - 21.1) <= 1.5, `p1W=${p1W.toFixed(2)}`)
    pass(`T1 ${tag} p1 imgH 84.5 (+-2)`, Math.abs(p1H - 84.5) <= 2, `p1H=${p1H.toFixed(2)}`)
    pass(`T1 ${tag} p2 left 85.6 (+-1.5)`, Math.abs(p2L - 85.6) <= 1.5, `p2L=${p2L.toFixed(2)}`)
    pass(`T1 ${tag} p2 width 15 (+-1.5)`, Math.abs(p2W - 15) <= 1.5, `p2W=${p2W.toFixed(2)}`)
    pass(`T1 ${tag} p1 text hidden`, textHidden, `ds0=${p1.ds[0].f} ds1=${p1.ds[1].f} btn=${p1.btn && p1.btn.op} words=${p1.words.length}`)
    pass(`T1 ${tag} intro paragraph fully revealed`, linesDone, `lines=${JSON.stringify(fix.introLines)}`)
    pass(`T1 ${tag} intro label revealed`, labelOK, `labelF=${fix.introLabel ? fix.introLabel.f : '?'}`)
    pass(`T1 ${tag} intro bg white`, bgOK, `bg=${fix.intro.bg}`)
  } else {
    pass(`T1 ${tag} fixture`, false, 'no fixture state')
  }

  // ---- T2 window checks ----
  const S = 80, E = 20
  let badW = 0
  let badGrow = 0
  for (const f of [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.9, 1]) {
    const st = await settleF(f, 200)
    if (!st) continue
    st.panels.forEach((p) => {
      const l = p.l / st.iw * 100
      const w = p.w / st.iw * 100
      if (l > S && w > 15.5) badW++
      if (l < E && w < 59.6) badGrow++
    })
  }
  pass(`T2 ${tag} no growth right of 80vw`, badW === 0, `bad=${badW}`)
  pass(`T2 ${tag} no growth left of 20vw`, badGrow === 0, `bad=${badGrow}`)

  // ---- T3 visibility vs reference ----
  const expect = refExpect(W)
  let t3ok = true
  let t3detail = []
  if (expect) {
    for (const target of [60, 45, 30, 15, 0, -15]) {
      const st = await findFrameByIntroLeft(target, 0, 0.6)
      if (!st) { t3ok = false; continue }
      const p1L = st.panels[0].l / st.iw * 100
      const got = visibleCount(st)
      const want = expect(p1L)
      t3detail.push(`il≈${target}:got=${got}/want=${want}@p1L=${p1L.toFixed(1)}`)
      if (want === null || got !== want) t3ok = false
      console.log(`[${tag}] T3 il≈${target} got=${got} want=${want} p1L=${p1L.toFixed(1)}`)
    }
  } else {
    t3detail.push('no ref data')
  }
  pass(`T3 ${tag} visible panel counts match reference`, t3ok, t3detail.join(' '))

  // ---- T4 reverse x3 ----
  let t4ok = true
  let t4detail = []
  for (let r = 0; r < 3; r++) {
    await settleF(0.4, 250)
    await settleF(0, 500)
    const st = await readState()
    if (!st) { t4ok = false; t4detail.push('no state'); break }
    const all15 = st.panels.every((p) => Math.abs(p.w / st.iw * 100 - 15) < 1)
    const all87 = st.panels.every((p) => Math.abs(p.imgH / st.ih * 100 - 87) < 2)
    const textHidden = st.panels.every((p) => {
      const ca = p.words.map((c) => c && Math.abs(c.f)).filter((v) => v !== null && v !== undefined)
      return p.ds[0] && p.ds[1] && Math.abs(p.ds[0].f) > 12 && Math.abs(p.ds[1].f) > 12 && p.btn && p.btn.op === 0 && ca.length > 0 && Math.min(...ca) > 10 && Math.max(...ca) > 30
    })
    t4detail.push(`w=[${st.panels.map((p) => (p.w / st.iw * 100).toFixed(1)).join(',')}] h=[${st.panels.map((p) => (p.imgH / st.ih * 100).toFixed(1)).join(',')}]`)
    if (!all15 || !all87 || !textHidden) t4ok = false
  }
  pass(`T4 ${tag} reverse restores start 3x`, t4ok, t4detail.join(' '))

  // ---- T5 overflow ----
  const stEnd = await settleF(1, 400)
  if (stEnd) {
    pass(`T5 ${tag} no horizontal doc overflow`, stEnd.dw <= stEnd.cw + 1, `dw=${stEnd.dw} cw=${stEnd.cw}`)
  }
}

try {
  for (const [W, H] of VIEWPORTS) {
    await runViewport(W, H, `${W}x${H}`)
  }
  pass('T5 no console warnings', warnings.length === 0, `warnings=${warnings.length} ${warnings.slice(0, 3).join(' | ')}`)
} finally {
  ws.close()
}

console.log('\n--- SUMMARY ---')
const failed = results.filter((r) => !r.ok)
console.log(`total=${results.length} passed=${results.length - failed.length} failed=${failed.length}`)
for (const f of failed) console.log(`  ${f.t}: ${f.detail}`)
writeFileSync(`${Q}\\accept2-results.json`, JSON.stringify(results, null, 1))
