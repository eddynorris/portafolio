import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneTheme } from './sceneTheme';

const TONE: Record<string, THREE.ToneMapping> = {
  none: THREE.NoToneMapping,
  aces: THREE.ACESFilmicToneMapping,
  linear: THREE.LinearToneMapping,
  reinhard: THREE.ReinhardToneMapping,
};

/**
 * Niebla + tone mapping + exposición, todo tematizado.
 * El tone mapping es un enum (no se interpola) pero ambos temas usan el mismo,
 * así que se mantiene consistente entre día y noche.
 */
export function Env() {
  const cfg = useSceneTheme();
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const fogColor = useRef(new THREE.Color(cfg.fog?.color ?? '#000000'));
  const exposure = useRef(1);

  useEffect(() => {
    gl.toneMapping = TONE[cfg.toneMapping] ?? THREE.NoToneMapping;
  }, [gl, cfg.toneMapping]);

  useFrame((_, dt) => {
    const k = 1 - Math.pow(0.002, Math.min(dt, 0.05));

    if (cfg.fog) {
      fogColor.current.set(cfg.fog.color);
      if (!(scene.fog instanceof THREE.Fog)) {
        scene.fog = new THREE.Fog(cfg.fog.color, cfg.fog.near, cfg.fog.far);
      }
      const fog = scene.fog as THREE.Fog;
      fog.color.lerp(fogColor.current, k);
      fog.near += (cfg.fog.near - fog.near) * k;
      fog.far += (cfg.fog.far - fog.far) * k;
    } else if (scene.fog) {
      scene.fog = null;
    }

    exposure.current += (1 - exposure.current) * k;
    gl.toneMappingExposure = exposure.current;
  });

  return null;
}
