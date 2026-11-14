import { launchChrome, connectCDP, evalJS, setViewport, wheel, sleep } from './lib/cdp.mjs'
const chrome = launchChrome(9333, 'minediag3', { w: 1440, h: 900 })
const { ws, send } = await connectCDP(9333)
await send('Runtime.enable')
await setViewport(send, 1440, 900)
await send('Page.navigate', { url: 'http://127.0.0.1:5173/?debug=1' })
await sleep(12000)
const r1 = await evalJS(send, `(() => JSON.stringify({ lenisStopped: window.__lenis ? window.__lenis.isStopped : null, lenisGStopped: typeof lenis !== 'undefined' ? lenis.isStopped : null }))()`).catch((e) => 'ERR ' + e.message)
console.log('state1', r1)
for (let i = 0; i < 6; i++) {
  await wheel(send, 300, 720, 450)
  await sleep(400)
  const y = await evalJS(send, `window.scrollY`).catch(() => null)
  console.log('wheel', i, 'y=', y)
}
ws.close(); chrome.kill()
