import { useMemo } from 'react';
import * as THREE from 'three';

/** Sol bajo sobre el mar, pintado directo en el cielo (glow suave). */
const SUN_DIR = new THREE.Vector3(0.2103, 0.0976, -0.9727).normalize();

export function Sky() {
  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color('#2f9fe0') },
      uMid: { value: new THREE.Color('#8fdcff') },
      uBottom: { value: new THREE.Color('#ffe9c9') },
      uSun: { value: SUN_DIR.clone() },
    }),
    [],
  );

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
            c += vec3(1.0, 0.88, 0.6) * halo * 0.55;
            c += vec3(1.0, 0.97, 0.86) * core * 0.6;

            gl_FragColor = vec4(c, 1.0);
          }
        `}
      />
    </mesh>
  );
}
