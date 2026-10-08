import { chromium } from 'playwright';

/** Hotspots con etiqueta de estado quemada en el screenshot (inmune a mezcla de imágenes). */
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

const label = (text) =>
  page.evaluate((t) => {
    let el = document.getElementById('__lbl');
    if (!el) {
      el = document.createElement('div');
      el.id = '__lbl';
      el.style.cssText =
        'position:fixed;left:0;top:0;z-index:9999;background:#111;color:#0f0;font:700 28px/1.2 monospace;padding:10px 16px;letter-spacing:.06em';
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text);

const shot = async (name) => {
  const s = await state();
  await label(`${name} | open=${s.open} | ${s.title || '(sin panel)'}`);
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${out}/${name}.png`, timeout: 60000 });
  console.log(name, JSON.stringify(s));
  await page.evaluate(() => document.getElementById('__lbl')?.remove());
};

const go = async (name, x, y) => {
  await page.mouse.move(x, y);
  await page.waitForTimeout(350);
  await page.mouse.click(x, y);
  await page.waitForTimeout(2400);
  await shot(name);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2200);
  await shot(`${name}-vuelta`);
};

await shot('L0-hero');
await go('L1-proyectos', 937, 330);
await go('L2-skills', 645, 672);
await go('L3-redes', 560, 175);

console.log(problems.length ? `PROBLEMS (${problems.length}):` : 'sin errores');
for (const p of [...new Set(problems)].slice(0, 20)) console.log(' -', p);
await browser.close();
