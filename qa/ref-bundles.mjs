// List all JS resources and fetch bundle candidates; save for analysis.
import { writeFileSync, mkdirSync } from 'node:fs'
import { launchChrome, connectCDP, evalJS, setViewport, sleep } from './lib/cdp.mjs'
const PORT = 9223
const OUT = 'C:\\Users\\DK\\Desktop\\interior design\\qa\\ref\\bundles'
mkdirSync(OUT, { recursive: true })
const chrome = launchChrome(PORT, 'ref-bundles', { w: 1440, h: 900 })
const { ws, send } = await connectCDP(PORT)
await send('Runtime.enable')
await setViewport(send, 1440, 900)
await send('Page.navigate', { url: 'https://normalisboring.es/' })
for (let i = 0; i < 100; i++) {
  const r = await evalJS(send, `(() => !!document.querySelector('.mod-scroll') && typeof ScrollTrigger !== 'undefined')()`).catch(() => false)
  if (r) break
  await sleep(500)
}
await sleep(4000)
const res = await evalJS(send, `
(() => JSON.stringify(performance.getEntriesByType('resource').map((e) => ({ name: e.name, size: e.transferSize, initiator: e.initiatorType })).filter((e) => e.initiator === 'script' || /\\.js(\\?|$)/.test(e.name))))()`)
const list = JSON.parse(res)
console.log('JS RESOURCES')
for (const r of list) console.log(' ', r.size, r.name)

let found = []
for (const r of list) {
  if (!r.name.startsWith('http')) continue
  try {
    const txt = await (await fetch(r.name)).text()
    const hasMod = txt.includes('mod-scroll')
    const hasST = txt.includes('ScrollTrigger')
    const hasSm = txt.includes('ScrollSmoother')
    const hasL = txt.includes('Lenis')
    if (hasMod || hasST || hasSm || hasL) {
      const safe = r.name.split('/').pop().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60)
      writeFileSync(OUT + '\\' + safe + '.js', txt)
      found.push({ name: r.name, size: txt.length, hasMod, hasST, hasSm, hasL, file: safe + '.js' })
      console.log('KEPT', r.name, { hasMod, hasST, hasSm, hasL }, '->', safe + '.js')
    }
  } catch (e) {
    console.log('fetch fail', r.name, e.message)
  }
}
writeFileSync(OUT + '\\..\\bundles-index.json', JSON.stringify({ all: list, kept: found }, null, 1))
ws.close(); chrome.kill()
