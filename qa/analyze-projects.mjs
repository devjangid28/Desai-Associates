// Analyze Projects-scroll measurements (ref + mine) and derive:
//  - per-panel windows in viewport-relative terms (vw of the panel's LEFT edge)
//    width start/end, image-height start/end, text element start/end
//  - ease fit (power1.inOut) + shared-progress check
//  - intro window + background
//  - fixture frame for 1917x916 (intro left == 38.4vw)
// Prints tables and writes qa/ref/projects-timings.md (updated).
import { readFileSync, writeFileSync } from 'node:fs'

const Q = 'C:\\Users\\DK\\Desktop\\interior design\\qa'
const SIZES = ['1917x916', '1920x1080', '1440x900']

function load(site, size) {
  const path = `${Q}\\${site}\\projects-${size}.json`
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null }
}
function loadOld(site, size) {
  const path = `${Q}\\${site}\\states-${size}.json`
  try {
    const d = JSON.parse(readFileSync(path, 'utf8'))
    if (!d.samples) return null
    const iw = d.samples[0].iw
    const ih = d.samples[0].ih || { '1920x1080': 1080, '1440x900': 900, '1917x916': 916 }[size]
    const introW = (99.9 * iw / 100 - 2 * 27.5 - 11 * 25) / 12 * 3 + 4 * 25
    return {
      site, viewport: { w: iw, h: ih }, yStart: d.yStart, yEnd: d.yEnd, n: d.samples.length,
      samples: d.samples.map((st) => ({
        intro: { l: st.panels[0].l - introW, w: introW, bg: null, pl: 25, pr: 25, pt: 25, pb: 25 },
        introLabel: st.introLabel ? { e: st.introLabel.e, f: st.introLabel.f } : null,
        introLines: st.introLines,
        introLinesCnt: st.introLines.length,
        panels: st.panels.map((p) => ({ ...p, l: p.l, w: p.w, imgH: p.imgH })),
        trackX: st.trackX, sy: st.sy, iw, ih, p: null,
      })),
    }
  } catch { return null }
}

// interpolate a crossing point: returns leftVw where series crosses value
function cross(samples, panelIdx, getter, target, dir) {
  let prev = null
  for (const st of samples) {
    const p = st.panels[panelIdx]
    if (!p) continue
    const left = p.l / st.iw * 100
    if (left > 130) continue
    const v = getter(p, st)
    if (v === null || v === undefined) { prev = null; continue }
    if (prev !== null) {
      const [l0, v0] = prev
      if ((dir > 0 && v0 < target && v >= target) || (dir < 0 && v0 > target && v <= target)) {
        const f = (target - v0) / (v - v0)
        return l0 + f * (left - l0)
      }
    }
    prev = [left, v]
  }
  return null
}

