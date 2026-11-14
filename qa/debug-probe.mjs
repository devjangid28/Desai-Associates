import { launchChrome, connectCDP, evalJS, setViewport, sleep } from './lib/cdp.mjs'
const PORT = 9226
const chrome = launchChrome(PORT, 'dbg', { w: 1920, h: 1080 })
const { ws, send } = await connectCDP(PORT)
await send('Runtime.enable')
await setViewport(send, 1920, 1080)
await send('Page.navigate', { url: 'http://127.0.0.1:5173/?debug=1' })
for (let i = 0; i < 80; i++) {
  const r = await evalJS(send, `(() => { const pre = document.querySelector('.preloader'); const preGone = !pre || getComputedStyle(pre).display === 'none'; return preGone && !!window.__M_FD__ && document.fonts.status === 'loaded' })()`).catch(() => null)
  if (r) break
  await sleep(400)
}
await evalJS(send, `(() => { const L = window.__lenis; if (L) { try { L.destroy() } catch (e) {} } })()`).catch(() => {})
const rng = JSON.parse(await evalJS(send, `
(() => {
  const w = document.querySelector('.mod-scroll-wrap')
  const r = w.getBoundingClientRect()
  const top = r.top + window.scrollY
  return JSON.stringify({ start: top, end: top + (w.offsetHeight - window.innerHeight) })
})()`))
console.log('range', rng)
for (const f of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
  const y = Math.round(rng.start + f * (rng.end - rng.start))
  await evalJS(send, `
  (() => {
    window.scrollTo(0, ${y})
    document.scrollingElement.scrollTop = ${y}
    if (window.__ST__ && typeof window.__ST__.update === 'function') window.__ST__.update()
  })()`)
  await sleep(400)
  const st = JSON.parse(await evalJS(send, `
  (() => {
    const sc = document.querySelector('.mod-scroll')
    const els = Array.from(sc.querySelectorAll(':scope > div')).map((el, i) => {
      const m = new DOMMatrix(getComputedStyle(el).transform)
      const r = el.getBoundingClientRect()
      return { i, cls: String(el.className).slice(0, 30), x: Math.round(m.e * 100) / 100, l: Math.round(r.left) }
    })
    const tl = window.__TRACK_TL__
    const sp = window.__SCROLL_P__ ? window.__SCROLL_P__() : null
    return JSON.stringify({ els, tlTime: tl ? Math.round(tl.time() * 10) / 10 : null, sp })
  })()`))
  console.log('f=' + f, JSON.stringify(st))
}
ws.close(); chrome.kill()
