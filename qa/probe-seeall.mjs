import { launchChrome, connectCDP, evalJS, setViewport, sleep } from './lib/cdp.mjs'
const chrome = launchChrome(9260, 'seeall', { w: 1920, h: 1080 })
const { ws, send } = await connectCDP(9260)
await send('Runtime.enable')
await setViewport(send, 1920, 1080)
await send('Page.navigate', { url: 'http://127.0.0.1:5173/?debug=1' })
for (let i = 0; i < 150; i++) {
  const r = await evalJS(send, `(() => { const pre = document.querySelector('.preloader'); const preGone = !pre || getComputedStyle(pre).display === 'none'; return preGone && !!window.__M_FD__ && document.fonts.status === 'loaded' && !!document.querySelector('.mod-scroll-wrap') })()`).catch(() => null)
  if (r) break
  await sleep(400)
}
await evalJS(send, `(() => { const L = window.__lenis; if (L) { try { L.destroy() } catch (e) {} } })()`).catch(() => {})
await sleep(500)
const st0 = JSON.parse(await evalJS(send, `(() => { const w = document.querySelector('.mod-scroll-wrap'); const r = w.getBoundingClientRect(); const top = r.top + window.scrollY; return JSON.stringify({ top, h: w.offsetHeight, ih: window.innerHeight }) })()`))
const y = Math.round(st0.top + 1 * (st0.h - st0.ih))
await evalJS(send, `
(() => { window.scrollTo(0, ${y}); document.scrollingElement.scrollTop = ${y}; if (window.__ST__ && typeof window.__ST__.update === 'function') window.__ST__.update(); return new Promise((rs) => requestAnimationFrame(() => requestAnimationFrame(() => rs(true)))) })()`)
await sleep(500)
const info = await evalJS(send, `(() => {
  const tile = document.querySelector('.last-item__carousel__item--link')
  if (!tile) return JSON.stringify({ none: true })
  const tr = tile.getBoundingClientRect()
  const spans = Array.from(tile.querySelectorAll('.btn--label > span')).map((s) => {
    const r = s.getBoundingClientRect()
    const cs = getComputedStyle(s)
    return { text: s.textContent, display: cs.display, visible: cs.display !== 'none' && r.width > 0 && r.height > 0, l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom) }
  })
  const visible = spans.filter((s) => s.visible)
  const center = visible[0] ? { cx: Math.round((visible[0].l + visible[0].r) / 2), cy: Math.round((visible[0].t + visible[0].b) / 2) } : null
  return JSON.stringify({ tile: { l: Math.round(tr.left), r: Math.round(tr.right), t: Math.round(tr.top), b: Math.round(tr.bottom), cx: Math.round((tr.left + tr.right) / 2), cy: Math.round((tr.top + tr.bottom) / 2) }, spans, visibleCount: visible.length, center })
})()`)
console.log(info)
ws.close()
chrome.kill()
