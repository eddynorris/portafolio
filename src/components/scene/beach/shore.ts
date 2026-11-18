/**
 * Geometría compartida de la isla: la misma función de orilla se usa en
 * JS (arena, utilería) y en GLSL (espuma y color del agua), así la espuma
 * cae exactamente donde la arena se hunde bajo el mar.
 */

/** Nivel del mar (y del plano de agua). */
export const SEA_Y = -0.42;

/** Coeficientes de la orilla irregular: R(θ) = R0 + Σ a·sin(kθ + φ). */
export const SHORE = {
  r0: 6.4,
  a: [0.75, 0.5, 0.28] as const,
  k: [2, 3, 5] as const,
  p: [0.6, 2.1, 4.0] as const,
};

/** θ en convención atan2(z, x). */
export function shoreR(theta: number): number {
  const { r0, a, k, p } = SHORE;
  return r0 + a[0] * Math.sin(k[0] * theta + p[0]) + a[1] * Math.sin(k[1] * theta + p[1]) + a[2] * Math.sin(k[2] * theta + p[2]);
}

/** Igual que shoreR pero en GLSL (pegar dentro del shader). */
export const SHORE_GLSL = /* glsl */ `
float shoreR(float th) {
  return ${SHORE.r0.toFixed(3)}
    + ${SHORE.a[0].toFixed(3)} * sin(${SHORE.k[0].toFixed(1)} * th + ${SHORE.p[0].toFixed(3)})
    + ${SHORE.a[1].toFixed(3)} * sin(${SHORE.k[1].toFixed(1)} * th + ${SHORE.p[1].toFixed(3)})
    + ${SHORE.a[2].toFixed(3)} * sin(${SHORE.k[2].toFixed(1)} * th + ${SHORE.p[2].toFixed(3)});
}
`;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Hash determinista 2D → [0,1). */
export function hash2(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Ruido de valor suave 2D (para dunas y variación de color). */
export function noise2(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/**
 * Altura de la arena en (x, z). Meseta plana bajo el carrito (y = 0, para
 * que la sombra de contacto no capture la isla), dunas suaves a media
 * distancia y caída hacia el mar pasando por SEA_Y justo en la orilla.
 */
export function sandHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const R = shoreR(Math.atan2(z, x));
  const t = r / R;
  const fall = Math.pow(smooth(0.42, 1.0, t), 1.25);
  let y = SEA_Y * fall;
  if (t > 1) y -= (t - 1) * R * 0.55;
  // dunas: solo en el anillo medio, lejos del carrito
  const dune = smooth(0.4, 0.55, t) * (1 - smooth(0.72, 0.9, t));
  y += dune * (noise2(x * 0.55, z * 0.55) - 0.35) * 0.22;
  return Math.min(y, r < 2.2 ? 0 : 0.2);
}
