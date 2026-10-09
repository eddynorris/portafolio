import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Billboard, Outlines } from '@react-three/drei';
import * as THREE from 'three';
import { INK, badgeTexture, signTexture, stripeTexture } from '../../scene/toon';
import { SITIOS, type SitioId } from './layout';
import { ToonMat } from './Island';
import { simTime } from './simClock';

type Sel = {
  selected: SitioId | null;
  onSelect: (id: SitioId) => void;
};

type PickProps = Sel & {
  id: SitioId;
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

/* ---------------- taquilla + arco de entrada ---------------- */

function Taquilla(p: Sel) {
  const stripes = useMemo(() => stripeTexture('#ff5a3c', '#fff7ea', 8), []);
  return (
    <group position={[-12.4, 0, -1.1]} {...pick('taquilla', p.onSelect)}>
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[2.7, 0.14, 2.1]} />
        <ToonMat color="#e8c9a0" ramp={[0.6, 0.8, 1]} />
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <boxGeometry args={[2.2, 1.56, 1.6]} />
        <ToonMat color="#fff7ea" />
        <Outlines thickness={0.045} color={INK} />
      </mesh>
      {/* ventanilla */}
      <mesh position={[0, 1.05, 0.82]}>
        <boxGeometry args={[1.2, 0.62, 0.08]} />
        <meshToonMaterial color="#2a2340" />
      </mesh>
      <mesh position={[0, 0.68, 0.88]}>
        <boxGeometry args={[1.4, 0.1, 0.3]} />
        <ToonMat color="#d9a066" ramp={[0.6, 0.8, 1]} />
      </mesh>
      {/* techo + toldo rayado */}
      <mesh position={[0, 1.7, 0]}>
        <boxGeometry args={[2.5, 0.2, 1.9]} />
        <ToonMat color="#ff5a3c" />
        <Outlines thickness={0.045} color={INK} />
      </mesh>
      <mesh position={[0, 1.5, 1.18]} rotation={[-0.62, 0, 0]}>
        <planeGeometry args={[2.3, 0.85]} />
        <meshBasicMaterial map={stripes} side={THREE.DoubleSide} />
      </mesh>

      {/* arco: el puerto propiamente dicho, sobre el camino */}
      <group position={[1.4, 0, 1.9]}>
        {[-1.25, 1.25].map((z) => (
          <group key={z} position={[0, 0, z]}>
            <mesh position={[0, 1.2, 0]}>
              <boxGeometry args={[0.28, 2.4, 0.28]} />
              <ToonMat color="#fff7ea" />
              <Outlines thickness={0.04} color={INK} />
            </mesh>
            <mesh position={[0, 2.6, 0]}>
              <coneGeometry args={[0.26, 0.4, 6]} />
              <ToonMat color="#ff5a3c" ramp={[0.55, 0.75, 1]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 2.5, 0]}>
          <boxGeometry args={[0.36, 0.36, 3.0]} />
          <ToonMat color="#ff5a3c" />
          <Outlines thickness={0.04} color={INK} />
        </mesh>
        <mesh position={[0.22, 3.3, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[2.3, 1.15]} />
          <meshBasicMaterial
            map={signTexture('ENTRADA', 'puerto driving')}
            side={THREE.DoubleSide}
            transparent
          />
        </mesh>
      </group>
    </group>
  );
}

/* ---------------- castillo: núcleo del dominio ---------------- */

function Castillo(p: Sel) {
  const flag = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    if (flag.current) flag.current.rotation.y = Math.sin(simTime() * 3) * 0.28;
  });
  return (
    <group position={[0, 0, -1.9]} {...pick('castillo', p.onSelect)}>
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[3.2, 2.4, 3]} />
        <ToonMat color="#cdd3e3" />
        <Outlines thickness={0.05} color={INK} />
      </mesh>
      {/* puerta */}
      <mesh position={[0, 0.78, 1.53]}>
        <boxGeometry args={[1.1, 1.56, 0.12]} />
        <meshToonMaterial color="#2a2340" />
      </mesh>
      <mesh position={[0, 1.66, 1.53]}>
        <boxGeometry args={[1.34, 0.2, 0.14]} />
        <ToonMat color="#ffc93c" ramp={[0.6, 0.8, 1]} />
      </mesh>
      {/* almenas delanteras */}
      {[-1.15, -0.4, 0.4, 1.15].map((x) => (
        <mesh key={x} position={[x, 2.58, 1.32]}>
          <boxGeometry args={[0.36, 0.36, 0.36]} />
          <ToonMat color="#b9c1d6" ramp={[0.6, 0.8, 1]} />
        </mesh>
      ))}
      {/* torres */}
      {[
        [-1.35, -1.25],
        [1.35, -1.25],
        [-1.35, 1.25],
        [1.35, 1.25],
      ].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh position={[0, 1.6, 0]}>
            <cylinderGeometry args={[0.46, 0.5, 3.2, 8]} />
            <ToonMat color="#d8dde9" />
            <Outlines thickness={0.045} color={INK} />
          </mesh>
          <mesh position={[0, 3.55, 0]}>
            <coneGeometry args={[0.6, 1.1, 8]} />
            <ToonMat color="#ff5a3c" />
            <Outlines thickness={0.045} color={INK} />
          </mesh>
        </group>
      ))}
      {/* torre del homenaje */}
      <mesh position={[0, 3.5, 0]}>
        <boxGeometry args={[1.7, 2.2, 1.7]} />
        <ToonMat color="#b9c1d6" />
        <Outlines thickness={0.05} color={INK} />
      </mesh>
      <mesh position={[0, 5.1, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[1.2, 1.1, 4]} />
        <ToonMat color="#14a8a8" />
        <Outlines thickness={0.05} color={INK} />
      </mesh>
      {/* mástil + bandera */}
      <mesh position={[0, 6.1, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1.4, 6]} />
        <ToonMat color="#4a4363" ramp={[0.5, 0.7, 1]} />
      </mesh>
      <mesh ref={flag} position={[0.4, 6.5, 0]}>
        <planeGeometry args={[0.8, 0.42]} />
        <meshBasicMaterial color="#ffc93c" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* ---------------- kiosks de contexto ---------------- */

function Kiosco({ id, onSelect, color }: PickProps & { color: string }) {
  const sitio = SITIOS.find((s) => s.id === id)!;
  return (
    <group position={[sitio.at[0], 0, sitio.at[1]]} {...pick(id, onSelect)}>
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[2.1, 0.14, 2.1]} />
        <ToonMat color="#e8c9a0" ramp={[0.6, 0.8, 1]} />
      </mesh>
      <mesh position={[0, 0.8, 0]}>
        <boxGeometry args={[1.7, 1.4, 1.7]} />
        <ToonMat color="#fff7ea" />
        <Outlines thickness={0.045} color={INK} />
      </mesh>
      <mesh position={[0, 0.52, 0.87]}>
        <boxGeometry args={[0.7, 1.0, 0.08]} />
        <meshToonMaterial color="#2a2340" />
      </mesh>
      <mesh position={[0, 2.0, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[1.45, 1.0, 4]} />
        <ToonMat color={color} />
        <Outlines thickness={0.045} color={INK} />
      </mesh>
    </group>
  );
}

/* ---------------- bodega (Postgres) ---------------- */

function Bodega(p: Sel) {
  const sign = useMemo(() => signTexture('POSTGRES', 'adaptador driven'), []);
  return (
    <group position={[13.3, 0, -5.5]} {...pick('bodega', p.onSelect)}>
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[4.9, 0.14, 3.7]} />
        <ToonMat color="#e8c9a0" ramp={[0.6, 0.8, 1]} />
      </mesh>
      <mesh position={[0, 1.25, 0]}>
        <boxGeometry args={[4.4, 2.4, 3.2]} />
        <ToonMat color="#dfe6f2" />
        <Outlines thickness={0.05} color={INK} />
      </mesh>
      <mesh position={[0, 2.55, 0]}>
        <boxGeometry args={[4.65, 0.26, 3.45]} />
        <ToonMat color="#2f9fe0" />
        <Outlines thickness={0.045} color={INK} />
      </mesh>
      {[-1.1, 1.1].map((x) => (
        <mesh key={x} position={[x, 2.75, 0]}>
          <boxGeometry args={[0.6, 0.16, 2.7]} />
          <ToonMat color="#5cc4f4" ramp={[0.7, 0.86, 1]} />
        </mesh>
      ))}
      {/* puerta lateral sur (hacia la que llega el camino) */}
      <mesh position={[-1.2, 0.95, 1.66]}>
        <boxGeometry args={[1.75, 1.8, 0.1]} />
        <meshToonMaterial color="#17122b" />
      </mesh>
      <mesh position={[-1.2, 0.87, 1.72]}>
        <boxGeometry args={[1.45, 1.55, 0.08]} />
        <meshToonMaterial color="#2a2340" />
      </mesh>
      <mesh position={[0.75, 1.62, 1.68]}>
        <planeGeometry args={[2.4, 1.2]} />
        <meshBasicMaterial map={sign} transparent />
      </mesh>
      {/* silo */}
      <group position={[3.0, 0, 0]}>
        <mesh position={[0, 1.3, 0]}>
          <cylinderGeometry args={[0.85, 0.9, 2.6, 10]} />
          <ToonMat color="#5cc4f4" />
          <Outlines thickness={0.045} color={INK} />
        </mesh>
        <mesh position={[0, 3.0, 0]}>
          <coneGeometry args={[0.95, 0.8, 10]} />
          <ToonMat color="#2f9fe0" />
          <Outlines thickness={0.045} color={INK} />
        </mesh>
      </group>
    </group>
  );
}

