import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Billboard, Outlines } from '@react-three/drei';
import * as THREE from 'three';
import { INK, badgeTexture, signTexture } from '../scene/toon';
import { SITIOS, type SitioId } from './layout';
import { ToonMat } from '../parque/park/Island';
import { simTime } from '../parque/park/simClock';

type Sel = {
  selected: SitioId | null;
  onSelect: (id: SitioId) => void;
};

function pick(id: SitioId, onSelect: (id: SitioId) => void) {
  return {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onSelect(id);
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      document.body.style.cursor = '';
    },
  };
}

/* ---------------- muros de la ciudadela ---------------- */

function Muro({ a, b }: { a: [number, number]; b: [number, number] }) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  const ang = Math.atan2(dz, dx);
  const cx = (a[0] + b[0]) / 2;
  const cz = (a[1] + b[1]) / 2;
  const n = Math.max(1, Math.round(len / 1.05));
  const merlones = Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n;
    return [a[0] + dx * t, a[1] + dz * t] as [number, number];
  });
  return (
    <group>
      <mesh position={[cx, 0.5, cz]} rotation={[0, -ang, 0]}>
        <boxGeometry args={[len, 1.0, 0.3]} />
        <ToonMat color="#cdd3e3" />
        <Outlines thickness={0.045} color={INK} />
      </mesh>
      {merlones.map(([x, z], i) => (
        <mesh key={i} position={[x, 1.12, z]} rotation={[0, -ang, 0]}>
          <boxGeometry args={[0.4, 0.26, 0.34]} />
          <ToonMat color="#b9c1d6" ramp={[0.6, 0.8, 1]} />
        </mesh>
      ))}
    </group>
  );
}

function Pilon({ at }: { at: [number, number] }) {
  return (
    <group position={[at[0], 0, at[1]]}>
      <mesh position={[0, 0.95, 0]}>
        <boxGeometry args={[0.5, 1.9, 0.5]} />
        <ToonMat color="#d8dde9" />
        <Outlines thickness={0.04} color={INK} />
      </mesh>
      <mesh position={[0, 2.08, 0]}>
        <coneGeometry args={[0.4, 0.44, 6]} />
        <ToonMat color="#8f6bd8" ramp={[0.55, 0.75, 1]} />
      </mesh>
    </group>
  );
}

function Ciudadela({ onSelect }: Sel) {
  const lindes: [number, number][][] = [
    [
      [-3.0, -6.6],
      [9.2, -6.6],
    ],
    [
      [9.2, -6.6],
      [9.2, 0],
    ],
    [
      [9.2, 1.6],
      [9.2, 2.4],
    ],
    [
      [9.2, 2.4],
      [-3.0, 2.4],
    ],
    [
      [-3.0, 2.4],
      [-3.0, 1.7],
    ],
    [
      [-3.0, -0.1],
      [-3.0, -6.6],
    ],
  ];
  return (
    <group {...pick('ciudadela', onSelect)}>
      {lindes.map(([a, b], i) => (
        <Muro key={i} a={a} b={b} />
      ))}
      <Pilon at={[-3.0, -0.1]} />
      <Pilon at={[-3.0, 1.7]} />
      <Pilon at={[9.2, 0]} />
      <Pilon at={[9.2, 1.6]} />
    </group>
  );
}

/* ---------------- puente = raíz ---------------- */

