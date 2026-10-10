import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Billboard, Outlines } from '@react-three/drei';
import * as THREE from 'three';
import { INK, badgeTexture, signTexture, stripeTexture } from '../scene/toon';
import { ToonMat } from '../parque/park/Island';
import { SITIOS, type SitioId } from './layout';
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

/* ---------------- taquilla + arco de la petición ---------------- */

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
      <mesh position={[0, 1.05, 0.82]}>
        <boxGeometry args={[1.2, 0.62, 0.08]} />
        <meshToonMaterial color="#2a2340" />
      </mesh>
      <mesh position={[0, 0.68, 0.88]}>
        <boxGeometry args={[1.4, 0.1, 0.3]} />
        <ToonMat color="#d9a066" ramp={[0.6, 0.8, 1]} />
      </mesh>
      <mesh position={[0, 1.7, 0]}>
        <boxGeometry args={[2.5, 0.2, 1.9]} />
        <ToonMat color="#ff5a3c" />
        <Outlines thickness={0.045} color={INK} />
      </mesh>
      <mesh position={[0, 1.5, 1.18]} rotation={[-0.62, 0, 0]}>
        <planeGeometry args={[2.3, 0.85]} />
        <meshBasicMaterial map={stripes} side={THREE.DoubleSide} />
      </mesh>

      {/* arco: por aquí entra la petición al sistema */}
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
          <planeGeometry args={[2.5, 1.2]} />
          <meshBasicMaterial map={signTexture('PETICION', 'GET /pedidos')} side={THREE.DoubleSide} transparent />
        </mesh>
      </group>
    </group>
  );
}

/* ---------------- controlador: traduce y despacha ---------------- */

function Controlador(p: Sel) {
  const gear = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    if (gear.current) gear.current.rotation.y = simTime() * 2.4;
  });
  return (
    <group position={[-5.6, 0, -1.9]} {...pick('controlador', p.onSelect)}>
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[2.4, 0.14, 2.2]} />
        <ToonMat color="#e8c9a0" ramp={[0.6, 0.8, 1]} />
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <boxGeometry args={[1.9, 1.56, 1.7]} />
        <ToonMat color="#e6f4f4" />
        <Outlines thickness={0.045} color={INK} />
      </mesh>
      {/* ventanilla de despacho */}
      <mesh position={[0, 1.05, 0.87]}>
        <boxGeometry args={[1.1, 0.6, 0.08]} />
        <meshToonMaterial color="#2a2340" />
      </mesh>
      <mesh position={[0, 0.68, 0.93]}>
        <boxGeometry args={[1.3, 0.1, 0.3]} />
        <ToonMat color="#d9a066" ramp={[0.6, 0.8, 1]} />
      </mesh>
      {/* techo teal */}
      <mesh position={[0, 1.72, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[1.7, 1.05, 4]} />
        <ToonMat color="#14a8a8" />
        <Outlines thickness={0.045} color={INK} />
      </mesh>
      <mesh ref={gear} position={[0, 2.75, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.24, 0.08, 6, 10]} />
        <meshToonMaterial color="#ffc93c" />
        <Outlines thickness={0.03} color={INK} />
      </mesh>
      <mesh position={[0, 2.05, 0.95]}>
        <planeGeometry args={[2.0, 1.0]} />
        <meshBasicMaterial map={signTexture('CONTROLADOR', 'traduce y despacha')} transparent />
      </mesh>
    </group>
  );
}

/* ---------------- modelo: estado y reglas ---------------- */

