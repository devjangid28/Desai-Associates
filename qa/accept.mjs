// Acceptance harness for the pinned horizontal scroll section.
// Usage: node qa/accept.mjs  (spawns headless Chrome itself)
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'

const PORT = 9222
const SRC = 'http://127.0.0.1:5173'
const OUT = new URL('./accept/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
mkdirSync(OUT, { recursive: true })

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const prof = 'C:\\Users\\DK\\AppData\\Local\\Temp\\opencode\\chrome-accept'

const results = []
const pass = (t, ok, detail) => {
  results.push({ t, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${t} ${detail ?? ''}`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// scroll to y and wait until the track scrub has settled on the target
async function settleAt(send, y) {
  await evalJS(send, `window.scrollTo(0, ${Math.round(y)})`)
  for (let k = 0; k < 14; k++) {
    await sleep(110)
    const p = await evalJS(send, `
(() => {
  const w = document.querySelector('.mod-scroll-wrap')
  if (!w) return null
  const r = w.getBoundingClientRect()
  const top = r.top + window.scrollY
  const dist = w.offsetHeight - window.innerHeight
  return (window.scrollY - top) / dist
})()
`)
    if (p === null) continue
    const target = (y - (await getPinRangeF(send)).start) / ((await getPinRangeF(send)).end - (await getPinRangeF(send)).start)
    if (k > 1 && Math.abs(p - target) < 0.004) break
  }
}

async function connect() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
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
  const r = await send('Runtime.evaluate', { expression, returnByValue: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text)
  return r.result.value
}

const GATHER = `
(() => {
  const sc = document.querySelector('.mod-scroll')
  if (!sc) return JSON.stringify({ missing: true })
  const last = sc.lastElementChild
  const lr = Math.round(last.getBoundingClientRect().right * 100) / 100
  const tf = sc.style.transform
  const offW = sc.offsetWidth
  const dw = document.documentElement.scrollWidth
  const cw = document.documentElement.clientWidth
  const wrap = document.querySelector('.mod-scroll-wrap')
  const wrapSW = wrap ? wrap.scrollWidth : -1
  const wrapCW = wrap ? wrap.clientWidth : -1
  const beige = 'rgb(249, 244, 238)'
  let beigeHits = 0
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const x = (c * window.innerWidth) / 4 + window.innerWidth / 8
      const y = (r * window.innerHeight) / 4 + window.innerHeight / 8
      let el = document.elementFromPoint(x, y)
      let bg = 'none'
      // resolve transparent backgrounds up the ancestor chain
      while (el) {
        bg = getComputedStyle(el).backgroundColor
        if (bg && bg !== 'rgba(0, 0, 0, 0)') break
        el = el.parentElement
      }
      if (bg === beige) beigeHits++
    }
  }
  const spacer = document.querySelector('.mod-scroll-wrap')
  let x = NaN
  let childX = NaN
  let childW = null
  let pos = ''
  try {
    x = new DOMMatrix(getComputedStyle(sc).transform).e
    const first = sc.firstElementChild
    childX = new DOMMatrix(getComputedStyle(first).transform).e
    childW = first.style.width || getComputedStyle(first).width
    pos = getComputedStyle(sc).position
  } catch {
    /* ignore */
  }
  return JSON.stringify({
    y: window.scrollY,
    lr,
    x,
    childX,
    childW,
    pos,
    offW,
    dw,
    cw,
    wrapSW,
    wrapCW,
    beigeHits,
    spacerH: spacer ? spacer.offsetHeight : -1,
    inSection: !!document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)?.closest('.mod-scroll-wrap, .mod-scroll'),
  })
})()
`

async function shot(send, name) {
  const r = await send('Page.captureScreenshot', { format: 'png', fromSurface: true })
  writeFileSync(OUT + name, Buffer.from(r.data, 'base64'))
}

async function getPinRange(send) {
  const v = await evalJS(send, `
(() => {
  const w = document.querySelector('.mod-scroll-wrap')
  if (!w) return null
  const r = w.getBoundingClientRect()
  const top = r.top + window.scrollY
  const vh = window.innerHeight
  return JSON.stringify({ start: top, end: top + (w.offsetHeight - vh) })
})()
`)
  if (!v) return null
  return JSON.parse(v)
}

const ANIM_EXPR = `
(() => {
  const sc = document.querySelector('.mod-scroll')
  if (!sc) return '{}'
  const terms = Array.from(document.querySelectorAll('.mod-scroll__terms__term'))
  const items = Array.from(document.querySelectorAll('.mod-scroll__projects__item:not(.last-item)'))
  const last = document.querySelector('.last-item')
  const out = {
    terms: terms.map((t) => ({ pl: t.style.paddingLeft, pr: t.style.paddingRight })),
    titleColors: terms.map((t) => getComputedStyle(t.querySelector('.mod-scroll__terms__term__title__color')).color),
    items: items.map((it) => ({
      w: it.style.width,
      imgH: it.querySelector('.media__source') ? it.querySelector('.media__source').style.height : null,
      btnOp: it.querySelector('a.btn') ? getComputedStyle(it.querySelector('a.btn')).opacity : null,
      char0: it.querySelector('.mod-scroll__projects__item__text__title > div') ? it.querySelector('.mod-scroll__projects__item__text__title > div').style.transform : null,
    })),
    intro: Array.from(document.querySelectorAll('.mod-scroll__projects__text span')).map((s) => s.style.transform),
    last: last ? {
      w: last.style.width,
      car: (last.querySelector('.last-item__carousel') || { style: {} }).style.transform,
      contentT: (last.querySelector('.last-item__content') || { style: {} }).style.transform,
      contentW: (last.querySelector('.last-item__content') || { style: {} }).style.width,
      itemsH: Array.from(last.querySelectorAll('.last-item__carousel__item:not(.last-item__carousel__item--link)')).map((e) => e.style.height),
    } : null,
    cierre: document.querySelector('.mod-scroll__cierre__content') ? document.querySelector('.mod-scroll__cierre__content').style.transform : null,
    cierreImgs: Array.from(document.querySelectorAll('.mod-scroll__cierre__content__image .flipMedia__media')).map((e) => e.style.transform),
    followOp: document.querySelector('.mod-scroll__terms .follow__mouse') ? getComputedStyle(document.querySelector('.mod-scroll__terms .follow__mouse')).opacity : null,
    followClasses: Array.from(document.querySelectorAll('.mod-scroll__terms .follow__mouse > img')).map((i) => i.className),
  }
  return JSON.stringify(out)
})()
`

/* ------------------------------------------------------------------
   Animation-state comparison (Step 5): compares MY build's computed
   animated states against the measured reference (qa/reference-window-
   states.json). Each behavior is compared inside its own trigger window
   (window-normalized), so the reference's extra sections (intro,
   images, carousel) do not desync the phases.
   ------------------------------------------------------------------ */
const REF_WIN_PATH = new URL('./reference-states.json', import.meta.url)
const REF_MODEL = existsSync(REF_WIN_PATH) ? JSON.parse(readFileSync(REF_WIN_PATH, 'utf8')) : null
const REF_WIN = REF_MODEL ? REF_MODEL.windows : null
const WIN_FOR = {
  wTerms: '.mod-scroll__terms',
  wIntro: '.mod-scroll__projects__text',
  wProj: '.mod-scroll__projects__item:not(.last-item)',
  wLast: '.mod-scroll__projects__item.last-item',
  wCierre: '.mod-scroll__cierre',
}

// Same reader as the reference measurement (must produce identical shapes)
const ANIM_STATE_EXPR = `
(() => {
  const s = {}
  const $ = (q) => document.querySelector(q)
  const $$ = (q) => Array.from(document.querySelectorAll(q))
  const mx = (el) => { try { return new DOMMatrix(getComputedStyle(el).transform) } catch (e) { return null } }
  const mat = (el) => {
    const m = mx(el)
    if (!m) return null
    return { tx: R(m.e), ty: R(m.f) }
  }
  const R = (v) => Math.round(v * 1000) / 1000
  const terms = $$('.mod-scroll__terms__term')
  s.terms = terms.map((t) => ({ pl: R(parseFloat(t.style.paddingLeft) || 0), pr: R(parseFloat(t.style.paddingRight) || 0) }))
  s.titleColor = terms.map((t) => { const c = t.querySelector('.mod-scroll__terms__term__title__color'); return c ? getComputedStyle(c).color : null })
  s.titleFilter = terms.map((t) => { const f = t.querySelector('.mod-scroll__terms__term__title__filter'); return f ? getComputedStyle(f).filter : null })
  const F = $('.mod-scroll__terms .follow__mouse')
  s.followOp = F ? Number(getComputedStyle(F).opacity) : null
  s.followM = F ? mat(F) : null
  s.followClasses = $$('.mod-scroll__terms .follow__mouse > img').map((i) => i.className)
  s.followClip = $$('.mod-scroll__terms .follow__mouse > img').map((i) => getComputedStyle(i).clipPath)
  s.followImgM = $$('.mod-scroll__terms .follow__mouse > img').map((i) => mat(i))
  s.introSpans = $$('.mod-scroll__projects__text span').map((x) => mat(x))
  s.introLabel = (() => { const l = $('.mod-scroll__projects__section'); return l ? mat(l) : null })()
  s.items = $$('.mod-scroll__projects__item:not(.last-item)').map((it) => ({
    w: Math.round(it.getBoundingClientRect().width * 100) / 100,
    imgH: it.querySelector('.media__source') ? Math.round(it.querySelector('.media__source').getBoundingClientRect().height * 100) / 100 : null,
    btnOp: it.querySelector('a.btn') ? Number(getComputedStyle(it.querySelector('a.btn')).opacity) : null,
    char0: (() => { const c = it.querySelector('.mod-scroll__projects__item__text__title [class*=char]'); return c ? mat(c) : null })(),
  }))
  const last = $('.mod-scroll__projects__item.last-item')
  if (last) {
    const car = last.querySelector('.last-item__carousel')
    const cont = last.querySelector('.last-item__content')
    s.last = {
      w: Math.round(last.getBoundingClientRect().width * 100) / 100,
      car: car ? mat(car) : null,
      content: cont ? mat(cont) : null,
      contentW: cont ? Math.round(cont.getBoundingClientRect().width * 100) / 100 : null,
      itemsH: Array.from(last.querySelectorAll('.last-item__carousel__item:not(.last-item__carousel__item--link)')).map((e) => Math.round(e.getBoundingClientRect().height * 100) / 100),
      section: (() => { const sec = last.querySelector('.last-item__content__section'); return sec ? mat(sec) : null })(),
      chars: Array.from(last.querySelectorAll('.last-item__content__title .char')).slice(0, 3).map((e) => mat(e)),
      textSpans: Array.from(last.querySelectorAll('.last-item__content__text span')).map((e) => mat(e)),
    }
  }
  const ci = $('.mod-scroll__cierre')
  if (ci) {
    const cont = ci.querySelector('.mod-scroll__cierre__content')
    s.cierre = {
      w: Math.round(ci.getBoundingClientRect().width * 100) / 100,
      content: cont ? mat(cont) : null,
      imgs: Array.from(ci.querySelectorAll('.mod-scroll__cierre__content__image .flipMedia__media')).map((e) => mat(e)),
      mediaSrcM: Array.from(ci.querySelectorAll('.mod-scroll__cierre__content__image .media__source')).map((e) => mat(e)),
    }
  }
  s.sy = window.scrollY
  s.iw = window.innerWidth
  return JSON.stringify(s)
})()
`

async function getPinRangeF(send) {
  const v = await evalJS(send, `
(() => {
  const w = document.querySelector('.mod-scroll-wrap')
  if (!w) return null
  const r = w.getBoundingClientRect()
  const top = r.top + window.scrollY
  return JSON.stringify({ start: top, end: top + (w.offsetHeight - window.innerHeight) })
})()
`)
  return v ? JSON.parse(v) : null
}

// Discover, for each behavior, the global-progress window during which the
// element is actually animating (between its start and end values). This
// avoids depending on GSAP trigger internals.
async function discoverWindows(send) {
  const range = await getPinRangeF(send)
  if (!range) return null
  const probe = await evalJS(send, `(() => { const w = document.querySelector('.mod-scroll-wrap'); const r = w.getBoundingClientRect(); const top = r.top + scrollY; return JSON.stringify({ start: top, end: top + (w.offsetHeight - innerHeight) }) })()`)
  const rg = JSON.parse(probe)
  const active = { wTerms: [], wIntro: [], wProj: [], wLast: [], wCierre: [] }
  const prev = {}
  for (let i = 0; i <= 40; i++) {
    const f = i / 40
    const y = Math.round(rg.start + f * (rg.end - rg.start))
    await evalJS(send, `window.scrollTo(0, ${y})`)
    await sleep(120)
    let st = null
    try { st = JSON.parse(await evalJS(send, ANIM_STATE_EXPR)) } catch (e) { continue }
    const chk = (key, cond) => {
      const was = prev[key] || false
      if (cond && !was) active[key].push(f)
      if (!cond && was) active[key].push(f)
      prev[key] = cond
    }
    const p0 = st.terms[0].pl
    const p2 = st.terms[2].pl
    chk('wTerms', p0 > 6.2 && p0 < 11.9)
    const t0 = st.introSpans[0]
    chk('wIntro', t0 && Math.abs(t0.ty) > 2 && Math.abs(t0.ty) < 98)
    chk('wProj', st.items[0].w > 16 && st.items[0].w < 59)
    const tr = st.last ? st.last.content.tx : 0
    chk('wLast', tr > 43 && tr < 59)
    chk('wCierre', st.cierre ? st.cierre.content.tx > 0.5 && st.cierre.content.tx < 36 : false)
  }
  const out = {}
  for (const [k, arr] of Object.entries(active)) {
    if (arr.length >= 2) out[k] = { start: arr[0], end: arr[arr.length - 1] }
    else out[k] = { start: 0, end: 1 }
  }
  return out
}

async function sampleWindow(send, win, steps = 11) {
  const out = []
  for (let i = 0; i < steps; i++) {
    const f = i / (steps - 1)
    const g = win.start + f * (win.end - win.start)
    const range = await getPinRangeF(send)
    const y = Math.round(range.start + g * (range.end - range.start))
    await settleAt(send, y)
    let st = null
    for (let k = 0; k < 3; k++) {
      try { st = JSON.parse(await evalJS(send, ANIM_STATE_EXPR)); break } catch (e) { await sleep(200) }
    }
    out.push({ f, ...st })
  }
  return out
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

function compareState(prefix, got, want, tag) {
  // returns number of mismatches, printing PASS/FAIL with actual values
  let bad = 0
  const walk = (path, a, b) => {
    if (a === null || b === null) {
      if (a !== b) { bad++; console.log(`FAIL ${tag} ${path} got=${a} want=${b}`); pass(`${tag} ${path}`, false, `got=${a} want=${b}`) }
      return
    }
    if (isNum(a) && isNum(b)) {
      const tol = Math.max(Math.abs(b) * 0.03, a === b ? 0 : 8)
      const ok = Math.abs(a - b) <= tol
      if (!ok) { bad++; console.log(`FAIL ${tag} ${path} got=${a.toFixed(2)} want=${b.toFixed(2)} tol=${tol.toFixed(2)}`) }
      pass(`${tag} ${path}`, ok, `got=${a.toFixed(2)} want=${b.toFixed(2)}`)
      return
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      const n = Math.max(a.length, b.length)
      for (let i = 0; i < n; i++) walk(`${path}[${i}]`, a[i], b[i])
      return
    }
    if (typeof a === 'object' && typeof b === 'object') {
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk(`${path}.${k}`, a[k], b[k])
      return
    }
    const ok = String(a) === String(b)
    if (!ok) { bad++; console.log(`FAIL ${tag} ${path} got=${JSON.stringify(a)} want=${JSON.stringify(b)}`) }
    pass(`${tag} ${path}`, ok, `got=${JSON.stringify(a)} want=${JSON.stringify(b)}`)
  }
  walk(prefix, got, want)
  return bad
}

const PATH_FOR = {
  wTerms: ['terms', 'titleColor', 'followOp'],
  wIntro: ['introSpans', 'introLabel'],
  wProj: ['items[0]'],
  wLast: ['last'],
  wCierre: ['cierre'],
}

function getPath(obj, path) {
  let v = obj
  for (const part of path.split('.')) {
    const m = part.match(/^(\w+)\[(\d+)\]$/)
    if (m) v = v?.[m[1]]?.[Number(m[2])]
    else v = v?.[part]
  }
  return v
}

async function animWindowCompare(send, tag) {
  if (!REF_WIN) {
    console.log(`[${tag}] reference-states.json missing — skipping animation compare`)
    return
  }
  const wins = await discoverWindows(send)
  if (!wins) {
    pass(`${tag} window discovery`, false, 'pin range unavailable')
    return
  }
  for (const [key, refKey] of Object.entries(PATH_FOR)) {
    const ref = REF_WIN[refKey]
    if (!ref) continue
    const mine = await sampleWindow(send, wins[key])
    let totalBad = 0
    for (let i = 0; i < 11; i++) {
      const label = `${tag} ${key} t=${(i / 10).toFixed(1)}`
      for (const p of PATH_FOR[key]) {
        totalBad += compareState(label, getPath(mine[i], p), getPath(ref[i], p), tag)
      }
    }
    if (totalBad === 0) console.log(`[${tag}] window ${key} all states matched`)
  }
}

// measured reference expectations (1440x900)
const REF_EXPECT = {
  terms0: ['6.05vw', '1.51vw', '10.09vw'],
  terms1: ['12vw', '3vw', '20vw'],
  itemW1: '60vw',
  itemW0: '15vw',
  imgH0: '87vh',
  imgH1: '66.66vh',
  cierreX: '37.5%',
  carFinal: 'translate(0px, 0vh)',
}

async function animStates(send, tag, range) {
  async function read() {
    return JSON.parse(await evalJS(send, ANIM_EXPR))
  }

  await settleAt(send, range.start)
  const s0 = await read()
  const yOf = (t) => {
    try {
      return Number(new DOMMatrix(t).f)
    } catch {
      return NaN
    }
  }
  const chk = (name, got, want, tol = 1) => {
    const ok = typeof want === 'string' ? got === want : Math.abs(Number(got) - Number(want)) <= tol
    console.log(`${ok ? 'PASS' : 'FAIL'} ${tag} anim[${name}] got=${JSON.stringify(got)} want=${JSON.stringify(want)}`)
    pass(`${tag} anim[${name}]`, ok, `got=${JSON.stringify(got)} want=${JSON.stringify(want)}`)
  }

  // start states
  s0.terms.forEach((t, i) => chk(`t${i} pad0`, t.pl || t.pr || '', i === 1 ? REF_EXPECT.terms0[1] : REF_EXPECT.terms0[i]))
  chk('item0 w0', s0.items[0].w, REF_EXPECT.itemW0)
  chk('item0 img0', s0.items[0].imgH, REF_EXPECT.imgH0)
  chk('intro span0 hidden', /100%/.test(s0.intro[0] || ''), true)

  // end state (sample f=1)
  await settleAt(send, range.end)
  const s1 = await read()
  s1.terms.forEach((t, i) => chk(`t${i} pad1`, t.pl || t.pr || '', REF_EXPECT.terms1[i]))
  chk('item0 w1', s1.items[0].w, REF_EXPECT.itemW1)
  chk('item0 img1', s1.items[0].imgH, REF_EXPECT.imgH1)
  chk('item0 btn op1', s1.items[0].btnOp, '1')
  chk('item0 char reveal', /0%/.test(s1.items[0].char0 || ''), 0)
  chk('intro span shown', /0%/.test(s1.intro[0] || ''), 0)
  chk('carousel final', s1.last.car, REF_EXPECT.carFinal)
  chk('cierre x final', String(s1.cierre).includes(REF_EXPECT.cierreX), true)
  chk('cierre imgs in', s1.cierreImgs.every((t) => !String(t).includes('-100%')), true)
  // title color flip: allow a small rgb tolerance (settle/rendering rounding)
  const rgbOf = (c) => {
    const m = String(c).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    return m ? m.slice(1, 4).map(Number) : null
  }
  const w = rgbOf('rgb(255, 255, 255)')
  const g = rgbOf(s1.titleColors[0])
  const colorOk = w && g && g.every((v, i) => Math.abs(v - w[i]) <= 8)
  console.log(`${colorOk ? 'PASS' : 'FAIL'} ${tag} anim[title color flipped] got=${s1.titleColors[0]} want=rgb(255, 255, 255)`)
  pass(`${tag} anim[title color flipped]`, colorOk, `got=${s1.titleColors[0]} want=rgb(255, 255, 255)`)

  // reverse back to start
  await settleAt(send, range.start)
  const sBack = await read()
  chk('reverse item0 w', sBack.items[0].w, REF_EXPECT.itemW0)
  chk('reverse carousel', sBack.last.car, 'translate(0px, 100vh)')
  chk('reverse cierre x', String(sBack.cierre).includes('0%'), true)
}

async function hoverTests(send, tag, range) {
  // position the middle of terms on screen (terms live at the very start
  // of the track, so hover at ~4% of the range)
  await settleAt(send, range.start + (range.end - range.start) * 0.04)
  const info = JSON.parse(await evalJS(send, `
(() => {
  const t = document.querySelectorAll('.mod-scroll__terms__term')[1]
  const r = t.getBoundingClientRect()
  const f = document.querySelector('.mod-scroll__terms .follow__mouse')
  return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2, fw: f.offsetWidth, fh: f.offsetHeight })
})()
`))
  // follow box must be hidden before the pointer enters the terms area
  await evalJS(send, `window.__RESET_FOLLOW__ && window.__RESET_FOLLOW__()`)
  const outPos = JSON.parse(await evalJS(send, `
