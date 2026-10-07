import { chromium } from 'playwright';

const url = process.env.URL || 'http://localhost:4321/';
const out = process.env.OUT || 'scripts/shots';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));

// congela el reloj del canvas para poder fotografiar la entrada
await page.addInitScript(() => {
  window.__t = 0;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((ts) => cb(ts));
});

await page.goto(url, { waitUntil: 'domcontentloaded' });

const stops = [250, 550, 900, 1400, 2200, 3400];
let last = Date.now();
for (const ms of stops) {
  const wait = ms - (Date.now() - last);
  if (wait > 0) await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/t-${String(ms).padStart(4, '0')}.png`, timeout: 60000 });
}

await page.evaluate(() => window.scrollTo({ top: 520, behavior: 'instant' }));
await page.waitForTimeout(1600);
await page.screenshot({ path: `${out}/t-scroll.png`, timeout: 60000 });

await page.evaluate(() => window.scrollTo({ top: 1100, behavior: 'instant' }));
await page.waitForTimeout(1600);
await page.screenshot({ path: `${out}/t-scroll2.png`, timeout: 60000 });

console.log(errs.length ? 'ERRORES: ' + errs.join(' | ') : 'sin errores de runtime');
await browser.close();
