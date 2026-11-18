import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = 'http://localhost:4321/portafolio/educador/tactica-ddd-agregados-y-eventos/';
const out = 'scripts/shots/tactica';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const problems = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => problems.push(`[fail] ${r.url()} - ${r.failure()?.errorText}`));

await page.goto(url, { waitUntil: 'networkidle' });
await page.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });
await page.waitForTimeout(6000);

const shot = async (name) => {
  await page.screenshot({ path: `${out}/${name}.png`, timeout: 60000 });
  console.log('shot', name);
};

await shot('01-hero-flujo');

// paso a paso a 2x: cada "Siguiente" desbloquea un paso
await page.getByRole('button', { name: 'Velocidad 2 veces' }).click();
await page.getByRole('button', { name: 'Paso a paso' }).click();
await page.waitForTimeout(800);

const dur = [3.4, 4.4, 4.6, 8.0, 5.6, 11.0];
for (let i = 0; i < 6; i++) {
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.waitForTimeout(dur[i] * 500 + 900);
  await shot(`1${i}-paso${i + 1}`);
}

// ficha por chip
await page.getByRole('button', { name: 'Agregado', exact: true }).click();
await page.waitForTimeout(900);
await shot('20-ficha-agregado');

// noche
await page.getByRole('button', { name: 'Cambiar a modo noche' }).click();
await page.waitForTimeout(1500);
await shot('21-noche');

// movil
const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
m.on('pageerror', (e) => problems.push(`[mobile pageerror] ${e.message}`));
await m.goto(url, { waitUntil: 'networkidle' });
await m.waitForTimeout(6000);
await m.screenshot({ path: `${out}/30-movil.png`, timeout: 60000 });
console.log('shot 30-movil');

const gl = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  const ctx = c && (c.getContext('webgl2') || c.getContext('webgl'));
  return ctx ? ctx.getParameter(ctx.VERSION) : 'no context';
});
console.log('gl:', gl);
console.log(problems.length ? `PROBLEMS (${problems.length}):` : 'sin errores');
for (const p of [...new Set(problems)].slice(0, 40)) console.log(' -', p);
await browser.close();
