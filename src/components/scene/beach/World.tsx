import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { prefersReduced } from '../anim';
import { nm } from './nightMix';
import { COAST, coastU, roadR0 } from './shore';

/**
 * Diorama "Costa Verde" modelado en Blender (scripts/blender/costa_verde):
 * isla, acantilados, malecón, ciudad, pista, Morro Solar, parapente y autos.
 * Un solo GLB con Draco + WebP; React sólo anima lo que tiene nombre.
 */

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
export const WORLD_URL = `${BASE}/models/costa_verde.glb`;
const DRACO_PATH = `${BASE}/draco/`;

/** Intensidad emisiva de noche por familia de material (`CV_emissive_<familia>`). */
const EMISSIVE: Record<string, number> = {
  windows: 1.1,
  lamp: 1.8,
  faro: 3.0,
  antena: 2.5,
};

type Car = {
  obj: THREE.Object3D;
  /** radio del carril (unidades sobre roadR0) */
  lane: number;
  /** +1 avanza en θ creciente, -1 al revés */
  dir: 1 | -1;
  /** velocidad lineal (unidades/s) */
  speed: number;
  theta: number;
};

const T0 = -Math.PI / 2 - COAST.span + 0.12;
const T1 = -Math.PI / 2 + COAST.span - 0.12;

function emissiveFamily(name: string): number | null {
  if (!name.startsWith('CV_emissive')) return null;
  const fam = name.replace('CV_emissive_', '').split(/[._]/)[0];
  return EMISSIVE[fam] ?? 1.2;
}

function Beam({ at }: { at: THREE.Vector3 }) {
  const g = useRef<THREE.Group>(null!);
  const reduced = prefersReduced();
  const mat = useMemo(
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
  useFrame((state) => {
    if (g.current && !reduced) g.current.rotation.y = state.clock.getElapsedTime() * 0.6;
    mat.opacity = nm() * 0.22;
  });
  return (
    <group ref={g} position={at}>
      {[0, Math.PI].map((a) => (
        <mesh key={a} material={mat} rotation={[0, a, -Math.PI / 2]} position={[Math.cos(a) * -14, 0, Math.sin(a) * 14]}>
          <coneGeometry args={[2.6, 28, 20, 1, true]} />
        </mesh>
      ))}
    </group>
  );
}

function Diorama() {
  const gltf = useGLTF(WORLD_URL, DRACO_PATH);
  const reduced = prefersReduced();
  const [lampAt, setLampAt] = useState<THREE.Vector3 | null>(null);

  const built = useMemo(() => {
    const root = gltf.scene;
    const emissive: { mat: THREE.MeshStandardMaterial; k: number }[] = [];
    const seen = new Set<THREE.Material>();
    const cars: Car[] = [];
    let glider: THREE.Object3D | null = null;
    let lamp: THREE.Object3D | null = null;

    root.traverse((o) => {
      if (o.name === 'Parapente') glider = o;
      else if (o.name === 'Faro_lamp') lamp = o;
      else if (/^Auto_\d+$/.test(o.name)) {
        const i = cars.length;
        const dir: 1 | -1 = i % 2 === 0 ? 1 : -1;
        cars.push({
          obj: o,
          dir,
          lane: dir === 1 ? (i % 4 < 2 ? 0.95 : 2.55) : i % 4 < 2 ? 4.45 : 6.05,
          speed: 2.2 + (i % 5) * 0.45,
          theta: T0 + ((T1 - T0) * ((i * 7) % 12)) / 12,
        });
      }
      if (!(o instanceof THREE.Mesh)) return;
      const isIsland = o.name.startsWith('island');
      o.receiveShadow = isIsland;
      o.castShadow = isIsland && !/arena|sand|suelo|huella/i.test(o.name);
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (seen.has(m)) continue;
        seen.add(m);
        if (m instanceof THREE.MeshStandardMaterial) {
          const k = emissiveFamily(m.name);
          if (k !== null) {
            m.emissiveIntensity = 0;
            emissive.push({ mat: m, k });
          }
        }
      }
    });
    return { root, emissive, cars, glider: glider as THREE.Object3D | null, lamp: lamp as THREE.Object3D | null };
  }, [gltf]);

  useEffect(() => {
    if (!built.lamp) return;
    built.root.updateMatrixWorld(true);
    setLampAt(built.lamp.getWorldPosition(new THREE.Vector3()));
  }, [built]);

  const tmp = useMemo(() => ({ v: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler() }), []);

  useFrame((state, dt) => {
    const n = nm();
    for (const { mat, k } of built.emissive) mat.emissiveIntensity = n * k;
    if (reduced) return;
    const t = state.clock.getElapsedTime();
    const step = Math.min(dt, 0.05);

    // parapente: lazo lento frente al acantilado, con balanceo
    if (built.glider) {
      const g = built.glider;
      const w = 0.11;
      const cx = 20;
      const cz = -44;
      const px = cx + Math.cos(t * w) * 11;
      const pz = cz + Math.sin(t * w * 2) * 6;
      const py = 13.5 + Math.sin(t * 0.37) * 1.4;
      const vx = -Math.sin(t * w) * 11 * w;
      const vz = Math.cos(t * w * 2) * 6 * 2 * w;
      g.position.set(px, py, pz);
      // el modelo mira hacia -X local: φ = atan2(fz, -fx)
      g.rotation.set(Math.sin(t * 0.5) * 0.08, Math.atan2(vz, -vx), Math.sin(t * 0.31) * 0.22);
    }

    // autos: recorren la pista en ambos sentidos
    for (const c of built.cars) {
      const r = roadR0(c.theta) + c.lane;
      c.theta += (c.dir * c.speed * step) / r;
      if (c.theta > T1) c.theta = T0;
      if (c.theta < T0) c.theta = T1;
      const rr = roadR0(c.theta) + c.lane;
      c.obj.position.set(rr * Math.cos(c.theta), COAST.roadY + 0.01, rr * Math.sin(c.theta));
      // tangente: (-sin θ, cos θ) para θ creciente; el frente del modelo es +X local
      const fx = -Math.sin(c.theta) * c.dir;
      const fz = Math.cos(c.theta) * c.dir;
      c.obj.rotation.set(0, Math.atan2(-fz, fx), 0);
      c.obj.visible = Math.abs(coastU(c.theta)) < 0.97;
    }
  });

  return (
    <>
      <primitive object={built.root} />
      {lampAt && <Beam at={lampAt} />}
    </>
  );
}

class WorldBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn('[hero] no se pudo cargar el diorama, uso el fondo procedural:', err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Diorama de Blender; si el GLB falla, `fallback` (el fondo procedural antiguo). */
export function World({ fallback }: { fallback: ReactNode }) {
  return (
    <WorldBoundary fallback={fallback}>
      <Diorama />
    </WorldBoundary>
  );
}

useGLTF.preload(WORLD_URL, DRACO_PATH);
