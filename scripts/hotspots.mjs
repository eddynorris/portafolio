import { chromium } from 'playwright';

/** Comprueba los hotspots del carrito: click -> zoom de cámara + panel. */
const url = process.env.URL || 'http://localhost:4321/portafolio/';
const out = process.env.OUT || 'scripts/shots';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const problems = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`[error] ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => problems.push(`[fail] ${r.url()}`));

await page.goto(url, { waitUntil: 'networkidle' });
await page.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });
await page.waitForTimeout(5000);

const state = async () =>
  page.evaluate(() => {
    const el = document.querySelector('.cp');
    const title = document.querySelector('.cp__title')?.textContent ?? '';
    return { open: el?.classList.contains('is-open') ?? false, title };
  });

const shot = async (name) => {
  await page.screenshot({ path: `${out}/${name}.png`, timeout: 60000 });
  const s = await state();
  console.log(name, JSON.stringify(s));
};

const go = async (name, x, y) => {
  await page.mouse.move(x, y);
  await page.waitForTimeout(350);
  await page.mouse.click(x, y);
  await page.waitForTimeout(1700);
  await shot(name);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1400);
  await shot(`${name}-vuelta`);
};

await shot('h0-hero');
await go('h1-proyectos', 937, 330); // letrero
await go('h2-skills', 645, 672); // menú
await go('h3-redes', 560, 175); // sombrilla

console.log(problems.length ? `PROBLEMS (${problems.length}):` : 'sin errores');
for (const p of [...new Set(problems)].slice(0, 20)) console.log(' -', p);
await browser.close();
