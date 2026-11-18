import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { prefersReduced } from '../anim';
import { frondGeometry, taperedTube } from './geo';
import { sandHeight } from './shore';

type PalmProps = {
  x: number;
  z: number;
  height: number;
  /** inclinación del tronco (dirección y cantidad en el plano xz) */
  lean: [number, number];
  seed: number;
  /** callback con la posición mundial de la copa (para colgar la guirnalda) */
  fronds?: number;
};

const TRUNK_A = new THREE.Color('#9a7048');
const TRUNK_B = new THREE.Color('#7a5434');

export function crownOf(p: PalmProps): THREE.Vector3 {
  const base = new THREE.Vector3(p.x, sandHeight(p.x, p.z) - 0.05, p.z);
  return base.add(new THREE.Vector3(p.lean[0], p.height, p.lean[1]));
}

export function Palm(p: PalmProps) {
  const crown = useRef<THREE.Group>(null!);
  const reduced = prefersReduced();
  const baseY = sandHeight(p.x, p.z) - 0.05;

  const { trunk, top, frondGeos } = useMemo(() => {
    const top = new THREE.Vector3(p.lean[0], p.height, p.lean[1]);
    const curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(p.lean[0] * 0.05, p.height * 0.35, p.lean[1] * 0.05),
      new THREE.Vector3(p.lean[0] * 0.55, p.height * 0.75, p.lean[1] * 0.55),
      top,
    );
    const c = new THREE.Color();
    const trunk = taperedTube(curve, {
      segments: 40,
      radial: 10,
      radius: (t) => 0.17 * (1 - t * 0.45) + Math.max(0, 0.06 - t * 0.5),
      // anillos del tronco: bandas claras/oscuras
      color: (t) => {
        const band = (Math.sin(t * 40 * Math.PI) + 1) / 2;
        return c.copy(TRUNK_A).lerp(TRUNK_B, band * 0.75);
      },
      capEnd: true,
    });
    const n = p.fronds ?? 9;
    const frondGeos = Array.from({ length: n }, (_, i) =>
      frondGeometry(1.5 + ((i * 37 + p.seed) % 5) * 0.12, 0.9 + (i % 3) * 0.2, 0.26, p.seed + i),
    );
    return { trunk, top, frondGeos };
  }, [p.height, p.lean, p.seed, p.fronds]);

  useFrame((state) => {
    if (!crown.current || reduced) return;
    const t = state.clock.getElapsedTime() + p.seed;
    crown.current.rotation.z = Math.sin(t * 0.8) * 0.04;
    crown.current.rotation.x = Math.cos(t * 0.63) * 0.035;
    crown.current.children.forEach((f, i) => {
      if (f.userData.frond) f.rotation.z = f.userData.tilt + Math.sin(t * 1.4 + i * 0.9) * 0.05;
    });
  });

  return (
    <group position={[p.x, baseY, p.z]}>
      <mesh geometry={trunk} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.95} />
      </mesh>
      <group ref={crown} position={top}>
        {frondGeos.map((g, i) => {
          const yaw = (i / frondGeos.length) * Math.PI * 2 + p.seed * 0.37;
          const tilt = 0.25 + (i % 3) * 0.12;
          return (
            <group key={i} rotation={[0, yaw, 0]}>
              <mesh
                geometry={g}
                rotation={[0, 0, tilt]}
                userData={{ frond: true, tilt }}
                castShadow
              >
                <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.8} />
              </mesh>
            </group>
          );
        })}
        {/* cocos */}
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2 + 0.4;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.14, -0.12, Math.sin(a) * 0.14]} castShadow>
              <sphereGeometry args={[0.1, 10, 8]} />
              <meshStandardMaterial color="#6d4a26" roughness={0.7} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

/** Las palmeras de la isla (posiciones exportadas para la guirnalda de focos). */
export const PALMS: PalmProps[] = [
  { x: -3.3, z: -2.7, height: 4.2, lean: [0.7, 0.3], seed: 1 },
  { x: 3.9, z: -3.1, height: 3.6, lean: [-0.75, 0.2], seed: 7 },
  { x: -4.6, z: 0.6, height: 2.9, lean: [-0.4, 0.5], seed: 13, fronds: 8 },
  { x: 1.2, z: -3.9, height: 3.1, lean: [0.5, -0.3], seed: 21, fronds: 8 },
];

export function Palms() {
  return (
    <>
      {PALMS.map((p, i) => (
        <Palm key={i} {...p} />
      ))}
    </>
  );
}