function Modelo(p: Sel) {
  const sign = useMemo(() => signTexture('MODELO', 'estado y reglas'), []);
  const rueda = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    if (rueda.current) rueda.current.rotation.z = simTime() * 1.2;
  });
  return (
    <group position={[0.2, 0, -2.2]} {...pick('modelo', p.onSelect)}>
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[4.2, 0.14, 3.2]} />
        <ToonMat color="#e8c9a0" ramp={[0.6, 0.8, 1]} />
      </mesh>
      <mesh position={[0, 1.3, 0]}>
        <boxGeometry args={[3.6, 2.5, 2.8]} />
        <ToonMat color="#dfe6f2" />
        <Outlines thickness={0.05} color={INK} />
      </mesh>
      <mesh position={[0, 2.68, 0]}>
        <boxGeometry args={[3.9, 0.26, 3.05]} />
        <ToonMat color="#ffc93c" />
        <Outlines thickness={0.045} color={INK} />
      </mesh>
      {/* cajones de estado */}
      {[-0.85, 0.85].map((x) => (
        <mesh key={x} position={[x, 1.15, 1.44]}>
          <boxGeometry args={[1.2, 1.5, 0.08]} />
          <meshToonMaterial color="#c98a52" />
        </mesh>
      ))}
      <mesh position={[0, 2.9, 1.3]}>
        <planeGeometry args={[2.6, 1.3]} />
        <meshBasicMaterial map={sign} transparent />
      </mesh>
      {/* rueda de la lógica */}
      <mesh ref={rueda} position={[2.0, 2.2, 1.5]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.3, 0.1, 6, 12]} />
        <meshToonMaterial color="#ffc93c" />
        <Outlines thickness={0.035} color={INK} />
      </mesh>
    </group>
  );
}

/* ---------------- vista: escenario con pantalla ---------------- */

function Vista(p: Sel) {
  const pantalla = useMemo(
    () => signTexture('PEDIDOS', '3 · S/ 120 · listo'),
    [],
  );
  return (
    <group position={[6.4, 0, -2.0]} {...pick('vista', p.onSelect)}>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[3.6, 0.24, 2.6]} />
        <ToonMat color="#e8c9a0" ramp={[0.6, 0.8, 1]} />
      </mesh>
      {/* marco del escenario */}
      {[-1.55, 1.55].map((x) => (
        <mesh key={x} position={[x, 1.7, 0]}>
          <boxGeometry args={[0.3, 3.0, 0.3]} />
          <ToonMat color="#ff4f9a" />
          <Outlines thickness={0.04} color={INK} />
        </mesh>
      ))}
      <mesh position={[0, 3.35, 0]}>
        <boxGeometry args={[3.5, 0.36, 0.42]} />
        <ToonMat color="#ff4f9a" />
        <Outlines thickness={0.045} color={INK} />
      </mesh>
      {/* cortinas */}
      {[-1.3, 1.3].map((x) => (
        <mesh key={x} position={[x, 1.85, 0.1]}>
          <boxGeometry args={[0.42, 2.6, 0.16]} />
          <ToonMat color="#d63d84" ramp={[0.55, 0.75, 1]} />
        </mesh>
      ))}
      {/* pantalla: lo que la vista dibuja */}
      <mesh position={[0, 1.8, 0.12]}>
        <boxGeometry args={[2.4, 2.2, 0.1]} />
        <meshToonMaterial color="#2a2340" />
      </mesh>
      <mesh position={[0, 1.8, 0.19]}>
        <planeGeometry args={[2.15, 1.95]} />
        <meshBasicMaterial map={pantalla} transparent />
      </mesh>
    </group>
  );
}

/* ---------------- arco de salida (respuesta) ---------------- */

function ArcoSalida() {
  return (
    <group position={[15.2, 0, 3.0]}>
      {[-1.25, 1.25].map((z) => (
        <group key={z} position={[0, 0, z]}>
          <mesh position={[0, 1.2, 0]}>
            <boxGeometry args={[0.28, 2.4, 0.28]} />
            <ToonMat color="#fff7ea" />
            <Outlines thickness={0.04} color={INK} />
          </mesh>
          <mesh position={[0, 2.6, 0]}>
            <coneGeometry args={[0.26, 0.4, 6]} />
            <ToonMat color="#7ed957" ramp={[0.55, 0.75, 1]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 2.5, 0]}>
        <boxGeometry args={[0.36, 0.36, 3.0]} />
        <ToonMat color="#7ed957" />
        <Outlines thickness={0.04} color={INK} />
      </mesh>
      <mesh position={[-0.22, 3.3, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[2.4, 1.15]} />
        <meshBasicMaterial map={signTexture('RESPUESTA', 'la vista responde al cliente')} side={THREE.DoubleSide} transparent />
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
      <Controlador {...p} />
      <Modelo {...p} />
      <Vista {...p} />
      <ArcoSalida />

      {sel && <Anillo sitio={sel} />}
      {labels && SITIOS.map((s) => <Etiqueta key={s.id} sitio={s} onSelect={onSelect} />)}
    </group>
  );
}
