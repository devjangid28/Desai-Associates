// T1-T6 comparison harness: my build vs recorded reference data.
// Usage: node qa/compare.mjs [viewportTag]   (viewportTag: 1920x1080|1440x900|1366x768)
// Static phases (T1/T2) run from the recorded JSON; live phases (T3-T6)
// launch headless Chrome against the local dev server.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { launchChrome, connectCDP, evalJS, setViewport, wheel, mouseMove, sleep } from './lib/cdp.mjs'

const ROOT = 'C:\\Users\\DK\\Desktop\\interior design\\qa'
mkdirSync(ROOT + '\\diff', { recursive: true })
const TAG = process.argv[2] || '1440x900'
const [W, H] = TAG.split('x').map(Number)
const SRC = 'http://127.0.0.1:5173/?debug=1'
const REF = JSON.parse(readFileSync(`${ROOT}\\ref\\states-${TAG}.json`, 'utf8'))
const MINE = JSON.parse(readFileSync(`${ROOT}\\mine\\states-${TAG}.json`, 'utf8'))

const results = []
const pass = (t, ok, detail) => { results.push({ t, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${t} ${detail ?? ''}`) }
const R = (v) => Math.round(v * 100) / 100

function interp(samples, x) {
  if (x >= 0) return samples[0]
  let lo = null, hi = null
  for (let i = 0; i < samples.length; i++) {
    if (samples[i].trackX <= x) lo = i
    else { hi = i; break }
  }
  if (lo === null) return null
  if (hi === null || hi === lo) return samples[lo]
  const a = samples[lo], b = samples[hi]
  const f = (x - a.trackX) / (b.trackX - a.trackX)
  const blend = (av, bv) => av + (bv - av) * f
  const out = JSON.parse(JSON.stringify(a))
  for (const key of ['trackX']) out[key] = blend(a[key], b[key])
  for (const key of ['titleC', 'titleF', 'titleM']) out[key] = a[key]
  out.titleOp = a.titleOp.map((v, i) => blend(v, b.titleOp[i]))
  if (a.terms && b.terms) out.terms = a.terms.map((v, i) => ({ pl: blend(v.pl, b.terms[i].pl), pr: blend(v.pr, b.terms[i].pr), num: v.num }))
  if (a.mobile && b.mobile) out.mobile = a.mobile.map((v, i) => ({ op: blend(v.op, b.mobile[i].op), m: { e: blend(v.m.e, b.mobile[i].m.e), f: blend(v.m.f, b.mobile[i].m.f) } }))
  if (a.follow && b.follow) out.follow = {
    op: blend(a.follow.op, b.follow.op),
    m: { e: blend(a.follow.m.e, b.follow.m.e), f: blend(a.follow.m.f, b.follow.m.f), a: blend(a.follow.m.a, b.follow.m.a) },
    w: blend(a.follow.w, b.follow.w),
    imgs: a.follow.imgs.map((v, i) => ({ cls: v.cls, clip: v.clip, a: blend(v.a, b.follow.imgs[i].a) })),
  }
  out.introLines = a.introLines.map((v, i) => ({ e: blend(v.e, b.introLines[i].e), f: blend(v.f, b.introLines[i].f) }))
  if (a.introLabel && b.introLabel) out.introLabel = { e: blend(a.introLabel.e, b.introLabel.e), f: blend(a.introLabel.f, b.introLabel.f) }
  out.panels = a.panels.map((v, i) => {
    const w = b.panels[i]
    return {
      w: blend(v.w, w.w), l: blend(v.l, w.l), imgH: blend(v.imgH, w.imgH),
      imgM: { e: blend(v.imgM.e, w.imgM.e), f: blend(v.imgM.f, w.imgM.f) },
      dataSpans: v.dataSpans.map((s, k) => ({ e: blend(s.e, w.dataSpans[k].e), f: blend(s.f, w.dataSpans[k].f) })),
      dataNum: blend(v.dataNum, w.dataNum),
      btn: { op: blend(v.btn.op, w.btn.op), m: { e: blend(v.btn.m.e, w.btn.m.e), f: blend(v.btn.m.f, w.btn.m.f) } },
      chars: v.chars.map((s, k) => ({ e: blend(s.e, w.chars[k].e), f: blend(s.f, w.chars[k].f) })),
    }
  })
  out.last = { l: blend(a.last.l, b.last.l), w: blend(a.last.w, b.last.w) }
  return out
}

const closeV = (a, b, tolPct = 0.02) => Math.abs(a - b) <= Math.max(1, Math.abs(a) * tolPct)
const closeT = (a, b) => Math.abs(a - b) <= 4
const closeOp = (a, b) => Math.abs(a - b) <= 0.05
const closeClip = (a, b) => {
  const pa = (a.match(/-?[\d.]+/g) || []).map(Number)
  const pb = (b.match(/-?[\d.]+/g) || []).map(Number)
  return pa.length === pb.length && pa.every((v, i) => Math.abs(v - pb[i]) <= 3)
}

// ---------------- T1: state curves ----------------
const offenders = []
let compared = 0
let skipped = 0
for (const ref of REF.samples) {
  const x = ref.trackX
  const mine = interp(MINE.samples, x)
  if (!mine) { skipped++; continue }
  compared++
  const o = { x: R(x) }
  const worst = (field, val, tol, got) => {
    if (!tol(got, val)) {
      if (!o[field] || Math.abs(got - val) > o[field].d) o[field] = { want: R(val), got: R(got), d: R(Math.abs(got - val)) }
    }
  }
  if (ref.terms && mine.terms) {
    for (let i = 0; i < 3; i++) {
      worst(`term${i}pl`, ref.terms[i].pl, closeV, mine.terms[i].pl)
      worst(`term${i}pr`, ref.terms[i].pr, closeV, mine.terms[i].pr)
    }
  }
  if (ref.titleOp && mine.titleOp) for (let i = 0; i < 3; i++) worst(`titleOp${i}`, ref.titleOp[i], closeOp, mine.titleOp[i])
  if (ref.mobile.length && mine.mobile.length) {
    for (let i = 0; i < ref.mobile.length; i++) {
      worst(`mobOp${i}`, ref.mobile[i].op, closeOp, mine.mobile[i].op)
      worst(`mobY${i}`, ref.mobile[i].m.f, closeT, mine.mobile[i].m.f)
    }
  }
  if (ref.follow && mine.follow) {
    worst('fOp', ref.follow.op, closeOp, mine.follow.op)
    worst('fX', ref.follow.m.e, closeT, mine.follow.m.e)
    worst('fY', ref.follow.m.f, closeT, mine.follow.m.f)
    worst('fScale', ref.follow.m.a, (a, b) => Math.abs(a - b) <= 0.06, mine.follow.m.a)
    for (let i = 0; i < 3; i++) {
      if (ref.follow.imgs[i].cls !== mine.follow.imgs[i].cls) o[`fcls${i}`] = { want: ref.follow.imgs[i].cls, got: mine.follow.imgs[i].cls, d: 99 }
      if (!closeClip(ref.follow.imgs[i].clip, mine.follow.imgs[i].clip)) o[`fclip${i}`] = { want: ref.follow.imgs[i].clip, got: mine.follow.imgs[i].clip, d: 99 }
    }
  }
  for (let i = 0; i < Math.min(ref.panels.length, 4); i++) {
    const p = ref.panels[i], m = mine.panels[i]
    worst(`P${i}w`, p.w, closeV, m.w)
    worst(`P${i}imgH`, p.imgH, closeV, m.imgH)
    worst(`P${i}btnOp`, p.btn.op, closeOp, m.btn.op)
    for (let k = 0; k < Math.min(p.chars.length, 5); k++) {
      worst(`P${i}c${k}f`, p.chars[k].f, closeT, m.chars[k].f)
    }
  }
  if (Object.keys(o).length > 1) offenders.push(o)
}
offenders.sort((a, b) => {
  const da = Math.max(...Object.values(a).filter((v) => typeof v === 'object' && v.d !== undefined).map((v) => v.d), 0)
  const db = Math.max(...Object.values(b).filter((v) => typeof v === 'object' && v.d !== undefined).map((v) => v.d), 0)
  return db - da
})
writeFileSync(`${ROOT}\\diff\\diff-states-${TAG}.json`, JSON.stringify({ compared, skipped, offenders: offenders.slice(0, 50) }, null, 1))
const worst10 = offenders.slice(0, 10)
pass(`T1 ${TAG} state curves (${compared} compared, ${skipped} skipped)`, offenders.length === 0 && compared > 20, `offenders=${offenders.length}`)
for (const o of worst10) console.log('  worst @x=' + o.x + ' ' + JSON.stringify(Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === 'object' && v.d !== undefined))))

// ---------------- T2: fact-4 fixture ----------------
const targetP2 = 0.248867 * W
let refRow = null
for (const s of REF.samples) {
  if (s.panels[2] && Math.abs(s.panels[2].w - targetP2) < 30) { refRow = s; break }
}
if (refRow) {
  const mineRow = interp(MINE.samples, refRow.trackX)
  const p2 = refRow.panels[2], m2 = mineRow.panels[2]
  const p0 = refRow.panels[0], m0 = mineRow.panels[0]
  const p3 = refRow.panels[3], m3 = mineRow.panels[3]
  const textHidden = (row) => row.panels[2].chars.every((c) => Math.abs(c.f) > 8) && row.panels[2].btn.op < 0.1
  const textShown = (row) => row.panels[0].chars.every((c) => Math.abs(c.f) < 4) && row.panels[0].btn.op > 0.9
  const ok3 = closeV(m2.w, p2.w) && closeV(m2.imgH, p2.imgH)
  const okOk = closeV(m0.w, p0.w) && textShown(mineRow) === textShown(refRow)
  const okHide = textHidden(mineRow) === textHidden(refRow) && closeV(m3.w, p3.w)
  pass(`T2 ${TAG} fixture P2@24.89vw`, ok3, `x=${R(refRow.trackX)} mineP2w=${R(m2.w)} want=${R(p2.w)} imgH mine=${R(m2.imgH)} want=${R(p2.imgH)}`)
  pass(`T2 ${TAG} fixture P0/P1 revealed 60vw`, okOk, `mineP0w=${R(m0.w)} want=${R(p0.w)}`)
  pass(`T2 ${TAG} fixture P3 hidden at 15vw`, okHide, `mineP3w=${R(m3.w)} want=${R(p3.w)}`)
} else {
  pass(`T2 ${TAG} fixture P2@24.89vw`, false, 'reference row not found')
}

// ---------------- live phases (T3-T6) ----------------
if (process.argv.includes('--live')) {
  const chrome = launchChrome(9340, `cmp-${TAG}`, { w: W, h: H })
  const { ws, send } = await connectCDP(9340)
  try {
    await send('Runtime.enable')
    await setViewport(send, W, H)
    await send('Page.navigate', { url: SRC })
    for (let i = 0; i < 150; i++) {
      const r = await evalJS(send, `(() => { const pre = document.querySelector('.preloader'); const preGone = !pre || getComputedStyle(pre).display === 'none'; return preGone && !!window.__M_FD__ && document.fonts.status === 'loaded' })()`).catch(() => null)
      if (r) break
      await sleep(300)
    }
    const pinRange = JSON.parse(await evalJS(send, `
    (() => { const w = document.querySelector('.mod-scroll-wrap'); const r = w.getBoundingClientRect(); const top = r.top + window.scrollY; return JSON.stringify({ start: top, end: top + (w.offsetHeight - window.innerHeight) }) })()`))
    const goF = async (f) => {
      const y = Math.round(pinRange.start + f * (pinRange.end - pinRange.start))
      await evalJS(send, `
      (() => { window.scrollTo(0, ${y}); document.scrollingElement.scrollTop = ${y}; if (window.__ST__) window.__ST__.update(); return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))) })()`)
      await sleep(350)
    }

    // T5: reverse x3
    let t5Ok = true
    const snapStart = () => evalJS(send, `
    (() => {
      const t = document.querySelector('.mod-scroll__terms__term')
      const F = document.querySelector('.mod-scroll__terms .follow__mouse')
      const m = t ? new DOMMatrix(getComputedStyle(t).transform) : null
      const fm = F ? new DOMMatrix(getComputedStyle(F).transform) : null
      const last = document.querySelector('.mod-scroll__projects__item.last-item')
      const lr = last ? last.getBoundingClientRect() : null
      return JSON.stringify({ pad: t ? getComputedStyle(t).paddingLeft : null, fOp: F ? getComputedStyle(F).opacity : null, fX: fm ? fm.e : null, lastL: lr ? lr.left : null })
    })()`)
    const s0 = await snapStart()
    for (let rep = 0; rep < 3; rep++) {
      await goF(1)
      await goF(0)
      const s = await snapStart()
      if (s !== s0) t5Ok = false
    }
    pass(`T5 ${TAG} reverse restores start (3x)`, t5Ok, `start=${s0}`)

    // T3: motion replay (same constant wheel sequence as reference)
    const refMotion = JSON.parse(readFileSync(`${ROOT}\\ref\\motion-${TAG}.json`, 'utf8')).samples
    await goF(0.25)
    await evalJS(send, `
    (() => {
      window.__MOTION__ = []
      const t = document.querySelector('.mod-scroll__projects')
      const ch = document.querySelector('.mod-scroll__projects__item__text__title .char')
      const log = () => {
        const m = t ? new DOMMatrix(getComputedStyle(t).transform) : null
        const cm = ch ? new DOMMatrix(getComputedStyle(ch).transform) : null
        window.__MOTION__.push({ t: performance.now(), y: window.scrollY, x: m ? m.e : null, chy: cm ? cm.f : null })
        window.__MOTION_RAF__ = requestAnimationFrame(log)
      }
      window.__MOTION_RAF__ = requestAnimationFrame(log)
    })()`)
    const t0 = Date.now()
    while (Date.now() - t0 < 1500) { await wheel(send, 100, W / 2, H / 2); await sleep(16) }
    await sleep(800)
    await evalJS(send, `cancelAnimationFrame(window.__MOTION_RAF__)`).catch(() => {})
    const mineMotion = JSON.parse(await evalJS(send, `JSON.stringify(window.__MOTION__)`))
    const x0 = mineMotion[0] && mineMotion[0].x
    let maxLagX = 0
    let maxLagT = 0
    for (const s of mineMotion) {
      // nearest reference frame by y
      let best = null
      for (const rs of refMotion) if (!best || Math.abs(rs.y - s.y) < Math.abs(best.y - s.y)) best = rs
      if (best) {
        maxLagX = Math.max(maxLagX, Math.abs((best.x - x0) - s.x))
        maxLagT = Math.max(maxLagT, Math.abs(best.t - s.t))
      }
    }
    pass(`T3 ${TAG} motion replay`, maxLagX < 60, `maxLagX=${R(maxLagX)}px maxLagT=${R(maxLagT)}ms`)

    // T4: hover replay on my build
    let hoverOk = true
    let hoverDetail = ''
    try {
      const refHover = JSON.parse(readFileSync(`${ROOT}\\ref\\hover-${TAG}.json`, 'utf8'))
      const t = refHover.terms[1]
      if (t) {
        await mouseMove(send, t.x, t.y)
        await sleep(1200)
        const st = JSON.parse(await evalJS(send, `
        (() => {
          const F = document.querySelector('.mod-scroll__terms .follow__mouse')
          const fm = F ? new DOMMatrix(getComputedStyle(F).transform) : null
          const fr = F ? F.getBoundingClientRect() : null
          return JSON.stringify({ op: F ? getComputedStyle(F).opacity : null, x: fm ? fm.e : null, y: fm ? fm.f : null, w: fr ? fr.width : null, imgs: F ? Array.from(F.querySelectorAll('img')).map((i) => String(i.className)) : [] })
        })()`))
        hoverDetail = `followOp=${st.op} x=${R(st.x)} y=${R(st.y)} imgs=${JSON.stringify(st.imgs)}`
        const refFollow = refHover.scrolls[0] && refHover.scrolls[0].events[0] && refHover.scrolls[0].events[0].samples[refHover.scrolls[0].events[0].samples.length - 1]
        if (refFollow) {
          if (Math.abs(st.op - refFollow.fOp) > 0.15) hoverOk = false
          if (Math.abs((st.x + (st.w || 0) / 2) - (refFollow.fX + refFollow.fW / 2)) > 30) hoverOk = false
          if (st.imgs[1] !== 'on') hoverOk = false
        }
      }
    } catch (e) {
      hoverDetail = 'hover ref missing: ' + e.message
      hoverOk = false
    }
    pass(`T4 ${TAG} hover follow`, hoverOk, hoverDetail)

    // T6: last-item regression vs last-item-before.json
    const before = JSON.parse(readFileSync(`${ROOT}\\last-item-before.json`, 'utf8'))
    const vpBefore = before.viewports[TAG]
    let t6Bad = 0
    let t6Worst = 0
    const GEOM = `
    (() => {
      const R = (v) => Math.round(v * 100) / 100
      const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { l: R(r.left), r: R(r.right), w: R(r.width) } }
      const mx = (el) => { if (!el) return null; const m = new DOMMatrix(getComputedStyle(el).transform); return { e: R(m.e), f: R(m.f) } }
      const sc = document.querySelector('.mod-scroll')
      const sectionsX = (() => { const s = sc ? sc.querySelector(':scope > div') : null; return s ? mx(s) : null })()
      const last = document.querySelector('.mod-scroll__projects__item.last-item')
      const car = last ? last.querySelector('.last-item__carousel') : null
      const content = last ? last.querySelector('.last-item__content') : null
      const title = last ? last.querySelector('.last-item__content__title') : null
      const para = last ? last.querySelector('.last-item__content__text') : null
      const titleChars = title ? Array.from(title.querySelectorAll('.char')).map((c) => mx(c)) : []
      let paraLines = []
      if (para) { const p = para.querySelector('p'); paraLines = Array.from(p ? p.querySelectorAll('.line') : []).map((l) => { const r = rect(l); const inner = l.querySelector('span'); const m = inner ? mx(inner) : null; return { ...r, y: m ? m.f : 0 } }) }
      return JSON.stringify({ sectionsX, panels: Array.from(document.querySelectorAll('.mod-scroll__projects__item')).map((p) => rect(p)), group: rect(last), car: rect(car), carT: mx(car), content: rect(content), contentT: mx(content), titleChars, paraLines })
    })()`
    for (const b of vpBefore.samples) {
      await goF(b.f)
      const now = JSON.parse(await evalJS(send, GEOM))
      const chk = (name, a, c, tol) => {
        if (a == null || c == null) return
        const d = Math.abs(a - c)
        if (d > tol) { t6Bad++; t6Worst = Math.max(t6Worst, d) }
      }
      chk('sectionsX', b.sectionsX && b.sectionsX.e, now.sectionsX && now.sectionsX.e, 4)
      chk('groupW', b.group && b.group.w, now.group && now.group.w, 3)
      chk('carY', b.carT && b.carT.f, now.carT && now.carT.f, 4)
      chk('contentL', b.content && b.content.l, now.content && now.content.l, 4)
      if (b.titleChars.length === now.titleChars.length) {
        for (let i = 0; i < b.titleChars.length; i++) chk('char' + i, b.titleChars[i].f, now.titleChars[i].f, 4)
      } else t6Bad++
      if (b.paraLines.length === now.paraLines.length) {
        for (let i = 0; i < b.paraLines.length; i++) chk('line' + i, b.paraLines[i].y, now.paraLines[i].y, 4)
      } else t6Bad++
    }
    pass(`T6 ${TAG} last-item regression`, t6Bad === 0, `bad=${t6Bad} worst=${R(t6Worst)}`)
    const noOverflow = await evalJS(send, `document.documentElement.scrollWidth <= document.documentElement.clientWidth`)
    pass(`T6 ${TAG} no horizontal overflow`, !!noOverflow)
  } finally {
    ws.close()
    chrome.kill()
  }
}

console.log('\n--- SUMMARY ---')
const failed = results.filter((r) => !r.ok)
console.log(`total=${results.length} passed=${results.length - failed.length} failed=${failed.length}`)
for (const f of failed) console.log(`  ${f.t}: ${f.detail}`)
process.exit(failed.length ? 1 : 0)
