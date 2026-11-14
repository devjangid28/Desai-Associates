// Measure the Projects horizontal-scroll behavior of a site at a viewport.
// Usage: node qa/measure-projects.mjs --site=ref|mine --vp=1917x916
//   site=ref  -> https://normalisboring.es/
//   site=mine -> http://127.0.0.1:5173/?debug=1
// Sweeps the full pinned range with real wheel events (40px), waiting for
// 400ms of stability before every sample, and saves a rich JSON:
//   qa/ref/projects-<vp>.json  or  qa/mine/projects-<vp>.json
import { writeFileSync } from 'node:fs'
import { launchChrome, connectCDP, evalJS, setViewport, wheel, sleep } from './lib/cdp.mjs'

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)=(.*)$/)
  return m ? [m[1], m[2]] : [a, true]
}))
const SITE = args.site || 'ref'
const VP = (args.vp || '1917x916').split('x').map(Number)
const W = VP[0]
const H = VP[1]
const URL = SITE === 'ref' ? 'https://normalisboring.es/' : 'http://127.0.0.1:5173/?debug=1'
const OUT = `C:\\Users\\DK\\Desktop\\interior design\\qa\\${SITE}\\projects-${W}x${H}.json`
const PORT = SITE === 'ref' ? 9231 : 9232

const READ = `
(() => {
  const R = (v) => Math.round(v * 100) / 100
  const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { l: R(r.left), r: R(r.right), t: R(r.top), b: R(r.bottom), w: R(r.width), h: R(r.height) } }
  const mx = (el) => { if (!el) return null; const m = new DOMMatrix(getComputedStyle(el).transform); return { e: R(m.e), f: R(m.f), a: R(m.a), d: R(m.d) } }
  const cs = (el, p) => { if (!el) return null; return getComputedStyle(el)[p] }
  const s = {}
  const wrapText = document.querySelector('.mod-scroll__projects__wrap-text')
  const introText = document.querySelector('.mod-scroll__projects__text')
  s.intro = wrapText ? { ...rect(wrapText), bg: cs(wrapText, 'backgroundColor'), pl: parseFloat(cs(wrapText, 'paddingLeft') || '0'), pr: parseFloat(cs(wrapText, 'paddingRight') || '0'), pt: parseFloat(cs(wrapText, 'paddingTop') || '0'), pb: parseFloat(cs(wrapText, 'paddingBottom') || '0') } : null
  s.introLabel = (() => { const l = document.querySelector('.mod-scroll__projects__section'); return l ? { ...mx(l), op: R(parseFloat(cs(l, 'opacity'))), color: cs(l, 'color') } : null })()
  s.introLines = introText ? Array.from(introText.querySelectorAll('span')).map((el) => mx(el)) : []
  s.introLinesCnt = introText ? introText.querySelectorAll('span').length : 0
  const panels = Array.from(document.querySelectorAll('.mod-scroll__projects__item:not(.last-item)'))
  s.panels = panels.map((p) => {
    const media = p.querySelector('.media__source')
    const btn = p.querySelector('a.btn')
    const dataSpans = Array.from(p.querySelectorAll('.mod-scroll__projects__item__text__data span:not(.data-number)')).map((el) => mx(el))
    const dataNum = (() => { const n = p.querySelector('.data-number'); return n ? R(parseFloat(cs(n, 'opacity'))) : null })()
    const btnState = btn ? { op: R(parseFloat(cs(btn, 'opacity'))), m: mx(btn) } : null
    const titleEl = p.querySelector('.mod-scroll__projects__item__text__title')
    const chars = titleEl ? Array.from(titleEl.querySelectorAll('.char')).slice(0, 8).map((c) => mx(c)) : []
    return { ...rect(p), imgH: media ? R(media.getBoundingClientRect().height) : null, imgM: media ? mx(media) : null, dataSpans, dataNum, btn: btnState, chars }
  })
  const last = document.querySelector('.mod-scroll__projects__item.last-item')
  s.last = last ? rect(last) : null
  const track = document.querySelector('.mod-scroll__projects')
  s.trackX = track ? (() => { const m = mx(track); return m ? m.e : null })() : null
  s.sy = window.scrollY
  s.iw = window.innerWidth
  s.ih = window.innerHeight
  s.p = window.__SCROLL_P__ ? (() => { try { const v = window.__SCROLL_P__(); return v && Number.isFinite(v.p) ? v.p : null } catch { return null } })() : null
  return JSON.stringify(s)
})()
`

