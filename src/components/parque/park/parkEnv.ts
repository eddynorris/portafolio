import { useTheme } from '../../../scripts/theme';

export type ParkEnv = {
  bg: string;
  ambient: number;
  hemi: readonly [string, string, number];
  key: { position: readonly [number, number, number]; intensity: number; color: string };
  fill: { position: readonly [number, number, number]; intensity: number; color: string };
};

const LIGHT: ParkEnv = {
  bg: '#bde8ff',
  ambient: 0.55,
  hemi: ['#fff4dd', '#a8e6ff', 0.55],
  key: { position: [14, 22, 10], intensity: 1.5, color: '#fff6e2' },
  fill: { position: [-12, 8, -8], intensity: 0.5, color: '#9adcff' },
};

const NIGHT: ParkEnv = {
  bg: '#0f1e33',
  ambient: 0.32,
  hemi: ['#2a3a5a', '#16324f', 0.4],
  key: { position: [14, 22, 10], intensity: 0.7, color: '#9fb8e8' },
  fill: { position: [-12, 8, -8], intensity: 0.28, color: '#3d6ea8' },
};

/** Fondo y luces del parque que siguen el tema (día / noche). */
export function useParkEnv(): ParkEnv {
  return useTheme() === 'night' ? NIGHT : LIGHT;
}