function Puente(p: Sel) {
  const plumas = [-0.66, -0.33, 0, 0.33, 0.66];
  return (
    <group {...pick('puente', p.onSelect)}>
      {plumas.map((dx) => (
        <mesh key={dx} position={[-3.1 + dx, 0.075, 0.8]}>
          <boxGeometry args={[0.28, 0.07, 1.15]} />
          <ToonMat color="#b87c46" ramp={[0.55, 0.75, 1]} />
        </mesh>
      ))}
      {[0.22, 1.38].map((z) => (
        <group key={z}>
          <mesh position={[-3.1, 0.3, z]}>
            <boxGeometry args={[1.72, 0.07, 0.07]} />
            <ToonMat color="#8a5a34" ramp={[0.5, 0.7, 1]} />
          </mesh>
          {[-0.75, 0, 0.75].map((dx) => (
            <mesh key={dx} position={[-3.1 + dx, 0.16, z]}>
              <boxGeometry args={[0.08, 0.32, 0.08]} />
              <ToonMat color="#8a5a34" ramp={[0.5, 0.7, 1]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/* ---------------- torno = una instancia por transacción ---------------- */

function Torno(p: Sel) {
  const aspas = useRef<THREE.Group>(null!);
  useFrame(() => {
    if (aspas.current) aspas.current.rotation.y = simTime() * 1.1;
  });
  const sign = useMemo(() => signTexture('TORNO', 'una instancia'), []);
  return (
    <group position={[-6.9, 0, 0.8]} {...pick('torno', p.onSelect)}>
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[1.6, 0.14, 2.6]} />
        <ToonMat color="#e8c9a0" ramp={[0.6, 0.8, 1]} />
      </mesh>
      {[-0.95, 0.95].map((z) => (
        <mesh key={z} position={[0, 1.05, z]}>
          <boxGeometry args={[0.22, 2.1, 0.22]} />
          <ToonMat color="#ff5a3c" />
          <Outlines thickness={0.04} color={INK} />
        </mesh>
      ))}
      <mesh position={[0, 2.22, 0]}>
        <boxGeometry args={[0.3, 0.3, 2.4]} />
        <ToonMat color="#ff5a3c" />
        <Outlines thickness={0.04} color={INK} />
      </mesh>
      <mesh position={[0, 3.0, 0]}>
        <planeGeometry args={[1.7, 0.85]} />
        <meshBasicMaterial map={sign} transparent side={THREE.DoubleSide} />
      </mesh>
      <group ref={aspas} position={[0, 0.95, 0]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} rotation={[0, (i * Math.PI) / 2, 0]}>
            <boxGeometry args={[0.09, 0.09, 1.7]} />
            <ToonMat color="#ffc93c" ramp={[0.6, 0.8, 1]} />
          </mesh>
        ))}
        <mesh position={[0, 0.75, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.5, 6]} />
          <ToonMat color="#4a4363" ramp={[0.5, 0.7, 1]} />
        </mesh>
      </group>
    </group>
  );
}

/* ---------------- guardia = invariantes ---------------- */

function Guardia(p: Sel) {
  const sign = useMemo(() => signTexture('GUARDIA', 'invariantes'), []);
  return (
    <group position={[-1.5, 0, -0.8]} {...pick('guardia', p.onSelect)}>
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[1.9, 0.14, 1.7]} />
        <ToonMat color="#e8c9a0" ramp={[0.6, 0.8, 1]} />
      </mesh>
      <mesh position={[0, 1.0, 0]}>
        <boxGeometry args={[1.5, 1.86, 1.35]} />
        <ToonMat color="#fff7ea" />
        <Outlines thickness={0.045} color={INK} />
      </mesh>
      <mesh position={[0, 0.62, 0.7]}>
        <boxGeometry args={[0.55, 1.1, 0.08]} />
        <meshToonMaterial color="#2a2340" />
      </mesh>
      <mesh position={[0, 1.34, 0.7]}>
        <boxGeometry args={[1.0, 0.5, 0.08]} />
        <meshToonMaterial color="#9fd7f0" />
      </mesh>
      <mesh position={[0, 2.1, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[1.25, 0.8, 4]} />
        <ToonMat color="#7ed957" ramp={[0.55, 0.75, 1]} />
        <Outlines thickness={0.045} color={INK} />
      </mesh>
      <mesh position={[0, 2.95, 0.05]}>
        <planeGeometry args={[1.6, 0.8]} />
        <meshBasicMaterial map={sign} transparent side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* ---------------- sala de líneas = entidades ---------------- */

function Sala(p: Sel) {
  const sign = useMemo(() => signTexture('LÍNEAS', 'entidades'), []);
  return (
    <group position={[5.6, 0, -4.4]} {...pick('sala', p.onSelect)}>
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[3.9, 0.14, 2.3]} />
        <ToonMat color="#e8c9a0" ramp={[0.6, 0.8, 1]} />
      </mesh>
      <mesh position={[0, 1.05, 0]}>
        <boxGeometry args={[3.5, 1.96, 1.9]} />
        <ToonMat color="#dfe6f2" />
        <Outlines thickness={0.05} color={INK} />
      </mesh>
      {[-1.05, 0, 1.05].map((x) => (
        <mesh key={x} position={[x, 0.72, 0.97]}>
          <boxGeometry args={[0.6, 1.2, 0.08]} />
          <meshToonMaterial color="#2a2340" />
        </mesh>
      ))}
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 1.62, 0.97]}>
          <boxGeometry args={[0.62, 0.44, 0.08]} />
          <meshToonMaterial color="#9fd7f0" />
        </mesh>
      ))}
      <mesh position={[0, 2.22, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[2.6, 0.72, 4]} />
        <ToonMat color="#2f9fe0" ramp={[0.55, 0.75, 1]} />
        <Outlines thickness={0.05} color={INK} />
      </mesh>
      <mesh position={[0, 3.1, 0]}>
        <planeGeometry args={[1.7, 0.85]} />
        <meshBasicMaterial map={sign} transparent side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* ---------------- cofre = value objects ---------------- */

function Cofre(p: Sel) {
  const moneda = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    if (moneda.current) moneda.current.position.y = 1.5 + Math.sin(simTime() * 2.4) * 0.12;
  });
  return (
    <group position={[6.2, 0, 0.6]} {...pick('cofre', p.onSelect)}>
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[1.7, 0.14, 1.4]} />
        <ToonMat color="#e8c9a0" ramp={[0.6, 0.8, 1]} />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[1.2, 0.62, 0.85]} />
        <ToonMat color="#8a5a34" ramp={[0.5, 0.7, 1]} />
        <Outlines thickness={0.045} color={INK} />
      </mesh>
      <mesh position={[0, 0.82, -0.08]} rotation={[-0.42, 0, 0]}>
        <boxGeometry args={[1.2, 0.28, 0.85]} />
        <ToonMat color="#b87c46" ramp={[0.55, 0.75, 1]} />
        <Outlines thickness={0.045} color={INK} />
      </mesh>
      <mesh position={[0, 0.5, 0.45]}>
        <boxGeometry args={[0.22, 0.26, 0.1]} />
        <ToonMat color="#ffc93c" ramp={[0.65, 0.85, 1]} />
      </mesh>
      <mesh ref={moneda} position={[0, 1.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.06, 12]} />
        <meshToonMaterial color="#ffc93c" />
        <Outlines thickness={0.02} color={INK} />
      </mesh>
    </group>
  );
}

