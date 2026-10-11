import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Billboard, Outlines } from '@react-three/drei';
import * as THREE from 'three';
import { INK, badgeTexture, signTexture } from '../scene/toon';
import { ToonMat } from '../parque/park/Island';
import { CABLES, PLOTS_VARIOS, PLOT_UNICO, SITIOS, type Despliegue, type SitioId, type Vec2 } from './layout';
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

/* ---------------- presentación: mostrador con pantalla ---------------- */

function Presentacion(p: Sel) {
  const pantalla = useMemo(() => signTexture('PEDIDOS', '3 listos · S/ 120'), []);
  return (
    <group position={[-11, 0, -3.2]} {...pick('presentacion', p.onSelect)}>
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[4.0, 0.14, 3.0]} />
        <ToonMat color="#e8c9a0" ramp={[0.6, 0.8, 1]} />
      </mesh>
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[3.5, 2.9, 2.6]} />
        <ToonMat color="#ffe4f0" />
        <Outlines thickness={0.05} color={INK} />
      </mesh>
      {/* mostrador / ventanilla */}
      <mesh position={[0, 1.0, 1.35]}>
        <boxGeometry args={[2.4, 1.1, 0.1]} />
        <meshToonMaterial color="#2a2340" />
      </mesh>
      <mesh position={[0, 0.62, 1.5]}>
        <boxGeometry args={[3.0, 0.12, 0.5]} />
        <ToonMat color="#d9a066" ramp={[0.6, 0.8, 1]} />
      </mesh>
      {/* techo fucsia */}
      <mesh position={[0, 3.1, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[2.9, 1.1, 4]} />
        <ToonMat color="#ff4f9a" />
        <Outlines thickness={0.05} color={INK} />
      </mesh>
      {/* pantalla con la respuesta */}
      <mesh position={[0, 2.0, -1.34]}>
        <boxGeometry args={[2.6, 1.9, 0.1]} />
        <meshToonMaterial color="#2a2340" />
      </mesh>
      <mesh position={[0, 2.0, -1.42]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[2.35, 1.65]} />
        <meshBasicMaterial map={pantalla} transparent />
      </mesh>
      <mesh position={[0, 4.3, 1.4]}>
        <planeGeometry args={[3.0, 1.4]} />
        <meshBasicMaterial map={signTexture('PRESENTACION', 'capa de interfaz')} transparent />
      </mesh>
    </group>
  );
}

/* ---------------- negocio: oficina con engranajes ---------------- */

function Negocio(p: Sel) {
  const g1 = useRef<THREE.Mesh>(null!);
  const g2 = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    const t = simTime();
    if (g1.current) g1.current.rotation.z = t * 1.6;
    if (g2.current) g2.current.rotation.z = -t * 1.6;
  });
  return (
    <group position={[0, 0, -3.4]} {...pick('negocio', p.onSelect)}>
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[4.2, 0.14, 3.2]} />
        <ToonMat color="#e8c9a0" ramp={[0.6, 0.8, 1]} />
      </mesh>
      <mesh position={[0, 1.75, 0]}>
        <boxGeometry args={[3.7, 3.4, 2.8]} />
        <ToonMat color="#fff4d6" />
        <Outlines thickness={0.05} color={INK} />
      </mesh>
      {/* ventanas de oficina */}
      {[-1.0, 1.0].map((x) => (
        <mesh key={x} position={[x, 2.3, 1.42]}>
          <boxGeometry args={[1.1, 1.0, 0.08]} />
          <meshToonMaterial color="#2a2340" />
        </mesh>
      ))}
      {/* techo amarillo */}
      <mesh position={[0, 3.7, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[3.0, 1.2, 4]} />
        <ToonMat color="#ffc93c" />
        <Outlines thickness={0.05} color={INK} />
      </mesh>
      {/* engranajes girando = la lógica del dominio */}
      <mesh ref={g1} position={[-0.5, 1.6, 1.55]}>
        <torusGeometry args={[0.42, 0.14, 6, 12]} />
        <meshToonMaterial color="#ffc93c" />
        <Outlines thickness={0.035} color={INK} />
      </mesh>
      <mesh ref={g2} position={[0.55, 1.6, 1.55]}>
        <torusGeometry args={[0.32, 0.11, 6, 10]} />
        <meshToonMaterial color="#ff5a3c" />
        <Outlines thickness={0.035} color={INK} />
      </mesh>
      <mesh position={[0, 4.7, 1.5]}>
        <planeGeometry args={[2.8, 1.3]} />
        <meshBasicMaterial map={signTexture('NEGOCIO', 'reglas del dominio')} transparent />
      </mesh>
    </group>
  );
}

