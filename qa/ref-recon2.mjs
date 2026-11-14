// Deeper recon: inline scripts, trigger metadata after delay, DOM tree of mod-scroll.
import { mkdirSync, writeFileSync } from 'node:fs'
import { launchChrome, connectCDP, evalJS, setViewport, sleep } from './lib/cdp.mjs'
const PORT = 9223
const OUT = 'C:\\Users\\DK\\Desktop\\interior design\\qa\\ref'
mkdirSync(OUT, { recursive: true })
const chrome = launchChrome(PORT, 'ref-recon2', { w: 1440, h: 900 })
const { ws, send } = await connectCDP(PORT)
await send('Runtime.enable')
await setViewport(send, 1440, 900)
await send('Page.navigate', { url: 'https://normalisboring.es/' })
for (let i = 0; i < 100; i++) {
  const r = await evalJS(send, `(() => { const pre = document.querySelector('.preloader, .preloader-wrap, [class*=preload]'); const preGone = !pre || getComputedStyle(pre).display === 'none'; return preGone && !!document.querySelector('.mod-scroll') })()`).catch(() => null)
  if (r) break
  await sleep(500)
}
await sleep(5000)
const trigs = await evalJS(send, `
(() => {
  try {
    const all = ScrollTrigger.getAll()
    return JSON.stringify(all.map((t, i) => {
      const o = { i }
      try { o.trigger = t.trigger ? String(t.trigger.className || t.trigger.id || t.trigger).slice(0, 70) : null } catch { o.trigger = '?' }
      try { o.pin = t.pin ? String(t.pin.className || t.pin.id || t.pin).slice(0, 70) : null } catch { o.pin = null }
      try { o.start = t.start } catch {}
      try { o.end = t.end } catch {}
      try { o.scrollStart = Math.round(t.scrollStart) } catch {}
      try { o.scrollEnd = Math.round(t.scrollEnd) } catch {}
      try { o.scrub = t.scrub ? (t.scrub.duration || t.scrub) : null } catch {}
      try { o.containerAnimation = t.containerAnimation ? String(t.containerAnimation.animation || t.containerAnimation).slice(0, 40) : null } catch {}
      let anim = null
      try {
        if (t.animation) {
          const a = t.animation
          anim = { dur: typeof a.duration === 'function' ? a.duration() : null, total: typeof a.totalDuration === 'function' ? a.totalDuration() : null }
        }
      } catch {}
      o.anim = anim
      return o
    }))
  } catch (e) { return 'ERR:' + e.message }
})()`)
console.log('TRIGGERS count=', typeof trigs === 'string' ? trigs.length : trigs)
writeFileSync(OUT + '\\triggers-recon.json', typeof trigs === 'string' ? trigs : JSON.stringify(trigs, null, 1))

const scripts = await evalJS(send, `
(() => {
  const inline = Array.from(document.scripts).filter((s) => !s.src).map((s, i) => ({
    i, len: (s.textContent || '').length,
    head: (s.textContent || '').slice(0, 120).replace(/\\s+/g, ' '),
    hasMod: (s.textContent || '').includes('mod-scroll'),
    hasST: (s.textContent || '').includes('ScrollTrigger.create'),
    hasSmoother: (s.textContent || '').includes('ScrollSmoother'),
    hasLenis: (s.textContent || '').includes('Lenis'),
  }))
  return JSON.stringify(inline)
})()`)
console.log('INLINE SCRIPTS\n' + JSON.stringify(JSON.parse(scripts), null, 1))

const dom = await evalJS(send, `
(() => {
  const out = []
  const dump = (el, depth) => {
    if (!el || depth > 5) return
    const cls = el.className ? String(el.className) : ''
    const tag = el.tagName.toLowerCase()
    const info = { tag, cls: cls.slice(0, 90) }
    const st = el.getAttribute('style')
    if (st) info.style = st.slice(0, 120)
    out.push(info)
    for (let c = 0; c < el.children.length; c++) dump(el.children[c], depth + 1)
  }
  const sc = document.querySelector('.mod-scroll')
  dump(sc, 0)
  return JSON.stringify(out)
})()`)
writeFileSync(OUT + '\\dom-tree.json', JSON.stringify(JSON.parse(dom), null, 1))
console.log('DOM saved', JSON.parse(dom).length, 'nodes')

const smoother = await evalJS(send, `
(() => {
  let out = { has: typeof ScrollSmoother !== 'undefined', created: false }
  try {
    const sm = ScrollSmoother.get()
    if (sm) {
      out.created = true
      out.wrap = sm.wrap ? (sm.wrap.className || sm.wrap.tagName) : null
      out.content = sm.content ? (sm.content.className || sm.content.tagName) : null
      out.smooth = sm.smooth
      out.effects = sm.effects
      out.normalize = sm.normalize
    }
  } catch (e) { out.err = e.message }
  return JSON.stringify(out)
})()`)
console.log('SMOOTHER\n' + smoother)
ws.close(); chrome.kill()
