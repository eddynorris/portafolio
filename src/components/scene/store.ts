import type { Object3D, Vector3 } from 'three';

export type HotspotId = 'proyectos' | 'skills' | 'redes';

export type Focus = {
  id: HotspotId;
  /** Objeto 3D que sirve de ancla (se mueve con el carrito). */
  anchor: Object3D;
  /** Offset local dentro del ancla para apuntar al centro del objeto. */
  offset: Vector3;
  /** Dirección congelada objeto -> cámara al momento del click. */
  dir: Vector3;
  /** Ancho (en unidades de mundo) que debe ocupar el encuadre. */
  fit: number;
};

type Store = { focus: Focus | null; subs: Set<() => void> };

/* Singleton en globalThis: los islands de Astro viven en roots distintos
   y este módulo podría empaquetarse más de una vez. */
const g = globalThis as unknown as { __cartFocus?: Store };
const store: Store = (g.__cartFocus ??= { focus: null, subs: new Set() });

export function getFocus(): Focus | null {
  return store.focus;
}

export function setFocus(next: Focus | null) {
  if (store.focus === next) return;
  store.focus = next;
  store.subs.forEach((cb) => cb());
}

export function subscribe(cb: () => void) {
  store.subs.add(cb);
  return () => {
    store.subs.delete(cb);
  };
}
