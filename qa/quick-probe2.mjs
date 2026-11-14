import { launchChrome, connectCDP, evalJS, setViewport, sleep } from './lib/cdp.mjs'
const PORT = 9240
const SRC = 'http://127.0.0.1:5173/?debug=1'
const chrome = launchChrome(PORT, 'probe2', { w: 1917, h: 916 })
const { ws, send } = await connectCDP(PORT)
await send('Runtime.enable')
await setViewport(send, 1917, 916)
await send('Page.navigate', { url: SRC })
for (let i = 0; i < 150; i++) {
  const r = await evalJS(send, `(() => { const pre = document.querySelector('.preloader'); const preGone = !pre || getComputedStyle(pre).display === 'none'; return preGone && !!window.__M_FD__ && document.fonts.status === 'loaded' && !!document.querySelector('.mod-scroll-wrap') })()`).catch(() => null)
  if (r) break
  await sleep(400)
}
await evalJS(send, `(() => { const L = window.__lenis; if (L) { try { L.destroy() } catch (e) {} } })()`).catch(() => {})
await sleep(500)
const rng = JSON.parse(await evalJS(send, `
(() => { const w = document.querySelector('.mod-scroll-wrap'); const r = w.getBoundingClientRect(); const top = r.top + window.scrollY; return JSON.stringify({ start: top, end: top + (w.offsetHeight - window.innerHeight) }) })()`))
console.log('pin', Math.round(rng.start), Math.round(rng.end))
const READ = `
(() => {
  const R = (v) => Math.round(v * 100) / 100
  const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { l: R(r.left), r: R(r.right), w: R(r.width) } }
  const mx = (el) => { if (!el) return null; const m = new DOMMatrix(getComputedStyle(el).transform); return { e: R(m.e), f: R(m.f) } }
  const iw = window.innerWidth
  const wrapText = document.querySelector('.mod-scroll__projects__wrap-text')
  const items = Array.from(document.querySelectorAll('.mod-scroll__projects__item:not(.last-item)'))
  const introText = document.querySelector('.mod-scroll__projects__text')
  const introLines = introText ? Array.from(introText.querySelectorAll('span')).map((el) => mx(el)) : []
  const introLabel = document.querySelector('.mod-scroll__projects__section')
  return JSON.stringify({
    iw,
    intro: wrapText ? { ...rect(wrapText), bg: getComputedStyle(wrapText).backgroundColor } : null,
    introLabel: introLabel ? mx(introLabel) : null,
    introLines,
    panels: items.map((p) => {
      const media = p.querySelector('.media__source')
      const btn = p.querySelector('a.btn')
      const ds = Array.from(p.querySelectorAll('.mod-scroll__projects__item__text__data span:not(.data-number)')).map((el) => mx(el))
      const chars = Array.from(p.querySelectorAll('.mod-scroll__projects__item__text__title .char')).slice(0, 4).map((c) => mx(c))
      return { ...rect(p), imgH: media ? R(media.getBoundingClientRect().height) : null, ds, btn: btn ? { op: R(parseFloat(getComputedStyle(btn).opacity)) } : null, chars }
    }),
  })
})()
`
async function atF(f) {
  const y = Math.round(rng.start + f * (rng.end - rng.start))
  await evalJS(send, `
(() => { window.scrollTo(0, ${y}); document.scrollingElement.scrollTop = ${y}; if (window.__ST__ && typeof window.__ST__.update === 'function') window.__ST__.update(); return new Promise((rs) => requestAnimationFrame(() => requestAnimationFrame(() => rs(true)))) })()`)
  await sleep(250)
  return JSON.parse(await evalJS(send, READ))
}
// find scroll fraction where intro left = 38.4vw
let lo = 0, hi = 0.5
for (let k = 0; k < 14; k++) {
  const mid = (lo + hi) / 2
  const st = await atF(mid)
  const il = st.intro.l / st.iw * 100
  if (il > 38.4) lo = mid; else hi = mid
}
const fix = await atF((lo + hi) / 2)
console.log('FIXTURE introLeftVw=', (fix.intro.l / fix.iw * 100).toFixed(2), 'bg=', fix.intro.bg)
console.log('p1', JSON.stringify(fix.panels[0]).slice(0, 300))
console.log('p2', JSON.stringify({ l: fix.panels[1].l, w: fix.panels[1].w }))
console.log('introLabel', JSON.stringify(fix.introLabel), 'lines', JSON.stringify(fix.introLines))
for (const f of [0.12, 0.2, 0.3, 0.4, 0.5, 0.6, 0.72, 0.8, 0.9, 1]) {
  const st = await atF(f)
  const arr = st.panels.map((p) => `${Math.round(p.l / st.iw * 10) / 10}vw/${Math.round(p.w / st.iw * 10) / 10}vw`)
  console.log('f=' + f, 'p1..4(left/w):', arr.join(' '), 'introL=' + (st.intro.l / st.iw * 100).toFixed(1))
}
ws.close()
chrome.kill()