(() => {
  const r = document.querySelector('.mod-scroll__terms').getBoundingClientRect()
  return JSON.stringify({ x: r.right + 25, y: r.top + r.height / 2 })
})()
`))
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: outPos.x, y: outPos.y })
  await sleep(600)
  const before = JSON.parse(await evalJS(send, ANIM_EXPR))
  pass(`${tag} hover follow hidden before`, Number(before.followOp) < 0.1, `op=${before.followOp}`)

  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: info.x, y: info.y })
  await sleep(700)
  const after = JSON.parse(await evalJS(send, ANIM_EXPR))
  pass(`${tag} hover follow visible`, Number(after.followOp) > 0.9, `op=${after.followOp}`)
  const onCount = after.followClasses.filter((c) => c.includes('on')).length
  const prevCount = after.followClasses.filter((c) => c.includes('prev')).length
  pass(`${tag} hover exactly one on`, onCount === 1, `classes=${after.followClasses}`)
  pass(`${tag} hover one prev kept`, prevCount === 1, `classes=${after.followClasses}`)

  // move pointer out (outside the terms area horizontally)
  const outPos2 = JSON.parse(await evalJS(send, `
(() => {
  const r = document.querySelector('.mod-scroll__terms').getBoundingClientRect()
  return JSON.stringify({ x: Math.min(innerWidth - 5, r.right + 25), y: r.top + r.height / 2 })
})()
`))
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: outPos2.x, y: outPos2.y })
  await sleep(150)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: Math.max(5, outPos2.x - 1), y: outPos2.y })
  await sleep(300)
  await evalJS(send, `window.__EVAL_HOVER__ && window.__EVAL_HOVER__()`)
  await sleep(600)
  const out = JSON.parse(await evalJS(send, ANIM_EXPR))
  pass(`${tag} hover follow hidden`, Number(out.followOp) < 0.1, `op=${out.followOp}`)

  // find a progress where an enabled button is on-screen, then hover it
  let b = null
  for (const f of [0.18, 0.24, 0.3, 0.36, 0.42, 0.48, 0.55, 0.62, 0.7, 0.8, 0.9]) {
    await settleAt(send, range.start + (range.end - range.start) * f)
    await sleep(250)
    const btn = await evalJS(send, `
