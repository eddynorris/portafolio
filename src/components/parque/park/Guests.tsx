import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Outlines } from '@react-three/drei';
import * as THREE from 'three';
import { INK, shadowTexture } from '../../scene/toon';
import { ENTRADA_PATH, ORBE, SALIDAS, salidaPath, type Vec2 } from './layout';
import { ToonMat } from './Island';
import { simTime } from './simClock';

type Fase = 'in' | 'dwell' | 'out' | 'die';

type Invitado = {
  activo: boolean;
  fase: Fase;
  path: Vec2[];
  seg: number;
  t: number;
  dist: number;
  espera: number;
  x: number;
  z: number;
  ang: number;
  esc: number;
  sal: keyof typeof SALIDAS;
};

type Orbe = { activo: boolean; u: number };

const CAMISA = ['#ff5a3c', '#14a8a8', '#ff4f9a', '#ffc93c', '#7ed957', '#2f9fe0', '#8f6bd8'];
const PIEL = ['#ffd9b0', '#f2b98c', '#c98a52', '#8a5a34'];
const VELOCIDAD = 2.3;
const SPAWN_CADA = 1.2;
const MAX = 22;

function longitud(a: Vec2, b: Vec2) {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function elegirSalida(): keyof typeof SALIDAS {
  const r = Math.random();
  return r < 0.4 ? 'db' : r < 0.7 ? 'correo' : 'api';
}

export function Flow({
  playing,
  speed,
  resetTick,
}: {
  playing: boolean;
  speed: number;
  resetTick: number;
}) {
  const grupos = useRef<(THREE.Group | null)[]>([]);
  const cajas = useRef<(THREE.Mesh | null)[]>([]);
  const engranajes = useRef<(THREE.Mesh | null)[]>([]);
  const orbes = useRef<(THREE.Group | null)[]>([]);

  const invitados = useMemo<Invitado[]>(
    () =>
      Array.from({ length: MAX }, () => ({
        activo: false,
        fase: 'in' as Fase,
        path: ENTRADA_PATH,
        seg: 0,
        t: 0,
        dist: 0,
        espera: 0,
        x: 0,
        z: 0,
        ang: 0,
        esc: 0,
        sal: 'db' as keyof typeof SALIDAS,
      })),
    [],
  );
  const orbesEstado = useMemo<Orbe[]>(() => Array.from({ length: 4 }, () => ({ activo: false, u: 0 })), []);
  const plantilla = useMemo(
    () =>
      Array.from({ length: MAX }, (_, i) => ({
        camisa: CAMISA[i % CAMISA.length],
        piel: PIEL[(i * 3 + 1) % PIEL.length],
      })),
    [],
  );

  const reloj = useRef({ spawn: 0.4, pendientes: 0 });

  useEffect(() => {
    reloj.current = { spawn: 0.4, pendientes: 0 };
    invitados.forEach((g) => {
      g.activo = false;
      g.esc = 0;
    });
    orbesEstado.forEach((o) => {
      o.activo = false;
      o.u = 0;
    });
  }, [resetTick, invitados, orbesEstado]);

  const bezier = (u: number) => {
    const k = 1 - u;
    return [
      k * k * ORBE.desde[0] + 2 * k * u * ORBE.ctrl[0] + u * u * ORBE.hasta[0],
      k * k * ORBE.desde[1] + 2 * k * u * ORBE.ctrl[1] + u * u * ORBE.hasta[1],
      k * k * ORBE.desde[2] + 2 * k * u * ORBE.ctrl[2] + u * u * ORBE.hasta[2],
    ] as [number, number, number];
  };

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const sdt = playing ? dt * speed : 0;
    const now = simTime();

    /* ---- apariciones ---- */
    if (sdt > 0) {
      reloj.current.spawn -= sdt;
      if (reloj.current.spawn <= 0) {
        reloj.current.spawn += SPAWN_CADA;
        const g = invitados.find((v) => !v.activo);
        if (g) {
          g.activo = true;
          g.fase = 'in';
          g.path = ENTRADA_PATH;
          g.seg = 0;
          g.t = 0;
          g.dist = 0;
          g.espera = 0;
          g.esc = 0;
          g.x = ENTRADA_PATH[0][0];
          g.z = ENTRADA_PATH[0][1];
          g.ang = Math.PI / 2;
          g.sal = elegirSalida();
        }
      }
    }

    /* ---- invitados ---- */
    for (let i = 0; i < invitados.length; i++) {
      const g = invitados[i];
      const grp = grupos.current[i];
      if (!grp) continue;

      if (!g.activo) {
        grp.visible = false;
        continue;
      }

      if (g.esc < 1 && g.fase !== 'die') g.esc = Math.min(1, g.esc + sdt * 3);

      if (g.fase !== 'die' && g.fase !== 'dwell') {
        const a = g.path[g.seg];
        const b = g.path[g.seg + 1];
        if (b) {
          const L = longitud(a, b);
          g.t += (sdt * VELOCIDAD) / L;
          g.dist += sdt * VELOCIDAD;
          while (g.t >= 1) {
            g.t -= 1;
            g.seg += 1;
            if (g.seg >= g.path.length - 1) break;
          }
          const a2 = g.path[g.seg];
          const b2 = g.path[Math.min(g.seg + 1, g.path.length - 1)];
          const dx = b2[0] - a2[0];
          const dz = b2[1] - a2[1];
          g.x = a2[0] + dx * g.t;
          g.z = a2[1] + dz * g.t;
          if (dx || dz) g.ang = Math.atan2(dx, dz);

          if (g.seg >= g.path.length - 1) {
            if (g.fase === 'in') {
              g.fase = 'dwell';
              g.espera = 1.7;
              g.ang = Math.PI; // mira al castillo
              // el caso de uso terminó: se consume el "comando"…
              if (Math.random() < 0.45 && reloj.current.pendientes < 4) {
                reloj.current.pendientes += 1;
              }
            } else {
              g.fase = 'die';
              g.espera = 0.45;
            }
          }
        }
      } else if (g.fase === 'dwell') {
        g.espera -= sdt;
        if (g.espera <= 0) {
          g.fase = 'out';
          g.path = salidaPath(g.sal);
          g.seg = 0;
          g.t = 0;
        }
      } else if (g.fase === 'die') {
        g.espera -= sdt;
        g.esc = Math.max(0, g.espera / 0.45);
        if (g.espera <= 0) g.activo = false;
      }

      const paso = Math.sin(g.dist * 9) * 0.05;
      grp.visible = true;
      grp.position.set(g.x, Math.abs(paso) * 0.6, g.z);
      grp.rotation.y = g.ang;
      grp.rotation.z = g.fase === 'dwell' ? 0 : Math.sin(g.dist * 9) * 0.06;
      grp.scale.setScalar(0.82 * g.esc);

      const caja = cajas.current[i];
      if (caja) caja.visible = g.fase === 'in';
      const eng = engranajes.current[i];
      if (eng) {
        eng.visible = g.fase === 'dwell';
        if (eng.visible) eng.rotation.y = now * 5;
      }
    }

    /* ---- eventos de dominio ---- */
    if (sdt > 0 && reloj.current.pendientes > 0) {
      const o = orbesEstado.find((v) => !v.activo);
      if (o) {
        o.activo = true;
        o.u = 0;
        reloj.current.pendientes -= 1;
      } else {
        reloj.current.pendientes = 0;
      }
    }

    for (let i = 0; i < orbesEstado.length; i++) {
      const o = orbesEstado[i];
      const grp = orbes.current[i];
      if (!grp) continue;
      if (!o.activo) {
        grp.visible = false;
        continue;
      }
      o.u += sdt / 3.4;
      if (o.u >= 1) {
        o.activo = false;
        grp.visible = false;
        continue;
      }
      const [x, y, z] = bezier(o.u);
      const inSc = Math.min(1, o.u * 8);
      const outSc = Math.min(1, (1 - o.u) * 6);
      grp.visible = true;
      grp.position.set(x, y + Math.sin(now * 3 + i) * 0.12, z);
      grp.rotation.y = now * 2;
      grp.scale.setScalar(Math.min(inSc, outSc));
    }
  });

  return (
    <group>
      {plantilla.map((p, i) => (
        <group
          key={i}
          ref={(el) => {
            grupos.current[i] = el;
          }}
          visible={false}
        >
          <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.72, 0.72]} />
            <meshBasicMaterial map={shadowTexture()} transparent depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.42, 0]}>
            <capsuleGeometry args={[0.16, 0.28, 4, 10]} />
            <ToonMat color={p.camisa} ramp={[0.5, 0.72, 1]} />
          </mesh>
          <mesh position={[0, 0.8, 0]}>
            <sphereGeometry args={[0.17, 12, 10]} />
            <ToonMat color={p.piel} ramp={[0.55, 0.75, 1]} />
          </mesh>
          <mesh position={[0, 0.9, -0.02]}>
            <sphereGeometry args={[0.15, 10, 8]} />
            <ToonMat color="#2a2340" ramp={[0.5, 0.7, 1]} />
          </mesh>
          <mesh
            ref={(el) => {
              cajas.current[i] = el;
            }}
            position={[0.26, 0.4, 0.12]}
          >
            <boxGeometry args={[0.22, 0.2, 0.26]} />
            <ToonMat color="#ff5a3c" ramp={[0.55, 0.75, 1]} />
            <Outlines thickness={0.03} color={INK} />
          </mesh>
          <mesh
            ref={(el) => {
              engranajes.current[i] = el;
            }}
            position={[0, 1.28, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            visible={false}
          >
            <torusGeometry args={[0.17, 0.06, 5, 10]} />
            <meshToonMaterial color="#ffc93c" />
          </mesh>
        </group>
      ))}

      {orbesEstado.map((_, i) => (
        <group
          key={i}
          ref={(el) => {
            orbes.current[i] = el;
          }}
          visible={false}
        >
          <mesh>
            <octahedronGeometry args={[0.3, 0]} />
            <ToonMat color="#ffc93c" ramp={[0.7, 0.88, 1]} />
            <Outlines thickness={0.035} color={INK} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
