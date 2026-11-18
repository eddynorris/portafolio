/**
 * Progreso de la "historia" con scroll: cada sección del home lleva
 * `data-station="N"` y la cámara viaja entre estaciones. Devuelve un valor
 * continuo s ∈ [0, N-1]: entero cuando una sección está centrada en pantalla.
 */

let centers: number[] = [];
let measuredAt = -1;

function measure() {
  if (typeof document === 'undefined') return;
  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-station]'));
  els.sort((a, b) => Number(a.dataset.station) - Number(b.dataset.station));
  const y = window.scrollY;
  centers = els.map((el, i) => {
    const r = el.getBoundingClientRect();
    // la primera estación (hero) se considera "centrada" con scroll 0
    return i === 0 ? window.innerHeight / 2 : r.top + y + Math.min(r.height, window.innerHeight) / 2;
  });
  measuredAt = performance.now();
}

let wired = false;
function wire() {
  if (wired || typeof window === 'undefined') return;
  wired = true;
  window.addEventListener('resize', measure, { passive: true });
  window.addEventListener('load', measure);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(measure).observe(document.body);
}

export function stationCount() {
  return centers.length;
}

/** Posición continua en la historia (re-mide cada ~1 s por si cambió el layout). */
export function storyProgress(): number {
  if (typeof window === 'undefined') return 0;
  wire();
  if (measuredAt < 0 || performance.now() - measuredAt > 1000) measure();
  if (centers.length < 2) return 0;
  const v = window.scrollY + window.innerHeight / 2;
  if (v <= centers[0]) return 0;
  for (let i = 0; i < centers.length - 1; i++) {
    if (v < centers[i + 1]) return i + (v - centers[i]) / (centers[i + 1] - centers[i]);
  }
  return centers.length - 1;
}
