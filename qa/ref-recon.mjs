// Recon the reference site: structure, scripts, triggers, smoothing.
import { writeFileSync } from 'node:fs'
import { launchChrome, connectCDP, evalJS, setViewport, sleep } from './lib/cdp.mjs'
const PORT = 9223
const chrome = launchChrome(PORT, 'ref-recon', { w: 1440, h: 900 })
const { ws, send } = await connectCDP(PORT)
await send('Runtime.enable')
await setViewport(send, 1440, 900)
await send('Page.navigate', { url: 'https://normalisboring.es/' })
let ready = false
for (let i = 0; i < 90; i++) {
  const r = await evalJS(send, `(() => { const pre = document.querySelector('.preloader, .preloader-wrap, [class*=preload]'); const preGone = !pre || getComputedStyle(pre).display === 'none' || getComputedStyle(pre).visibility === 'hidden' || pre.style.display === 'none'; return { preGone, hasScroll: !!document.querySelector('.mod-scroll'), st: typeof ScrollTrigger !== 'undefined' } })()`).catch(() => null)
  if (r && r.preGone && r.hasScroll && r.st) { ready = true; break }
  await sleep(500)
}
console.log('ready', ready)
const info = await evalJS(send, `
(() => {
  const out = { scrollH: document.documentElement.scrollHeight, vh: innerHeight, bodyH: document.body.scrollHeight }
  const w = document.querySelector('.mod-scroll-wrap')
  const sc = document.querySelector('.mod-scroll')
  out.wrap = w ? { cls: w.className, tag: w.tagName, pos: getComputedStyle(w).position, h: Math.round(w.getBoundingClientRect().height), top0: Math.round(w.getBoundingClientRect().top + scrollY) } : null
  out.sc = sc ? { cls: sc.className, tag: sc.tagName, pos: getComputedStyle(sc).position, w: Math.round(sc.getBoundingClientRect().width) } : null
  out.smoother = typeof ScrollSmoother !== 'undefined' ? 'global' : (window.ScrollSmoother ? 'win' : null)
  out.lenis = typeof Lenis !== 'undefined' ? 'global' : null
  out.scripts = Array.from(document.scripts).map((s) => s.src || '(inline)').filter((s) => s.includes('wp-content') || s.includes('wp-includes') || s.includes('js') || s.includes('assets'))
  out.hasFollow = !!document.querySelector('.follow__mouse')
  out.terms = Array.from(document.querySelectorAll('.mod-scroll__terms__term')).map((t) => t.className)
  out.items = Array.from(document.querySelectorAll('.mod-scroll__projects__item')).map((p) => p.className)
  out.cierre = !!document.querySelector('.mod-scroll__cierre')
  return JSON.stringify(out)
})()`)
console.log('INFO\n' + JSON.stringify(JSON.parse(info), null, 1))
const trigs = await evalJS(send, `
(() => {
  try {
    return JSON.stringify(ScrollTrigger.getAll().map((t, i) => {
      const o = { i }
      try { o.trigger = t.trigger ? String(t.trigger.className || t.trigger.id || t.trigger).slice(0, 60) : null } catch { o.trigger = '?' }
      try { o.pin = t.pin ? String(t.pin.className || t.pin.id || t.pin).slice(0, 60) : null } catch { o.pin = null }
      try { o.start = t.start } catch {}
      try { o.end = t.end } catch {}
      try { o.scrollStart = Math.round(t.scrollStart) } catch {}
      try { o.scrollEnd = Math.round(t.scrollEnd) } catch {}
      try { o.scrub = t.scrub ? (t.scrub.duration || t.scrub) : null } catch {}
      try { o.containerAnimation = t.containerAnimation ? 'yes' : null } catch {}
      let anim = null
      try {
        if (t.animation) {
          const a = t.animation
          anim = { dur: typeof a.duration === 'function' ? a.duration() : null, paused: a.paused(), total: typeof a.totalDuration === 'function' ? a.totalDuration() : null }
        }
      } catch {}
      o.anim = anim
      return o
    }))
  } catch (e) { return 'ERR:' + e.message }
})()`)
console.log('TRIGGERS\n' + (typeof trigs === 'string' ? trigs : JSON.stringify(trigs)))
writeFileSync('C:\\Users\\DK\\Desktop\\interior design\\qa\\ref\\triggers-recon.json', JSON.stringify(JSON.parse(trigs), null, 1))
ws.close(); chrome.kill()
