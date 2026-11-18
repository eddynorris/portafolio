import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { prefersReduced } from '../anim';
import { nm } from './nightMix';

/** Pelícano peruano: cuerpo gris, cabeza clara, pico largo; planea y aletea a ratos. */
function Pelican({ wingL, wingR }: { wingL: (g: THREE.Group | null) => void; wingR: (g: THREE.Group | null) => void }) {
  return (
    <group>
      <mesh scale={[0.62, 0.22, 0.24]}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color="#a39a8e" roughness={0.9} />
      </mesh>
      <mesh position={[0.62, 0.1, 0]}>
        <sphereGeometry args={[0.13, 10, 8]} />
        <meshStandardMaterial color="#f1ead8" roughness={0.9} />
      </mesh>
      <mesh position={[1.0, 0.04, 0]} rotation={[0, 0, -Math.PI / 2 - 0.12]}>
        <coneGeometry args={[0.06, 0.62, 6]} />
        <meshStandardMaterial color="#e8a33c" roughness={0.7} />
      </mesh>
      <mesh position={[-0.62, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.3]}>
        <coneGeometry args={[0.16, 0.3, 6]} />
        <meshStandardMaterial color="#7b7369" roughness={0.9} />
      </mesh>
      {[1, -1].map((s) => (
        <group key={s} ref={s === 1 ? wingL : wingR} position={[0.05, 0.06, 0.18 * s]}>
          <mesh position={[0, 0, 0.75 * s]}>
            <boxGeometry args={[0.42, 0.03, 1.5]} />
            <meshStandardMaterial color="#8c8478" roughness={0.9} />
          </mesh>
          <mesh position={[-0.05, -0.005, 1.38 * s]}>
            <boxGeometry args={[0.32, 0.03, 0.3]} />
            <meshStandardMaterial color="#3a3530" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Bandada en V que rodea la bahía despacio. */
export function Pelicans() {
  const root = useRef<THREE.Group>(null!);
  const birds = useRef<THREE.Group[]>([]);
  const wings = useRef<{ l: THREE.Group | null; r: THREE.Group | null }[]>([]);
  const reduced = prefersReduced();
  const n = 5;
  const slots = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => {
        if (i === 0) return new THREE.Vector3(0, 0, 0);
        const row = Math.ceil(i / 2);
        const side = i % 2 ? 1 : -1;
        return new THREE.Vector3(-row * 1.9, row * 0.15, side * row * 2.1);
      }),
    [],
  );
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    const t = reduced ? 20 : state.clock.getElapsedTime();
    const a = t * 0.075 + 1.2;
    // elipse alrededor de la isla, por detrás del carrito
    const cx = Math.cos(a) * 26;
    const cz = Math.sin(a) * 15 - 12;
    const tx = -Math.sin(a) * 26;
    const tz = Math.cos(a) * 15;
    const yaw = Math.atan2(-tz, tx);
    root.current.position.set(cx, 7.5 + Math.sin(t * 0.4) * 0.6, cz);
    root.current.rotation.set(0, yaw, Math.sin(t * 0.3) * 0.08);
    root.current.visible = nm() < 0.85;
    birds.current.forEach((b, i) => {
      if (!b) return;
      tmp.copy(slots[i]);
      tmp.y += Math.sin(t * 0.9 + i) * 0.12;
      b.position.copy(tmp);
      const glide = Math.max(0, Math.sin(t * 0.45 + i * 0.4));
      const flap = reduced ? 0.05 : Math.sin(t * 5.5 + i * 0.6) * 0.42 * glide + 0.05;
      const w = wings.current[i];
      if (w?.l) w.l.rotation.x = -flap;
      if (w?.r) w.r.rotation.x = flap;
    });
  });

  return (
    <group ref={root}>
      {slots.map((_, i) => (
        <group
          key={i}
          ref={(g) => {
            if (g) birds.current[i] = g;
          }}
          scale={0.62}
        >
          <Pelican
            wingL={(g) => {
              wings.current[i] = { ...(wings.current[i] ?? { l: null, r: null }), l: g };
            }}
            wingR={(g) => {
              wings.current[i] = { ...(wings.current[i] ?? { l: null, r: null }), r: g };
            }}
          />
        </group>
      ))}
    </group>
  );
}

/** Gaviotas en lo alto, girando sobre el carrito. */
export function Gulls() {
  const refs = useRef<THREE.Group[]>([]);
  const reduced = prefersReduced();
  const gulls = useMemo(
    () => [
      { r: 7, h: 9.5, s: 0.32, p: 0 },
      { r: 9.5, h: 10.6, s: 0.26, p: 2.2 },
      { r: 6, h: 11.4, s: 0.38, p: 4.1 },
    ],
    [],
  );
  useFrame((state) => {
    const t = reduced ? 10 : state.clock.getElapsedTime();
    const show = nm() < 0.85;
    refs.current.forEach((g, i) => {
      if (!g) return;
      const q = gulls[i];
      const a = t * q.s + q.p;
      g.visible = show;
      g.position.set(Math.cos(a) * q.r + 1, q.h + Math.sin(t + i) * 0.3, Math.sin(a) * q.r - 3);
      g.rotation.set(0, -a - Math.PI / 2, 0.35);
      const flap = Math.sin(t * 7 + i) * 0.5;
      (g.children[0] as THREE.Object3D).rotation.x = 0.3 + flap;
      (g.children[1] as THREE.Object3D).rotation.x = -0.3 - flap;
    });
  });
  return (
    <>
      {gulls.map((_, i) => (
        <group
          key={i}
          ref={(g) => {
            if (g) refs.current[i] = g;
          }}
        >
          {[1, -1].map((s) => (
            <group key={s}>
              <mesh position={[0, 0, 0.32 * s]}>
                <boxGeometry args={[0.16, 0.015, 0.64]} />
                <meshStandardMaterial color="#ffffff" roughness={0.8} />
              </mesh>
            </group>
          ))}
          <mesh scale={[0.22, 0.07, 0.07]}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color="#f4f4f4" roughness={0.8} />
          </mesh>
        </group>
      ))}
    </>
  );
}
