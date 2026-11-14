// STEP 1d: hover recordings on the reference.
// - follow __mouse over each term (3 scroll positions), 50ms samples
// - button rollover (enter from left, then leave)
// - custom cursor (#mouse) behavior + native cursor computed styles
// Output qa/ref/hover-<W>x<H>.json
import { writeFileSync, mkdirSync } from 'node:fs'
import { launchChrome, connectCDP, evalJS, setViewport, wheel, mouseMove, sleep } from './lib/cdp.mjs'

process.on('unhandledRejection', (e) => { console.error('UHR', e && e.message); process.exit(1) })

const URL = 'https://normalisboring.es/'
const OUT_DIR = 'C:\\Users\\DK\\Desktop\\interior design\\qa\\ref'
mkdirSync(OUT_DIR, { recursive: true })
const VP = JSON.parse(process.env.VP_JSON || '{"w":1440,"h":900}')
const PORT = 9261 + (VP.w % 100)

const chrome = launchChrome(PORT, `ref-hover-${VP.w}`, { w: VP.w, h: VP.h })
const { ws, send } = await connectCDP(PORT)

const READ_FOLLOW = `
(() => {
  const F = document.querySelector('.mod-scroll__terms .follow__mouse')
  const M = document.querySelector('#mouse')
  if (!F) return null
  const fm = new DOMMatrix(getComputedStyle(F).transform)
  const mm = M ? new DOMMatrix(getComputedStyle(M).transform) : null
  const mr = M ? M.getBoundingClientRect() : null
  return JSON.stringify({
    t: performance.now(),
    sy: window.scrollY,
    fOp: parseFloat(getComputedStyle(F).opacity),
    fX: Math.round(fm.e * 100) / 100,
    fY: Math.round(fm.f * 100) / 100,
    fScale: Math.round(fm.a * 100) / 100,
    fW: Math.round(F.getBoundingClientRect().width),
    imgs: Array.from(F.querySelectorAll('img')).map((i) => ({
      cls: String(i.className),
      clip: getComputedStyle(i).clipPath,
      a: Math.round(new DOMMatrix(getComputedStyle(i).transform).a * 100) / 100,
    })),
    mouse: M ? {
      disp: getComputedStyle(M).display,
      x: mm ? Math.round(mm.e * 100) / 100 : null,
      y: mm ? Math.round(mm.f * 100) / 100 : null,
      w: mr ? Math.round(mr.width) : null,
      op: parseFloat(getComputedStyle(M).opacity),
    } : null,
    cur: getComputedStyle(document.body).cursor,
  })
})()
`

async function gotoScroll(send, targetY, step = 100) {
  let guard = 0
  while (guard++ < 400) {
    const y = await evalJS(send, `window.scrollY`).catch(() => 0)
    if (Math.abs(y - targetY) < 30) return
    await wheel(send, y < targetY ? step : -step)
    await sleep(40)
  }
}

async function termCenters(send) {
  const info = await evalJS(send, `
  (() => {
    const terms = Array.from(document.querySelectorAll('.mod-scroll__terms__term'))
    const F = document.querySelector('.mod-scroll__terms .follow__mouse')
    const r = F ? F.getBoundingClientRect() : null
    return JSON.stringify({
      terms: terms.map((t) => { const r = t.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width), h: Math.round(r.height) } }),
      follow: r ? { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width) } : null,
      iw: innerWidth, ih: innerHeight,
    })
  })()`).catch(() => null)
  return info ? JSON.parse(info) : null
}

