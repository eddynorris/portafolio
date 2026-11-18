import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Outlines } from '@react-three/drei';
import * as THREE from 'three';
import { INK, badgeTexture, shadowTexture } from '../scene/toon';
import { ESTACIONES, PASOS, type Vec2 } from './layout';
import { ToonMat } from '../parque/park/Island';
import { simTime } from '../parque/park/simClock';

/* ---------------- utilidades de recorrido ---------------- */

const N = PASOS.length;

const CAMISA = ['#ff5a3c', '#14a8a8', '#ff4f9a', '#ffc93c', '#7ed957', '#2f9fe0', '#8f6bd8'];
const PIEL = ['#ffd9b0', '#f2b98c', '#c98a52', '#8a5a34'];

/** Duración de cada paso en segundos (a velocidad ×1). */
const DUR = [3.4, 4.4, 4.6, 8.0, 5.6, 11.0];

const RUTA_CLIENTE: Vec2[] = [ESTACIONES.inicio, ESTACIONES.espera];
const RUTA_PASAR: Vec2[] = [
  ESTACIONES.espera,
  ESTACIONES.torno,
  ESTACIONES.puente,
  ESTACIONES.plaza,
];
const RUTA_GUARDIA: Vec2[] = [ESTACIONES.plaza, [-1.5, 0.65], ESTACIONES.guardiaPuerta];
const RUTA_ESTADO: Vec2[] = [
  ESTACIONES.plaza,
  [4.6, 0.8],
  [5.6, -1.4],
  ESTACIONES.salaPuerta,
  [5.6, -1.4],
  [4.6, 0.8],
  ESTACIONES.cofrePuerta,
];
const RUTA_REGISTRO: Vec2[] = [ESTACIONES.plaza, [2.2, -1.6], ESTACIONES.registroPuerta];
const RUTA_COMMIT: Vec2[] = [
  ESTACIONES.plaza,
  [8.0, 0.8],
  [9.2, 0.8],
  [11.2, 0.8],
  [12.6, -1.5],
  ESTACIONES.bodegaPuerta,
];
const RUTA_SUSCRIPTOR: Vec2[] = [ESTACIONES.subRest, ESTACIONES.correoPuerta];
const RUTA_PASEO: Vec2[] = [ESTACIONES.inicio, [-8.2, 2.4]];

/** Formas que adopta el paquete al cruzar cada frontera. */
const FORMAS = ['comando', 'agregado', 'linea', 'dinero', 'evento', 'commit'];
const ROTULOS = ['CrearLínea', 'Pedido', 'Línea', 'Dinero', 'Evento', 'Commit'];

function largoRuta(path: Vec2[]) {
  let s = 0;
  for (let i = 0; i < path.length - 1; i++)
    s += Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]);
  return s;
}

function puntoEnRuta(path: Vec2[], dist: number) {
  let restante = Math.max(0, dist);
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i];
    const [bx, bz] = path[i + 1];
    const L = Math.hypot(bx - ax, bz - az);
    if (restante <= L || i === path.length - 2) {
      const t = L === 0 ? 0 : Math.min(1, restante / L);
      return {
        x: ax + (bx - ax) * t,
        z: az + (bz - az) * t,
        ang: L === 0 ? 0 : Math.atan2(bx - ax, bz - az),
      };
    }
    restante -= L;
  }
  return { x: path[0][0], z: path[0][1], ang: 0 };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** rampa lineal de 0 a 1 entre a y b */
const rampa = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));

/* ---------------- piezas ---------------- */

function Persona({
  camisa,
  piel,
  gorra,
}: {
  camisa: string;
  piel: string;
  gorra?: string;
}) {
  return (
    <group>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.72, 0.72]} />
        <meshBasicMaterial map={shadowTexture()} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <capsuleGeometry args={[0.16, 0.28, 4, 10]} />
        <ToonMat color={camisa} ramp={[0.5, 0.72, 1]} />
      </mesh>
      <mesh position={[0, 0.8, 0]}>
        <sphereGeometry args={[0.17, 12, 10]} />
        <ToonMat color={piel} ramp={[0.55, 0.75, 1]} />
      </mesh>
      <mesh position={[0, 0.9, -0.02]}>
        <sphereGeometry args={[0.15, 10, 8]} />
        <ToonMat color="#2a2340" ramp={[0.5, 0.7, 1]} />
      </mesh>
      {gorra && (
        <mesh position={[0, 1.0, 0]}>
          <cylinderGeometry args={[0.21, 0.21, 0.1, 10]} />
          <ToonMat color={gorra} ramp={[0.6, 0.8, 1]} />
          <Outlines thickness={0.03} color={INK} />
        </mesh>
      )}
    </group>
  );
}

