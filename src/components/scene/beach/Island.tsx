import { useMemo } from 'react';
import * as THREE from 'three';
import { noise2, sandHeight, shoreR } from './shore';

const DRY = new THREE.Color('#f4deb0');
const DRY_ALT = new THREE.Color('#ead09c');
const DAMP = new THREE.Color('#dcb98a');
const WET = new THREE.Color('#c39c6c');
const UNDER = new THREE.Color('#d9cf9f');

function sandGeometry() {
  // anillos más densos cerca de la orilla, donde se nota la forma
  const ts: number[] = [];
  for (let t = 0; t < 0.4; t += 0.05) ts.push(t);
  for (let t = 0.4; t < 1.15; t += 0.018) ts.push(t);
  for (let t = 1.15; t <= 1.6; t += 0.06) ts.push(t);
  const seg = 180;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const c = new THREE.Color();

  ts.forEach((t) => {
    for (let j = 0; j <= seg; j++) {
      const th = (j / seg) * Math.PI * 2;
      const R = shoreR(th);
      const r = t * R;
      const x = Math.cos(th) * r;
      const z = Math.sin(th) * r;
      const y = sandHeight(x, z);
      pos.push(x, y, z);

      const n = noise2(x * 0.9, z * 0.9);
      const grain = noise2(x * 6.0, z * 6.0);
      c.copy(DRY).lerp(DRY_ALT, n * 0.8);
      c.lerp(DAMP, THREE.MathUtils.smoothstep(t, 0.8, 0.95));
      c.lerp(WET, THREE.MathUtils.smoothstep(t, 0.95, 1.0));
      c.lerp(UNDER, THREE.MathUtils.smoothstep(t, 1.01, 1.12));
      c.multiplyScalar(0.96 + grain * 0.06);
      col.push(c.r, c.g, c.b);
    }
  });
  const row = seg + 1;
  for (let i = 0; i < ts.length - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * row + j;
      const b = a + row;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function starShape(arms = 5, outer = 1, inner = 0.42) {
  const s = new THREE.Shape();
  for (let i = 0; i <= arms * 2; i++) {
    const a = (i / (arms * 2)) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  return s;
}

/** Objeto apoyado en la arena (calcula la altura del suelo). */
function OnSand({
  x,
  z,
  lift = 0,
  rot = 0,
  children,
}: {
  x: number;
  z: number;
  lift?: number;
  rot?: number;
  children: React.ReactNode;
}) {
  return (
    <group position={[x, sandHeight(x, z) + lift, z]} rotation={[0, rot, 0]}>
      {children}
    </group>
  );
}

/** Isla de arena con orilla irregular, conchas, estrellas de mar, huellas y un castillo. */
export function Island() {
  const geo = useMemo(sandGeometry, []);
  const star = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(starShape(), {
      depth: 0.18,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.08,
      bevelSegments: 2,
    });
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  /* huellas: de la orilla al carrito (alguien vino por su ceviche) */
  const steps = useMemo(() => {
    const out: { x: number; z: number; r: number }[] = [];
    const th = 2.2; // orilla delantera-izquierda
    const R = shoreR(th) * 0.92;
    const sx = Math.cos(th) * R;
    const sz = Math.sin(th) * R;
    const ex = -0.9;
    const ez = 1.1;
    const n = 11;
    const ang = Math.atan2(ez - sz, ex - sx);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const side = i % 2 ? 1 : -1;
      const x = sx + (ex - sx) * t + Math.cos(ang + Math.PI / 2) * 0.12 * side;
      const z = sz + (ez - sz) * t + Math.sin(ang + Math.PI / 2) * 0.12 * side;
      out.push({ x, z, r: -ang });
    }
    return out;
  }, []);

  return (
    <group>
      <mesh geometry={geo} receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} metalness={0} />
      </mesh>

      {steps.map((s, i) => (
        <mesh
          key={i}
          position={[s.x, sandHeight(s.x, s.z) + 0.006, s.z]}
          rotation={[-Math.PI / 2, 0, s.r + Math.PI / 2]}
          scale={[0.55, 1, 1]}
          receiveShadow
        >
          <circleGeometry args={[0.07, 10]} />
          <meshStandardMaterial
            color="#d7b582"
            roughness={1}
            polygonOffset
            polygonOffsetFactor={-2}
            transparent
            opacity={0.8}
          />
        </mesh>
      ))}

      {/* estrellas de mar */}
      {[
        { x: -3.6, z: 3.4, s: 0.13, r: 0.4, c: '#ff7a4d' },
        { x: 4.4, z: 2.6, s: 0.11, r: 1.4, c: '#ff9a5c' },
        { x: -1.6, z: 4.9, s: 0.1, r: 2.2, c: '#f2603c' },
      ].map((s, i) => (
        <OnSand key={i} x={s.x} z={s.z} lift={0.01} rot={s.r}>
          <mesh geometry={star} scale={s.s} castShadow receiveShadow>
            <meshStandardMaterial color={s.c} roughness={0.75} />
          </mesh>
        </OnSand>
      ))}

      {/* conchas */}
      {[
        { x: 2.9, z: 3.5, r: 0.3 },
        { x: -4.2, z: 1.6, r: 1.1 },
        { x: 1.2, z: 4.7, r: 2.0 },
        { x: -2.5, z: -3.9, r: 0.8 },
      ].map((s, i) => (
        <OnSand key={i} x={s.x} z={s.z} lift={0.02} rot={s.r}>
          <mesh scale={[0.11, 0.05, 0.09]} castShadow>
            <sphereGeometry args={[1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={i % 2 ? '#fde7d6' : '#f7cdb8'} roughness={0.6} />
          </mesh>
        </OnSand>
      ))}

      {/* castillo de arena */}
      <OnSand x={-3.1} z={2.2} rot={0.5}>
        <group>
          <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.28, 0.34, 0.24, 10]} />
            <meshStandardMaterial color="#e6c48c" roughness={1} />
          </mesh>
          {[0, 1, 2, 3].map((i) => {
            const a = (i / 4) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.3, 0.2, Math.sin(a) * 0.3]} castShadow>
                <cylinderGeometry args={[0.07, 0.09, 0.4, 8]} />
                <meshStandardMaterial color="#e1bd84" roughness={1} />
              </mesh>
            );
          })}
          <mesh position={[0, 0.34, 0]} castShadow>
            <coneGeometry args={[0.16, 0.26, 8]} />
            <meshStandardMaterial color="#e9c995" roughness={1} />
          </mesh>
          <mesh position={[0, 0.58, 0]}>
            <cylinderGeometry args={[0.006, 0.006, 0.26, 4]} />
            <meshStandardMaterial color="#6b4a2b" />
          </mesh>
          <mesh position={[0.05, 0.66, 0]}>
            <planeGeometry args={[0.1, 0.06]} />
            <meshStandardMaterial color="#ff5a3c" side={THREE.DoubleSide} />
          </mesh>
        </group>
      </OnSand>
    </group>
  );
}

export { OnSand };