/* ---------------- registro de eventos ---------------- */

function Registro(p: Sel) {
  const orbes = useRef<THREE.Group>(null!);
  useFrame(() => {
    if (orbes.current) orbes.current.rotation.y = simTime() * 1.5;
  });
  const sign = useMemo(() => signTexture('REGISTRO', 'eventos'), []);
  return (
    <group position={[2.4, 0, -5.4]} {...pick('registro', p.onSelect)}>
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[1.9, 0.14, 1.9]} />
        <ToonMat color="#e8c9a0" ramp={[0.6, 0.8, 1]} />
      </mesh>
      <mesh position={[0, 1.35, 0]}>
        <cylinderGeometry args={[0.72, 0.85, 2.7, 8]} />
        <ToonMat color="#d8dde9" />
        <Outlines thickness={0.045} color={INK} />
      </mesh>
      {[0.85, 1.75].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[0.88, 0.88, 0.14, 8]} />
          <ToonMat color="#ffc93c" ramp={[0.6, 0.8, 1]} />
        </mesh>
      ))}
      <mesh position={[0, 3.0, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[1.05, 0.95, 4]} />
        <ToonMat color="#ffc93c" />
        <Outlines thickness={0.05} color={INK} />
      </mesh>
      <group ref={orbes} position={[0, 3.55, 0]}>
        {[0, 1, 2].map((i) => (
          <mesh
            key={i}
            position={[Math.cos((i * Math.PI * 2) / 3) * 0.55, 0, Math.sin((i * Math.PI * 2) / 3) * 0.55]}
          >
            <octahedronGeometry args={[0.14, 0]} />
            <meshToonMaterial color="#ffc93c" />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 4.35, 0.05]}>
        <planeGeometry args={[1.6, 0.8]} />
        <meshBasicMaterial map={sign} transparent side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* ---------------- bodega = commit atómico ---------------- */

function Bodega(p: Sel) {
  const sign = useMemo(() => signTexture('BODEGA', 'commit'), []);
  return (
    <group position={[14.7, 0, -4.3]} {...pick('bodega', p.onSelect)}>
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[4.4, 0.14, 3.3]} />
        <ToonMat color="#e8c9a0" ramp={[0.6, 0.8, 1]} />
      </mesh>
      <mesh position={[0, 1.15, 0]}>
        <boxGeometry args={[4.0, 2.2, 2.9]} />
        <ToonMat color="#dfe6f2" />
        <Outlines thickness={0.05} color={INK} />
      </mesh>
      <mesh position={[0, 2.37, 0]}>
        <boxGeometry args={[4.2, 0.24, 3.1]} />
        <ToonMat color="#8f6bd8" />
        <Outlines thickness={0.045} color={INK} />
      </mesh>
      <mesh position={[-0.9, 0.92, 1.52]}>
        <boxGeometry args={[1.5, 1.7, 0.1]} />
        <meshToonMaterial color="#17122b" />
      </mesh>
      <mesh position={[-0.9, 0.86, 1.58]}>
        <boxGeometry args={[1.25, 1.45, 0.08]} />
        <meshToonMaterial color="#2a2340" />
      </mesh>
      <mesh position={[0.9, 1.5, 1.53]}>
        <planeGeometry args={[1.9, 0.95]} />
        <meshBasicMaterial map={sign} transparent />
      </mesh>
      <group position={[2.6, 0, 0]}>
        <mesh position={[0, 1.15, 0]}>
          <cylinderGeometry args={[0.75, 0.8, 2.3, 10]} />
          <ToonMat color="#b9c1d6" />
          <Outlines thickness={0.045} color={INK} />
        </mesh>
        <mesh position={[0, 2.65, 0]}>
          <coneGeometry args={[0.85, 0.7, 10]} />
          <ToonMat color="#8f6bd8" />
          <Outlines thickness={0.045} color={INK} />
        </mesh>
      </group>
    </group>
  );
}

/* ---------------- mástil del bus de eventos ---------------- */

function BusMastil(p: Sel) {
  const orb = useRef<THREE.Mesh>(null!);
  const rings = useRef<THREE.Group>(null!);
  useFrame(() => {
    const t = simTime();
    if (orb.current) orb.current.rotation.y = t * 1.4;
    if (rings.current) {
      rings.current.children.forEach((c, i) => {
        c.scale.setScalar(1 + Math.sin(t * 2.2 + i * 1.6) * 0.12);
      });
    }
  });
  const sign = useMemo(() => signTexture('BUS', 'publicar'), []);
  return (
    <group position={[13.2, 0, 2.6]} {...pick('bus', p.onSelect)}>
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[1.9, 0.14, 1.9]} />
        <ToonMat color="#e8c9a0" ramp={[0.6, 0.8, 1]} />
      </mesh>
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[1.2, 0.56, 1.2]} />
        <ToonMat color="#cdd3e3" />
        <Outlines thickness={0.04} color={INK} />
      </mesh>
      <mesh position={[0, 1.9, 0]}>
        <cylinderGeometry args={[0.09, 0.12, 2.5, 7]} />
        <ToonMat color="#4a4363" ramp={[0.5, 0.7, 1]} />
      </mesh>
      <group ref={rings} position={[0, 3.3, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.62, 0.045, 6, 22]} />
          <meshToonMaterial color="#14a8a8" />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.94, 0.04, 6, 26]} />
          <meshToonMaterial color="#fff7ea" />
        </mesh>
      </group>
      <mesh ref={orb} position={[0, 3.3, 0]}>
        <octahedronGeometry args={[0.32, 0]} />
        <ToonMat color="#14a8a8" ramp={[0.7, 0.88, 1]} />
        <Outlines thickness={0.04} color={INK} />
      </mesh>
      <mesh position={[0, 4.35, 0.05]}>
        <planeGeometry args={[1.4, 0.7]} />
        <meshBasicMaterial map={sign} transparent side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* ---------------- correo = suscriptor ---------------- */

