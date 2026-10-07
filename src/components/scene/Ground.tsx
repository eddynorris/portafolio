import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Outlines } from '@react-three/drei';
import * as THREE from 'three';
import { INK, RAMP_MAIN, toonRamp } from './toon';
import { prefersReduced } from './anim';

function ToonMat({ color, ramp = [0.4, 0.68, 1] }: { color: string; ramp?: number[] }) {
  const gradientMap = useMemo(() => toonRamp(`g:${ramp.join(',')}`, ramp), [ramp]);
  return <meshToonMaterial color={color} gradientMap={gradientMap} />;
}

/** Isla-diorama sobre la que apoya el carrito. */
export function Ground() {
  return (
    <group>
      <mesh position={[0, -0.16, 0]}>
        <cylinderGeometry args={[4.6, 4.1, 0.32, 56]} />
        <ToonMat color="#ffe7c4" />
        <Outlines thickness={0.05} color={INK} />
      </mesh>
      <mesh position={[0, -0.34, 0]}>
        <cylinderGeometry args={[4.1, 3.4, 0.34, 48]} />
        <ToonMat color="#f6c98f" />
        <Outlines thickness={0.05} color={INK} />
      </mesh>
      <mesh position={[0, -0.56, 0]}>
        <cylinderGeometry args={[3.4, 2.2, 0.5, 40]} />
        <ToonMat color="#e0a86a" />
        <Outlines thickness={0.05} color={INK} />
      </mesh>
      {/* motas decorativas del suelo */}
      {[
        [2.6, 0.01, 1.5],
        [-2.4, 0.01, 2.1],
        [1.4, 0.01, -2.6],
        [-3.1, 0.01, -0.9],
        [3.4, 0.01, -1.2],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} rotation={[-Math.PI / 2, 0, i]}>
          <circleGeometry args={[0.26 + (i % 3) * 0.1, 14]} />
          <ToonMat color={i % 2 ? '#ffd79b' : '#fff0d8'} ramp={[0.6, 0.8, 1]} />
        </mesh>
      ))}

      {/* cajones de pescado */}
      <group position={[2.0, 0, -2.5]} rotation={[0, -0.35, 0]}>
        <mesh position={[0, 0.24, 0]}>
          <boxGeometry args={[0.78, 0.48, 0.6]} />
          <ToonMat color="#e0a86a" />
          <Outlines thickness={0.03} color={INK} />
        </mesh>
        <mesh position={[0.06, 0.7, 0.03]} rotation={[0, 0.22, 0]}>
          <boxGeometry args={[0.7, 0.44, 0.55]} />
          <ToonMat color="#f0c088" />
          <Outlines thickness={0.03} color={INK} />
        </mesh>
        {[0.06, 0.42].map((y, i) => (
          <mesh key={i} position={[0, y, 0.31]}>
            <boxGeometry args={[0.72, 0.07, 0.02]} />
            <ToonMat color="#b87c46" ramp={[0.7, 0.86, 1]} />
          </mesh>
        ))}
      </group>

      {/* caracol */}
      <group position={[-2.6, 0.03, 1.9]} rotation={[-Math.PI / 2, 0, 0.4]} scale={0.9}>
        <mesh>
          <torusGeometry args={[0.2, 0.07, 8, 22, Math.PI * 1.6]} />
          <ToonMat color="#f6e2c0" ramp={[0.6, 0.82, 1]} />
          <Outlines thickness={0.025} color={INK} />
        </mesh>
      </group>
    </group>
  );
}

