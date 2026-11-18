import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { prefersReduced } from '../anim';
import { nm } from './nightMix';

const DAY = new THREE.Color('#ffffff');
const DAY_EM = new THREE.Color('#fff4e6');
const NIGHT = new THREE.Color('#33466b');
const NIGHT_EM = new THREE.Color('#0d1730');

/** Cúmulos suaves de base plana que derivan despacio. */
export function Clouds() {
  const g = useRef<THREE.Group>(null!);
  const reduced = prefersReduced();
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#fff4e6', emissiveIntensity: 0.35 }),
    [],
  );

  const clouds = useMemo(
    () =>
      [
        { x: -26, y: 13, z: -48, s: 3.0, speed: 0.05 },
        { x: -6, y: 16, z: -60, s: 3.8, speed: -0.04 },
        { x: 18, y: 14, z: -55, s: 3.2, speed: 0.035 },
        { x: 38, y: 11, z: -40, s: 2.4, speed: -0.05 },
        { x: -42, y: 10, z: -26, s: 2.2, speed: 0.06 },
        { x: 6, y: 20, z: -40, s: 2.0, speed: 0.045 },
      ].map((c, ci) => ({
        ...c,
        blobs: Array.from({ length: 7 }, (_, i) => {
          const x = (i - 3) * 0.7 + Math.sin(i * 2.3 + ci) * 0.25;
          const r = 0.55 + Math.abs(Math.sin(i * 1.9 + ci * 1.3)) * 0.55 * (1 - Math.abs(i - 3) / 5);
          return {
            p: [x, r * 0.35, Math.sin(i * 1.3 + ci) * 0.35] as [number, number, number],
            r,
          };
        }),
      })),
    [],
  );

  useFrame((state) => {
    const n = nm();
    mat.color.copy(DAY).lerp(NIGHT, n);
    mat.emissive.copy(DAY_EM).lerp(NIGHT_EM, n);
    if (!g.current || reduced) return;
    const t = state.clock.getElapsedTime();
    g.current.children.forEach((c, i) => {
      const p = clouds[i];
      c.position.x = p.x + Math.sin(t * p.speed + i) * 4;
    });
  });

  return (
    <group ref={g}>
      {clouds.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} scale={[c.s * 1.25, c.s * 0.8, c.s]}>
          {c.blobs.map((b, j) => (
            <mesh key={j} position={b.p} material={mat}>
              <sphereGeometry args={[b.r, 16, 12]} />
            </mesh>
          ))}
          {/* base plana */}
          <mesh position={[0, 0.02, 0]} scale={[2.6, 0.22, 0.75]} material={mat}>
            <sphereGeometry args={[1, 16, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
