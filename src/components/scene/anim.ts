export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Rebote con overshoot — el clásico "pop" del anime. */
export function easeOutBack(t: number, s = 1.9) {
  const c3 = s + 1;
  const p = t - 1;
  return 1 + c3 * p * p * p + s * p * p;
}

/** Caída con rebotes, para la entrada del carrito. */
export function easeOutBounce(t: number) {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

/** Fase retardada: secundario que sigue al primario. */
export const wave = (t: number, speed = 1, phase = 0) => Math.sin(t * speed + phase);

let _reduced: boolean | null = null;
export function prefersReduced() {
  if (_reduced === null) {
    _reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  return _reduced;
}

/** Ruido suave y barato para micro-movimientos orgánicos. */
export function drift(t: number, seed = 0) {
  return (
    Math.sin(t * 0.7 + seed) * 0.6 + Math.sin(t * 1.31 + seed * 2.7) * 0.3 + Math.sin(t * 2.17 + seed * 5.1) * 0.1
  );
}