/* ---------------- torre de correo ---------------- */

function Correo(p: Sel) {
  const sign = useMemo(() => signTexture('CORREO', 'adaptador driven'), []);
  const beam = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    if (!beam.current) return;
    const k = 1 + Math.sin(simTime() * 5) * 0.22;
    beam.current.scale.setScalar(k);
  });
  return (
    <group position={[15.1, 0, 0.6]} {...pick('correo', p.onSelect)}>
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[2.4, 0.14, 2.4]} />
        <ToonMat color="#e8c9a0" ramp={[0.6, 0.8, 1]} />
      </mesh>
      <mesh position={[0, 2.55, 0]}>
        <boxGeometry args={[1.9, 5.0, 1.9]} />
        <ToonMat color="#e6f4f4" />
        <Outlines thickness={0.05} color={INK} />
      </mesh>
      {[1.3, 2.7, 4.1].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[2.0, 0.16, 2.0]} />
          <ToonMat color="#14a8a8" ramp={[0.55, 0.75, 1]} />
        </mesh>
      ))}
      <mesh position={[0, 0.75, 0.97]}>
        <boxGeometry args={[0.9, 1.4, 0.1]} />
        <meshToonMaterial color="#2a2340" />
      </mesh>
      <mesh position={[0, 1.55, 0.97]}>
        <boxGeometry args={[1.1, 0.16, 0.12]} />
        <ToonMat color="#ffc93c" ramp={[0.6, 0.8, 1]} />
      </mesh>
      <mesh position={[0, 3.4, 0.99]}>
        <planeGeometry args={[2.0, 1.0]} />
        <meshBasicMaterial map={sign} transparent />
      </mesh>
      <mesh position={[0, 5.15, 0]}>
        <boxGeometry args={[2.1, 0.22, 2.1]} />
        <ToonMat color="#14a8a8" />
        <Outlines thickness={0.045} color={INK} />
      </mesh>
      <mesh position={[0, 5.9, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 1.3, 6]} />
        <ToonMat color="#4a4363" ramp={[0.5, 0.7, 1]} />
      </mesh>
      <mesh ref={beam} position={[0, 6.65, 0]}>
        <sphereGeometry args={[0.16, 10, 8]} />
        <meshToonMaterial color="#ffc93c" />
      </mesh>
    </group>
  );
}

