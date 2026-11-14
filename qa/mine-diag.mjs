import { launchChrome, connectCDP, evalJS, setViewport, sleep } from './lib/cdp.mjs'
const chrome = launchChrome(9331, 'minediag', { w: 1440, h: 900 })
const { ws, send } = await connectCDP(9331)
await send('Runtime.enable')
await setViewport(send, 1440, 900)
await send('Page.navigate', { url: 'http://127.0.0.1:5173/?debug=1' })
for (let i = 0; i < 40; i++) {
  const r = await evalJS(send, `(() => {
    const pre = document.querySelector('.preloader')
    let trigs = 0
    try { trigs = typeof ScrollTrigger !== 'undefined' ? ScrollTrigger.getAll().length : 0 } catch (e) {}
    return JSON.stringify({
      pre: pre ? (getComputedStyle(pre).display + '/' + pre.className) : 'none-el',
      preGone: !pre || getComputedStyle(pre).display === 'none',
      trigs, sc: !!document.querySelector('.mod-scroll'), fonts: document.fonts.status,
      lenis: typeof lenis !== 'undefined' ? 'glob' : (window.__lenis ? 'win' : 'none'),
    })
  })()`).catch(() => 'ERR')
  console.log(i, r)
  await sleep(500)
}
ws.close(); chrome.kill()
