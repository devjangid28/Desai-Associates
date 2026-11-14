import { launchChrome, connectCDP, evalJS, setViewport, sleep } from './lib/cdp.mjs'
const chrome = launchChrome(9335, 'minediag5', { w: 1440, h: 900 })
const { ws, send } = await connectCDP(9335)
await send('Runtime.enable')
await setViewport(send, 1440, 900)
await send('Page.navigate', { url: 'http://127.0.0.1:5173/?debug=1' })
await sleep(16000)
const st = await evalJS(send, `(() => {
  const t = document.querySelector('.mod-scroll__terms__term')
  const terms = document.querySelector('.mod-scroll__terms')
  const ST = window.__ST__
  const all = ST ? ST.getAll() : []
  const info = all.map((s, i) => {
    let o = { i }
    try { o.trigger = s.trigger ? String(s.trigger.className || s.trigger.tagName).slice(0, 50) : null } catch {}
    try { o.start = s.start } catch {}
    try { o.end = s.end } catch {}
    try { o.scrub = s.scrub ? (s.scrub.duration || s.scrub) : 0 } catch {}
    try { o.anim = s.animation ? (s.animation.duration ? s.animation.duration() : 'tl') : null } catch {}
    return o
  })
  return JSON.stringify({
    padAttr: t.getAttribute('style'),
    padComp: getComputedStyle(t).paddingLeft,
    termsW: terms.offsetWidth,
    termsStyleW: terms.style.width,
    trackTl: window.__TRACK_TL__ ? window.__TRACK_TL__.time() : null,
    triggers: info,
  })
})()`).catch((e) => 'ERR ' + e.message)
console.log(st)
ws.close(); chrome.kill()
