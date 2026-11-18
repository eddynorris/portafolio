import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneTheme } from './sceneTheme';
import { prefersReduced } from './anim';
import { SUN_DIR } from './beach/sun';
import { nm } from './beach/nightMix';

/**
 * Cielo degradado con sol (de día) o luna y estrellas (de noche), brillo
 * cálido en el horizonte hacia el sol. Interpola hacia el tema activo
 * mutando uniforms, sin reiniciar el Canvas.
 */
export function Sky() {
  const cfg = useSceneTheme();
  const reduced = prefersReduced();

  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color(cfg.sky.top) },
      uMid: { value: new THREE.Color(cfg.sky.mid) },
      uBottom: { value: new THREE.Color(cfg.sky.bottom) },
      uSun: { value: SUN_DIR.clone() },
      uSunI: { value: cfg.sky.sun },
      uNight: { value: cfg.night },
      uTime: { value: 0 },
    }),
    // solo se crea una vez; el interpolar vive en useFrame
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const target = useRef({
    top: new THREE.Color(cfg.sky.top),
    mid: new THREE.Color(cfg.sky.mid),
    bottom: new THREE.Color(cfg.sky.bottom),
  });

  useFrame((_, dt) => {
    const k = 1 - Math.pow(0.002, Math.min(dt, 0.05));
    target.current.top.set(cfg.sky.top);
    target.current.mid.set(cfg.sky.mid);
    target.current.bottom.set(cfg.sky.bottom);
    uniforms.uTop.value.lerp(target.current.top, k);
    uniforms.uMid.value.lerp(target.current.mid, k);
    uniforms.uBottom.value.lerp(target.current.bottom, k);
    uniforms.uSunI.value += (cfg.sky.sun - uniforms.uSunI.value) * k;
    uniforms.uNight.value = nm();
    if (!reduced) uniforms.uTime.value += Math.min(dt, 0.05);
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
          uniform float uSunI; uniform float uNight; uniform float uTime;
          varying vec3 vDir;

          float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }

          void main() {
            vec3 dir = normalize(vDir);
            float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
            vec3 c = h > 0.5
              ? mix(uMid, uTop, smoothstep(0.5, 1.0, h))
              : mix(uBottom, uMid, smoothstep(0.44, 0.62, h));

            vec3 sun = normalize(uSun);
            float d = max(dot(dir, sun), 0.0);
            float day = 1.0 - uNight;

            // resplandor cálido en el horizonte, más fuerte hacia el sol
            float toward = max(dot(normalize(dir.xz + 1e-4), normalize(sun.xz)), 0.0);
            float band = exp(-abs(dir.y) * 9.0);
            c += vec3(1.0, 0.72, 0.42) * band * pow(toward, 5.0) * 0.32 * day;

            // sol: disco + halo
            c += vec3(1.0, 0.85, 0.6) * pow(d, 420.0) * 0.45 * uSunI * day;
            c += vec3(1.0, 0.97, 0.88) * smoothstep(0.99935, 0.9996, d) * 0.9 * day;

            // luna: disco frío con manchas + halo
            float moonDisc = smoothstep(0.99945, 0.99962, d);
            float spots = hash3(floor(dir * 900.0)) * 0.12;
            c = mix(c, vec3(0.93, 0.95, 1.0) - spots, moonDisc * uNight);
            c += vec3(0.55, 0.65, 0.9) * pow(d, 160.0) * 0.28 * uNight;

            // estrellas (solo sobre el horizonte, titilan)
            vec3 sd = dir * 260.0;
            vec3 cell = floor(sd);
            float rnd = hash3(cell);
            float star = step(0.992, rnd) * smoothstep(0.42, 0.0, length(fract(sd) - 0.5));
            float tw = 0.65 + 0.35 * sin(uTime * (1.5 + rnd * 3.0) + rnd * 60.0);
            c += vec3(0.9, 0.93, 1.0) * star * tw * smoothstep(0.02, 0.2, dir.y) * uNight * (1.0 - moonDisc);

            gl_FragColor = vec4(c, 1.0);
            #include <colorspace_fragment>
          }
        `}
      />
    </mesh>
  );
}