/* ---------------- datos: archivo con cajones y base de datos ---------------- */

function Datos(p: Sel) {
  const cilindro = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    if (cilindro.current) cilindro.current.rotation.y = simTime() * 0.8;
  });
  return (
    <group position={[11, 0, -3.2]} {...pick('datos', p.onSelect)}>
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[4.0, 0.14, 3.0]} />
        <ToonMat color="#e8c9a0" ramp={[0.6, 0.8, 1]} />
      </mesh>
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[3.5, 2.9, 2.6]} />
        <ToonMat color="#dff4f4" />
        <Outlines thickness={0.05} color={INK} />
      </mesh>
      {/* cajones del archivo */}
      {[0.55, 1.35, 2.15].map((y) => (
        <mesh key={y} position={[0, y, 1.35]}>
          <boxGeometry args={[2.6, 0.62, 0.08]} />
          <meshToonMaterial color="#c98a52" />
        </mesh>
      ))}
      {/* cilindro de la base de datos */}
      <mesh ref={cilindro} position={[0, 3.55, 0]}>
        <cylinderGeometry args={[1.0, 1.0, 0.5, 16]} />
        <ToonMat color="#14a8a8" />
        <Outlines thickness={0.045} color={INK} />
      </mesh>
      <mesh position={[0, 3.9, 0]}>
        <cylinderGeometry args={[0.85, 0.85, 0.28, 16]} />
        <ToonMat color="#0f8a8a" ramp={[0.55, 0.75, 1]} />
      </mesh>
      {/* techo teal */}
      <mesh position={[0, 3.1, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[2.9, 1.1, 4]} />
        <ToonMat color="#14a8a8" />
        <Outlines thickness={0.05} color={INK} />
      </mesh>
      <mesh position={[0, 4.3, 1.4]}>
        <planeGeometry args={[2.6, 1.3]} />
        <meshBasicMaterial map={signTexture('DATOS', 'persistencia')} transparent />
      </mesh>
    </group>
  );
}

/* ---------------- recuadros de despliegue (fronteras de nivel) -------- */

