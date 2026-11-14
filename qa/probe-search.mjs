import { launchChrome, connectCDP, evalJS, setViewport, sleep } from './lib/cdp.mjs'
const chrome = launchChrome(9252, 'probe-search', { w: 1440, h: 900 })
const { ws, send } = await connectCDP(9252)
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
const READ = `(() => { const intro = document.querySelector('.mod-scroll__projects__wrap-text'); if (!intro) return null; const r = intro.getBoundingClientRect(); return JSON.stringify({ il: r.left / innerWidth * 100, sy: window.scrollY }) })()`
async function settleF(f, wait) {
  const y = Math.round(st0.top + f * (st0.h - st0.ih))
  await evalJS(send, `
(() => { window.scrollTo(0, ${y}); document.scrollingElement.scrollTop = ${y}; if (window.__ST__ && typeof window.__ST__.update === 'function') window.__ST__.update(); return new Promise((rs) => requestAnimationFrame(() => requestAnimationFrame(() => rs(true)))) })()`)
  await sleep(wait)
  return evalJS(send, READ)
}
let lo = 0, hi = 0.5
for (let k = 0; k < 18; k++) {
  const mid = (lo + hi) / 2
  const s = await settleF(mid, 120)
  if (!s) { console.log(k, 'null', mid); hi = mid; continue }
  const il = JSON.parse(s).il
  console.log(k, 'mid=' + mid.toFixed(4), 'il=' + il.toFixed(2), 'lo=' + lo.toFixed(4), 'hi=' + hi.toFixed(4))
  if (Math.abs(il - 38.4) < 0.15) break
  if (il > 38.4) lo = mid; else hi = mid
}
ws.close()
chrome.kill()