function Paquetes({
  refs,
}: {
  refs: React.MutableRefObject<(THREE.Group | null)[]>;
}) {
  const formas: { n: string; jsx: React.ReactNode }[] = [
    {
      n: 'comando',
      jsx: (
        <mesh>
          <boxGeometry args={[0.5, 0.46, 0.54]} />
          <ToonMat color="#ff5a3c" ramp={[0.55, 0.75, 1]} />
          <Outlines thickness={0.04} color={INK} />
        </mesh>
      ),
    },
    {
      n: 'agregado',
      jsx: (
        <mesh>
          <boxGeometry args={[0.6, 0.56, 0.6]} />
          <ToonMat color="#8f6bd8" ramp={[0.55, 0.75, 1]} />
          <Outlines thickness={0.045} color={INK} />
        </mesh>
      ),
    },
    {
      n: 'linea',
      jsx: (
        <mesh>
          <boxGeometry args={[0.58, 0.16, 0.46]} />
          <ToonMat color="#2f9fe0" ramp={[0.6, 0.8, 1]} />
          <Outlines thickness={0.035} color={INK} />
        </mesh>
      ),
    },
    {
      n: 'dinero',
      jsx: (
        <group>
          {[0, 0.11, 0.22].map((y) => (
            <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.24, 0.24, 0.09, 12]} />
              <meshToonMaterial color="#ffc93c" />
            </mesh>
          ))}
        </group>
      ),
    },
    {
      n: 'evento',
      jsx: (
        <mesh>
          <octahedronGeometry args={[0.3, 0]} />
          <ToonMat color="#ffc93c" ramp={[0.6, 0.82, 1]} />
          <Outlines thickness={0.04} color={INK} />
        </mesh>
      ),
    },
    {
      n: 'commit',
      jsx: (
        <group>
          <mesh>
            <boxGeometry args={[0.58, 0.5, 0.58]} />
            <ToonMat color="#14a8a8" ramp={[0.55, 0.75, 1]} />
            <Outlines thickness={0.04} color={INK} />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.62, 0.1, 0.62]} />
            <meshToonMaterial color="#fff7ea" />
          </mesh>
        </group>
      ),
    },
  ];
  return (
    <group>
      {formas.map((f, i) => (
        <group
          key={f.n}
          name={f.n}
          visible={i === 0}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          {f.jsx}
        </group>
      ))}
    </group>
  );
}

function setForma(
  refs: React.MutableRefObject<(THREE.Group | null)[]>,
  n: string,
  tag?: THREE.Mesh | null,
  etiquetas?: THREE.Texture[],
) {
  const i = FORMAS.indexOf(n);
  refs.current.forEach((g, j) => {
    if (g) g.visible = j === i;
  });
  const mat = tag?.material as THREE.MeshBasicMaterial | undefined;
  if (mat && etiquetas && etiquetas[i] && mat.map !== etiquetas[i]) {
    mat.map = etiquetas[i];
    mat.needsUpdate = true;
  }
}

/* ---------------- flujo canónico ---------------- */

