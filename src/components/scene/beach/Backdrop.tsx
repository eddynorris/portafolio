import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { prefersReduced } from '../anim';
import { jitter } from './geo';
import { SEA_Y, noise2 } from './shore';
import { nm } from './nightMix';

/* ------------------------------------------------------------------ */
/*  Acantilados de la Costa Verde (mesetas con malecón verde arriba)    */
/* ------------------------------------------------------------------ */

const FACE_A = new THREE.Color('#d2a576');
const FACE_B = new THREE.Color('#b98a5e');
const TOP = new THREE.Color('#86b35e');
const FAR = new THREE.Color('#9fb3c6');

type Ridge = { r: number; from: number; to: number; base: number; amp: number; depth: number; far?: boolean; seed: number };

function ridge({ r, from, to, base, amp, depth, far, seed }: Ridge) {
  const n = 220;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const tops: THREE.Vector3[] = [];
  const c = new THREE.Color();
  for (let i = 0; i <= n; i++) {
    const th = from + ((to - from) * i) / n;
    // mesetas: ruido aplanado + quebradas ocasionales
    let h = base + amp * Math.round(noise2(i * 0.05 + seed, seed) * 4) / 4;
    h += noise2(i * 0.4 + seed, 3.1) * 0.6;
    const gully = Math.max(0, 1 - Math.abs(((i + seed * 7) % 37) - 18) / 3);
    h -= gully * amp * 0.9;
    const rr = r + (noise2(i * 0.11 + seed, 7.7) - 0.5) * 7;
    const ca = Math.cos(th);
    const sa = Math.sin(th);
    // 4 vértices por columna: pie, borde, cima interior, cima lejana
    pos.push(ca * rr, SEA_Y - 0.6, sa * rr);
    pos.push(ca * rr, h, sa * rr);
    pos.push(ca * (rr + 2), h + 0.25, sa * (rr + 2));
    pos.push(ca * (rr + depth), h + 1.5, sa * (rr + depth));
    tops.push(new THREE.Vector3(ca * (rr + 1.2), h + 0.2, sa * (rr + 1.2)));
    const strata = (Math.sin(h * 2.3 + i * 0.07) + 1) / 2;
    if (far) {
      for (let k = 0; k < 4; k++) col.push(FAR.r, FAR.g, FAR.b);
    } else {
      c.copy(FACE_A).lerp(FACE_B, 0.6);
      col.push(c.r, c.g, c.b);
      c.copy(FACE_A).lerp(FACE_B, strata * 0.5);
      col.push(c.r, c.g, c.b);
      col.push(TOP.r, TOP.g, TOP.b);
      c.copy(TOP).multiplyScalar(0.85);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < n; i++) {
    const a = i * 4;
    const b = a + 4;
    for (let k = 0; k < 3; k++) idx.push(a + k, b + k, a + k + 1, b + k, b + k + 1, a + k + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return { g, tops };
}

/** Edificios del malecón + ventanas que se encienden de noche. */
function City({ tops }: { tops: THREE.Vector3[] }) {
  const inst = useRef<THREE.InstancedMesh>(null!);
  const win = useRef<THREE.PointsMaterial>(null!);
  const blocks = useMemo(() => {
    const out: { p: THREE.Vector3; s: THREE.Vector3; yaw: number }[] = [];
    tops.forEach((t, i) => {
      if (i % 3 !== 0) return;
      const h = noise2(i * 0.31, 2.2);
      if (h < 0.35) return;
      const hh = 1 + h * h * 7;
      out.push({ p: t.clone().setY(t.y + hh / 2), s: new THREE.Vector3(1.6 + h, hh, 1.6), yaw: Math.atan2(t.z, t.x) });
    });
    return out;
  }, [tops]);

  const windows = useMemo(() => {
    const pts: number[] = [];
    blocks.forEach((b, i) => {
      const n = Math.max(2, Math.round(b.s.y * 1.6));
      for (let k = 0; k < n; k++) {
        if (noise2(i * 3.1, k * 1.7) < 0.45) continue;
        const off = ((k % 3) - 1) * 0.45;
        const nx = -Math.cos(b.yaw);
        const nz = -Math.sin(b.yaw);
        pts.push(
          b.p.x + nx * 0.85 - nz * off,
          b.p.y - b.s.y / 2 + 0.5 + Math.floor(k / 3) * 0.7,
          b.p.z + nz * 0.85 + nx * off,
        );
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [blocks]);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    blocks.forEach((b, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -b.yaw);
      m.compose(b.p, q, b.s);
      inst.current.setMatrixAt(i, m);
      c.set(['#efe4d6', '#e2d3c2', '#f5efe6', '#d9c8b4'][i % 4]);
      inst.current.setColorAt(i, c);
    });
    inst.current.instanceMatrix.needsUpdate = true;
    if (inst.current.instanceColor) inst.current.instanceColor.needsUpdate = true;
  }, [blocks]);

  useFrame(() => {
    if (win.current) win.current.opacity = nm();
  });

  return (
    <group>
      <instancedMesh ref={inst} args={[undefined, undefined, blocks.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <points geometry={windows}>
        <pointsMaterial
          ref={win}
          color="#ffd58a"
          size={0.7}
          sizeAttenuation
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </points>
    </group>
  );
}

export function Cliffs() {
  const near = useMemo(
    () => ridge({ r: 82, from: -Math.PI / 2 - 1.05, to: -Math.PI / 2 + 1.2, base: 8, amp: 3.2, depth: 14, seed: 1.3 }),
    [],
  );
  const far = useMemo(
    () => ridge({ r: 118, from: -Math.PI / 2 - 1.3, to: -Math.PI / 2 + 0.6, base: 15, amp: 6, depth: 10, far: true, seed: 5.1 }),
    [],
  );
  return (
    <group>
      <mesh geometry={far.g}>
        <meshStandardMaterial vertexColors roughness={1} flatShading />
      </mesh>
      <mesh geometry={near.g}>
        <meshStandardMaterial vertexColors roughness={1} flatShading />
      </mesh>
      <City tops={near.tops} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Islotes tipo Palomino (roca con guano blanco)                       */
/* ------------------------------------------------------------------ */

function rockGeometry(seed: number) {
  const g = jitter(new THREE.IcosahedronGeometry(1, 2), 0.32, seed);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const col: number[] = [];
  const rock = new THREE.Color('#7d6e62');
  const rock2 = new THREE.Color('#988676');
  const guano = new THREE.Color('#f1ece2');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    c.copy(rock).lerp(rock2, (Math.sin(i * 0.7 + seed) + 1) / 2);
    if (y > 0.55) c.lerp(guano, THREE.MathUtils.smoothstep(y, 0.55, 0.8));
    for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

export function Islets() {
  const rocks = useMemo(
    () => [
      { p: [-30, SEA_Y - 0.3, -40] as const, s: [6, 3.2, 4] as const, seed: 1 },
      { p: [-22, SEA_Y - 0.4, -52] as const, s: [4, 2.2, 3] as const, seed: 2 },
      { p: [-38, SEA_Y - 0.3, -31] as const, s: [3, 1.8, 2.5] as const, seed: 3 },
      { p: [-16, SEA_Y - 0.2, -24] as const, s: [1.2, 0.9, 1.1] as const, seed: 4 },
    ].map((r) => ({ ...r, g: rockGeometry(r.seed) })),
    [],
  );
  return (
    <group>
      {rocks.map((r, i) => (
        <mesh key={i} geometry={r.g} position={[...r.p]} scale={[...r.s]}>
          <meshStandardMaterial vertexColors flatShading roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Faro sobre su roca, con haz giratorio de noche                      */
/* ------------------------------------------------------------------ */

export function Lighthouse() {
  const beam = useRef<THREE.Group>(null!);
  const beamMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#fff1c4',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
        fog: false,
      }),
    [],
  );
  const lamp = useRef<THREE.MeshStandardMaterial>(null!);
  const reduced = prefersReduced();
  const rock = useMemo(() => rockGeometry(9), []);
  const H = 6;

  useFrame((state) => {
    const n = nm();
    if (beam.current && !reduced) beam.current.rotation.y = state.clock.getElapsedTime() * 0.6;
    beamMat.opacity = n * 0.22;
    if (lamp.current) lamp.current.emissiveIntensity = 0.3 + n * 4;
  });

  return (
    <group position={[30, SEA_Y, -42]}>
      <mesh geometry={rock} scale={[5, 2.6, 4]} position={[0, -0.4, 0]}>
        <meshStandardMaterial vertexColors flatShading roughness={1} />
      </mesh>
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={i} position={[0, 1.6 + i * (H / 5) + H / 10, 0]}>
          <cylinderGeometry args={[0.62 - (i + 1) * 0.05, 0.62 - i * 0.05, H / 5, 16]} />
          <meshStandardMaterial color={i % 2 ? '#d93a2b' : '#fbf6ee'} roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, 1.6 + H + 0.35, 0]}>
        <cylinderGeometry args={[0.34, 0.34, 0.7, 12]} />
        <meshStandardMaterial ref={lamp} color="#fff2c0" emissive="#ffd27a" emissiveIntensity={0.3} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.6 + H + 0.9, 0]}>
        <coneGeometry args={[0.48, 0.5, 12]} />
        <meshStandardMaterial color="#d93a2b" roughness={0.6} />
      </mesh>
      <group ref={beam} position={[0, 1.6 + H + 0.35, 0]}>
        {[0, Math.PI].map((a) => (
          <mesh
            key={a}
            material={beamMat}
            rotation={[0, a, -Math.PI / 2]}
            position={[Math.cos(a) * -13, 0, Math.sin(a) * 13]}
          >
            <coneGeometry args={[2.4, 26, 20, 1, true]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