try {
  await send('Runtime.enable')
  await setViewport(send, VP.w, VP.h)
  await send('Page.navigate', { url: URL })
  for (let i = 0; i < 220; i++) {
    const r = await evalJS(send, `(() => {
      const pre = document.querySelector('.preloader, .preloader-wrap, [class*=preload]')
      const preGone = !pre || getComputedStyle(pre).display === 'none'
      let lenisOk = false
      try { lenisOk = typeof lenis !== 'undefined' && lenis.isStopped === false } catch (e) {}
      return preGone && lenisOk && !!document.querySelector('.mod-scroll__terms .follow__mouse')
    })()`).catch(() => null)
    if (r) break
    await sleep(350)
  }
  await evalJS(send, `(() => { const b = document.querySelector('.cky-btn-accept, .cky-btn-reject'); if (b) b.click(); })()`).catch(() => {})
  await sleep(2000)

  // wheel forward until the terms block occupies the viewport
  let guard = 0
  let centers = null
  while (guard++ < 500) {
    centers = await termCenters(send)
    if (centers && centers.terms.length === 3 && centers.terms[1] && centers.terms[1].x > 100 && centers.terms[1].x < centers.iw - 100) break
    await wheel(send, 80)
    await sleep(40)
  }
  if (!centers) throw new Error('terms never centered')
  console.log(`[hover ${VP.w}x${VP.h}] terms centers`, JSON.stringify(centers.terms))
  await sleep(800)

  const rec = { viewport: VP, terms: centers.terms, scrolls: [] }
  const sample = async (ms) => {
    const out = []
    for (let i = 0; i < ms / 50; i++) {
      const s = await evalJS(send, READ_FOLLOW).catch(() => null)
      if (s) out.push(JSON.parse(s))
      await sleep(50)
    }
    return out
  }

  // For 3 scroll positions: shift the track a bit (wheel 300px between) and
  // hover term 1, then switch to term 2, then leave the area.
  for (let sc = 0; sc < 3; sc++) {
    const entry = { scroll: sc, events: [] }
    const center = centers.terms[1]
    // hover term 1
    await mouseMove(send, center.x, center.y)
    entry.events.push({ kind: 'enter-term1', samples: await sample(1500) })
    // switch to term 2
    const c2 = centers.terms[2]
    if (c2) {
      await mouseMove(send, c2.x, c2.y)
      entry.events.push({ kind: 'switch-to-term2', samples: await sample(1500) })
    }
    // leave the terms box (move to top-right corner)
    await mouseMove(send, VP.w - 10, 10)
    entry.events.push({ kind: 'leave', samples: await sample(1000) })
    rec.scrolls.push(entry)
    if (sc < 2) await wheel(send, 400) // advance to next scroll position
    await sleep(700)
  }

  // ---- button rollover: find first enabled project button ----
  let btn = await evalJS(send, `
  (() => {
    const b = document.querySelector('.mod-scroll__projects__item:not(.last-item) a.btn:not(.disabled)')
    if (!b) return null
    const r = b.getBoundingClientRect()
    return JSON.stringify({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), l: Math.round(r.left), t: Math.round(r.top) })
  })()`).catch(() => null)
  // button not visible yet: scroll until it enters viewport
  let guardBtn = 0
  while (!btn && guardBtn++ < 400) {
    await wheel(send, 100)
    await sleep(60)
    btn = await evalJS(send, `
    (() => {
      const b = document.querySelector('.mod-scroll__projects__item:not(.last-item) a.btn:not(.disabled)')
      if (!b) return null
      const r = b.getBoundingClientRect()
      if (r.right < 0 || r.left > innerWidth) return null
      return JSON.stringify({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), l: Math.round(r.left), t: Math.round(r.top) })
    })()`).catch(() => null)
  }
  const btnRec = { found: !!btn }
  if (btn) {
    const READ_BTN = `
    (() => {
      const b = document.querySelector('.mod-scroll__projects__item:not(.last-item) a.btn:not(.disabled)')
      const s = b.querySelector(':scope > span')
      const beforeFill = getComputedStyle(b, '::before').backgroundColor
      return JSON.stringify({
        t: performance.now(),
        span: s ? (() => { const m = new DOMMatrix(getComputedStyle(s).transform); return { x: Math.round(m.e), y: Math.round(m.f) } })() : null,
        color: getComputedStyle(b).color,
        beforeFill,
        posX: getComputedStyle(b).getPropertyValue('--posX'),
        posY: getComputedStyle(b).getPropertyValue('--posY'),
      })
    })()`
    const samples = []
    // move to just left of the button, then enter
    await mouseMove(send, btn.l - 40, btn.y)
    await sleep(100)
    await mouseMove(send, btn.l + 2, btn.y)
    for (let i = 0; i < 24; i++) {
      const s = await evalJS(send, READ_BTN).catch(() => null)
      if (s) samples.push(JSON.parse(s))
      await sleep(40)
    }
    await mouseMove(send, btn.l - 60, btn.y)
    for (let i = 0; i < 20; i++) {
      const s = await evalJS(send, READ_BTN).catch(() => null)
      if (s) samples.push(JSON.parse(s))
      await sleep(40)
    }
    btnRec.samples = samples
  }
  rec.button = btnRec

  // ---- native cursor styles across elements ----
  rec.cursors = await evalJS(send, `
  (() => {
    const pick = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).cursor : null }
    return JSON.stringify({
      body: pick('body'),
      link: pick('main a[href]'),
      img: pick('.mod-scroll__projects__item__image img'),
      term: pick('.mod-scroll__terms__term'),
      btn: pick('.mod-scroll__projects__item a.btn:not(.disabled)'),
      mouseExists: !!document.querySelector('#mouse'),
      mouseDisplay: (() => { const m = document.querySelector('#mouse'); return m ? getComputedStyle(m).display : null })(),
    })
  })()`)

  writeFileSync(`${OUT_DIR}\\hover-${VP.w}x${VP.h}.json`, JSON.stringify(rec, null, 1))
  console.log(`[hover ${VP.w}x${VP.h}] saved, button=${btnRec.found} cursors=${rec.cursors}`)
} finally {
  ws.close()
  chrome.kill()
}