function Correo(p: Sel) {
  const beacon = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    if (beacon.current) beacon.current.scale.setScalar(1 + Math.sin(simTime() * 5) * 0.22);
  });
  const sign = useMemo(() => signTexture('CORREO', 'suscriptor'), []);
  return (
    <group position={[15.9, 0, 6.2]} {...pick('correo', p.onSelect)}>
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[2.0, 0.14, 2.0]} />
        <ToonMat color="#e8c9a0" ramp={[0.6, 0.8, 1]} />
      </mesh>
      <mesh position={[0, 1.7, 0]}>
        <boxGeometry args={[1.6, 3.26, 1.6]} />
        <ToonMat color="#e6f4f4" />
        <Outlines thickness={0.05} color={INK} />
      </mesh>
      {[1.0, 2.3].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[1.7, 0.14, 1.7]} />
          <ToonMat color="#14a8a8" ramp={[0.55, 0.75, 1]} />
        </mesh>
      ))}
      <mesh position={[0, 0.72, 0.82]}>
        <boxGeometry args={[0.8, 1.2, 0.1]} />
        <meshToonMaterial color="#2a2340" />
      </mesh>
      <mesh position={[0, 2.75, 0.82]}>
        <planeGeometry args={[1.5, 0.75]} />
        <meshBasicMaterial map={sign} transparent />
      </mesh>
      <mesh position={[0, 3.5, 0]}>
        <boxGeometry args={[1.7, 0.22, 1.7]} />
        <ToonMat color="#14a8a8" />
        <Outlines thickness={0.045} color={INK} />
      </mesh>
      <mesh ref={beacon} position={[0, 3.95, 0]}>
        <sphereGeometry args={[0.17, 10, 8]} />
        <meshToonMaterial color="#ffc93c" />
      </mesh>
    </group>
  );
}

