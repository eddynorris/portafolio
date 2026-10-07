import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
p.on('console', m => { if (m.type()==='error'||m.type()==='warning') errs.push(m.type()+': '+m.text()); });
p.on('pageerror', e => errs.push('pageerror: '+e.message));
await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await p.waitForTimeout(5000);
const info = await p.evaluate(() => {
  const c = document.querySelector('canvas');
  const scene = document.querySelector('.hero__scene');
  const hero = document.querySelector('.hero');
  let px = null;
  try {
    const g = document.createElement('canvas'); g.width=c.width; g.height=c.height;
    const ctx = g.getContext('2d'); ctx.drawImage(c,0,0);
    const d = ctx.getImageData(Math.floor(c.width/2), Math.floor(c.height*0.15), 1,1).data;
    px = [...d];
  } catch(e){ px = 'err '+e.message; }
  return {
    canvas: c ? {w:c.width,h:c.height,rect:c.getBoundingClientRect().toJSON(), style:c.getAttribute('style')} : null,
    sceneRect: scene.getBoundingClientRect().toJSON(),
    heroRect: hero.getBoundingClientRect().toJSON(),
    dpr: window.devicePixelRatio,
    px,
  };
});
console.log(JSON.stringify(info,null,2));
console.log('ERRORS:', errs.length); errs.slice(0,20).forEach(e=>console.log(' -',e));
await p.screenshot({ path: 'scripts/shots/dbg-mobile.png' });
await b.close();
