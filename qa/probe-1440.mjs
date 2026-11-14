import { launchChrome, connectCDP, evalJS, setViewport, sleep } from './lib/cdp.mjs'
const chrome = launchChrome(9251, 'probe1440', { w: 1440, h: 900 })
const { ws, send } = await connectCDP(9251)
await send('Runtime.enable')
await setViewport(send, 1440, 900)
await send('Page.navigate', { url: 'http://127.0.0.1:5173/?debug=1' })
for (let i = 0; i < 150; i++) {
  const r = await evalJS(send, `(() => { const pre = document.querySelector('.preloader'); const preGone = !pre || getComputedStyle(pre).display === 'none'; return preGone && !!window.__M_FD__ && document.fonts.status === 'loaded' && !!document.querySelector('.mod-scroll-wrap') })()`).catch(() => null)
  if (r) break
  await sleep(400)
}
await evalJS(send, `(() => { const L = window.__lenis; if (L) { try { L.destroy() } catch (e) {} } })()`).catch(() => {})
await sleep(500)
const st0 = JSON.parse(await evalJS(send, `(() => { const w = document.querySelector('.mod-scroll-wrap'); const r = w.getBoundingClientRect(); const top = r.top + window.scrollY; return JSON.stringify({ top, h: w.offsetHeight, ih: window.innerHeight, iw: window.innerWidth }) })()`))
console.log('pin', Math.round(st0.top), Math.round(st0.top + st0.h - st0.ih), 'iw', st0.iw)
async function atF(f) {
  const y = Math.round(st0.top + f * (st0.h - st0.ih))
  await evalJS(send, `
(() => { window.scrollTo(0, ${y}); document.scrollingElement.scrollTop = ${y}; if (window.__ST__ && typeof window.__ST__.update === 'function') window.__ST__.update(); return new Promise((rs) => requestAnimationFrame(() => requestAnimationFrame(() => rs(true)))) })()`)
  await sleep(350)
  const r = await evalJS(send, `(() => {
    const intro = document.querySelector('.mod-scroll__projects__wrap-text').getBoundingClientRect()
    const p1 = document.querySelectorAll('.mod-scroll__projects__item:not(.last-item)')[0].getBoundingClientRect()
    const t = document.querySelector('.mod-scroll__projects')
    const m = new DOMMatrix(getComputedStyle(t).transform)
    return JSON.stringify({ il: intro.left / innerWidth * 100, p1l: p1.left / innerWidth * 100, p1w: p1.width / innerWidth * 100, trackX: m.e })
  })()`)
  console.log('f=' + f, r)
}
for (const f of [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4]) {
  await atF(f)
}
ws.close()
chrome.kill()
