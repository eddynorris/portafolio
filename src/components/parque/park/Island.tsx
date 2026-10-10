import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Outlines } from '@react-three/drei';
import * as THREE from 'three';
import { INK, toonRamp } from '../../scene/toon';
import { ARBUSTOS, ARBOLES, BANCOS, FAROLAS, VALLAS, VALLAS_CONTEXTO, type Vec2 } from './layout';
import { simTime } from './simClock';

export function ToonMat({ color, ramp = [0.4, 0.68, 1] }: { color: string; ramp?: number[] }) {
  const key = ramp.join(',');
  const gradientMap = useMemo(() => toonRamp(`pk:${key}`, ramp), [key]);
  return <meshToonMaterial color={color} gradientMap={gradientMap} />;
}

const textures = new Map<string, THREE.Texture>();
function memo(key: string, make: () => THREE.Texture) {
  const hit = textures.get(key);
  if (hit) return hit;
  const t = make();
  textures.set(key, t);
  return t;
}

/** Césped con cuadrícula tipo RCT (dos verdes alternos). */
function grassTexture() {
  return memo('pk:grass', () => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const g = c.getContext('2d')!;
    const n = 4;
    const s = 256 / n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        g.fillStyle = (x + y) % 2 ? '#7ed957' : '#75d151';
        g.fillRect(x * s, y * s, s, s);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(38, 21);
    tex.anisotropy = 4;
    return tex;
  });
}

/* ---------------- caminos ---------------- */

function Camino({ pts, w = 1.7 }: { pts: Vec2[]; w?: number }) {
  const joints = pts.map(([x, z]) => ({ x, z }));
  const segs = pts.slice(0, -1).map(([ax, az], i) => {
    const [bx, bz] = pts[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    return { cx: (ax + bx) / 2, cz: (az + bz) / 2, len, ang: Math.atan2(dz, dx) };
  });
  const dark = w + 0.44;
  return (
    <group>
      {segs.map((s, i) => (
        <group key={i} position={[s.cx, 0.014, s.cz]} rotation={[0, -s.ang, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[s.len + w * 0.6, dark]} />
            <meshBasicMaterial color="#dfb285" />
          </mesh>
          <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[s.len + w * 0.6, w]} />
            <meshBasicMaterial color="#ffe7c4" />
          </mesh>
        </group>
      ))}
      {joints.map((p, i) => (
        <group key={i} position={[p.x, 0.014, p.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[dark / 2, 14]} />
            <meshBasicMaterial color="#dfb285" />
          </mesh>
          <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[w / 2, 14]} />
            <meshBasicMaterial color="#ffe7c4" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ---------------- vallas ---------------- */

function Valla({ a, b }: { a: Vec2; b: Vec2 }) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  const ang = Math.atan2(dz, dx);
  const cx = (a[0] + b[0]) / 2;
  const cz = (a[1] + b[1]) / 2;
  const n = Math.max(2, Math.round(len / 1.15));
  const posts = Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return [a[0] + dx * t, a[1] + dz * t] as Vec2;
  });
  return (
    <group>
      {[0.2, 0.46].map((y) => (
        <mesh key={y} position={[cx, y, cz]} rotation={[0, -ang, 0]}>
          <boxGeometry args={[len, 0.055, 0.055]} />
          <ToonMat color="#4a4363" ramp={[0.6, 0.8, 1]} />
        </mesh>
      ))}
      {posts.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.3, z]}>
          <boxGeometry args={[0.11, 0.6, 0.11]} />
          <ToonMat color="#fff7ea" ramp={[0.62, 0.82, 1]} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------------- decoración ---------------- */

function Arbol({ at }: { at: Vec2 }) {
  return (
    <group position={[at[0], 0, at[1]]}>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.11, 0.15, 0.6, 7]} />
        <ToonMat color="#b87c46" ramp={[0.5, 0.7, 1]} />
      </mesh>
      <mesh position={[0, 1.05, 0]}>
        <coneGeometry args={[0.78, 1.15, 7]} />
        <ToonMat color="#4fbb5c" />
        <Outlines thickness={0.045} color={INK} />
      </mesh>
      <mesh position={[0, 1.75, 0]}>
        <coneGeometry args={[0.52, 0.85, 7]} />
        <ToonMat color="#7ed957" />
        <Outlines thickness={0.045} color={INK} />
      </mesh>
    </group>
  );
}

function Farola({ at }: { at: Vec2 }) {
  return (
    <group position={[at[0], 0, at[1]]}>
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 1.6, 6]} />
        <ToonMat color="#4a4363" ramp={[0.5, 0.7, 1]} />
      </mesh>
      <mesh position={[0, 1.72, 0]}>
        <sphereGeometry args={[0.2, 10, 8]} />
        <ToonMat color="#ffe9a8" ramp={[0.8, 0.92, 1]} />
        <Outlines thickness={0.04} color={INK} />
      </mesh>
      <mesh position={[0, 1.95, 0]}>
        <coneGeometry args={[0.26, 0.2, 6]} />
        <ToonMat color="#ff5a3c" ramp={[0.55, 0.75, 1]} />
      </mesh>
    </group>
  );
}

