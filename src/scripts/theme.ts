import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'night';

export const THEME_KEY = 'portfolio-theme';
export const THEME_EVENT = 'portfolio-theme-change';

/** Colores de la barra del navegador (coinciden con el fondo de cada tema). */
const META_COLOR: Record<Theme, string> = { light: '#fff7ea', night: '#0c0a1a' };

function readTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.getAttribute('data-theme') === 'night' ? 'night' : 'light';
}

function writeMeta(t: Theme) {
  if (typeof document === 'undefined') return;
  let m = document.querySelector('meta[name="theme-color"]');
  if (!m) {
    m = document.createElement('meta');
    m.setAttribute('name', 'theme-color');
    document.head.appendChild(m);
  }
  m.setAttribute('content', META_COLOR[t]);
}

type Store = { subs: Set<() => void> };

/* Singleton en globalThis: los islands de Astro viven en roots distintos
   y este módulo podría empaquetarse más de una vez. */
const g = globalThis as unknown as { __portfolioTheme?: Store };
const store: Store = (g.__portfolioTheme ??= { subs: new Set() });

/** Tema vigente, leído del atributo data-theme (fuente de verdad en el DOM). */
export function getTheme(): Theme {
  return readTheme();
}

/** Aplica el tema al DOM, lo persiste y notifica a los suscriptores. */
export function setTheme(t: Theme) {
  if (typeof document === 'undefined') return;
  if (readTheme() === t) {
    writeMeta(t);
    return;
  }
  document.documentElement.setAttribute('data-theme', t);
  document.documentElement.style.colorScheme = t;
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    /* modo privado: seguimos en memoria */
  }
  writeMeta(t);
  store.subs.forEach((cb) => cb());
}

export function toggleTheme() {
  setTheme(readTheme() === 'night' ? 'light' : 'night');
}

function subscribe(cb: () => void) {
  store.subs.add(cb);
  return () => {
    store.subs.delete(cb);
  };
}

/** Hook de React: se re-renderiza al cambiar el tema, sin recargar. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => 'light' as Theme);
}