/** Dibuja un perímetro discontinuo que marca una frontera física de proceso. */
function Plot({
  rect,
  color,
  dashed,
}: {
  rect: [Vec2, Vec2];
  color: string;
  dashed?: boolean;
}) {
  const [a, b] = rect;
  const cx = (a[0] + b[0]) / 2;
  const cz = (a[1] + b[1]) / 2;
  const w = Math.abs(b[0] - a[0]);
  const d = Math.abs(b[1] - a[1]);
  const y = 0.05;
  const posts = useMemo(() => {
    const out: [number, number][] = [];
    // perimetro: caminar los 4 bordes con posts distribuidos
    const per = 2 * (w + d);
    const n = Math.round(per / 1.6);
    for (let i = 0; i < n; i++) {
      let t = (i / n) * per;
      let x: number;
      let z: number;
      const left = a[0];
      const right = b[0];
      const top = a[1];
      const bot = b[1];
      const wSeg = w;
      const dSeg = d;
      if (t < wSeg) {
        x = left + t;
        z = top;
      } else if (t < wSeg + dSeg) {
        x = right;
        z = top + (t - wSeg);
      } else if (t < 2 * wSeg + dSeg) {
        x = right - (t - wSeg - dSeg);
        z = bot;
      } else {
        x = left;
        z = bot - (t - 2 * wSeg - dSeg);
      }
      out.push([x, z]);
    }
    return out;
  }, [w, d, a, b]);
  return (
    <group>
      {/* base semitransparente del recuadro */}
      <mesh position={[cx, 0.02, cz]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial color={color} transparent opacity={0.06} depthWrite={false} />
      </mesh>
      {posts.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.22, z]}>
          <boxGeometry args={[0.12, dashed ? 0.5 : 0.42, 0.12]} />
          <ToonMat color={color} ramp={[0.55, 0.78, 1]} />
        </mesh>
      ))}
      {/* barra continua del contorno */}
      {[
        [cx, a[1]],
        [cx, b[1]],
      ].map(([x, z], i) => (
        <mesh key={`h${i}`} position={[x, y, z]}>
          <boxGeometry args={[w, 0.05, 0.05]} />
          <ToonMat color={color} ramp={[0.6, 0.8, 1]} />
        </mesh>
      ))}
      {[
        [a[0], cz],
        [b[0], cz],
      ].map(([x, z], i) => (
        <mesh key={`v${i}`} position={[x, y, z]}>
          <boxGeometry args={[0.05, 0.05, d]} />
          <ToonMat color={color} ramp={[0.6, 0.8, 1]} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------------- cables de red con paquetes viajando ---------------- */

function Cable({ a, b }: { a: Vec2; b: Vec2 }) {
  const packets = useRef<THREE.Mesh[]>([]);
  const mid: [number, number, number] = [(a[0] + b[0]) / 2, 3.2, (a[1] + b[1]) / 2];
  const start: [number, number, number] = [a[0], 1.6, a[1]];
  const end: [number, number, number] = [b[0], 1.6, b[1]];
  // curva cuadrática de Bézier
  const curve = useMemo(() => {
    const p0 = new THREE.Vector3(...start);
    const p1 = new THREE.Vector3(...mid);
    const p2 = new THREE.Vector3(...end);
    return new THREE.QuadraticBezierCurve3(p0, p1, p2);
  }, [a[0], a[1], b[0], b[1]]);
  const cableGeo = useMemo(() => new THREE.TubeGeometry(curve, 24, 0.06, 6, false), [curve]);
  const N = 4;
  useFrame(() => {
    const t = simTime();
    for (let i = 0; i < N; i++) {
      const m = packets.current[i];
      if (!m) continue;
      const u = ((t * 0.35 + i / N) % 1 + 1) % 1;
      const pt = curve.getPoint(u);
      m.position.copy(pt);
    }
  });
  return (
    <group>
      <mesh geometry={cableGeo}>
        <meshToonMaterial color="#8f6bd8" />
        <Outlines thickness={0.03} color={INK} />
      </mesh>
      {Array.from({ length: N }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) packets.current[i] = el;
          }}
        >
          <boxGeometry args={[0.22, 0.22, 0.22]} />
          <meshToonMaterial color="#ff5a3c" />
          <Outlines thickness={0.03} color={INK} />
        </mesh>
      ))}
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
        <planeGeometry args={[3.6, 3.6 * (200 / 512)]} />
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
  despliegue,
}: {
  selected: SitioId | null;
  onSelect: (id: SitioId) => void;
  labels: boolean;
  despliegue: Despliegue;
}) {
  const sel = SITIOS.find((s) => s.id === selected) ?? null;
  const p = { selected, onSelect };
  const varios = despliegue === 'varios';
  return (
    <group>
      <Presentacion {...p} />
      <Negocio {...p} />
      <Datos {...p} />

      {/* fronteras de nivel: un recuadro (monolito) o tres (distribuido) */}
      {!varios && <Plot rect={PLOT_UNICO} color="#ff5a3c" />}
      {varios &&
        PLOTS_VARIOS.map((r, i) => <Plot key={i} rect={r} color="#8f6bd8" dashed />)}

      {/* cables de red: solo cuando cada capa corre en su propio proceso */}
      {varios && CABLES.map(([a, b], i) => <Cable key={i} a={a} b={b} />)}

      {sel && <Anillo sitio={sel} />}
      {labels && SITIOS.map((s) => <Etiqueta key={s.id} sitio={s} onSelect={onSelect} />)}
    </group>
  );
}
