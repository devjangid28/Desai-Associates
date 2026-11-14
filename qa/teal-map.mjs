import { launchChrome, connectCDP, evalJS, setViewport, sleep } from './lib/cdp.mjs'
const chrome = launchChrome(9255, 'teal3', { w: 1912, h: 906 })
const { ws, send } = await connectCDP(9255)
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
const iw = st0.iw
console.log('iw', iw)
await evalJS(send, `(() => { const y = Math.round(${st0.top} + 0.18 * (${st0.h} - ${st0.ih})); window.scrollTo(0, y); document.scrollingElement.scrollTop = y; if (window.__ST__ && typeof window.__ST__.update === 'function') window.__ST__.update(); return new Promise((rs) => requestAnimationFrame(() => requestAnimationFrame(() => rs(true)))) })()`)
await sleep(400)
const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true })
const { writeFileSync } = await import('node:fs')
writeFileSync('C:\\Users\\DK\\Desktop\\interior design\\qa\\teal-frame.png', Buffer.from(shot.data, 'base64'))
const { decodePNG } = await import('./png.js')
const png = decodePNG(Buffer.from(shot.data, 'base64'))
const W = png.width, H = png.height
const NX = 48, NY = 20
for (let iy = 0; iy < NY; iy++) {
  let row = ''
  const y = Math.round((iy / (NY - 1)) * (H - 1))
  for (let ix = 0; ix < NX; ix++) {
    const x = Math.round((ix / (NX - 1)) * (W - 1))
    const i = (y * W + x) * 4
    const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2]
    let c = '.'
    if (r > 240 && g > 240 && b > 240) c = 'W'
    else if (r > 225 && g > 215 && b > 200 && r < 255 && g < 245 && b < 235) c = 'B' // beige
    else if (r > 180 && g > 200 && b > 215) c = 'b' // blue
    else if (g > 110 && g > r + 25) c = 'T' // teal
    else if (r < 60 && g < 60 && b < 60) c = 'k'
    else if (r > 120 && g > 120 && b > 120) c = 'g'
    else c = '?'
    row += c
  }
  console.log(String(y).padStart(4), row)
}
ws.close()
chrome.kill()
