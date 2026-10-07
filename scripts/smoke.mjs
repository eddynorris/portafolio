import { chromium } from 'playwright';

const url = process.env.URL || 'http://localhost:4321/';
const out = process.env.OUT || 'scripts/shots';

const browser = await chromium.launch({
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'],
});

const problems = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => problems.push(`[fail] ${r.url()} - ${r.failure()?.errorText}`));

await page.goto(url, { waitUntil: 'networkidle' });
await page.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });
await page.waitForTimeout(5000);

const shot = async (name) => {
  const y = await page.evaluate(() => Math.round(window.scrollY));
  await page.screenshot({ path: `${out}/${name}.png`, timeout: 60000 });
  console.log(name, 'scrollY=', y);
};

await shot('01-hero');

await page.evaluate(() => window.scrollTo(0, Math.round(window.innerHeight * 0.95)));
await page.waitForTimeout(1200);
await shot('02-proyectos');

await page.evaluate(() => document.querySelector('#skills').scrollIntoView());
await page.waitForTimeout(1200);
await shot('03-skills');

await page.evaluate(() => document.querySelector('#contacto').scrollIntoView());
await page.waitForTimeout(1200);
await shot('04-contacto');

await page.evaluate(() => window.scrollTo(0, 0));
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(4000);
await shot('05-mobile');

const gl = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  if (!c) return 'no canvas';
  const ctx = c.getContext('webgl2') || c.getContext('webgl');
  return ctx ? ctx.getParameter(ctx.VERSION) : 'no context';
});
console.log('gl:', gl);
console.log(problems.length ? `PROBLEMS (${problems.length}):` : 'sin errores');
for (const p of [...new Set(problems)].slice(0, 40)) console.log(' -', p);
await browser.close();