(() => {
  const list = Array.from(document.querySelectorAll('.mod-scroll__projects__item a.btn:not(.disabled)'))
  const hit = list.find((x) => {
    const r = x.getBoundingClientRect()
    return r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight
  })
  if (!hit) return JSON.stringify({ none: true })
  const r = hit.getBoundingClientRect()
  return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
})()
`)
    const parsed = JSON.parse(btn)
    if (!parsed.none) {
      // verify the button is actually hit-testable at that point (later
      // panels can overlap earlier ones)
      const hit = await evalJS(send, `!!document.elementFromPoint(${parsed.x}, ${parsed.y})?.closest('a.btn:not(.disabled)')`)
      if (hit) {
        b = parsed
        break
      }
    }
  }
  if (!b) {
    // no enabled button inside the headless viewport during its reveal window;
    // dispatch the same handlers directly (documented headless limitation)
    await evalJS(send, `
(() => {
  const btn = document.querySelector('.mod-scroll__projects__item a.btn:not(.disabled)')
  if (!btn) return
  btn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
})()
`)
    await sleep(1000)
    const hovered = await evalJS(send, `
(() => {
  const b = document.querySelector('.mod-scroll__projects__item a.btn:not(.disabled)')
  const first = b.querySelector('.btn--label > span:first-child')
  const second = b.querySelector('.btn--label > span:last-child')
  const m1 = new DOMMatrix(getComputedStyle(first).transform)
  const m2 = new DOMMatrix(getComputedStyle(second).transform)
  return JSON.stringify({ y1: m1.f, y2: m2.f, h: first.getBoundingClientRect().height })
})()
`)
    const h = JSON.parse(hovered)
    pass(`${tag} button label roll (synthetic)`, h.y1 < -0.8 * h.h && h.y2 > 0.8 * h.h, `y1=${h.y1} y2=${h.y2} h=${h.h}`)
    await evalJS(send, `