/* ---------------- antena (API externa) ---------------- */

function Antena(p: Sel) {
  const dishes = useRef<THREE.Group>(null!);
  const beam = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    const t = simTime();
    if (dishes.current) dishes.current.rotation.y = Math.sin(t * 0.4) * 0.7;
    if (beam.current) beam.current.scale.setScalar(1 + Math.sin(t * 4.2) * 0.22);
  });
  return (
    <group position={[13.4, 0, 5.7]} {...pick('antena', p.onSelect)}>
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[3.0, 0.14, 3.0]} />
        <ToonMat color="#e8c9a0" ramp={[0.6, 0.8, 1]} />
      </mesh>
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[2.6, 0.56, 2.6]} />
        <ToonMat color="#dfe6f2" />
        <Outlines thickness={0.045} color={INK} />
      </mesh>
      <mesh position={[0, 1.9, 0]}>
        <cylinderGeometry args={[0.11, 0.15, 2.7, 8]} />
        <ToonMat color="#4a4363" ramp={[0.5, 0.7, 1]} />
        <Outlines thickness={0.035} color={INK} />
      </mesh>
      <group ref={dishes} position={[0, 0, 0]}>
        <mesh position={[0.5, 2.4, 0]} rotation={[0, 0, -2.0]}>
          <coneGeometry args={[0.55, 0.6, 8, 1, true]} />
          <ToonMat color="#fff7ea" ramp={[0.6, 0.8, 1]} />
          <Outlines thickness={0.035} color={INK} />
        </mesh>
        <mesh position={[-0.45, 3.0, 0.25]} rotation={[0, 2.6, 2.0]}>
          <coneGeometry args={[0.45, 0.5, 8, 1, true]} />
          <ToonMat color="#fff7ea" ramp={[0.6, 0.8, 1]} />
          <Outlines thickness={0.035} color={INK} />
        </mesh>
      </group>
      <mesh ref={beam} position={[0, 3.45, 0]}>
        <octahedronGeometry args={[0.18, 0]} />
        <meshToonMaterial color="#ffc93c" />
      </mesh>
      <mesh position={[0.7, 0.75, 0.7]}>
        <boxGeometry args={[0.7, 0.5, 0.6]} />
        <ToonMat color="#b9c1d6" ramp={[0.55, 0.75, 1]} />
        <Outlines thickness={0.035} color={INK} />
      </mesh>
    </group>
  );
}