function Banco({ at }: { at: Vec2 }) {
  return (
    <group position={[at[0], 0, at[1]]}>
      <mesh position={[0, 0.34, 0]}>
        <boxGeometry args={[1.1, 0.09, 0.4]} />
        <ToonMat color="#d9a066" ramp={[0.55, 0.75, 1]} />
        <Outlines thickness={0.035} color={INK} />
      </mesh>
      <mesh position={[0, 0.55, -0.16]}>
        <boxGeometry args={[1.1, 0.34, 0.07]} />
        <ToonMat color="#c98a52" ramp={[0.55, 0.75, 1]} />
      </mesh>
      {[-0.42, 0.42].map((x) => (
        <mesh key={x} position={[x, 0.16, 0]}>
          <boxGeometry args={[0.08, 0.32, 0.34]} />
          <ToonMat color="#a5713f" ramp={[0.5, 0.7, 1]} />
        </mesh>
      ))}
    </group>
  );
}

function Estanque({ at }: { at: Vec2 }) {
  return (
    <group position={[at[0], 0, at[1]]}>
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.6, 26]} />
        <meshBasicMaterial color="#e8c9a0" />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.2, 26]} />
        <meshBasicMaterial color="#5cc4f4" />
      </mesh>
      <mesh position={[0.4, 0.05, -0.3]} rotation={[-Math.PI / 2, 0, 0.4]}>
        <circleGeometry args={[0.5, 14]} />
        <meshBasicMaterial color="#74d1f8" />
      </mesh>
      {[[-1.4, 0.8], [1.5, 1.0], [-0.6, -1.5]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.12, z]}>
          <sphereGeometry args={[0.16, 8, 6]} />
          <ToonMat color="#4fbb5c" ramp={[0.55, 0.75, 1]} />
        </mesh>
      ))}
    </group>
  );
}

function Arbusto({ at, i }: { at: Vec2; i: number }) {
  return (
    <mesh position={[at[0], 0.22, at[1]]} scale={[1, 0.72, 1]}>
      <sphereGeometry args={[0.42 + (i % 3) * 0.1, 8, 6]} />
      <ToonMat color={i % 2 ? '#4fbb5c' : '#35a84a'} ramp={[0.5, 0.72, 1]} />
      <Outlines thickness={0.04} color={INK} />
    </mesh>
  );
}

/** Nubes gordas que derivan con el reloj de simulación. */
function Nubes() {
  const g = useRef<THREE.Group>(null!);
  const defs = useMemo(
    () => [
      { x: -14, y: 9.5, z: -16, s: 1.5, sp: 0.09 },
      { x: 6, y: 11, z: -20, s: 2, sp: -0.06 },
      { x: 23, y: 9, z: -5, s: 1.3, sp: 0.05 },
      { x: -20, y: 10, z: 10, s: 1.1, sp: -0.08 },
    ],
    [],
  );
  useFrame(() => {
    if (!g.current) return;
    const t = simTime();
    g.current.children.forEach((c, i) => {
      const d = defs[i];
      c.position.x = d.x + Math.sin(t * d.sp * 6 + i) * 2.2;
    });
  });
  return (
    <group ref={g}>
      {defs.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} scale={c.s}>
          {[
            [-0.7, 0, 0, 0.55],
            [0, 0.2, 0, 0.75],
            [0.75, 0.02, 0.1, 0.5],
          ].map(([x, y, z, r], j) => (
            <mesh key={j} position={[x, y, z]}>
              <sphereGeometry args={[r, 12, 9]} />
              <meshToonMaterial color="#ffffff" />
              <Outlines thickness={0.05} color="#cfe8ff" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/* ---------------- isla ---------------- */

/** Isla compartida por los parques del apartado Educador (DDD, MVC…).
 *  Vallas y estanque son opcionales: cada mundo pasa los suyos. */
export function Island({
  paths,
  vallas = VALLAS,
  vallasExtra = VALLAS_CONTEXTO,
  estanque = [-15.2, 3.6] as Vec2 | null,
}: {
  paths: Vec2[][];
  vallas?: [Vec2, Vec2][];
  vallasExtra?: [Vec2, Vec2][];
  estanque?: Vec2 | null;
}) {
  const grass = grassTexture();
  return (
    <group>
      {/* plataforma */}
      <mesh position={[0, -0.25, 0]}>
        <boxGeometry args={[38, 0.5, 21]} />
        <meshToonMaterial map={grass} gradientMap={toonRamp('pk:grass-main', [0.4, 0.68, 1])} />
        <Outlines thickness={0.06} color={INK} />
      </mesh>
      <mesh position={[0, -1.0, 0]}>
        <boxGeometry args={[37.6, 1.2, 20.6]} />
        <ToonMat color="#d9a066" ramp={[0.45, 0.65, 1]} />
        <Outlines thickness={0.06} color={INK} />
      </mesh>
      <mesh position={[0, -1.95, 0]}>
        <boxGeometry args={[36.4, 0.9, 19.4]} />
        <ToonMat color="#a5713f" ramp={[0.4, 0.6, 1]} />
        <Outlines thickness={0.06} color={INK} />
      </mesh>

      {/* caminos */}
      {paths.map((p, i) => (
        <Camino key={i} pts={p} />
      ))}

      {/* vallas del mundo */}
      {vallas.map(([a, b], i) => (
        <Valla key={i} a={a} b={b} />
      ))}
      {vallasExtra.map(([a, b], i) => (
        <Valla key={`c${i}`} a={a} b={b} />
      ))}

      {/* decoración */}
      {ARBOLES.map((a, i) => (
        <Arbol key={i} at={a} />
      ))}
      {FAROLAS.map((a, i) => (
        <Farola key={i} at={a} />
      ))}
      {BANCOS.map((a, i) => (
        <Banco key={i} at={a} />
      ))}
      {ARBUSTOS.map((a, i) => (
        <Arbusto key={i} at={a} i={i} />
      ))}
      {estanque && <Estanque at={estanque} />}

      <Nubes />
    </group>
  );
}
