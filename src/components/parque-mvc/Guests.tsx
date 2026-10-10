import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Outlines } from '@react-three/drei';
import * as THREE from 'three';
import { INK, shadowTexture } from '../scene/toon';
import { ToonMat } from '../parque/park/Island';
import { simTime } from '../parque/park/simClock';
import { PARADAS, RUTA, type Vec2 } from './layout';

/** Invitado del parque MVC: una petición caminando por el flujo web completo
 *  petición → controlador → modelo → controlador (resultado) → vista → respuesta.
 *  El controlador se visita dos veces (es el hub). */

type Fase = 'ruta' | 'dwell' | 'die';

type Invitado = {
  activo: boolean;
  fase: Fase;
  seg: number;
  t: number;
  dist: number;
  espera: number;
  parada: number; // 0=controlador 1=modelo 2=vista
  x: number;
  z: number;
  ang: number;
  esc: number;
};

const CAMISA = ['#ff5a3c', '#14a8a8', '#ff4f9a', '#ffc93c', '#7ed957', '#2f9fe0', '#8f6bd8'];
const PIEL = ['#ffd9b0', '#f2b98c', '#c98a52', '#8a5a34'];
const VELOCIDAD = 2.4;
const SPAWN_CADA = 1.7;
const MAX = 12;
const ESPERA = 1.6;

function longitud(a: Vec2, b: Vec2) {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
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
  const cajasResultado = useRef<(THREE.Mesh | null)[]>([]);
  const cajasRespuesta = useRef<(THREE.Mesh | null)[]>([]);
  const engranajes = useRef<(THREE.Mesh | null)[]>([]);
  const destellos = useRef<(THREE.Mesh | null)[]>([]);

  const invitados = useMemo<Invitado[]>(
    () =>
      Array.from({ length: MAX }, () => ({
        activo: false,
        fase: 'ruta' as Fase,
        seg: 0,
        t: 0,
        dist: 0,
        espera: 0,
        parada: 0,
        x: 0,
        z: 0,
        ang: 0,
        esc: 0,
      })),
    [],
  );
  const plantilla = useMemo(
    () =>
      Array.from({ length: MAX }, (_, i) => ({
        camisa: CAMISA[i % CAMISA.length],
        piel: PIEL[(i * 3 + 1) % PIEL.length],
      })),
    [],
  );

  const reloj = useRef({ spawn: 0.3 });

  useEffect(() => {
    reloj.current = { spawn: 0.3 };
    invitados.forEach((g) => {
      g.activo = false;
      g.esc = 0;
    });
  }, [resetTick, invitados]);

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
          g.fase = 'ruta';
          g.seg = 0;
          g.t = 0;
          g.dist = 0;
          g.espera = 0;
          g.parada = 0;
          g.esc = 0;
          g.x = RUTA[0][0];
          g.z = RUTA[0][1];
          g.ang = Math.PI / 2;
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

      if (g.fase === 'ruta') {
        const a = RUTA[g.seg];
        const b = RUTA[g.seg + 1];
        if (b) {
          const L = longitud(a, b);
          g.t += (sdt * VELOCIDAD) / L;
          g.dist += sdt * VELOCIDAD;
          while (g.t >= 1) {
            g.t -= 1;
            g.seg += 1;
            // ¿llegó a una parada (controlador / modelo / vista)?
            if (g.parada < PARADAS.length && g.seg === PARADAS[g.parada]) {
              g.fase = 'dwell';
              g.espera = ESPERA;
              g.t = 0;
              // mira al edificio de enfrente (norte)
              g.ang = Math.PI;
              break;
            }
            if (g.seg >= RUTA.length - 1) break;
          }
          if (g.fase === 'ruta') {
            const a2 = RUTA[g.seg];
            const b2 = RUTA[Math.min(g.seg + 1, RUTA.length - 1)];
            const dx = b2[0] - a2[0];
            const dz = b2[1] - a2[1];
            g.x = a2[0] + dx * g.t;
            g.z = a2[1] + dz * g.t;
            if (dx || dz) g.ang = Math.atan2(dx, dz);

            if (g.seg >= RUTA.length - 1) {
              g.fase = 'die';
              g.espera = 0.45;
            }
          }
        } else {
          g.fase = 'die';
          g.espera = 0.45;
        }
      } else if (g.fase === 'dwell') {
        g.espera -= sdt;
        if (g.espera <= 0) {
          g.parada += 1;
          g.fase = 'ruta';
        }
      } else {
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
      if (caja) caja.visible = g.parada === 0; // petición en mano (hasta el controlador)
      const cajaR = cajasResultado.current[i];
      if (cajaR) cajaR.visible = g.parada === 2; // resultado del modelo, de vuelta al controlador
      const cajaResp = cajasRespuesta.current[i];
      if (cajaResp) cajaResp.visible = g.parada === 4; // respuesta que sale hacia el cliente
      const eng = engranajes.current[i];
      if (eng) {
        eng.visible = g.fase === 'dwell' && g.parada === 1; // el modelo hace su lógica
        if (eng.visible) eng.rotation.y = now * 5;
      }
      const dest = destellos.current[i];
      if (dest) {
        dest.visible = g.fase === 'dwell' && g.parada === 3; // la vista renderiza
        if (dest.visible) {
          const k = 1 + Math.sin(now * 7) * 0.18;
          dest.scale.setScalar(k);
        }
      }
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
          {/* cajita roja = la petición */}
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
          {/* cajita ámbar = el resultado del modelo, de regreso al controlador */}
          <mesh
            ref={(el) => {
              cajasResultado.current[i] = el;
            }}
            position={[-0.26, 0.4, 0.12]}
            visible={false}
          >
            <boxGeometry args={[0.22, 0.2, 0.26]} />
            <ToonMat color="#ffc93c" ramp={[0.55, 0.75, 1]} />
            <Outlines thickness={0.03} color={INK} />
          </mesh>
          {/* cajita verde = la respuesta que sale hacia el cliente */}
          <mesh
            ref={(el) => {
              cajasRespuesta.current[i] = el;
            }}
            position={[0.26, 0.4, 0.12]}
            visible={false}
          >
            <boxGeometry args={[0.22, 0.2, 0.26]} />
            <ToonMat color="#7ed957" ramp={[0.55, 0.75, 1]} />
            <Outlines thickness={0.03} color={INK} />
          </mesh>
          {/* engranaje = lógica del modelo */}
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
          {/* destello = la vista renderiza */}
          <mesh
            ref={(el) => {
              destellos.current[i] = el;
            }}
            position={[0, 1.28, 0]}
            visible={false}
          >
            <octahedronGeometry args={[0.18, 0]} />
            <meshToonMaterial color="#ff4f9a" />
            <Outlines thickness={0.03} color={INK} />
          </mesh>
        </group>
      ))}

    </group>
  );
}