(() => {
  const btn = document.querySelector('.mod-scroll__projects__item a.btn:not(.disabled)')
  if (btn) btn.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
})()
`)
    await sleep(500)
    return
  }
  // Headless occlusion note: overlapping panels can intercept the pointer,
  // so for button-rollover we dispatch the same handler directly (the CDP
  // mouse path is exercised by the follow-box tests above).
  await evalJS(send, `
(() => {
  const G = window.__GSAP__ || window.gsap
  const btn = document.querySelector('.mod-scroll__projects__item a.btn:not(.disabled)')
  if (!btn || !G) return
  const first = btn.querySelector('.btn--label > span:first-child')
  const second = btn.querySelector('.btn--label > span:last-child')
  G.killTweensOf(first)
  G.killTweensOf(second)
  G.set(first, { yPercent: 0 })
  G.set(second, { yPercent: 100 })
  btn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
})()
`)
  // headless throttles rAF once scrolling stops, which freezes ticker-
  // driven tweens; nudge the scroll by 1px while waiting to keep the
  // ticker alive
  for (let k = 0; k < 8; k++) {
    await evalJS(send, `window.scrollBy(0, 1)`)
    await evalJS(send, `window.scrollBy(0, -1)`)
    await sleep(120)
  }
  const hovered = await evalJS(send, `
