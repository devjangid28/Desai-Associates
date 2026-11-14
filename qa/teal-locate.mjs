import { launchChrome, connectCDP, evalJS, setViewport, sleep } from './lib/cdp.mjs'
const chrome = launchChrome(9254, 'teal2', { w: 1912, h: 906 })
const { ws, send } = await connectCDP(9254)
await send('Runtime.enable')
await setViewport(send, 1912, 906)
await send('Page.navigate', { url: 'http://127.0.0.1:5173/?debug=1' })
for (let i = 0; i < 150; i++) {
  const r = await evalJS(send, `(() => { const pre = document.querySelector('.preloader'); const preGone = !pre || getComputedStyle(pre).display === 'none'; return preGone && !!window.__M_FD__ && document.fonts.status === 'loaded' && !!document.querySelector('.mod-scroll-wrap') })()`).catch(() => null)
  if (r) break
  await sleep(400)
}
await evalJS(send, `(() => { const L = window.__lenis; if (L) { try { L.destroy() } catch (e) {} } })()`).catch(() => {})
await sleep(500)
const st0 = JSON.parse(await evalJS(send, `(() => { const w = document.querySelector('.mod-scroll-wrap'); const r = w.getBoundingClientRect(); const top = r.top + window.scrollY; return JSON.stringify({ top, h: w.offsetHeight, ih: window.innerHeight, iw: window.innerWidth }) })()`))
await evalJS(send, `(() => { const y = Math.round(${st0.top} + 0.18 * (${st0.h} - ${st0.ih})); window.scrollTo(0, y); document.scrollingElement.scrollTop = y; if (window.__ST__ && typeof window.__ST__.update === 'function') window.__ST__.update(); return new Promise((rs) => requestAnimationFrame(() => requestAnimationFrame(() => rs(true)))) })()`)
await sleep(400)
const info = await evalJS(send, `(() => {
  const pts = [[950,450],[900,450],[1000,450],[950,400],[950,500],[850,450],[1050,450],[950,350],[950,550],[1100,500],[800,500]]
  return JSON.stringify(pts.map(([x,y]) => {
    const els = document.elementsFromPoint(x, y)
    return { x, y, els: els.slice(0, 5).map((e) => ({ tag: e.tagName, cls: String(e.className).slice(0, 50) })) }
  }))
})()`)
console.log(info)
ws.close()
chrome.kill()