/* ---------------- anillo de selección ---------------- */

function Anillo({ sitio }: { sitio: (typeof SITIOS)[number] }) {
  const m = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (!m.current) return;
    m.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 4) * 0.05);
  });
  return (
    <mesh ref={m} position={[sitio.at[0], 0.9, sitio.at[1]]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[sitio.ring - 0.22, sitio.ring, 44]} />
      <meshBasicMaterial color="#ffc93c" transparent opacity={0.95} depthWrite={false} />
    </mesh>
  );
}

/* ---------------- etiquetas flotantes ---------------- */

function Etiqueta({
  sitio,
  onSelect,
}: {
  sitio: (typeof SITIOS)[number];
  onSelect: (id: SitioId) => void;
}) {
  const tex = badgeTexture(sitio.badge.main, sitio.badge.fill);
  return (
    <Billboard position={sitio.labelAt} {...pick(sitio.id, onSelect)}>
      <mesh>
        <planeGeometry args={[3.5, 3.5 * (200 / 512)]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </Billboard>
  );
}

/* ---------------- conjunto ---------------- */

export function Structures({
  selected,
  onSelect,
  labels,
}: {
  selected: SitioId | null;
  onSelect: (id: SitioId) => void;
  labels: boolean;
}) {
  const sel = SITIOS.find((s) => s.id === selected) ?? null;
  const p = { selected, onSelect };
  return (
    <group>
      <Ciudadela {...p} />
      <Puente {...p} />
      <Torno {...p} />
      <Guardia {...p} />
      <Sala {...p} />
      <Cofre {...p} />
      <Registro {...p} />
      <Bodega {...p} />
      <BusMastil {...p} />
      <Correo {...p} />

      {sel && <Anillo sitio={sel} />}
      {labels && SITIOS.map((s) => <Etiqueta key={s.id} sitio={s} onSelect={onSelect} />)}
    </group>
  );
}