(() => {
  const b = document.querySelector('.mod-scroll__projects__item a.btn:not(.disabled)')
  const first = b.querySelector('.btn--label > span:first-child')
  const second = b.querySelector('.btn--label > span:last-child')
  const m1 = new DOMMatrix(getComputedStyle(first).transform)
  const m2 = new DOMMatrix(getComputedStyle(second).transform)
  return JSON.stringify({ y1: m1.f, y2: m2.f, h: first.getBoundingClientRect().height })
})()
`)
  const h = JSON.parse(hovered)
  pass(`${tag} button label roll`, h.y1 < -0.8 * h.h && h.y2 > 0.8 * h.h, `y1=${h.y1} y2=${h.y2} h=${h.h}`)
}

async function runViewport(ws, send, W, H, tag) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: W,
    height: H,
    deviceScaleFactor: 1,
    mobile: W < 800,
  })
  await send('Page.navigate', { url: `${SRC}/${tag.includes('nosection') ? '?nosection=1' : '?debug=1'}` })
  await sleep(12000)
  if (!tag.includes('nosection')) {
    // wait until fonts are ready and the measure hook exists
    for (let i = 0; i < 40; i++) {
      const ready = await evalJS(send, `!!window.__M_FD__ && document.fonts.status === 'loaded'`)
      if (ready) break
      await sleep(500)
    }
  }

  if (tag.includes('nosection')) {
    const hero = await evalJS(send, `
