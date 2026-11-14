import { launchChrome, connectCDP, evalJS, setViewport, sleep } from './lib/cdp.mjs'
const chrome = launchChrome(9258, 'stagger', { w: 1920, h: 1080 })
const { ws, send } = await connectCDP(9258)
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
async function atF(f) {
  const y = Math.round(st0.top + f * (st0.h - st0.ih))
  await evalJS(send, `
(() => { window.scrollTo(0, ${y}); document.scrollingElement.scrollTop = ${y}; if (window.__ST__ && typeof window.__ST__.update === 'function') window.__ST__.update(); return new Promise((rs) => requestAnimationFrame(() => requestAnimationFrame(() => rs(true)))) })()`)
  await sleep(250)
  return evalJS(send, `(() => {
    const p1 = document.querySelectorAll('.mod-scroll__projects__item:not(.last-item)')[0]
    const p2 = document.querySelectorAll('.mod-scroll__projects__item:not(.last-item)')[1]
    const words1 = Array.from(p1.querySelectorAll('.mod-scroll__projects__item__text__title .word')).map((w) => { const m = new DOMMatrix(getComputedStyle(w).transform); return Math.round(m.f) })
    const words2 = Array.from(p2.querySelectorAll('.mod-scroll__projects__item__text__title .word')).map((w) => { const m = new DOMMatrix(getComputedStyle(w).transform); return Math.round(m.f) })
    const l1 = Math.round(p1.getBoundingClientRect().left / innerWidth * 1000) / 10
    const l2 = Math.round(p2.getBoundingClientRect().left / innerWidth * 1000) / 10
    return JSON.stringify({ l1, words1, l2, words2 })
  })()`)
}
// hunt for mid-reveal: scan f 0.18..0.24 finely
for (let f = 0.18; f <= 0.24; f += 0.004) {
  const r = JSON.parse(await atF(f))
  const w1 = r.words1
  if (w1.some((v) => v > 1 && v < 69)) console.log('MID f=' + f.toFixed(3), JSON.stringify(r))
}
ws.close()
chrome.kill()
