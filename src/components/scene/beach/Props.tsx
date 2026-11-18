import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { prefersReduced } from '../anim';
import { taperedTube } from './geo';
import { SEA_Y, sandHeight, shoreR } from './shore';
import { nm } from './nightMix';

/* ------------------------------------------------------------------ */
/*  Caballitos de totora (Huanchaco): de pie, con la proa al cielo      */
/* ------------------------------------------------------------------ */

const REED = new THREE.Color('#d3ae63');
const REED_DARK = new THREE.Color('#a9833f');
const BIND = new THREE.Color('#6f5228');

function Caballito({ x, z, yaw, lean, h }: { x: number; z: number; yaw: number; lean: number; h: number }) {
  const geo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, h * 0.33, 0.02),
      new THREE.Vector3(0, h * 0.68, 0.1),
      new THREE.Vector3(0, h * 0.9, 0.34),
      new THREE.Vector3(0, h, 0.7),
    ]);
    const c = new THREE.Color();
    return taperedTube(curve, {
      segments: 46,
      radial: 14,
      radius: (t) => 0.26 * Math.pow(1 - t, 0.55) + 0.012,
      color: (t, a) => {
        // fibras a lo largo + amarres cada tanto
        const fiber = (Math.sin(a * Math.PI * 2 * 18) + 1) / 2;
        c.copy(REED).lerp(REED_DARK, fiber * 0.35);
        const ring = Math.abs(((t * 9) % 1) - 0.5);
        if (ring < 0.05 && t > 0.05 && t < 0.9) c.copy(BIND);
        return c;
      },
      capEnd: true,
    });
  }, [h]);
  return (
    <group position={[x, sandHeight(x, z) - 0.06, z]} rotation={[0, yaw, 0]}>
      <mesh geometry={geo} rotation={[-lean, 0, 0]} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.95} />
      </mesh>
    </group>
  );
}