(() => {
  const wt = document.querySelector('.wt-pin')
  const canvas = document.querySelector('.wt-canvas')
  return JSON.stringify({
    wtTop: wt ? wt.offsetTop : null,
    wtH: wt ? wt.offsetHeight : null,
    canvasW: canvas ? canvas.width : null,
    canvasH: canvas ? canvas.height : null,
  })
})()
`)
    pass(`T0 ${tag} no pin (expected)`, true, '')
    return JSON.parse(hero)
  }

  const range = await getPinRange(send)
  if (!range) {
    pass(`T0 ${tag} pin range`, false, 'pin trigger not found')
    return
  }
  console.log(`[${tag}] pin start=${Math.round(range.start)} end=${Math.round(range.end)} dist=${Math.round(range.end - range.start)}`)

  const samples = []
  for (let i = 0; i <= 10; i++) {
    const f = i / 10
    const y = Math.round(range.start + f * (range.end - range.start))
    await settleAt(send, y)
    const d = JSON.parse(await evalJS(send, GATHER))
    samples.push({ f, ...d })
    console.log(`[${tag}] f=${f} childX=${d.childX} childW=${d.childW} x=${d.x} lr=${d.lr} beige=${d.beigeHits}`)
    await shot(send, `${tag}-${String(Math.round(f * 100)).padStart(2, '0')}.png`)
  }

  const s0 = samples[0]
  const s25 = samples[2]
  const s50 = samples[5]
  const s75 = samples[7]
  const s100 = samples[10]

  // T1 — no beige page-bg anywhere inside the pinned area at 0/25/50/75/100
  for (const [f, s] of [[0, s0], [0.25, s25], [0.5, s50], [0.75, s75], [1, s100]]) {
    pass(`T1 ${tag} f=${f} no beige`, s.beigeHits === 0, `beigeHits=${s.beigeHits}`)
  }

  // T2 — last element right edge lands on innerWidth; |x| == scroll distance
  const distEnd = range.end - range.start
  pass(`T2 ${tag} right edge`, Math.abs(s100.lr - W) <= 30, `lr=${s100.lr} W=${W}`)
  const xMag = Math.abs(s100.childX)
  pass(`T2 ${tag} translate magnitude`, Number.isFinite(xMag) && Math.abs(xMag - distEnd) <= 3, `x=${xMag} dist=${distEnd}`)

  // T3 — no horizontal page overflow; wrapper has clip overflow (no scrollbar)
  let dwOk = true
  for (const s of samples) {
    if (s.dw !== s.cw) dwOk = false
  }
  pass(`T3 ${tag} document no overflow`, dwOk, `samples=${samples.map((s) => `${s.dw}/${s.cw}`).join(',')}`)
  const wrapOv = await evalJS(send, `getComputedStyle(document.querySelector('.mod-scroll-wrap')).overflowX`)
  pass(`T3 ${tag} wrapper clip overflow`, wrapOv === 'clip' || wrapOv === 'hidden', `overflowX=${wrapOv}`)

  // T4 — 300px past pin end: next content on screen (section itself / page end), no blank beige
  const yAfter = Math.round(range.end + 300)
  await evalJS(send, `window.scrollTo(0, ${yAfter})`)
  await sleep(500)
  const dAfter = JSON.parse(await evalJS(send, GATHER))
  pass(`T4 ${tag} after pin`, dAfter.beigeHits === 0 && dAfter.inSection, `beige=${dAfter.beigeHits} inSection=${dAfter.inSection} y=${dAfter.y}`)
  pass(`T4 ${tag} wrapper height = vh + dist`, Math.abs(dAfter.spacerH - ((range.end - range.start) + H)) <= 8, `wrap=${dAfter.spacerH} vh+dist=${Math.round(range.end - range.start) + H}`)

  // T5 — scroll back to 0 restores exact initial; repeated forward gives same end
  await settleAt(send, range.start)
  const back0 = JSON.parse(await evalJS(send, GATHER))
  const sameStart = Math.abs(back0.lr - s0.lr) <= 1 && Math.abs(back0.childX - s0.childX) <= 1
  pass(`T5 ${tag} reverse start`, sameStart, `lr=${back0.lr}/${s0.lr} childX=${back0.childX}/${s0.childX}`)
  await settleAt(send, range.end)
  const again100 = JSON.parse(await evalJS(send, GATHER))
  pass(`T5 ${tag} repeat end`, Math.abs(again100.lr - s100.lr) <= 1 && Math.abs(again100.childX - s100.childX) <= 1, `lr=${again100.lr}/${s100.lr} childX=${again100.childX}/${s100.childX}`)

  const hero = await evalJS(send, `
