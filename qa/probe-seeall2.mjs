import { launchChrome, connectCDP, evalJS, setViewport, sleep } from './lib/cdp.mjs'
const chrome = launchChrome(9261, 'seeall2', { w: 1920, h: 1080 })
const { ws, send } = await connectCDP(9261)
await send('Runtime.enable')
await setViewport(send, 1920, 1080)
await send('Page.navigate', { url: 'http://127.0.0.1:5173/?debug=1' })
for (let i = 0; i < 150; i++) {
  const r = await evalJS(send, `(() => { const pre = document.querySelector('.preloader'); const preGone = !pre || getComputedStyle(pre).display === 'none'; return preGone && !!window.__M_FD__ && document.fonts.status === 'loaded' })()`).catch(() => null)
  if (r) break
  await sleep(400)
}
await evalJS(send, `(() => { const L = window.__lenis; if (L) { try { L.destroy() } catch (e) {} } })()`).catch(() => {})
await sleep(400)
const st0 = JSON.parse(await evalJS(send, `(() => { const w = document.querySelector('.mod-scroll-wrap'); const r = w.getBoundingClientRect(); const top = r.top + window.scrollY; return JSON.stringify({ top, h: w.offsetHeight, ih: window.innerHeight }) })()`))
const y = Math.round(st0.top + 1 * (st0.h - st0.ih))
await evalJS(send, `
(() => { window.scrollTo(0, ${y}); document.scrollingElement.scrollTop = ${y}; if (window.__ST__ && typeof window.__ST__.update === 'function') window.__ST__.update(); return new Promise((rs) => requestAnimationFrame(() => requestAnimationFrame(() => rs(true)))) })()`)
await sleep(500)
const info = await evalJS(send, `(() => {
  const tile = document.querySelector('.last-item__carousel__item--link')
  const label = tile ? tile.querySelector('.btn--label') : null
  if (!label) return JSON.stringify({ none: true })
  const cs = getComputedStyle(label)
  const a = getComputedStyle(tile)
  const r = label.getBoundingClientRect()
  const tr = tile.getBoundingClientRect()
  return JSON.stringify({ aDisplay: a.display, aW: a.width, aH: a.height, tile: { l: tr.left, r: tr.right, t: tr.top, b: tr.bottom }, labelDisplay: cs.display, labelW: cs.width, labelH: cs.height, justify: cs.justifyItems, align: cs.alignItems, label: { l: r.left, r: r.right, t: r.top, b: r.bottom } })
})()`)
console.log(info)
ws.close()
chrome.kill()
