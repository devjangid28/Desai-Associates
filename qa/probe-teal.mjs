import { launchChrome, connectCDP, evalJS, setViewport, sleep } from './lib/cdp.mjs'
const chrome = launchChrome(9253, 'teal', { w: 1912, h: 906 })
const { ws, send } = await connectCDP(9253)
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
async function settleF(f) {
  const y = Math.round(st0.top + f * (st0.h - st0.ih))
  await evalJS(send, `
(() => { window.scrollTo(0, ${y}); document.scrollingElement.scrollTop = ${y}; if (window.__ST__ && typeof window.__ST__.update === 'function') window.__ST__.update(); return new Promise((rs) => requestAnimationFrame(() => requestAnimationFrame(() => rs(true)))) })()`)
  await sleep(400)
}
await settleF(0.18)
const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true })
const buf = Buffer.from(shot.data, 'base64')
const { writeFileSync } = await import('node:fs')
writeFileSync('C:\\Users\\DK\\Desktop\\interior design\\qa\\teal-frame.png', buf)
// sample pixels around (1129,708) region and near center
for (const [x, y] of [[1129, 708], [950, 450], [1129, 500], [700, 700], [1800, 800]]) {
  const el = await evalJS(send, `(() => {
    const els = document.elementsFromPoint(${x}, ${y})
    return JSON.stringify(els.slice(0, 6).map((e) => ({ tag: e.tagName, cls: String(e.className).slice(0, 60), id: e.id })))
  })()`)
  console.log('pt(' + x + ',' + y + ')', el)
}
ws.close()
chrome.kill()