function analyzeDataset(ds) {
  const iw = ds.viewport.w
  const ih = ds.viewport.h
  const s = ds.samples
  const out = { panels: [], intro: {}, overview: {} }
  const nPanels = ds.site === 'ref' ? 4 : Math.min(4, s.reduce((m, st) => Math.max(m, st.panels.length), 0))
  for (let i = 0; i < nPanels; i++) {
    const wStart = cross(s, i, (p) => p.w / iw * 100, 15.6, 1)
    const wEnd = cross(s, i, (p) => p.w / iw * 100, 59.6, 1)
    const hStart = cross(s, i, (p) => (p.imgH === null || p.imgH === undefined ? null : p.imgH / ih * 100), 86.4, -1)
    const hEnd = cross(s, i, (p) => (p.imgH === null || p.imgH === undefined ? null : p.imgH / ih * 100), 67.6, -1)
    const tYearS = cross(s, i, (p) => (p.dataSpans && p.dataSpans[0] ? p.dataSpans[0].f : null), 27.5, -1)
    const tYearE = cross(s, i, (p) => (p.dataSpans && p.dataSpans[0] ? p.dataSpans[0].f : null), 0.5, -1)
    const tPlaceS = cross(s, i, (p) => (p.dataSpans && p.dataSpans[1] ? p.dataSpans[1].f : null), 27.5, -1)
    const tPlaceE = cross(s, i, (p) => (p.dataSpans && p.dataSpans[1] ? p.dataSpans[1].f : null), 0.5, -1)
    const tBtnS = cross(s, i, (p) => (p.btn ? p.btn.op : null), 0.5, 1)
    const tBtnE = cross(s, i, (p) => (p.btn ? p.btn.op : null), 0.99, 1)
    const tChS = cross(s, i, (p) => (p.chars && p.chars[0] ? p.chars[0].f : null), 69.5, -1)
    const tChE = cross(s, i, (p) => (p.chars && p.chars[0] ? p.chars[0].f : null), 0.5, -1)
    out.panels.push({ idx: i + 1, wStart, wEnd, hStart, hEnd, tYearS, tYearE, tPlaceS, tPlaceE, tBtnS, tBtnE, tChS, tChE })
  }
  // intro: label + lines crossing
  out.intro.labelS = cross(s, -1, () => null, 0, 1)
  out.intro.paraS = (() => {
    for (const st of s) {
      if (!st.introLines || !st.introLines.length) continue
      const c = st.introLines.filter((x) => x && Math.abs(x.f) > 1).length
      if (c > 0) return (st.intro ? st.intro.l : st.panels[0].l - 25.9 * iw / 100) / iw * 100
    }
    return null
  })()
  out.intro.paraE = (() => {
    for (const st of s) {
      if (!st.introLines || !st.introLines.length) continue
      const c = st.introLines.filter((x) => x && Math.abs(x.f) > 1).length
      if (c === 0 && st.introLines.length === st.introLinesCnt) return (st.intro ? st.intro.l : st.panels[0].l - 25.9 * iw / 100) / iw * 100
    }
    return null
  })()
  out.intro.bg = (() => { for (const st of s) { if (st.intro && st.intro.bg) return st.intro.bg } return null })()
  out.intro.padding = (() => { for (const st of s) { if (st.intro && st.intro.pl !== undefined) return { pl: st.intro.pl, pr: st.intro.pr, pt: st.intro.pt, pb: st.intro.pb } } return null })()
  // overview: min/max of panel windows per dataset (to check identical windows)
  const starts = out.panels.map((p) => p.wStart).filter((v) => v !== null)
  const ends = out.panels.map((p) => p.wEnd).filter((v) => v !== null)
  out.overview = {
    startVw: starts.length ? starts.reduce((a, b) => a + b, 0) / starts.length : null,
    endVw: ends.length ? ends.reduce((a, b) => a + b, 0) / ends.length : null,
    startMin: starts.length ? Math.min(...starts) : null,
    startMax: starts.length ? Math.max(...starts) : null,
    endMin: ends.length ? Math.min(...ends) : null,
    endMax: ends.length ? Math.max(...ends) : null,
  }
  return out
}

function fmt(v, d = 1) { return v === null || v === undefined ? '-' : Number(v).toFixed(d) }

const datasets = {}
for (const size of SIZES) {
  datasets[size] = {
    ref: load('ref', size) || loadOld('ref', size),
    mine: load('mine', size) || loadOld('mine', size),
  }
}

let md = '# Projects panels — measured windows (viewport-relative, vw of panel LEFT edge)\n'
md += `\nMeasured from live https://normalisboring.es/ and my build (dev server).\n`
md += `Sweeps: 40px wheel, 400ms stability. Ease fit: power1.inOut (GSAP), p = clamp((START-left)/(START-END)), width = 15 + 45p, image height = 87 - 20.34p.\n\n`

