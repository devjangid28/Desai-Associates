import { launchChrome, connectCDP, evalJS, setViewport, sleep } from './lib/cdp.mjs'
const chrome = launchChrome(9334, 'minediag4', { w: 1440, h: 900 })
const { ws, send } = await connectCDP(9334)
await send('Runtime.enable')
await setViewport(send, 1440, 900)
await send('Page.navigate', { url: 'http://127.0.0.1:5173/?debug=1' })
await sleep(15000)
const st = await evalJS(send, `(() => {
  const w = document.querySelector('.mod-scroll-wrap')
  const sc = document.querySelector('.mod-scroll')
  const r = w ? w.getBoundingClientRect() : null
  const fd = window.__FINAL_DIST__ ? window.__FINAL_DIST__() : null
  const sp = window.__SCROLL_P__ ? window.__SCROLL_P__() : null
  return JSON.stringify({
    fd, sp,
    wrapTop0: r ? r.top : null,
    wrapH: r ? r.height : null,
    scW: sc ? sc.getBoundingClientRect().width : null,
    docH: document.documentElement.scrollHeight,
    termsPad: (() => { const t = document.querySelector('.mod-scroll__terms__term'); return t ? getComputedStyle(t).paddingLeft : null })(),
    termsW: (() => { const t = document.querySelector('.mod-scroll__terms'); return t ? t.offsetWidth : null })(),
    lastLeft: (() => { const l = document.querySelector('.mod-scroll__projects__item.last-item'); return l ? l.offsetLeft : null })(),
  })
})()`).catch((e) => 'ERR ' + e.message)
console.log(st)
ws.close(); chrome.kill()
