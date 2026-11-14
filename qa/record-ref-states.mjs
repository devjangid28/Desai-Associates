// STEP 1: Record reference scroll states as DATA.
// Drives https://normalisboring.es/ with real wheel events (deltaY grid40)
// and samples the whole values+projects range after 400ms stability.
// Outputs qa/ref/states-<W>x<H>.json
import { writeFileSync, mkdirSync } from 'node:fs'
import { launchChrome, connectCDP, evalJS, setViewport, wheel, waitStable, sleep } from './lib/cdp.mjs'

const URL = process.env.SRC || 'https://normalisboring.es/'
const OUT_DIR = process.env.OUT || 'C:\\Users\\DK\\Desktop\\interior design\\qa\\ref'
mkdirSync(OUT_DIR, { recursive: true })
const ALL_VIEWPORTS = [
  { w: 1920, h: 1080 },
  { w: 1440, h: 900 },
  { w: 1366, h: 768 },
]
const VIEWPORTS = (process.env.VP ? [process.env.VP] : []).map((tag) => ALL_VIEWPORTS.find((v) => `${v.w}x${v.h}` === tag) || ALL_VIEWPORTS[0])

const READ = `
(() => {
  const R = (v) => Math.round(v * 100) / 100
  const mx = (el) => { if (!el) return null; const m = new DOMMatrix(getComputedStyle(el).transform); return { e: R(m.e), f: R(m.f), a: R(m.a), d: R(m.d) } }
  const st = (el, p) => { if (!el) return null; const v = getComputedStyle(el)[p]; return typeof v === 'string' ? v : v }
  const s = {}
  const terms = Array.from(document.querySelectorAll('.mod-scroll__terms__term'))
  s.trackX = (() => { const t = document.querySelector('.mod-scroll__projects'); const m = t ? mx(t) : null; return m ? m.e : null })()
  s.termsX = (() => { const t = document.querySelector('.mod-scroll__terms'); const m = t ? mx(t) : null; return m ? m.e : null })()
  s.wrapTop = (() => { const w = document.querySelector('.mod-scroll'); return w ? R(w.getBoundingClientRect().top) : null })()
  s.terms = terms.map((t) => ({
    pl: R(parseFloat(st(t, 'paddingLeft') || '0')),
    pr: R(parseFloat(st(t, 'paddingRight') || '0')),
    num: (() => { const n = t.querySelector('.mod-scroll__terms__term__num'); return n ? R(parseFloat(st(n, 'opacity'))) : null })(),
  }))
  s.titleC = terms.map((t) => { const c = t.querySelector('.mod-scroll__terms__term__title__color'); return c ? st(c, 'color') : null })
  s.titleF = terms.map((t) => { const f = t.querySelector('.mod-scroll__terms__term__title__filter'); return f ? st(f, 'filter') : null })
  s.titleM = terms.map((t) => { const c = t.querySelector('.mod-scroll__terms__term__title'); return c ? st(c, 'mixBlendMode') : null })
  s.titleOp = terms.map((t) => { const c = t.querySelector('.mod-scroll__terms__term__title'); return c ? R(parseFloat(st(c, 'opacity'))) : null })
  s.mobile = (() => {
    const g = document.querySelector('.mod-scroll__terms__term__text-group .mod-scroll__terms__term__text__single')
    const all = document.querySelectorAll('.mod-scroll__terms__term__text-group .mod-scroll__terms__term__text__single')
    if (!all.length) return []
    return Array.from(all).map((el) => ({ op: R(parseFloat(st(el, 'opacity'))), m: mx(el) }))
  })()
  const F = document.querySelector('.mod-scroll__terms .follow__mouse')
  s.follow = F ? {
    op: R(parseFloat(st(F, 'opacity'))),
    m: mx(F),
    w: R(F.getBoundingClientRect().width),
    imgs: Array.from(F.querySelectorAll('img')).map((i) => ({
      cls: String(i.className),
      clip: st(i, 'clipPath'),
      m: mx(i),
    })),
  } : null
  s.introLines = (() => {
    const txt = document.querySelector('.mod-scroll__projects__text')
    if (!txt) return []
    return Array.from(txt.querySelectorAll('span')).map((el) => mx(el))
  })()
  s.introLabel = (() => { const l = document.querySelector('.mod-scroll__projects__section'); return l ? mx(l) : null })()
  const panels = Array.from(document.querySelectorAll('.mod-scroll__projects__item:not(.last-item)'))
  s.panels = panels.map((p) => {
    const media = p.querySelector('.media__source')
    const btn = p.querySelector('a.btn')
    const dataSpans = Array.from(p.querySelectorAll('.mod-scroll__projects__item__text__data span:not(.data-number)')).map((el) => mx(el))
    const dataNum = (() => { const n = p.querySelector('.data-number'); return n ? R(parseFloat(st(n, 'opacity'))) : null })()
    const btnState = btn ? { op: R(parseFloat(st(btn, 'opacity'))), m: mx(btn) } : null
    const titleEl = p.querySelector('.mod-scroll__projects__item__text__title')
    const chars = titleEl ? Array.from(titleEl.querySelectorAll('.char')).slice(0, 5).map((c) => mx(c)) : []
    const r = p.getBoundingClientRect()
    return {
      w: R(r.width),
      l: R(r.left),
      imgH: media ? R(media.getBoundingClientRect().height) : null,
      imgM: media ? mx(media) : null,
      dataSpans,
      dataNum,
      btn: btnState,
      chars,
    }
  })
  const last = document.querySelector('.mod-scroll__projects__item.last-item')
  s.last = last ? { l: R(last.getBoundingClientRect().left), w: R(last.getBoundingClientRect().width) } : null
  s.sy = window.scrollY
  s.iw = window.innerWidth
  return JSON.stringify(s)
})()
`

