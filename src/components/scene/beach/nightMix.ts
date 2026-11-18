import { useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSceneTheme } from '../sceneTheme';

/**
 * Mezcla día→noche compartida (0 = día, 1 = noche), interpolada una sola
 * vez por frame. Los objetos de la playa la leen en su useFrame para
 * encender focos, estrellas, el faro, etc. sin re-renderizar React.
 */
export const nightMix = { v: -1 };

export function NightMixDriver() {
  const cfg = useSceneTheme();
  useEffect(() => {
    // primer montaje: arranca ya en el tema correcto (sin fundido al cargar)
    if (nightMix.v < 0) nightMix.v = cfg.night;
  }, [cfg.night]);
  useFrame((_, dt) => {
    const k = 1 - Math.pow(0.002, Math.min(dt, 0.05));
    nightMix.v += (cfg.night - nightMix.v) * k;
  }, -10);
  return null;
}

export function nm() {
  return nightMix.v < 0 ? 0 : nightMix.v;
}
