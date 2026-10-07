/** Puntero normalizado compartido (ventana completa, no solo el canvas). */
export const pointerNorm = { x: 0, y: 0 };

let attached = false;

export function attachPointer() {
  if (attached || typeof window === 'undefined') return;
  attached = true;
  window.addEventListener(
    'pointermove',
    (e) => {
      pointerNorm.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointerNorm.y = -((e.clientY / window.innerHeight) * 2 - 1);
    },
    { passive: true },
  );
}

export function scrollY() {
  if (typeof window === 'undefined') return 0;
  return window.scrollY || 0;
}