async function waitReady(send) {
  for (let i = 0; i < 220; i++) {
    const r = await evalJS(send, `(() => {
      const pre = document.querySelector('.preloader, .preloader-wrap, [class*=preload]')
      const preGone = !pre || getComputedStyle(pre).display === 'none'
      let trigs = 0
      try {
        const ST = window.__ST__ || (typeof ScrollTrigger !== 'undefined' ? ScrollTrigger : null)
        trigs = ST ? ST.getAll().length : 0
      } catch (e) {}
      let lenisOk = true
      try { lenisOk = typeof lenis === 'undefined' || lenis.isStopped === false || (window.__lenis && window.__lenis.isStopped === false) } catch (e) { lenisOk = true }
      const isMine = typeof window.__ST__ !== 'undefined'
      return preGone && trigs >= 4 && (isMine || lenisOk) && !!document.querySelector('.mod-scroll')
    })()`).catch(() => null)
    if (r) return true
    await sleep(350)
  }
  return false
}

async function toTop(send) {
  for (let i = 0; i < 60; i++) {
    await wheel(send, -500)
    await sleep(60)
    const y = await evalJS(send, `window.scrollY`).catch(() => 9999)
    if (y <= 0) break
  }
  await sleep(600)
}

async function findPinEnd(send) {
  // The section is pinned from the top; the horizontal phase ends when the
  // track x reaches its final stable value. Wheel until x stops changing.
  let guard = 0
  let lastX = null
  let same = 0
  let sawMovement = false
  while (guard++ < 500) {
    const info = await evalJS(send, `
    (() => {
      const t = document.querySelector('.mod-scroll__projects')
      const m = t ? new DOMMatrix(getComputedStyle(t).transform) : null
      return JSON.stringify({ x: m ? m.e : 0, y: window.scrollY })
    })()`).catch(() => null)
    if (!info) break
    const { x, y } = JSON.parse(info)
    if (Math.abs(x) > 50) sawMovement = true
    if (sawMovement && lastX !== null && Math.abs(x - lastX) < 0.5) {
      same++
      if (same >= 5) return y
    } else same = 0
    lastX = x
    await wheel(send, 300)
    await sleep(90)
  }
  throw new Error('pin end not found')
}

const trackProbe = `
(() => {
  const t = document.querySelector('.mod-scroll__projects')
  const terms = document.querySelector('.mod-scroll__terms__term')
  const m = t ? new DOMMatrix(getComputedStyle(t).transform) : null
  const p = terms ? parseFloat(getComputedStyle(terms).paddingLeft || '0') : 0
  return JSON.stringify({ x: m ? m.e : 0, p, y: window.scrollY })
})()
`

async function sampleOnce(send) {
  for (let k = 0; k < 5; k++) {
    try {
      return JSON.parse(await evalJS(send, READ))
    } catch { await sleep(200) }
  }
  throw new Error('sample failed')
}

async function recordViewport(vp) {
  const PORT_BASE = Number(process.env.PORT_BASE || 9227)
  const chrome = launchChrome(PORT_BASE + vp.w % 100, `states-${vp.w}`, { w: vp.w, h: vp.h })
  const { ws, send } = await connectCDP(PORT_BASE + vp.w % 100)
  try {
    await send('Runtime.enable')
    await setViewport(send, vp.w, vp.h)
    await send('Page.navigate', { url: URL })
    const ok = await waitReady(send)
    if (!ok) throw new Error('reference never ready')
    await evalJS(send, `(() => { const b = document.querySelector('.cky-btn-accept, .cky-btn-reject'); if (b) b.click(); })()`).catch(() => {})
    await sleep(2500)
    await toTop(send)
    const yEnd = await findPinEnd(send)
    const yStart = 0
    console.log(`[${vp.w}x${vp.h}] pin ${Math.round(yStart)}..${Math.round(yEnd)}`)
    await toTop(send)

    // fine sampling
    const samples = []
    let guard = 0
    let wheelDelta = Number(process.env.STEP || 40)
    while (guard++ < 1200) {
      await wheel(send, wheelDelta)
      // wait until tracked values stop changing
      let last = null
      let stableCnt = 0
      for (let k = 0; k < 30; k++) {
        const p = await evalJS(send, trackProbe).catch(() => null)
        if (p && last) {
          if (Math.abs(p.x - last.x) < 1 && Math.abs(p.p - last.p) < 0.1 && Math.abs(p.y - last.y) < 1) stableCnt++
          else stableCnt = 0
        }
        last = p
        if (stableCnt >= 2) break
        await sleep(30)
      }
      const st = await sampleOnce(send)
      const sy = st.sy
      samples.push(st)
      if (samples.length % 20 === 0) {
        console.log(`[${vp.w}x${vp.h}] sample ${samples.length} y=${Math.round(sy)} trackX=${st.trackX} pad0=${st.terms[0] && st.terms[0].pl}`)
        writeFileSync(`${OUT_DIR}\\states-${vp.w}x${vp.h}.json`, JSON.stringify({ viewport: vp, yStart, yEnd, n: samples.length, samples }, null, 1))
      }
      if (sy >= yEnd - 2) break
    }
    writeFileSync(`${OUT_DIR}\\states-${vp.w}x${vp.h}.json`, JSON.stringify({ viewport: vp, yStart, yEnd, n: samples.length, samples }, null, 1))
    console.log(`[${vp.w}x${vp.h}] saved ${samples.length} samples`)
  } finally {
    ws.close()
    chrome.kill()
  }
}

for (const vp of VIEWPORTS) {
  await recordViewport(vp)
}
