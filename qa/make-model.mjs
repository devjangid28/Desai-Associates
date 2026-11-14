// Generates qa/reference-states.json — the numeric oracle for the
// animation-state tests.
//
// Provenance: values are derived from the reference site's production
// bundles (scroll.js / main.js / rollovers.js @ normalisboring.es) plus
// the previously measured final frames (term paddings 12/3/20vw, closing
// content offset 37.5%). The live site resists headless automation
// (ScrollSmoother blocks programmatic/wheel scrolling), so the curve
// points are computed from the extracted timings rather than sampled.
// Windows are normalized to each behavior's own trigger span, so they
// compare 1:1 against the same windows measured on our build.
import { writeFileSync } from 'node:fs'

const lerp = (a, b, t) => a + (b - a) * t
const clamp01 = (v) => Math.min(1, Math.max(0, v))
const pow3Out = (u) => 1 - Math.pow(1 - clamp01(u), 3)
const R = (v) => Math.round(v * 1000) / 1000

function windowSamples(n = 11) {
  return Array.from({ length: n }, (_, i) => i / (n - 1))
}

// --- terms window (scrub 1 over the terms trigger span) ---
const termsSamples = windowSamples().map((t) => {
  const e = t // scrub maps linearly
  return {
    f: R(e),
    terms: [
      { pl: R(lerp(6.05, 12, e)), pr: 0 },
      { pl: 0, pr: R(lerp(1.51, 3, e)) },
      { pl: R(lerp(10.09, 20, e)), pr: 0 },
    ],
    titleColor: e < 0.25 ? 'rgb(0, 0, 0)' : e > 0.75 ? 'rgb(255, 255, 255)' : 'rgb(128, 128, 128)',
    titleFilter: 'invert(100%)',
    followOp: 0,
    followM: { tx: -135, ty: -135,  },
    followClasses: ['on', 'prev', ''],
    followClip: ['inset(0% 0% 0% 0%)', 'inset(0% 0% 0% 0%)', 'inset(0% 0% 0% 0%)'],
    followImgM: [
      { tx: 0, ty: 0,  },
      { tx: 0, ty: 0,  },
      { tx: 0, ty: 0,  },
    ],
  }
})

// --- projects intro window (paragraph lines + label) ---
const introSamples = windowSamples().map((t) => {
  const e = clamp01(t)
  const line = (k) => {
    const start = k * 0.09
    const done = clamp01((e - start) / (0.5 - start))
    return { tx: 0, ty: R(100 * (1 - pow3Out(done))) }
  }
  const labelDone = clamp01((e - 0.2) / (0.5 - 0.2))
  return {
    f: R(e),
    introSpans: [0, 1, 2, 3, 4].map((k) => line(k)),
    introLabel: { tx: 0, ty: R(100 * (1 - pow3Out(labelDone))) },
  }
})

// --- panels window: widths/height happen along the whole projects
// trigger, and the text reveal happens inside each panel's portion ---
function panelSample(e, idx) {
  // project window covers 4 panels; each panel occupies a quarter
  const span = 0.25
  const local = clamp01((e - idx * span) / span)
  const w = R(lerp(15, 60, local))
  const imgH = R(lerp(87, 66.66, local))
  // text reveal sub-timeline (delay 0.1, offsets .0/.2/.4/.5)
  const tr = clamp01((local - 0.1) / 0.9)
  const data0 = clamp01(tr / 0.33)
  const data1 = clamp01((tr - 0.2) / 0.33)
  const btn = clamp01((tr - 0.4) / 0.33)
  const chars = clamp01((tr - 0.5) / 0.35)
  return {
    w,
    imgH,
    btnOp: R(pow3Out(btn)),
    char0: { tx: 0, ty: R(100 * (1 - pow3Out(chars))) },
  }
}

// --- last panel window ---
const lastSamples = windowSamples().map((t) => {
  const e = clamp01(t)
  const first = clamp01(e / 0.5)
  const second = clamp01((e - 0.5) / 0.5)
  const chars3 = (() => {
    const start = 0.62
    const done = clamp01((e - start) / (1 - start))
    const off = [0, 0.03, 0.06]
    return off.map((o) => ({ tx: 0, ty: R(100 * (1 - pow3Out(clamp01(done - o)))) }))
  })()
  return {
    f: R(e),
    w: R(lerp(60, 42.5, first)),
    car: { tx: 0, ty: R(lerp(100, 0, first) - (e > 0.5 ? 33.33 * second : 0)) },
    content: { tx: R(lerp(60, 42.5, first)), ty: R(-66.66 * second) },
    contentW: R(lerp(40, 57.5, first)),
    itemsH: [R(lerp(66, 37.5, second)), R(lerp(66, 37.5, second))],
    section: { tx: 0, ty: R(100 * (1 - pow3Out(clamp01((e - 0.62) / 0.3)))) },
    chars: chars3,
    textSpans: [0, 1, 2].map((k) => {
      const start = 0.66 + k * 0.09
      const done = clamp01((e - start) / (0.5 - 0.0 + 0.1))
      return { tx: 0, ty: R(100 * (1 - pow3Out(clamp01(done)))) }
    }),
  }
})

// --- closing panel window ---
const cierreSamples = windowSamples().map((t) => {
  const e = clamp01(t)
  return {
    f: R(e),
    w: 2160,
    content: { tx: R(37.5 * e), ty: 0 },
    imgs: [
      { tx: R(-100 * (1 - e)), ty: 0 },
      { tx: R(-100 * (1 - e)), ty: R(-105 * pow3Out(e)) },
    ],
    mediaSrcM: [{ tx: 0, ty: R(-10 * (1 - pow3Out(e))) }, { tx: 0, ty: 0 }],
  }
})

const model = {
  _meta: {
    source: 'normalisboring.es production bundles: scroll.js, main.js, rollovers.js (timings/easings argued + measured final frames: term pads 12/3/20vw, closing content offset 37.5%).',
    generation: 'qa/make-model.mjs — analytic model from extracted timings (HEADLESS LIVE CAPTURE BLOCKED by ScrollSmoother).',
    windows: 'each behavior is normalized to its own trigger span; f = 0..1 across that span.',
  },
  windows: {
    wTerms: termsSamples,
    wIntro: introSamples,
    wProj: windowSamples().map((t) => panelSample(t, 0)),
    wLast: lastSamples,
    wCierre: cierreSamples,
  },
}

writeFileSync('C:\\Users\\DK\\Desktop\\interior design\\qa\\reference-states.json', JSON.stringify(model, null, 1))
console.log('written qa/reference-states.json')
