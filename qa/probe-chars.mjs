import { launchChrome, connectCDP, evalJS, setViewport, sleep } from './lib/cdp.mjs'
const chrome = launchChrome(9259, 'chars', { w: 1920, h: 1080 })
const { ws, send } = await connectCDP(9259)
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
    const chars = Array.from(p1.querySelectorAll('.mod-scroll__projects__item__text__title div div')).map((c) => { const m = new DOMMatrix(getComputedStyle(c).transform); return Math.round(m.f) })
    const wrapper = p1.querySelector('.mod-scroll__projects__item__text__title > div')
    const l1 = Math.round(p1.getBoundingClientRect().left / innerWidth * 1000) / 10
    return JSON.stringify({ l1, chars, wrapperDisplay: wrapper ? getComputedStyle(wrapper).display : null })
  })()`)
}
let mid = null
for (let f = 0.18; f <= 0.26; f += 0.003) {
  const r = JSON.parse(await atF(f))
  if (!mid && r.chars.length > 2 && r.chars.some((v) => v > 1 && v < 99) && r.chars.some((v) => v === 0)) { mid = r; console.log('MID f=' + f.toFixed(3), JSON.stringify(r)) }
}
if (!mid) {
  for (let f = 0.19; f <= 0.23; f += 0.004) console.log('f=' + f.toFixed(3), await atF(f))
}
ws.close()
chrome.kill()
