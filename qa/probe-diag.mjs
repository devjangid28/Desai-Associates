import { launchChrome, connectCDP, evalJS, setViewport, sleep } from './lib/cdp.mjs'
const chrome = launchChrome(9242, 'probe-diag', { w: 1917, h: 916 })
const { ws, send } = await connectCDP(9242)
await send('Runtime.enable')
await setViewport(send, 1917, 916)
await send('Page.navigate', { url: 'http://127.0.0.1:5173/?debug=1' })
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
  const sc = document.querySelector('.mod-scroll')
  const proj = document.querySelector('.mod-scroll__projects')
  const sections = Array.from(sc.querySelectorAll(':scope > div'))
  const rect = (el) => { const r = el.getBoundingClientRect(); return { l: R(r.left), r: R(r.right), w: R(r.width) } }
  const mx = (el) => { const m = new DOMMatrix(getComputedStyle(el).transform); return { e: R(m.e), f: R(m.f) } }
  const items = Array.from(document.querySelectorAll('.mod-scroll__projects__item:not(.last-item)'))
  return JSON.stringify({
    sy: window.scrollY,
    wrap: rect(document.querySelector('.mod-scroll-wrap')),
    scT: mx(sc),
    projT: mx(proj),
    sectionsT: sections.map((s) => ({ cls: s.className, ...mx(s) })),
    items: items.map((p) => ({ ...rect(p), offL: p.offsetLeft, wPx: p.offsetWidth, stW: p.style.width })),
    termsW: document.querySelector('.mod-scroll__terms').offsetWidth,
  })
})()
`
async function atF(f) {
  const y = Math.round(rng.start + f * (rng.end - rng.start))
  await evalJS(send, `
(() => { window.scrollTo(0, ${y}); document.scrollingElement.scrollTop = ${y}; if (window.__ST__ && typeof window.__ST__.update === 'function') window.__ST__.update(); return new Promise((rs) => requestAnimationFrame(() => requestAnimationFrame(() => rs(true)))) })()`)
  await sleep(300)
  return JSON.parse(await evalJS(send, READ))
}
for (const f of [0, 0.05, 0.12, 0.2, 0.4, 0.6, 0.8, 1]) {
  const st = await atF(f)
  console.log('\nf=' + f, 'sy=' + st.sy)
  console.log(' wrap', JSON.stringify(st.wrap))
  console.log(' scT', JSON.stringify(st.scT), 'projT', JSON.stringify(st.projT))
  console.log(' sectionsT', JSON.stringify(st.sectionsT))
  console.log(' items', JSON.stringify(st.items))
  console.log(' termsW', st.termsW)
}
ws.close()
chrome.kill()
