import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneTheme } from './sceneTheme';

/** Sol bajo sobre el mar, pintado directo en el cielo (glow suave). */
const SUN_DIR = new THREE.Vector3(0.2103, 0.0976, -0.9727).normalize();

/**
 * Cielo degradado que interpola sus colores (y la fuerza del sol/luna)
 * hacia el tema activo. No reinicia el Canvas: solo muta uniforms.
 */
export function Sky() {
  const cfg = useSceneTheme();

  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color(cfg.sky.top) },
      uMid: { value: new THREE.Color(cfg.sky.mid) },
      uBottom: { value: new THREE.Color(cfg.sky.bottom) },
      uSun: { value: SUN_DIR.clone() },
      uSunI: { value: cfg.sky.sun },
    }),
    // solo se crea una vez; el interpolar vive en useFrame
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const target = useRef({
    top: new THREE.Color(cfg.sky.top),
    mid: new THREE.Color(cfg.sky.mid),
    bottom: new THREE.Color(cfg.sky.bottom),
    sun: cfg.sky.sun,
  });

  useFrame((_, dt) => {
    const k = 1 - Math.pow(0.002, Math.min(dt, 0.05));
    target.current.top.set(cfg.sky.top);
    target.current.mid.set(cfg.sky.mid);
    target.current.bottom.set(cfg.sky.bottom);
    target.current.sun = cfg.sky.sun;
    uniforms.uTop.value.lerp(target.current.top, k);
    uniforms.uMid.value.lerp(target.current.mid, k);
    uniforms.uBottom.value.lerp(target.current.bottom, k);
    uniforms.uSunI.value += (target.current.sun - uniforms.uSunI.value) * k;
  });

  return (
    <mesh scale={[70, 70, 70]} renderOrder={-1}>
      <sphereGeometry args={[1, 48, 32]} />
      <shaderMaterial
        uniforms={uniforms}
        depthWrite={false}
        fog={false}
        side={THREE.BackSide}
        vertexShader={`
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uBottom; uniform vec3 uSun;
          uniform float uSunI;
          varying vec3 vDir;
          void main() {
            vec3 dir = normalize(vDir);
            float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
            vec3 c = h > 0.45
              ? mix(uMid, uTop, smoothstep(0.45, 1.0, h))
              : mix(uBottom, uMid, smoothstep(0.0, 0.45, h));

            float d = max(dot(dir, normalize(uSun)), 0.0);
            float halo = pow(d, 3800.0);
            float core = pow(d, 46000.0);
            c += vec3(1.0, 0.88, 0.6) * halo * 0.55 * uSunI;
            c += vec3(1.0, 0.97, 0.86) * core * 0.6 * uSunI;

            gl_FragColor = vec4(c, 1.0);
          }
        `}
      />
    </mesh>
  );
}
