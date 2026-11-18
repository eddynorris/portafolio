import * as THREE from 'three';

/**
 * Tubo de radio variable a lo largo de una curva, con color por vértice.
 * Sirve para troncos de palmera, caballitos de totora, cuellos de pelícano…
 */
export function taperedTube(
  curve: THREE.Curve<THREE.Vector3>,
  opts: {
    segments: number;
    radial: number;
    radius: (t: number) => number;
    color: (t: number, a: number) => THREE.Color;
    capEnd?: boolean;
  },
): THREE.BufferGeometry {
  const { segments, radial, radius, color } = opts;
  const frames = curve.computeFrenetFrames(segments, false);
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, p);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const r = radius(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      n.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a));
      pos.push(p.x + n.x * r, p.y + n.y * r, p.z + n.z * r);
      const c = color(t, j / radial);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  if (opts.capEnd) {
    // tapa en el arranque (t=0): base que asienta en la arena
    curve.getPointAt(0, p);
    const center = pos.length / 3;
    pos.push(p.x, p.y, p.z);
    const c = color(0, 0);
    col.push(c.r, c.g, c.b);
    for (let j = 0; j < radial; j++) idx.push(center, j + 1, j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Hoja de palmera: cinta a lo largo de una curva que cae, con borde
 * aserrado (sugiere los foliolos) y nervio central más oscuro.
 */
export function frondGeometry(length: number, droop: number, width: number, seed: number): THREE.BufferGeometry {
  const steps = 22;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const dark = new THREE.Color('#2f8a3c');
  const mid = new THREE.Color('#4fb04a');
  const tip = new THREE.Color('#8fd45a');
  const c = new THREE.Color();

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = t * length;
    const y = Math.sin(t * Math.PI * 0.55) * length * 0.22 - t * t * droop;
    // ancho: 0 en la base, máximo a ~40%, punta fina; aserrado alterno
    const base = Math.sin(Math.min(1, t * 1.15) * Math.PI) * width;
    const saw = i % 2 === 0 ? 1 : 0.45;
    const w = base * saw * (0.9 + 0.1 * Math.sin(seed + i));
    const fold = w * 0.35; // la hoja se dobla en V sobre el nervio
    // vértices: borde izq, nervio, borde der
    pos.push(x, y - fold, -w, x, y, 0, x, y - fold, w);
    c.copy(mid).lerp(tip, t * 0.8);
    col.push(c.r, c.g, c.b);
    c.copy(dark).lerp(mid, t * 0.5);
    col.push(c.r, c.g, c.b);
    c.copy(mid).lerp(tip, t * 0.8);
    col.push(c.r, c.g, c.b);
  }
  for (let i = 0; i < steps; i++) {
    const a = i * 3;
    const b = a + 3;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
    idx.push(a + 1, b + 1, a + 2, b + 1, b + 2, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Desplaza los vértices de una geometría con ruido (rocas low-poly). */
export function jitter(g: THREE.BufferGeometry, amount: number, seed: number): THREE.BufferGeometry {
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  // agrupa vértices coincidentes para no abrir grietas
  const cache = new Map<string, number>();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    let k = cache.get(key);
    if (k === undefined) {
      const s = Math.sin(v.x * 12.9898 + v.y * 78.233 + v.z * 37.719 + seed) * 43758.5453;
      k = 1 + ((s - Math.floor(s)) - 0.5) * amount;
      cache.set(key, k);
    }
    p.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  g.computeVertexNormals();
  return g;
}