export function Caballitos() {
  return (
    <group>
      <Caballito x={2.35} z={-1.55} yaw={-0.5} lean={0.16} h={2.7} />
      <Caballito x={2.85} z={-1.85} yaw={-0.35} lean={0.12} h={2.95} />
      <Caballito x={3.35} z={-1.6} yaw={-0.7} lean={0.2} h={2.6} />
      {/* remo apoyado: una caña partida */}
      <mesh position={[2.0, 0.75, -1.25]} rotation={[0.1, 0, -0.32]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 1.7, 6]} />
        <meshStandardMaterial color="#b98f4e" roughness={0.9} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Jabas de pescado y limones junto al carrito                         */
/* ------------------------------------------------------------------ */

function Crate({ w, h, d, color }: { w: number; h: number; d: number; color: string }) {
  const slat = new THREE.Color(color).multiplyScalar(1.12).getStyle();
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      {[0.25, 0.72].map((y, i) => (
        <group key={i}>
          <mesh position={[0, h * y, d / 2 + 0.006]}>
            <boxGeometry args={[w * 1.01, h * 0.16, 0.012]} />
            <meshStandardMaterial color={slat} roughness={0.85} />
          </mesh>
          <mesh position={[0, h * y, -d / 2 - 0.006]}>
            <boxGeometry args={[w * 1.01, h * 0.16, 0.012]} />
            <meshStandardMaterial color={slat} roughness={0.85} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Fish({ position, rot }: { position: [number, number, number]; rot: number }) {
  return (
    <group position={position} rotation={[0, rot, 0.1]}>
      <mesh scale={[0.2, 0.05, 0.065]} castShadow>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color="#9fb4c6" metalness={0.55} roughness={0.32} />
      </mesh>
      <mesh position={[-0.22, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.3]}>
        <coneGeometry args={[0.06, 0.08, 6]} />
        <meshStandardMaterial color="#7f95a8" metalness={0.4} roughness={0.4} />
      </mesh>
    </group>
  );
}

export function Crates() {
  const limes = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        p: [((i % 3) - 1) * 0.11, 0.33 + Math.floor(i / 3) * 0.015, (Math.floor(i / 3) - 1) * 0.1] as [number, number, number],
      })),
    [],
  );
  return (
    <group position={[1.42, 0, -0.55]} rotation={[0, -0.4, 0]}>
      <Crate w={0.62} h={0.34} d={0.42} color="#a8743f" />
      <Fish position={[-0.08, 0.37, -0.06]} rot={0.2} />
      <Fish position={[0.1, 0.39, 0.08]} rot={-0.3} />
      <Fish position={[0.02, 0.41, -0.02]} rot={2.9} />
      <group position={[0.05, 0, 0.55]} rotation={[0, 0.5, 0]}>
        <Crate w={0.42} h={0.3} d={0.34} color="#b98549" />
        {limes.map((l, i) => (
          <mesh key={i} position={l.p} castShadow>
            <sphereGeometry args={[0.055, 10, 8]} />
            <meshStandardMaterial color={i % 3 ? '#86c33c' : '#a4d44e'} roughness={0.55} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Sombrilla, toalla y cooler                                         */
/* ------------------------------------------------------------------ */

function stripedCone(segments: number, colors: string[]) {
  const g = new THREE.ConeGeometry(1, 0.32, segments, 1, true).toNonIndexed();
  const pos = g.attributes.position as THREE.BufferAttribute;
  const col: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    // color por cara según el ángulo del centroide
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const a = (Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2);
    c.set(colors[Math.floor(a * segments) % colors.length]);
    for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

export function Umbrella() {
  const cone = useMemo(() => stripedCone(12, ['#fffaf0', '#ff5a3c']), []);
  const x = -2.35;
  const z = 1.75;
  const y = sandHeight(x, z);
  return (
    <group position={[x, y, z]}>
      <group rotation={[0.08, 0, 0.14]}>
        <mesh position={[0, 0.95, 0]} castShadow>
          <cylinderGeometry args={[0.028, 0.028, 1.95, 8]} />
          <meshStandardMaterial color="#f2f2f2" roughness={0.5} />
        </mesh>
        <mesh geometry={cone} position={[0, 1.95, 0]} scale={[1.05, 1, 1.05]} castShadow>
          <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.75} />
        </mesh>
        <mesh position={[0, 2.13, 0]}>
          <sphereGeometry args={[0.05, 8, 6]} />
          <meshStandardMaterial color="#ffc93c" />
        </mesh>
      </group>
      {/* toalla a rayas */}
      <group position={[0.35, 0.012, 0.25]} rotation={[0, 0.35, 0]}>
        {['#14a8a8', '#fffaf0', '#ffc93c', '#fffaf0', '#14a8a8'].map((c, i) => (
          <mesh key={i} position={[0, 0, (i - 2) * 0.13]} receiveShadow>
            <boxGeometry args={[1.15, 0.015, 0.13]} />
            <meshStandardMaterial color={c} roughness={1} />
          </mesh>
        ))}
      </group>
      {/* cooler */}
      <group position={[-0.55, 0, 0.45]} rotation={[0, 0.6, 0]}>
        <mesh position={[0, 0.17, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.5, 0.32, 0.32]} />
          <meshStandardMaterial color="#2a9df4" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.35, 0]} castShadow>
          <boxGeometry args={[0.52, 0.06, 0.34]} />
          <meshStandardMaterial color="#fffaf0" roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Muelle de madera + bote pesquero amarrado                           */
/* ------------------------------------------------------------------ */

export const PIER = (() => {
  const th = -0.78;
  const dir = new THREE.Vector3(Math.cos(th), 0, Math.sin(th));
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  const r0 = shoreR(th) - 1.4;
  const len = 9.5;
  const deckY = SEA_Y + 0.55;
  return { th, dir, side, r0, len, deckY };
})();

export function Pier() {
  const planks = useRef<THREE.InstancedMesh>(null!);
  const posts = useRef<THREE.InstancedMesh>(null!);
  const plankCount = Math.round(PIER.len / 0.2);
  const postCount = (Math.floor(PIER.len / 1.25) + 1) * 2;

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -PIER.th);
    const s = new THREE.Vector3(1, 1, 1);
    const p = new THREE.Vector3();
    const c = new THREE.Color();
    for (let i = 0; i < plankCount; i++) {
      const r = PIER.r0 + i * 0.2 + 0.1;
      p.copy(PIER.dir).multiplyScalar(r);
      p.y = PIER.deckY + Math.sin(i * 1.7) * 0.008;
      m.compose(p, q, s);
      planks.current.setMatrixAt(i, m);
      c.set(i % 3 === 0 ? '#9c7046' : i % 3 === 1 ? '#b48256' : '#a67a4d');
      planks.current.setColorAt(i, c);
    }
    let k = 0;
    for (let i = 0; i * 1.25 <= PIER.len; i++) {
      for (const sd of [-1, 1]) {
        p.copy(PIER.dir).multiplyScalar(PIER.r0 + i * 1.25 + 0.1).addScaledVector(PIER.side, sd * 0.56);
        p.y = PIER.deckY - 0.5;
        m.compose(p, q, s);
        posts.current.setMatrixAt(k++, m);
      }
    }
    planks.current.instanceMatrix.needsUpdate = true;
    if (planks.current.instanceColor) planks.current.instanceColor.needsUpdate = true;
    posts.current.instanceMatrix.needsUpdate = true;
  }, [plankCount]);

  return (
    <group>
      <instancedMesh ref={planks} args={[undefined, undefined, plankCount]} castShadow receiveShadow>
        <boxGeometry args={[0.18, 0.06, 1.25]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={posts} args={[undefined, undefined, postCount]} castShadow>
        <cylinderGeometry args={[0.07, 0.08, 1.35, 7]} />
        <meshStandardMaterial color="#6e4d2e" roughness={1} />
      </instancedMesh>
    </group>
  );
}

/** Bote pesquero de colores con banderita peruana. */
export function FishingBoat({
  position,
  yaw,
  scale = 1,
  hull = '#2a6fd1',
  rim = '#ffd23f',
  seed = 0,
}: {
  position: [number, number, number];
  yaw: number;
  scale?: number;
  hull?: string;
  rim?: string;
  seed?: number;
}) {
  const g = useRef<THREE.Group>(null!);
  const reduced = prefersReduced();
  useFrame((state) => {
    if (!g.current || reduced) return;
    const t = state.clock.getElapsedTime() + seed;
    g.current.position.y = position[1] + Math.sin(t * 1.1) * 0.05;
    g.current.rotation.z = Math.sin(t * 0.9) * 0.05;
    g.current.rotation.x = Math.cos(t * 0.7) * 0.03;
  });
  return (
    <group ref={g} position={position} rotation={[0, yaw, 0]} scale={scale}>
      <mesh scale={[1.55, 0.6, 0.58]} castShadow>
        <sphereGeometry args={[1, 28, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial color={hull} roughness={0.55} side={THREE.DoubleSide} />
      </mesh>
      <mesh scale={[1.53, 1, 0.57]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.035, 6, 40]} />
        <meshStandardMaterial color={rim} roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.12, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.45, 0.5, 1]}>
        <circleGeometry args={[1, 28]} />
        <meshStandardMaterial color="#8a5d34" roughness={0.9} />
      </mesh>
      {/* cabina */}
      <mesh position={[-0.55, 0.18, 0]} castShadow>
        <boxGeometry args={[0.5, 0.42, 0.55]} />
        <meshStandardMaterial color="#fffaf0" roughness={0.6} />
      </mesh>
      <mesh position={[-0.55, 0.42, 0]} castShadow>
        <boxGeometry args={[0.6, 0.06, 0.65]} />
        <meshStandardMaterial color="#ff5a3c" roughness={0.6} />
      </mesh>
      {/* mástil + bandera */}
      <mesh position={[0.35, 0.6, 0]}>
        <cylinderGeometry args={[0.022, 0.026, 1.3, 6]} />
        <meshStandardMaterial color="#6e4d2e" />
      </mesh>
      {['#d91023', '#ffffff', '#d91023'].map((c, i) => (
        <mesh key={i} position={[0.35 + 0.075 + i * 0.1, 1.12, 0]}>
          <planeGeometry args={[0.1, 0.18]} />
          <meshStandardMaterial color={c} side={THREE.DoubleSide} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

export function Boats() {
  const moor = PIER.dir
    .clone()
    .multiplyScalar(PIER.r0 + PIER.len - 2.2)
    .addScaledVector(PIER.side, 1.55);
  return (
    <>
      <FishingBoat position={[moor.x, SEA_Y + 0.32, moor.z]} yaw={-PIER.th} seed={1} />
      <FishingBoat
        position={[-9.5, SEA_Y + 0.3, -11]}
        yaw={0.9}
        scale={0.85}
        hull="#ff5a3c"
        rim="#14a8a8"
        seed={4}
      />
      <FishingBoat
        position={[13, SEA_Y + 0.3, 2.5]}
        yaw={2.2}
        scale={0.8}
        hull="#14a8a8"
        rim="#fffaf0"
        seed={9}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Guirnaldas de focos (se encienden de noche) + luz cálida            */
/* ------------------------------------------------------------------ */

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,240,200,1)');
  grd.addColorStop(0.25, 'rgba(255,200,120,0.55)');
  grd.addColorStop(1, 'rgba(255,170,90,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const BULB_COLORS = ['#ffd27a', '#ff9a5c', '#fff0c2', '#7fe3d6'];

export const LIGHT_POLES: { x: number; z: number; h: number }[] = [
  { x: -1.95, z: -0.85, h: 2.6 },
  { x: 2.05, z: -0.15, h: 2.45 },
];

export function StringLights() {
  const bulbMat = useRef<THREE.MeshStandardMaterial[]>([]);
  const halo = useRef<THREE.PointsMaterial>(null!);

  const { bulbs, wires } = useMemo(() => {
    const [L, R] = LIGHT_POLES;
    const lTop = new THREE.Vector3(L.x, sandHeight(L.x, L.z) + L.h, L.z);
    const rTop = new THREE.Vector3(R.x, sandHeight(R.x, R.z) + R.h, R.z);
    const spans: [THREE.Vector3, THREE.Vector3, number][] = [
      [lTop, new THREE.Vector3(-0.86, 1.82, 0.15), 0.32],
      [new THREE.Vector3(0.86, 1.82, 0.15), rTop, 0.3],
    ];
    const bulbs: { p: THREE.Vector3; c: string }[] = [];
    const wires: THREE.BufferGeometry[] = [];
    spans.forEach(([a, b, sag], si) => {
      const pts: THREE.Vector3[] = [];
      const n = 24;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const p = a.clone().lerp(b, t);
        p.y -= sag * 4 * t * (1 - t);
        pts.push(p);
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      wires.push(new THREE.TubeGeometry(curve, 40, 0.008, 4, false));
      const count = Math.max(4, Math.round(a.distanceTo(b) / 0.32));
      for (let i = 1; i < count; i++) {
        const p = curve.getPointAt(i / count);
        p.y -= 0.05;
        bulbs.push({ p, c: BULB_COLORS[(i + si) % BULB_COLORS.length] });
      }
    });
    return { bulbs, wires };
  }, []);

  const haloGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(bulbs.flatMap((b) => [b.p.x, b.p.y, b.p.z]), 3));
    return g;
  }, [bulbs]);
  const tex = useMemo(glowTexture, []);

  useFrame(() => {
    const n = nm();
    bulbMat.current.forEach((m) => {
      if (m) m.emissiveIntensity = 0.15 + n * 3.2;
    });
    if (halo.current) halo.current.opacity = n * 0.85;
  });

  return (
    <group>
      {LIGHT_POLES.map((p, i) => (
        <mesh key={i} position={[p.x, sandHeight(p.x, p.z) + p.h / 2 - 0.05, p.z]} castShadow>
          <cylinderGeometry args={[0.035, 0.045, p.h + 0.1, 7]} />
          <meshStandardMaterial color="#8a6a3e" roughness={0.9} />
        </mesh>
      ))}
      {wires.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color="#2b2236" roughness={0.8} />
        </mesh>
      ))}
      {bulbs.map((b, i) => (
        <mesh key={i} position={b.p}>
          <sphereGeometry args={[0.038, 10, 8]} />
          <meshStandardMaterial
            ref={(m) => {
              if (m) bulbMat.current[i] = m;
            }}
            color="#fff7e6"
            emissive={b.c}
            emissiveIntensity={0.15}
            roughness={0.3}
            toneMapped={false}
          />
        </mesh>
      ))}
      <points geometry={haloGeo}>
        <pointsMaterial
          ref={halo}
          map={tex}
          size={0.55}
          sizeAttenuation
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </group>
  );
}

/**
 * Luz cálida de la guirnalda. Va fuera del grupo precompilado: si naciera
 * oculta, al aparecer cambiaría el número de luces y forzaría a recompilar
 * todos los shaders de la escena.
 */
export function WarmLight() {
  const warm = useRef<THREE.PointLight>(null!);
  useFrame(() => {
    if (warm.current) warm.current.intensity = nm() * 7;
  });
  return <pointLight ref={warm} position={[0, 2.1, 1.4]} color="#ffb36b" intensity={0} distance={9} decay={1.6} />;
}