for (const size of SIZES) {
  md += `## ${size}\n`
  md += '| panel | W start | W end | H start | H end | year S/E | place S/E | btn S/E | chars S/E |\n'
  md += '|---|---|---|---|---|---|---|---|---|---|\n'
  for (const site of ['ref', 'mine']) {
    const ds = datasets[size][site]
    if (!ds) { md += `| ${site} | no data | | | | | | | |\n`; continue }
    const a = analyzeDataset(ds)
    md += `| **${site}** | | | | | | | | | |\n`
    for (const p of a.panels) {
      md += `| ${site} ${p.idx} | ${fmt(p.wStart)} | ${fmt(p.wEnd)} | ${fmt(p.hStart)} | ${fmt(p.hEnd)} | ${fmt(p.tYearS)}/${fmt(p.tYearE)} | ${fmt(p.tPlaceS)}/${fmt(p.tPlaceE)} | ${fmt(p.tBtnS)}/${fmt(p.tBtnE)} | ${fmt(p.tChS)}/${fmt(p.tChE)} |\n`
    }
    const o = a.overview
    md += `| ${site} AVG | ${fmt(o.startVw)} | ${fmt(o.endVw)} | | | | | | |\n`
    md += `| ${site} range | ${fmt(o.startMin)}..${fmt(o.startMax)} | ${fmt(o.endMin)}..${fmt(o.endMax)} | | | | | | |\n`
    if (size === '1917x916') {
      md += `| ${site} intro bg | ${a.intro.bg || '-'} | padding ${a.intro.padding ? JSON.stringify(a.intro.padding) : '-'} | paraS ${fmt(a.intro.paraS)} paraE ${fmt(a.intro.paraE)} | | | | | |\n`
    }
  }
  md += '\n'
}

writeFileSync(`${Q}\\ref\\projects-timings.md`, md)
console.log(md)

// ---- fixture for 1917x916: intro left edge at 38.4vw ----
const FIX = { targetIntroLeftVw: 38.4, targetPanel1LeftVw: 64.5 }
for (const site of ['ref', 'mine']) {
  const ds = datasets['1917x916'][site]
  if (!ds) continue
  let best = null
  let bestD = Infinity
  for (const st of ds.samples) {
    if (!st.intro || !st.panels.length) continue
    const d = Math.abs(st.intro.l / st.iw * 100 - 38.4)
    if (d < bestD) { bestD = d; best = st }
  }
  if (best) {
    const f = {
      site,
      introLeftVw: Math.round(best.intro.l / best.iw * 1000) / 10,
      panel1: best.panels[0] ? { leftVw: Math.round(best.panels[0].l / best.iw * 1000) / 10, widthVw: Math.round(best.panels[0].w / best.iw * 1000) / 10, imgHvh: Math.round(best.panels[0].imgH / best.ih * 1000) / 10 } : null,
      panel2: best.panels[1] ? { leftVw: Math.round(best.panels[1].l / best.iw * 1000) / 10, widthVw: Math.round(best.panels[1].w / best.iw * 1000) / 10 } : null,
      p1Text: best.panels[0] ? { yearF: best.panels[0].dataSpans && best.panels[0].dataSpans[0] ? best.panels[0].dataSpans[0].f : null, btnOp: best.panels[0].btn ? best.panels[0].btn.op : null, chars: best.panels[0].chars.length } : null,
      introBg: best.intro.bg,
      introLines: best.introLines.map((x) => (x ? { f: x.f } : null)),
      introLabel: best.introLabel ? { f: best.introLabel.f } : null,
      scrollY: best.sy,
      fileName: site,
    }
    writeFileSync(`${Q}\\ref\\fixture-1917x916-${site}.json`, JSON.stringify(f, null, 1))
    console.log(`\nFIXTURE ${site}: introLeft=${f.introLeftVw}vw p1=${JSON.stringify(f.panel1)} p2=${JSON.stringify(f.panel2)} text=${JSON.stringify(f.p1Text)} bg=${f.introBg} paraLines=${f.introLines.length} labelF=${f.introLabel.f}`)
  }
}