/* ---------------- mástil de eventos ---------------- */

function Mástil(p: Sel) {
  const orb = useRef<THREE.Mesh>(null!);
  const rings = useRef<THREE.Group>(null!);
  useFrame(() => {
    const t = simTime();
    if (orb.current) orb.current.rotation.y = t * 1.4;
    if (rings.current) {
      rings.current.children.forEach((c, i) => {
        const k = 1 + Math.sin(t * 2.2 + i * 1.6) * 0.12;
        c.scale.setScalar(k);
      });
    }
  });
  return (
    <group position={[4.8, 0, 6.1]} {...pick('bus', p.onSelect)}>
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[1.7, 0.14, 1.7]} />
        <ToonMat color="#e8c9a0" ramp={[0.6, 0.8, 1]} />
      </mesh>
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[1.1, 0.56, 1.1]} />
        <ToonMat color="#cdd3e3" />
        <Outlines thickness={0.04} color={INK} />
      </mesh>
      <mesh position={[0, 1.8, 0]}>
        <cylinderGeometry args={[0.08, 0.11, 2.4, 7]} />
        <ToonMat color="#4a4363" ramp={[0.5, 0.7, 1]} />
      </mesh>
      <group ref={rings} position={[0, 3.1, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.6, 0.045, 6, 22]} />
          <meshToonMaterial color="#ffc93c" />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.9, 0.04, 6, 26]} />
          <meshToonMaterial color="#fff7ea" />
        </mesh>
      </group>
      <mesh ref={orb} position={[0, 3.1, 0]}>
        <octahedronGeometry args={[0.34, 0]} />
        <ToonMat color="#ffc93c" ramp={[0.7, 0.88, 1]} />
        <Outlines thickness={0.04} color={INK} />
      </mesh>
    </group>
  );
}

/* ---------------- anillo de selección ---------------- */

function Anillo({ sitio }: { sitio: (typeof SITIOS)[number] }) {
  const m = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (!m.current) return;
    const k = 1 + Math.sin(clock.elapsedTime * 4) * 0.05;
    m.current.scale.setScalar(k);
  });
  // flota a la altura de los postes (0.6) para no quedar tapado por las barras de la valla
  return (
    <mesh ref={m} position={[sitio.at[0], 0.68, sitio.at[1]]} rotation={[-Math.PI / 2, 0, 0]}>
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
      <Taquilla {...p} />
      <Castillo {...p} />
      <Kiosco {...p} id="catalogo" color="#7ed957" />
      <Kiosco {...p} id="pedidos" color="#ffc93c" />
      <Kiosco {...p} id="envios" color="#ff4f9a" />
      <Bodega {...p} />
      <Correo {...p} />
      <Antena {...p} />
      <Mástil {...p} />

      {sel && <Anillo sitio={sel} />}
      {labels && SITIOS.map((s) => <Etiqueta key={s.id} sitio={s} onSelect={onSelect} />)}
    </group>
  );
}