/** Nubes gordas estilo anime que derivan despacio. */
export function Clouds() {
  const g = useRef<THREE.Group>(null!);
  const reduced = prefersReduced();

  const puffs = useMemo(
    () =>
      [
        { x: -11.9, y: 6.6, z: -19.8, s: 1.5, speed: 0.07 },
        { x: -4.0, y: 8.5, z: -30, s: 1.9, speed: -0.05 },
        { x: 2.6, y: 9.6, z: -34, s: 1.3, speed: 0.045 },
        { x: -17.5, y: 4.6, z: -12, s: 1.0, speed: -0.08 },
        { x: 11.5, y: 5.4, z: -18, s: 1.1, speed: 0.06 },
      ].map((c, ci) => ({
        ...c,
        blobs: Array.from({ length: 5 }, (_, i) => ({
          p: [
            (i - 2) * 0.62 + ((ci * 0.3 + i * 0.17) % 0.4),
            Math.abs(Math.sin(i * 1.7 + ci)) * 0.34,
            (((i * 0.53 + ci * 0.29) % 1) - 0.5) * 0.5,
          ] as [number, number, number],
          r: 0.5 + Math.abs(Math.sin(i * 2.1 + ci)) * 0.42,
        })),
      })),
    [],
  );

  useFrame((state) => {
    if (!g.current || reduced) return;
    const t = state.clock.getElapsedTime();
    g.current.children.forEach((c, i) => {
      const p = puffs[i];
      c.position.x = p.x + Math.sin(t * p.speed * 6 + i) * 1.6;
      c.position.y = p.y + Math.sin(t * 0.3 + i) * 0.28;
    });
  });

  return (
    <group ref={g}>
      {puffs.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} scale={c.s}>
          {c.blobs.map((b, j) => (
            <mesh key={j} position={b.p}>
              <sphereGeometry args={[b.r, 14, 12]} />
              <ToonMat color="#ffffff" ramp={[0.72, 0.88, 1]} />
              <Outlines thickness={0.04} color="#cfe8ff" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Mar alrededor de la isla: bandas planas + espuma. */
export function Sea() {
  const foam = useRef<THREE.Group>(null!);
  const reduced = prefersReduced();

  const bands = useMemo(
    () => [
      { r: 90, c: '#3aaeea', y: -0.82 },
      { r: 46, c: '#4bb8ef', y: -0.8 },
      { r: 26, c: '#5cc4f4', y: -0.78 },
      { r: 15, c: '#74d1f8', y: -0.76 },
    ],
    [],
  );

  const rings = useMemo(() => [7.4, 12.4, 19.6, 30.5], []);

  const islets = useMemo(
    () =>
      [
        { a: 0.6, d: 56, s: [11, 2.4, 7], c: '#a9e6cf' },
        { a: 2.1, d: 62, s: [14, 1.7, 8], c: '#bfe4ff' },
        { a: 3.6, d: 54, s: [9, 3.1, 6], c: '#9fdcc4' },
        { a: 5.1, d: 66, s: [16, 1.4, 9], c: '#cbe9ff' },
      ].map((i) => ({
        ...i,
        pos: [Math.cos(i.a) * i.d, -0.6 + i.s[1] * 0.55, Math.sin(i.a) * i.d] as [
          number,
          number,
          number,
        ],
      })),
    [],
  );

  useFrame((state) => {
    if (!foam.current || reduced) return;
    const t = state.clock.getElapsedTime();
    foam.current.children.forEach((c, i) => {
      const k = 1 + Math.sin(t * 0.55 + i * 1.1) * 0.018;
      c.scale.set(k, 1, k);
      c.position.y = -0.55 + Math.sin(t * 0.7 + i * 0.9) * 0.035;
    });
  });

  return (
    <group>
      {bands.map((b, i) => (
        <mesh key={i} position={[0, b.y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[b.r, 72]} />
          <ToonMat color={b.c} ramp={[0.7, 0.86, 1]} />
        </mesh>
      ))}

      <group ref={foam}>
        {rings.map((r, i) => (
          <mesh key={i} position={[0, -0.55, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[r, 0.07, 6, 80]} />
            <meshToonMaterial
              color="#f2fcff"
              transparent
              opacity={0.72}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>

      {islets.map((s, i) => (
        <mesh key={i} position={s.pos}>
          <sphereGeometry args={[1, 20, 14]} />
          <ToonMat color={s.c} ramp={[0.55, 0.78, 1]} />
        </mesh>
      ))}
    </group>
  );
}
