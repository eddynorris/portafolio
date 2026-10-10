import * as THREE from 'three';

export const INK = '#17122b';

const ramps = new Map<string, THREE.DataTexture>();

/** Rampas de luz duras en pocos escalones = look cel. */
export function toonRamp(name: string, stops: number[]): THREE.DataTexture {
  const key = `${name}|${stops.join(',')}`;
  const hit = ramps.get(key);
  if (hit) return hit;
  const data = new Uint8Array(stops.length);
  stops.forEach((v, i) => (data[i] = Math.max(0, Math.min(255, Math.round(v * 255)))));
  const tex = new THREE.DataTexture(data, stops.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  ramps.set(key, tex);
  return tex;
}

export const RAMP_MAIN = 'main';
export const RAMP_SOFT = 'soft';

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function canvasTexture(c: HTMLCanvasElement) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const textures = new Map<string, THREE.Texture>();
function memo(key: string, make: () => THREE.Texture) {
  const hit = textures.get(key);
  if (hit) return hit;
  const t = make();
  textures.set(key, t);
  return t;
}

/** Letrero pintado a mano, dibujado en canvas. */
export function signTexture(main: string, sub = '') {
  return memo(`sign:${main}:${sub}`, () => {
    const c = makeCanvas(1024, 512);
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff7ea';
    g.fillRect(0, 0, 1024, 512);

    g.strokeStyle = INK;
    g.lineWidth = 26;
    g.strokeRect(26, 26, 1024 - 52, 512 - 52);

    g.fillStyle = '#ff5a3c';
    g.font = '900 168px "Bricolage Grotesque", Impact, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(main, 512, sub ? 226 : 256);

    if (sub) {
      g.fillStyle = INK;
      g.font = '700 74px "DM Sans", Arial, sans-serif';
      g.fillText(sub, 512, 372);
    }

    g.fillStyle = '#ffc93c';
    g.beginPath();
    g.arc(94, 96, 40, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 12;
    g.strokeStyle = INK;
    g.stroke();

    return canvasTexture(c);
  });
}

/** Cartel de menú tipo pizarra. */
export function menuTexture(lines: string[]) {
  return memo(`menu:${lines.join('|')}`, () => {
    const c = makeCanvas(512, 640);
    const g = c.getContext('2d')!;
    g.fillStyle = '#17122b';
    g.fillRect(0, 0, 512, 640);
    g.strokeStyle = '#fff7ea';
    g.lineWidth = 12;
    g.strokeRect(22, 22, 512 - 44, 640 - 44);

    g.fillStyle = '#ffc93c';
    g.font = '800 78px "Bricolage Grotesque", Impact, sans-serif';
    g.textAlign = 'center';
    g.fillText('MENÚ', 256, 118);

    g.textAlign = 'left';
    g.font = '500 52px "DM Sans", Arial, sans-serif';
    lines.forEach((l, i) => {
      g.fillStyle = i % 2 ? '#7ed957' : '#fff7ea';
      g.fillText(l, 62, 214 + i * 92);
    });
    return canvasTexture(c);
  });
}

/** Rayas del toldo. */
export function stripeTexture(a = '#ff5a3c', b = '#fff7ea', count = 8) {
  return memo(`stripe:${a}:${b}:${count}`, () => {
    const w = 1024;
    const c = makeCanvas(w, 64);
    const g = c.getContext('2d')!;
    const step = w / count;
    for (let i = 0; i < count; i++) {
      g.fillStyle = i % 2 ? b : a;
      g.fillRect(i * step, 0, step + 1, 64);
    }
    const tex = canvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  });
}

/** Sombra plana elíptica bajo el carrito. */
export function shadowTexture() {
  return memo('shadow', () => {
    const c = makeCanvas(256, 256);
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(128, 128, 4, 128, 128, 124);
    grad.addColorStop(0, 'rgba(23,18,43,0.55)');
    grad.addColorStop(0.55, 'rgba(23,18,43,0.28)');
    grad.addColorStop(1, 'rgba(23,18,43,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    const tex = canvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

/** Destello de 4 puntas estilo anime. */
export function starTexture() {
  return memo('star', () => {
    const c = makeCanvas(256, 256);
    const g = c.getContext('2d')!;
    g.translate(128, 128);
    const spikes = 4;
    const outer = 120;
    const inner = 26;
    g.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 ? inner : outer;
      const a = (Math.PI / spikes) * i - Math.PI / 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
    g.fillStyle = '#ffffff';
    g.shadowColor = '#ffe9a8';
    g.shadowBlur = 40;
    g.fill();
    g.fill();
    const tex = canvasTexture(c);
    return tex;
  });
}

/** Chapa flotante que marca un punto interactivo del carrito. */
export function badgeTexture(label: string, fill = '#ffc93c') {
  return memo(`badge:${label}:${fill}`, () => {
    const W = 512;
    const H = 200;
    const c = makeCanvas(W, H);
    const g = c.getContext('2d')!;

    g.font = '900 92px "Bricolage Grotesque", Impact, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const w = Math.min(W - 48, g.measureText(label).width + 92);
    const x = (W - w) / 2;
    const y = 34;
    const h = 132;
    const r = 66;

    /* colita apuntando al objeto (dibujada antes para que la píldora tape su costura) */
    g.beginPath();
    g.moveTo(W / 2 - 36, y + h - 30);
    g.lineTo(W / 2 + 36, y + h - 30);
    g.lineTo(W / 2, H - 6);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = 16;
    g.lineJoin = 'round';
    g.strokeStyle = INK;
    g.stroke();

    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y);
    g.arcTo(x + w, y, x + w, y + r, r);
    g.lineTo(x + w, y + h - r);
    g.arcTo(x + w, y + h, x + w - r, y + h, r);
    g.lineTo(x + r, y + h);
    g.arcTo(x, y + h, x, y + h - r, r);
    g.lineTo(x, y + r);
    g.arcTo(x, y, x + r, y, r);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = 16;
    g.strokeStyle = INK;
    g.stroke();

    g.fillStyle = INK;
    g.fillText(label, W / 2, y + h / 2 + 5);

    return canvasTexture(c);
  });
}

/** Pez dibujado para colgar de la toldo. */
export function fishTexture() {
  return memo('fish', () => {
    const c = makeCanvas(512, 256);
    const g = c.getContext('2d')!;
    g.fillStyle = '#7ed4ff';
    g.fillRect(0, 0, 512, 256);
    g.translate(256, 128);
    g.fillStyle = '#fff7ea';
    g.beginPath();
    g.ellipse(-20, 0, 150, 74, 0, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 14;
    g.strokeStyle = INK;
    g.stroke();
    g.fillStyle = '#ff5a3c';
    g.beginPath();
    g.moveTo(130, 0);
    g.lineTo(206, -58);
    g.lineTo(206, 58);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = INK;
    g.beginPath();
    g.arc(-108, -18, 15, 0, Math.PI * 2);
    g.fill();
    return canvasTexture(c);
  });
}
