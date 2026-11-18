// Capturas de los parques 3D para las tarjetas de Educador en la portada.
// Uso: con el dev server corriendo -> node scripts/park-shots.mjs
import { chromium } from 'playwright';

const base = process.env.URL || 'http://localhost:4321/portafolio';
const parks = [
  ['ddd', '/educador/ddd-puertos-y-adaptadores'],
  ['mvc', '/educador/mvc'],
  ['capas', '/educador/capas'],
];

const browser = await chromium.launch({
  channel: process.env.CHANNEL || 'msedge',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
await page.addInitScript(() => localStorage.setItem('portfolio-theme', 'light'));

for (const [name, path] of parks) {
  await page.goto(base + path, { waitUntil: 'networkidle' });
  // sin HUD ni barra de dev: solo el parque
  await page.addStyleTag({ content: '.pkHud, astro-dev-toolbar { display: none !important; }' });
  await page.waitForTimeout(9000);
  const box = await (await page.$('.pkCanvas')).boundingBox();
  await page.screenshot({
    path: `public/educador/${name}.jpg`,
    type: 'jpeg',
    quality: 80,
    clip: { x: box.x + 40, y: box.y + 205, width: 790, height: 494 },
    timeout: 60000,
  });
  console.log('ok', name);
}
await browser.close();
