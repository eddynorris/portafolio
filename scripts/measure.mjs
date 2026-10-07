import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);
const r = await p.evaluate(() => {
  const el = document.querySelector('.hero__copy');
  const cs = getComputedStyle(el);
  const h1 = document.querySelector('.hero__title');
  return {
    gutter: getComputedStyle(document.documentElement).getPropertyValue('--gutter'),
    rect: el.getBoundingClientRect().toJSON(),
    width: cs.width, marginLeft: cs.marginInlineStart, marginRight: cs.marginInlineEnd,
    display: cs.display,
    parentDisplay: getComputedStyle(el.parentElement).display,
    h1: h1.getBoundingClientRect().toJSON(),
    hero: document.querySelector('.hero').getBoundingClientRect().toJSON(),
  };
});
console.log(JSON.stringify(r, null, 2));
await b.close();
