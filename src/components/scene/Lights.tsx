import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneTheme } from './sceneTheme';

/**
 * Rig de luces que interpola colores e intensidades hacia el tema activo.
 * Las posiciones se toman directo de la config (no cambian entre temas por defecto).
 */
export function Lights() {
  const cfg = useSceneTheme();
  const amb = useRef<THREE.AmbientLight>(null!);
  const hemi = useRef<THREE.HemisphereLight>(null!);
  const key = useRef<THREE.DirectionalLight>(null!);
  const fill = useRef<THREE.DirectionalLight>(null!);

  const cur = useRef({
    hemiSky: new THREE.Color(cfg.lights.hemiSky),
    hemiGround: new THREE.Color(cfg.lights.hemiGround),
    keyColor: new THREE.Color(cfg.lights.keyColor),
    fillColor: new THREE.Color(cfg.lights.fillColor),
    ambient: cfg.lights.ambient,
    hemi: cfg.lights.hemi,
    key: cfg.lights.key,
    fill: cfg.lights.fill,
  });

  useFrame((_, dt) => {
    const k = 1 - Math.pow(0.002, Math.min(dt, 0.05));
    const c = cur.current;
    const L = cfg.lights;

    c.hemiSky.set(L.hemiSky);
    c.hemiGround.set(L.hemiGround);
    c.keyColor.set(L.keyColor);
    c.fillColor.set(L.fillColor);

    if (amb.current) amb.current.intensity += (L.ambient - amb.current.intensity) * k;
    if (hemi.current) {
      hemi.current.intensity += (L.hemi - hemi.current.intensity) * k;
      hemi.current.color.lerp(c.hemiSky, k);
      hemi.current.groundColor.lerp(c.hemiGround, k);
    }
    if (key.current) {
      key.current.intensity += (L.key - key.current.intensity) * k;
      key.current.color.lerp(c.keyColor, k);
      key.current.position.set(...L.keyPos);
    }
    if (fill.current) {
      fill.current.intensity += (L.fill - fill.current.intensity) * k;
      fill.current.color.lerp(c.fillColor, k);
      fill.current.position.set(...L.fillPos);
    }
  });

  return (
    <>
      <ambientLight ref={amb} intensity={cfg.lights.ambient} />
      <hemisphereLight
        ref={hemi}
        args={[cfg.lights.hemiSky, cfg.lights.hemiGround, cfg.lights.hemi]}
      />
      <directionalLight ref={key} position={cfg.lights.keyPos} intensity={cfg.lights.key} color={cfg.lights.keyColor} />
      <directionalLight
        ref={fill}
        position={cfg.lights.fillPos}
        intensity={cfg.lights.fill}
        color={cfg.lights.fillColor}
      />
    </>
  );
}
