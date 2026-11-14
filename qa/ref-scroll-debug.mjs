import { launchChrome, connectCDP, evalJS, setViewport, wheel, sleep } from './lib/cdp.mjs'
const PORT = 9229
const chrome = launchChrome(PORT, 'refscroll', { w: 1440, h: 900 })
const { ws, send } = await connectCDP(PORT)
await send('Runtime.enable')
await setViewport(send, 1440, 900)
await send('Page.navigate', { url: 'https://normalisboring.es/' })
for (let i = 0; i < 120; i++) {
  const r = await evalJS(send, `(() => { try { return typeof ScrollTrigger !== 'undefined' && ScrollTrigger.getAll().length >= 4 && typeof lenis !== 'undefined' } catch (e) { return false } })()`).catch(() => null)
  if (r) break
  await sleep(400)
}
await sleep(2000)
console.log('ready, scrollH=', await evalJS(send, `document.documentElement.scrollHeight`))
for (let i = 0; i < 12; i++) {
  await wheel(send, 300, 720, 450)
  await sleep(350)
  const info = await evalJS(send, `
  (() => {
    const w = document.querySelector('.mod-scroll')
    const r = w ? w.getBoundingClientRect() : null
    const tr = document.querySelector('.mod-scroll__projects')
    const m = tr ? new DOMMatrix(getComputedStyle(tr).transform) : null
    return JSON.stringify({ y: window.scrollY, top: r ? Math.round(r.top) : null, x: m ? Math.round(m.e) : null, lenisStopped: lenis.isStopped })
  })()`).catch(() => null)
  console.log(i, info)
}
ws.close(); chrome.kill()