async function waitReady(send) {
  if (SITE === 'mine') {
    for (let i = 0; i < 160; i++) {
      const r = await evalJS(send, `(() => {
        const pre = document.querySelector('.preloader')
        const preGone = !pre || getComputedStyle(pre).display === 'none'
        return preGone && !!window.__M_FD__ && document.fonts.status === 'loaded' && !!document.querySelector('.mod-scroll')
      })()`).catch(() => null)
      if (r) return true
      await sleep(350)
    }
    return false
  }
  for (let i = 0; i < 220; i++) {
    const r = await evalJS(send, `(() => {
      const pre = document.querySelector('.preloader, .preloader-wrap, [class*=preload]')
      const preGone = !pre || getComputedStyle(pre).display === 'none'
      let trigs = 0
      try { const ST = window.__ST__ || (typeof ScrollTrigger !== 'undefined' ? ScrollTrigger : null); trigs = ST ? ST.getAll().length : 0 } catch {}
      let lenisOk = true
      try { lenisOk = typeof lenis === 'undefined' || lenis.isStopped === false || (window.__lenis && window.__lenis.isStopped === false) } catch { lenisOk = true }
      return preGone && trigs >= 4 && lenisOk && !!document.querySelector('.mod-scroll')
    })()`).catch(() => null)
    if (r) return true
    await sleep(350)
  }
  return false
}

async function findPinEnd(send) {
  let guard = 0
  let lastX = null
  let same = 0
  let sawMovement = false
  while (guard++ < 600) {
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

async function toTop(send) {
  for (let i = 0; i < 80; i++) {
    await wheel(send, -500)
    await sleep(50)
    const y = await evalJS(send, `window.scrollY`).catch(() => 9999)
    if (y <= 0) break
  }
  await sleep(600)
}

const trackProbe = `
(() => {
  const t = document.querySelector('.mod-scroll__projects')
  const m = t ? new DOMMatrix(getComputedStyle(t).transform) : null
  return JSON.stringify({ x: m ? m.e : 0, y: window.scrollY })
})()
`

async function sampleOnce(send) {
  for (let k = 0; k < 6; k++) {
    try { return JSON.parse(await evalJS(send, READ)) } catch { await sleep(200) }
  }
  throw new Error('sample failed')
}

const chrome = launchChrome(PORT, `proj-${SITE}-${W}`, { w: W, h: H })
const { ws, send } = await connectCDP(PORT)
try {
  await send('Runtime.enable')
  await setViewport(send, W, H)
  await send('Page.navigate', { url: URL })
  const ok = await waitReady(send)
  if (!ok) throw new Error(`${SITE} never ready`)
  if (SITE === 'ref') {
    await evalJS(send, `(() => { const b = document.querySelector('.cky-btn-accept, .cky-btn-reject'); if (b) b.click(); })()`).catch(() => {})
    await sleep(2500)
  }
  await toTop(send)
  const yEnd = await findPinEnd(send)
  const yStart = 0
  console.log(`[${SITE} ${W}x${H}] pin ${Math.round(yStart)}..${Math.round(yEnd)}`)
  await toTop(send)

  const samples = []
  let guard = 0
  const wheelDelta = 40
  while (guard++ < 1400) {
    await wheel(send, wheelDelta)
    let last = null
    let stableCnt = 0
    for (let k = 0; k < 30; k++) {
      const p = await evalJS(send, trackProbe).catch(() => null)
      if (p && last) {
        if (Math.abs(p.x - last.x) < 1 && Math.abs(p.y - last.y) < 1) stableCnt++
        else stableCnt = 0
      }
      last = p
      if (stableCnt >= 2) break
      await sleep(30)
    }
    const st = await sampleOnce(send)
    samples.push(st)
    if (samples.length % 30 === 0) {
      console.log(`[${SITE}] sample ${samples.length} y=${Math.round(st.sy)} introL=${st.intro ? Math.round(st.intro.l / st.iw * 1000) / 10 : '?'} p1L=${st.panels[0] ? Math.round(st.panels[0].l / st.iw * 1000) / 10 : '?'}`)
      writeFileSync(OUT, JSON.stringify({ site: SITE, viewport: { w: W, h: H }, yStart, yEnd, n: samples.length, samples }, null, 1))
    }
    if (st.sy >= yEnd - 2) break
  }
  writeFileSync(OUT, JSON.stringify({ site: SITE, viewport: { w: W, h: H }, yStart, yEnd, n: samples.length, samples }, null, 1))
  console.log(`[${SITE}] saved ${samples.length} samples -> ${OUT}`)
} finally {
  ws.close()
  chrome.kill()
}