export function Flow({
  playing,
  speed,
  resetTick,
  pasoMode,
  nudge,
  onPaso,
}: {
  playing: boolean;
  speed: number;
  resetTick: number;
  pasoMode: boolean;
  nudge: number;
  onPaso: (p: number) => void;
}) {
  const cliente = useRef<THREE.Group>(null!);
  const residente = useRef<THREE.Group>(null!);
  const guardia = useRef<THREE.Group>(null!);
  const suscriptor = useRef<THREE.Group>(null!);
  const paquete = useRef<THREE.Group>(null!);
  const paqGiro = useRef<THREE.Group>(null!);
  const paqTag = useRef<THREE.Mesh>(null!);
  const paqueteRefs = useRef<(THREE.Group | null)[]>([]);
  const orb = useRef<THREE.Group>(null!);
  const sparkGuardia = useRef<THREE.Mesh>(null!);
  const sparkCofre = useRef<THREE.Mesh>(null!);
  const paseos = useRef<(THREE.Group | null)[]>([]);

  const paseantes = useMemo(
    () =>
      Array.from({ length: 3 }, (_, i) => ({
        camisa: CAMISA[(i * 2 + 3) % CAMISA.length],
        piel: PIEL[(i * 2 + 1) % PIEL.length],
        fase: i * 2.1,
        vel: 0.1 + i * 0.014,
      })),
    [],
  );

  const L_CLIENTE = useMemo(() => largoRuta(RUTA_CLIENTE), []);
  const L_PASAR = useMemo(() => largoRuta(RUTA_PASAR), []);
  const L_GUARDIA = useMemo(() => largoRuta(RUTA_GUARDIA), []);
  const L_ESTADO = useMemo(() => largoRuta(RUTA_ESTADO), []);
  const L_SALA = useMemo(() => largoRuta(RUTA_ESTADO.slice(0, 4)), []);
  const L_JUNCTION = useMemo(() => largoRuta(RUTA_ESTADO.slice(0, 6)), []);
  const L_REGISTRO = useMemo(() => largoRuta(RUTA_REGISTRO), []);
  const L_COMMIT = useMemo(() => largoRuta(RUTA_COMMIT), []);
  const L_PASEO = useMemo(() => largoRuta(RUTA_PASEO), []);
  const evtTag = useMemo(() => badgeTexture('LineaAgregada', '#ffc93c'), []);
  const etiquetas = useMemo(() => ROTULOS.map((n) => badgeTexture(n, '#fff7ea')), []);

  const est = useRef({ paso: 0, prog: 0, pausa: false, esc: 1 });
  const ultimo = useRef({ nudge: -1, paso: -1 });

  useEffect(() => {
    est.current = { paso: 0, prog: 0, pausa: pasoMode, esc: 0 };
  }, [resetTick, pasoMode]);

  useEffect(() => {
    if (ultimo.current.nudge !== nudge) {
      ultimo.current.nudge = nudge;
      est.current.pausa = false;
    }
  }, [nudge]);

  useFrame((_, rawDt) => {
    const s = est.current;
    const sdt = pasoMode ? (s.pausa ? 0 : rawDt * speed) : playing ? rawDt * speed : 0;
    const dt = Math.min(rawDt, 0.05);
    const now = simTime();

    /* ---- avance del paso ---- */
    if (sdt > 0) {
      s.prog += sdt / DUR[s.paso];
      if (s.prog >= 1) {
        s.prog = 0;
        s.paso = (s.paso + 1) % N;
        if (pasoMode) s.pausa = true;
        if (s.paso === 0) s.esc = 0;
      }
    }
    const paso = s.paso;
    const p = s.prog;

    if (ultimo.current.paso !== paso) {
      ultimo.current.paso = paso;
      onPaso(paso);
    }

    /* ---- cliente (el comando que entra) ---- */
    const cli = cliente.current;
    if (cli) {
      if (paso === 0) {
        s.esc = Math.min(1, s.esc + dt * 7);
        const q = puntoEnRuta(RUTA_CLIENTE, p * L_CLIENTE);
        cli.position.set(q.x, 0, q.z);
        cli.rotation.y = q.ang;
      } else if (paso === 1) {
        s.esc = 1;
        const q = puntoEnRuta(RUTA_PASAR, p * L_PASAR);
        cli.position.set(q.x, 0, q.z);
        cli.rotation.y = q.ang;
      } else {
        s.esc = paso === 5 ? Math.max(0, 1 - p / 0.2) : 1;
        cli.position.set(ESTACIONES.plaza[0], 0, ESTACIONES.plaza[1]);
        cli.rotation.y = Math.PI / 2;
      }
      cli.visible = s.esc > 0.02;
      cli.scale.setScalar(0.82 * Math.max(0.05, s.esc));
    }

    /* ---- residente (trabaja dentro del agregado) ---- */
    const res = residente.current;
    if (res) {
      let x = ESTACIONES.residenciaRest[0];
      let z = ESTACIONES.residenciaRest[1];
      let ang = Math.sin(now * 1.1) * 0.3;
      let esc = 1;

      if (paso === 2) {
        let d: number;
        let ida = true;
        if (p < 0.4) d = (p / 0.4) * L_GUARDIA;
        else if (p < 0.62) d = L_GUARDIA;
        else if (p < 0.85) {
          d = (1 - (p - 0.62) / 0.23) * L_GUARDIA;
          ida = false;
        } else {
          d = 0;
        }
        const q = puntoEnRuta(RUTA_GUARDIA, d);
        x = q.x;
        z = q.z;
        ang = ida ? q.ang : q.ang + Math.PI;
      } else if (paso === 3) {
        let d: number;
        if (p < 0.4) d = (p / 0.4) * L_SALA;
        else if (p < 0.56) d = L_SALA;
        else if (p < 0.74) d = L_SALA + ((p - 0.56) / 0.18) * (L_JUNCTION - L_SALA);
        else if (p < 0.9) d = L_JUNCTION + ((p - 0.74) / 0.16) * (L_ESTADO - L_JUNCTION);
        else d = L_ESTADO;
        const q = puntoEnRuta(RUTA_ESTADO, d);
        x = q.x;
        z = q.z;
        ang = q.ang;
      } else if (paso === 4) {
        let d: number;
        let ida = true;
        if (p < 0.45) d = (p / 0.45) * L_REGISTRO;
        else if (p < 0.72) d = L_REGISTRO;
        else if (p < 0.95) {
          d = (1 - (p - 0.72) / 0.23) * L_REGISTRO;
          ida = false;
        } else d = 0;
        const q = puntoEnRuta(RUTA_REGISTRO, d);
        x = q.x;
        z = q.z;
        ang = ida ? q.ang : q.ang + Math.PI;
      } else if (paso === 5) {
        esc = p < 0.45 ? 1 : Math.max(0, 1 - (p - 0.45) / 0.08);
        const q = puntoEnRuta(RUTA_COMMIT, Math.min(p / 0.45, 1) * L_COMMIT);
        x = q.x;
        z = q.z;
        ang = q.ang;
      } else {
        ang = -Math.PI / 2 + Math.sin(now * 1.2) * 0.25;
      }

      res.position.set(x, Math.sin(now * 3) * 0.012 * (1 - Math.abs(esc - 1)), z);
      res.rotation.y = ang;
      res.scale.setScalar(0.84 * Math.max(0.05, esc));
      res.visible = esc > 0.02;
    }

    /* ---- guardia ---- */
    const gd = guardia.current;
    if (gd) {
      gd.position.set(ESTACIONES.guardiaRest[0], 0, ESTACIONES.guardiaRest[1]);
      gd.rotation.y = paso === 2 ? -0.4 : Math.sin(now * 1.05 + 2) * 0.3;
      gd.scale.setScalar(0.84 + Math.sin(now * 3 + 1) * 0.012);
    }

    /* ---- suscriptor del correo ---- */
    const sus = suscriptor.current;
    if (sus) {
      let x = ESTACIONES.subRest[0];
      let z = ESTACIONES.subRest[1];
      let ang = Math.sin(now * 1.1 + 4) * 0.3;
      if (paso === 5 && p >= 0.8) {
        const t = rampa(p, 0.8, 0.95);
        x = ESTACIONES.subRest[0] + (ESTACIONES.correoPuerta[0] - ESTACIONES.subRest[0]) * t;
        z = ESTACIONES.subRest[1] + (ESTACIONES.correoPuerta[1] - ESTACIONES.subRest[1]) * t;
        ang = Math.atan2(
          ESTACIONES.correoPuerta[0] - ESTACIONES.subRest[0],
          ESTACIONES.correoPuerta[1] - ESTACIONES.subRest[1],
        );
      }
      sus.position.set(x, 0, z);
      sus.rotation.y = ang;
      sus.scale.setScalar(0.84);
    }

    /* ---- paquete ---- */
    const paq = paquete.current;
    if (paq) {
      let x = 0;
      let y = 0.5;
      let z = 0;
      let forma = 'comando';
      let visible = true;
      let escala = 1;

      if (paso === 0) {
        const q = puntoEnRuta(RUTA_CLIENTE, p * L_CLIENTE);
        x = q.x + 0.44;
        z = q.z + 0.2;
        forma = 'comando';
      } else if (paso === 1) {
        const q = puntoEnRuta(RUTA_PASAR, p * L_PASAR);
        x = q.x + 0.44;
        z = q.z + 0.2;
        forma = p < 0.55 ? 'comando' : 'agregado';
      } else if (paso === 2) {
        let d: number;
        if (p < 0.4) d = (p / 0.4) * L_GUARDIA;
        else if (p < 0.62) d = L_GUARDIA;
        else if (p < 0.85) d = (1 - (p - 0.62) / 0.23) * L_GUARDIA;
        else d = 0;
        const q = puntoEnRuta(RUTA_GUARDIA, d);
        x = q.x + 0.44;
        z = q.z + 0.2;
        forma = 'agregado';
      } else if (paso === 3) {
        let d: number;
        if (p < 0.4) d = (p / 0.4) * L_SALA;
        else if (p < 0.56) d = L_SALA;
        else if (p < 0.74) d = L_SALA + ((p - 0.56) / 0.18) * (L_JUNCTION - L_SALA);
        else if (p < 0.9) d = L_JUNCTION + ((p - 0.74) / 0.16) * (L_ESTADO - L_JUNCTION);
        else d = L_ESTADO;
        const q = puntoEnRuta(RUTA_ESTADO, d);
        x = q.x + 0.44;
        z = q.z + 0.2;
        forma = p < 0.74 ? 'linea' : 'dinero';
      } else if (paso === 4) {
        visible = false;
      } else {
        const q = puntoEnRuta(RUTA_COMMIT, Math.min(p / 0.45, 1) * L_COMMIT);
        x = q.x + 0.44;
        z = q.z + 0.2;
        forma = 'commit';
        escala = p < 0.45 ? 1 : Math.max(0.05, 1 - (p - 0.45) / 0.08);
      }

      paq.visible = visible && escala > 0.02;
      if (paq.visible) {
        paq.position.set(x, y, z);
        paq.scale.setScalar(escala);
        if (paqGiro.current) paqGiro.current.rotation.y = now * 1.6;
        setForma(paqueteRefs, forma, paqTag.current, etiquetas);
      }
    }

    /* ---- orbe del evento ---- */
    const ob = orb.current;
    if (ob) {
      let on = false;
      let x = ESTACIONES.registroPuerta[0];
      let y = 1.0;
      let z = ESTACIONES.registroPuerta[1];
      let esc = 1;
      if (paso === 4) {
        on = p > 0.35;
        esc = rampa(p, 0.35, 0.45);
        y = 1.0 + Math.sin(now * 2.6) * 0.12;
      } else if (paso === 5) {
        on = p > 0.5;
        if (p < 0.6) {
          esc = rampa(p, 0.5, 0.58);
          x = ESTACIONES.bodegaPuerta[0];
          z = ESTACIONES.bodegaPuerta[1];
          y = 0.4 + rampa(p, 0.5, 0.6) * 0.9 + Math.sin(now * 2.6) * 0.1;
        } else if (p < 0.75) {
          const t = rampa(p, 0.6, 0.75);
          x = ESTACIONES.bodegaPuerta[0] + (ESTACIONES.busBase[0] - ESTACIONES.bodegaPuerta[0]) * t;
          z = ESTACIONES.bodegaPuerta[1] + (ESTACIONES.busBase[1] - ESTACIONES.bodegaPuerta[1]) * t;
          y = 1.35 + Math.sin(t * Math.PI) * 0.8;
        } else if (p < 0.8) {
          x = ESTACIONES.busBase[0];
          z = ESTACIONES.busBase[1];
          y = 1.35;
        } else if (p < 0.95) {
          const t = rampa(p, 0.8, 0.95);
          x = ESTACIONES.busBase[0] + (ESTACIONES.correoPuerta[0] - ESTACIONES.busBase[0]) * t;
          z = ESTACIONES.busBase[1] + (ESTACIONES.correoPuerta[1] - ESTACIONES.busBase[1]) * t;
          y = 1.35 + Math.sin(t * Math.PI) * 0.7;
        } else {
          x = ESTACIONES.correoPuerta[0];
          z = ESTACIONES.correoPuerta[1];
          y = 1.3;
          esc = Math.max(0, 1 - (p - 0.95) / 0.05);
          on = esc > 0.02;
        }
      }
      ob.visible = on && esc > 0.02;
      if (ob.visible) {
        ob.position.set(x, y, z);
        ob.scale.setScalar(Math.max(0.05, esc));
        ob.rotation.y = now * 1.7;
      }
    }

    /* ---- destellos = validación y prueba superada ---- */
    if (sparkGuardia.current) {
      const on = paso === 2 && p > 0.42 && p < 0.7;
      sparkGuardia.current.visible = on;
      if (on) sparkGuardia.current.scale.setScalar(0.8 + Math.sin(now * 7) * 0.25);
    }
    if (sparkCofre.current) {
      const on = paso === 3 && p > 0.74 && p < 0.92;
      sparkCofre.current.visible = on;
      if (on) sparkCofre.current.scale.setScalar(0.8 + Math.sin(now * 7) * 0.25);
    }

    /* ---- paseantes de fondo ---- */
    for (let i = 0; i < paseantes.length; i++) {
      const g = paseos.current[i];
      if (!g) continue;
      const cfg = paseantes[i];
      const u = (Math.sin(now * cfg.vel + cfg.fase) + 1) / 2;
      const dir = Math.cos(now * cfg.vel + cfg.fase) >= 0 ? 1 : -1;
      const q = puntoEnRuta(RUTA_PASEO, u * L_PASEO);
      g.position.set(q.x, Math.abs(Math.sin(now * 4 + i)) * 0.03, q.z);
      g.rotation.y = dir > 0 ? q.ang : q.ang + Math.PI;
      g.scale.setScalar(0.72);
    }
  });

  return (
    <group>
      <group ref={cliente} visible={false}>
        <Persona camisa="#ff4f9a" piel="#ffd9b0" />
      </group>

      <group ref={residente}>
        <Persona camisa="#8f6bd8" piel="#f2b98c" gorra="#ffc93c" />
      </group>

      <group ref={guardia}>
        <Persona camisa="#7ed957" piel="#ffd9b0" gorra="#2a2340" />
      </group>

      <group ref={suscriptor}>
        <Persona camisa="#14a8a8" piel="#c98a52" gorra="#ffc93c" />
      </group>

      {paseantes.map((c, i) => (
        <group
          key={i}
          ref={(el) => {
            paseos.current[i] = el;
          }}
        >
          <Persona camisa={c.camisa} piel={c.piel} />
        </group>
      ))}

      <mesh
        ref={sparkGuardia}
        position={[ESTACIONES.guardiaPuerta[0], 1.3, ESTACIONES.guardiaPuerta[1]]}
        rotation={[Math.PI / 2, 0, 0]}
        visible={false}
      >
        <torusGeometry args={[0.32, 0.05, 6, 18]} />
        <meshToonMaterial color="#7ed957" />
      </mesh>

      <mesh
        ref={sparkCofre}
        position={[ESTACIONES.cofrePuerta[0], 1.45, ESTACIONES.cofrePuerta[1]]}
        rotation={[Math.PI / 2, 0, 0]}
        visible={false}
      >
        <torusGeometry args={[0.32, 0.05, 6, 18]} />
        <meshToonMaterial color="#ffc93c" />
      </mesh>

      <group ref={paquete}>
        <group ref={paqGiro}>
          <Paquetes refs={paqueteRefs} />
        </group>
        <Billboard position={[0, 1.9, 0.4]}>
          <mesh ref={paqTag}>
            <planeGeometry args={[1.8, 0.7]} />
            <meshBasicMaterial
              map={etiquetas[0]}
              transparent
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </Billboard>
      </group>

      <group ref={orb} visible={false}>
        <mesh>
          <octahedronGeometry args={[0.3, 0]} />
          <ToonMat color="#ffc93c" ramp={[0.6, 0.82, 1]} />
          <Outlines thickness={0.04} color={INK} />
        </mesh>
        <Billboard position={[0, 0.95, 0.3]}>
          <mesh>
            <planeGeometry args={[2.2, 0.85]} />
            <meshBasicMaterial map={evtTag} transparent depthWrite={false} toneMapped={false} />
          </mesh>
        </Billboard>
      </group>
    </group>
  );
}