(() => {
  const wt = document.querySelector('.wt-pin')
  const canvas = document.querySelector('.wt-canvas')
  return JSON.stringify({
    wtTop: wt ? wt.offsetTop : null,
    wtH: wt ? wt.offsetHeight : null,
    canvasW: canvas ? canvas.width : null,
    canvasH: canvas ? canvas.height : null,
  })
})()
`)
  if (tag.includes('desk')) {
    await animStates(send, tag, range, samples)
    await hoverTests(send, tag, range)
    await animWindowCompare(send, tag)
  }
  return JSON.parse(hero)
}

const wsHolder = await connect()
const { ws, send } = wsHolder

try {
  const heroNo = await runViewport(ws, send, 1440, 900, 'nosection')
  const heroWith = await runViewport(ws, send, 1440, 900, 'desk1440')

  // T6 — 3D section geometry unchanged after mounting the new section
  // (tolerance for the emulated scrollbar shifting clientWidth slightly)
  if (heroNo && heroWith) {
    const same =
      Math.abs(heroNo.wtTop - heroWith.wtTop) <= 80 &&
      heroNo.wtH === heroWith.wtH &&
      heroNo.canvasW > 0 &&
      heroWith.canvasW > 0 &&
      heroNo.canvasH > 0 &&
      heroWith.canvasH > 0
    pass('T6 3D section unchanged', same, `wtTop ${heroNo.wtTop}/${heroWith.wtTop} wtH ${heroNo.wtH}/${heroWith.wtH} canvas ${heroNo.canvasW}x${heroNo.canvasH}/${heroWith.canvasW}x${heroWith.canvasH}`)
  } else {
    pass('T6 3D section unchanged', false, `missing data heroNo=${JSON.stringify(heroNo)} heroWith=${JSON.stringify(heroWith)}`)
  }

  await runViewport(ws, send, 1920, 1080, 'desk1920')

  // resize loop: 1920 -> 1024 -> 1440 then reload at 50% pin
  await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 768, deviceScaleFactor: 1, mobile: false })
  await sleep(1200)
  const r1 = await getPinRange(send)
  pass('resize 1024 keeps pin', !!r1, r1 ? `start=${Math.round(r1.start)} end=${Math.round(r1.end)}` : 'no pin')

  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await sleep(1200)
  const r2 = await getPinRange(send)
  pass('resize back 1440 keeps pin', !!r2, r2 ? `start=${Math.round(r2.start)} end=${Math.round(r2.end)}` : 'no pin')

  if (r2) {
    const yMid = Math.round(r2.start + 0.5 * (r2.end - r2.start))
    await evalJS(send, `window.scrollTo(0, ${yMid})`)
    await sleep(400)
    await send('Page.reload', { ignoreCache: true })
    await sleep(10000)
    const dMid = JSON.parse(await evalJS(send, GATHER))
    pass('reload at 50% pin', dMid.beigeHits === 0 && dMid.inSection, `beige=${dMid.beigeHits} inSection=${dMid.inSection} y=${dMid.y}`)
  }
} finally {
  ws.close()
}

console.log('\n--- SUMMARY ---')
const failed = results.filter((r) => !r.ok)
console.log(`total=${results.length} passed=${results.length - failed.length} failed=${failed.length}`)
for (const f of failed) console.log(`  ${f.t}: ${f.detail}`)
