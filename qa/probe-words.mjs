import { launchChrome, connectCDP, evalJS, setViewport, sleep } from './lib/cdp.mjs'
const chrome = launchChrome(9256, 'words', { w: 1920, h: 1080 })
const { ws, send } = await connectCDP(9256)
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
    const p1 = document.querySelectorAll('.mod-scroll__projects__item:not(.last-item)')[0]
    const last = document.querySelector('.mod-scroll__projects__item.last-item')
    const words = Array.from(p1.querySelectorAll('.mod-scroll__projects__item__text__title .word')).map((w) => { const m = new DOMMatrix(getComputedStyle(w).transform); return Math.round(m.f) })
    const lastWords = last ? Array.from(last.querySelectorAll('.last-item__panel .mod-scroll__projects__item__text__title .word')).map((w) => { const m = new DOMMatrix(getComputedStyle(w).transform); return Math.round(m.f) }) : []
    const p1l = Math.round(p1.getBoundingClientRect().left / innerWidth * 1000) / 10
    const lastl = last ? Math.round(last.getBoundingClientRect().left / innerWidth * 1000) / 10 : null
    const lastW = last ? Math.round(last.getBoundingClientRect().width / innerWidth * 1000) / 10 : null
    return JSON.stringify({ p1l, words, lastl, lastW, lastWords })
  })()`)
}
for (const f of [0.2, 0.22, 0.24, 0.26, 0.28, 0.8, 0.9, 1]) {
  console.log('f=' + f, await atF(f))
}
ws.close()
chrome.kill()
