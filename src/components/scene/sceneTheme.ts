import { createContext, useContext } from 'react';
import type { HotspotId } from './store';

export type ThemeId = 'light' | 'night';

/** Modelo 3D del hero. `src: null` => se usa el carrito procedural actual. */
export type ModelCfg = {
  /** Ruta del GLB relativa a `public/` (p. ej. 'models/cart.glb'). Se resuelve con BASE_URL. */
  src: string | null;
  scale: number;
  position: [number, number, number];
  rotation: [number, number, number];
};

export type LightsCfg = {
  ambient: number;
  hemiSky: string;
  hemiGround: string;
  hemi: number;
  keyPos: [number, number, number];
  keyColor: string;
  key: number;
  fillPos: [number, number, number];
  fillColor: string;
  fill: number;
};

export type SkyCfg = { top: string; mid: string; bottom: string; sun: number };

export type SceneThemeCfg = {
  model: ModelCfg;
  sky: SkyCfg;
  /** Niebla; null = sin niebla. */
  fog: { color: string; near: number; far: number } | null;
  lights: LightsCfg;
  toneMapping: 'none' | 'aces' | 'linear' | 'reinhard';
  emissionMultiplier: number;
  /** Bandas cel: se reajustan de noche para no aplastar las sombras. */
  toon: { main: number[]; soft: number[] };
  bloom: { intensity: number; threshold: number };
  /** Override opcional: mapea nombre de nodo `interact_X` a un hotspot concreto. */
  hotspots?: Record<string, HotspotId>;
};

/* ------------------------------------------------------------------ */
/*  Config por tema                                                    */
/* ------------------------------------------------------------------ */

/** Luz = valores actuales del hero (sin regresión visual). */
const LIGHT: SceneThemeCfg = {
  model: { src: null, scale: 1, position: [0, 0, 0], rotation: [0, 0, 0] },
  sky: { top: '#2f9fe0', mid: '#8fdcff', bottom: '#ffe9c9', sun: 1 },
  fog: null,
  lights: {
    ambient: 0.5,
    hemiSky: '#fff4dd',
    hemiGround: '#8ed7ff',
    hemi: 0.55,
    keyPos: [5, 8, 6],
    keyColor: '#fff6e2',
    key: 1.55,
    fillPos: [-6, 3, -4],
    fillColor: '#9adcff',
    fill: 0.55,
  },
  toneMapping: 'none',
  emissionMultiplier: 1,
  toon: { main: [0.4, 0.68, 1], soft: [0.52, 0.76, 1] },
  bloom: { intensity: 0.55, threshold: 0.92 },
};

/** Noche: cielo frío, luz direccional tenue, emisión al alza, bandas cel levantadas. */
const NIGHT: SceneThemeCfg = {
  model: { src: null, scale: 1, position: [0, 0, 0], rotation: [0, 0, 0] },
  sky: { top: '#05060f', mid: '#0d1b33', bottom: '#1a2b4a', sun: 0.16 },
  fog: { color: '#0a1424', near: 22, far: 70 },
  lights: {
    ambient: 0.3,
    hemiSky: '#243a5e',
    hemiGround: '#0e1c30',
    hemi: 0.4,
    keyPos: [5, 8, 6],
    keyColor: '#b8c8ff',
    key: 0.6,
    fillPos: [-6, 3, -4],
    fillColor: '#4a6ea0',
    fill: 0.28,
  },
  toneMapping: 'none',
  emissionMultiplier: 2.2,
  toon: { main: [0.5, 0.75, 1], soft: [0.6, 0.82, 1] },
  bloom: { intensity: 0.72, threshold: 0.8 },
};

export const SCENE_THEMES: Record<ThemeId, SceneThemeCfg> = { light: LIGHT, night: NIGHT };

export function getSceneTheme(id: ThemeId): SceneThemeCfg {
  return SCENE_THEMES[id] ?? LIGHT;
}

/** Ruta efectiva del modelo: si el tema actual no define uno, usa el del día. */
export function effectiveModelSrc(id: ThemeId): string | null {
  return SCENE_THEMES[id]?.model.src ?? LIGHT.model.src ?? null;
}

/** Ruta del GLB ya respetando BASE_URL (el sitio vive bajo /portafolio/). */
export function resolveModelUrl(src: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${src.replace(/^\//, '')}`;
}

/* ------------------------------------------------------------------ */
/*  Contexto React                                                    */
/* ------------------------------------------------------------------ */

export const SceneThemeCtx = createContext<SceneThemeCfg>(LIGHT);

/** Config del tema activo (objetivo hacia el que se interpolan las luces/cielo). */
export function useSceneTheme(): SceneThemeCfg {
  return useContext(SceneThemeCtx);
}
