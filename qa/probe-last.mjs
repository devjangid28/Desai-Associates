import { launchChrome, connectCDP, evalJS, setViewport, sleep } from './lib/cdp.mjs'
const chrome = launchChrome(9257, 'last', { w: 1920, h: 1080 })
const { ws, send } = await connectCDP(9257)
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
  await sleep(300)
  return evalJS(send, `(() => {
    const tl = window.__TRACK_TL__
    const last = document.querySelector('.mod-scroll__projects__item.last-item')
    const w = last ? Math.round(last.getBoundingClientRect().width / innerWidth * 1000) / 10 : null
    const l = last ? Math.round(last.getBoundingClientRect().left / innerWidth * 1000) / 10 : null
    const words = last ? Array.from(last.querySelectorAll('.last-item__panel .mod-scroll__projects__item__text__title .word')).map((x) => { const m = new DOMMatrix(getComputedStyle(x).transform); return Math.round(m.f) }) : []
    const pW = last ? last.style.getPropertyValue('--panel-w') : null
    return JSON.stringify({ t: tl ? Math.round(tl.time() * 100) / 100 : null, dur: tl ? tl.duration() : null, w, l, pW, words })
  })()`)
}
for (const f of [0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1]) {
  console.log('f=' + f, await atF(f))
}
ws.close()
chrome.kill()
