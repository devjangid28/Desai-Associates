// STEP 0: snapshot the current build's last-item phase BEFORE any change.
// Samples 12 positions across the pinned range at 1920x1080, 1440x900 and
// 1366x768 and writes qa/last-item-before.json. Any later deviation from
// this file (track x, panel widths, carousel/content transform, title chars,
// paragraph lines) is a failure.
import { writeFileSync } from 'node:fs'
import { launchChrome, connectCDP, evalJS, setViewport, sleep } from './lib/cdp.mjs'

const SRC = 'http://127.0.0.1:5173/?debug=1'
const PORT = 9222
const OUT = 'C:\\Users\\DK\\Desktop\\interior design\\qa\\last-item-before.json'
const VIEWPORTS = [
  { w: 1920, h: 1080, tag: '1920x1080' },
  { w: 1440, h: 900, tag: '1440x900' },
  { w: 1366, h: 768, tag: '1366x768' },
]

const chrome = launchChrome(PORT, 'last-item-before', { w: 1920, h: 1080 })
const { ws, send } = await connectCDP(PORT)
await send('Runtime.enable')

const waitSettled = async () => {
  for (let i = 0; i < 120; i++) {
    const r = await evalJS(send, `(() => {
      const pre = document.querySelector('.preloader')
      const preGone = !pre || getComputedStyle(pre).display === 'none'
      return preGone && !!window.__M_FD__ && document.fonts.status === 'loaded' && !!document.querySelector('.mod-scroll')
    })()`).catch(() => null)
    if (r) return true
    await sleep(400)
  }
  return false
}

const READ = `
(() => {
  const R = (v) => Math.round(v * 100) / 100
  const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { l: R(r.left), r: R(r.right), t: R(r.top), b: R(r.bottom), w: R(r.width), h: R(r.height) } }
  const mx = (el) => { if (!el) return null; const m = new DOMMatrix(getComputedStyle(el).transform); return { e: R(m.e), f: R(m.f), a: R(m.a), d: R(m.d) } }
  const sc = document.querySelector('.mod-scroll')
  const last = document.querySelector('.mod-scroll__projects__item.last-item')
  const car = last ? last.querySelector('.last-item__carousel') : null
  const content = last ? last.querySelector('.last-item__content') : null
  const title = last ? last.querySelector('.last-item__content__title') : null
  const para = last ? last.querySelector('.last-item__content__text') : null
  const panels = Array.from(document.querySelectorAll('.mod-scroll__projects__item')).map((p) => rect(p))
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
  const wrap = document.querySelector('.mod-scroll-wrap')
  const wrapRect = wrap ? wrap.getBoundingClientRect() : null
  const top = wrapRect ? wrapRect.top + window.scrollY : 0
  const fin = window.__FINAL_DIST__ ? window.__FINAL_DIST__() : null
  return JSON.stringify({
    scrollY: window.scrollY,
    iw: window.innerWidth, ih: window.innerHeight,
    track: mx(sc),
    sectionsX: (() => { const s = sc ? sc.querySelector(':scope > div') : null; return s ? mx(s) : null })(),
    panels,
    group: rect(last),
    car: rect(car),
    carT: mx(car),
    content: rect(content),
    contentT: mx(content),
    titleChars,
    paraLines,
    pinStart: R(top),
    pinEnd: fin !== null ? R(top + fin) : null,
    finalDist: fin,
  })
})()
`

async function sampleViewport(vp) {
  await setViewport(send, vp.w, vp.h)
  await send('Page.navigate', { url: SRC })
  const ok = await waitSettled()
  console.log(`[${vp.tag}] settled=${ok}`)
  await evalJS(send, `(() => { const L = window.__lenis; if (L) { try { L.destroy() } catch (e) {} } })()`).catch(() => {})
  await evalJS(send, `(() => { window.scrollTo(0, 0); document.scrollingElement.scrollTop = 0; if (window.__ST__ && typeof window.__ST__.update === 'function') window.__ST__.update(); return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))) })()`)
  await sleep(800)
  const rng = JSON.parse(await evalJS(send, `
  (() => {
    const w = document.querySelector('.mod-scroll-wrap')
    if (!w) return null
    const r = w.getBoundingClientRect()
    const top = r.top + window.scrollY
    return JSON.stringify({ start: top, end: top + (w.offsetHeight - window.innerHeight) })
  })()
  `))
  console.log(`[${vp.tag}] pin start=${Math.round(rng.start)} end=${Math.round(rng.end)}`)
  const samples = []
  for (let i = 0; i < 12; i++) {
    const f = i / 11
    const y = Math.round(rng.start + f * (rng.end - rng.start))
    await evalJS(send, `
    (() => {
      window.scrollTo(0, ${y})
      document.scrollingElement.scrollTop = ${y}
      if (window.__ST__ && typeof window.__ST__.update === 'function') window.__ST__.update()
      return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))
    })()
    `)
    await sleep(400)
    let st = null
    for (let k = 0; k < 4; k++) {
      try { st = JSON.parse(await evalJS(send, READ)); break } catch { await sleep(250) }
    }
    if (!st) throw new Error(`no state at f=${f}`)
    st.f = Math.round(f * 1000) / 1000
    samples.push(st)
    console.log(`[${vp.tag}] f=${st.f} trackX=${st.track.e} groupW=${st.group ? st.group.w : '-'} carY=${st.carT ? st.carT.f : '-'}`)
  }
  return { viewport: vp, pinStart: Math.round(rng.start), pinEnd: Math.round(rng.end), samples }
}

try {
  const all = {}
  for (const vp of VIEWPORTS) {
    const rec = await sampleViewport(vp)
    all[vp.tag] = rec
  }
  writeFileSync(OUT, JSON.stringify({ recordedAt: new Date().toISOString(), note: 'current build last-item phase before reference-match work', viewports: all }, null, 1))
  console.log('saved', OUT)
} finally {
  ws.close()
  chrome.kill()
}
