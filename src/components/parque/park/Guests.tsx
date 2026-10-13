import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Outlines } from '@react-three/drei';
import * as THREE from 'three';
import { INK, badgeTexture, shadowTexture } from '../../scene/toon';
import { ENCHUFES, ESTACIONES, SALIDAS, type Vec2 } from './layout';
import { ToonMat } from './Island';
import { simTime } from './simClock';

/* ---------------- utilidades de recorrido ---------------- */

const CAMISA = ['#ff5a3c', '#14a8a8', '#ff4f9a', '#ffc93c', '#7ed957', '#2f9fe0', '#8f6bd8'];
const PIEL = ['#ffd9b0', '#f2b98c', '#c98a52', '#8a5a34'];

/** Duración de cada paso en segundos (a velocidad ×1). */
const DUR = [3.2, 7.5, 6, 7.5, 8];

const RUTA_CLIENTE: Vec2[] = [ESTACIONES.inicio, ESTACIONES.espera];
const RUTA_OFICINA: Vec2[] = [
  ESTACIONES.oficinaPuerta,
  [-5.8, 0.8],
  [0, 0.8],
  ESTACIONES.castilloPuerta,
];
const RUTA_GUARDAR: Vec2[] = [
  ESTACIONES.oficinaPuerta,
  [-5.8, 0.8],
  [0, 0.8],
  ENCHUFES[1].at,
];
const RUTA_EVENTOS: Vec2[] = [
  ESTACIONES.oficinaPuerta,
  [-5.8, 0.8],
  [0, 0.8],
  ENCHUFES[3].at,
];
const RUTA_LLAMAR: Vec2[] = [
  ESTACIONES.oficinaPuerta,
  [-5.8, 0.8],
  [0, 0.8],
  ENCHUFES[2].at,
];
const RUTA_PASEO: Vec2[] = [ESTACIONES.inicio, [2.6, 0.8]];

/** Tramos que cada adaptador recorre tras enchufarse, desde su hueco. */
const CARRY_REPO = SALIDAS.db.slice(1);
const CARRY_SMTP = SALIDAS.correo.slice(1);
const CARRY_API = SALIDAS.api.slice(1);

/** Adaptadores: [reposo, enchufe, camisa, piel, gorra]. */
const ADAPT = [
  { idle: ESTACIONES.adaptRest, en: ENCHUFES[0].at, camisa: '#ff5a3c', piel: '#c98a52', gorra: '#ffc93c' },
  { idle: ESTACIONES.adaptRepo, en: ENCHUFES[1].at, camisa: '#14a8a8', piel: '#8a5a34', gorra: '#ffc93c' },
  { idle: ESTACIONES.adaptApi, en: ENCHUFES[2].at, camisa: '#2f9fe0', piel: '#f2b98c', gorra: '#ffc93c' },
  { idle: ESTACIONES.adaptSmtp, en: ENCHUFES[3].at, camisa: '#14a8a8', piel: '#ffd9b0', gorra: '#ffc93c' },
];

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

/** El paquete cambia de forma en cada cruce de frontera. */
const FORMAS = ['json', 'comando', 'pedido', 'fila', 'respuesta'];

function Paquetes({
  refs,
}: {
  refs: React.MutableRefObject<(THREE.Group | null)[]>;
}) {
  const formas: { n: string; jsx: React.ReactNode }[] = [
    {
      n: 'json',
      jsx: (
        <>
          <mesh>
            <boxGeometry args={[0.58, 0.09, 0.46]} />
            <ToonMat color="#9fd7f0" ramp={[0.6, 0.8, 1]} />
            <Outlines thickness={0.035} color={INK} />
          </mesh>
          <mesh position={[0, 0.07, 0]}>
            <boxGeometry args={[0.42, 0.03, 0.3]} />
            <meshToonMaterial color="#fff7ea" />
          </mesh>
        </>
      ),
    },
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
      n: 'pedido',
      jsx: (
        <mesh>
          <boxGeometry args={[0.56, 0.5, 0.56]} />
          <ToonMat color="#2f9fe0" ramp={[0.55, 0.75, 1]} />
          <Outlines thickness={0.04} color={INK} />
        </mesh>
      ),
    },
    {
      n: 'fila',
      jsx: (
        <>
          {[-0.14, 0, 0.14].map((y) => (
            <mesh key={y} position={[0, y, 0]}>
              <boxGeometry args={[0.56, 0.09, 0.46]} />
              <ToonMat color="#14a8a8" ramp={[0.6, 0.8, 1]} />
              <Outlines thickness={0.03} color={INK} />
            </mesh>
          ))}
        </>
      ),
    },
    {
      n: 'respuesta',
      jsx: (
        <mesh>
          <boxGeometry args={[0.46, 0.42, 0.5]} />
          <ToonMat color="#7ed957" ramp={[0.55, 0.75, 1]} />
          <Outlines thickness={0.04} color={INK} />
        </mesh>
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
  const oficinero = useRef<THREE.Group>(null!);
  const empleado = useRef<THREE.Group>(null!);
  const paquete = useRef<THREE.Group>(null!);
  const paqGiro = useRef<THREE.Group>(null!);
  const paqTag = useRef<THREE.Mesh>(null!);
  const paqueteRefs = useRef<(THREE.Group | null)[]>([]);
  const paqEvt = useRef<(THREE.Group | null)[]>([]);
  const paqEvtGiro = useRef<(THREE.Group | null)[]>([]);
  const engranaje = useRef<THREE.Mesh>(null!);
  const adapts = useRef<(THREE.Group | null)[]>([]);
  const sparks = useRef<(THREE.Mesh | null)[]>([]);
  const paseos = useRef<(THREE.Group | null)[]>([]);

  const paseantes = useMemo(
    () =>
      Array.from({ length: 3 }, (_, i) => ({
        camisa: CAMISA[(i * 2 + 3) % CAMISA.length],
        piel: PIEL[(i * 2 + 1) % PIEL.length],
        fase: i * 2.1,
        vel: 0.09 + i * 0.012,
      })),
    [],
  );

  const L_CLIENTE = useMemo(() => largoRuta(RUTA_CLIENTE), []);
  const L_OFICINA = useMemo(() => largoRuta(RUTA_OFICINA), []);
  const L_GUARDAR = useMemo(() => largoRuta(RUTA_GUARDAR), []);
  const L_EVENTOS = useMemo(() => largoRuta(RUTA_EVENTOS), []);
  const L_LLAMAR = useMemo(() => largoRuta(RUTA_LLAMAR), []);
  const L_CARRY_REPO = useMemo(() => largoRuta(CARRY_REPO), []);
  const L_CARRY_SMTP = useMemo(() => largoRuta(CARRY_SMTP), []);
  const L_CARRY_API = useMemo(() => largoRuta(CARRY_API), []);
  const L_PASEO = useMemo(() => largoRuta(RUTA_PASEO), []);
  const evtTag = useMemo(() => badgeTexture('PedidoCreado', '#ffc93c'), []);
  const etiquetas = useMemo(
    () => FORMAS.map((n) => badgeTexture(n.toUpperCase(), '#fff7ea')),
    [],
  );

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
        s.paso = (s.paso + 1) % 5;
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

    /* ---- cliente ---- */
    const cli = cliente.current;
    if (cli) {
      if (paso === 0) {
        s.esc = Math.min(1, s.esc + dt * 7);
        const q = puntoEnRuta(RUTA_CLIENTE, p * L_CLIENTE);
        cli.position.set(q.x, 0, q.z);
        cli.rotation.y = q.ang;
      } else {
        s.esc = paso === 4 ? (p < 0.78 ? 1 : Math.max(0, (1 - p) / 0.22)) : 1;
        cli.position.set(ESTACIONES.espera[0], 0, ESTACIONES.espera[1]);
        cli.rotation.y = Math.PI / 2;
      }
      cli.visible = s.esc > 0.02;
      cli.scale.setScalar(0.82 * s.esc);
    }

    /* ---- oficinero (caso de uso) ---- */
    const ofi = oficinero.current;
    if (ofi) {
      let ruta: Vec2[] | null = null;
      let L = 0;
      let fIda = 0.4;
      let fEsp = 0.5;
      let fVta = 0.9;
      if (paso === 2) {
        ruta = RUTA_OFICINA;
        L = L_OFICINA;
        fIda = 0.34;
        fEsp = 0.5;
        fVta = 0.84;
      } else if (paso === 3) {
        ruta = RUTA_GUARDAR;
        L = L_GUARDAR;
        fIda = 0.4;
        fEsp = 0.5;
        fVta = 0.88;
      } else if (paso === 4) {
        ruta = RUTA_EVENTOS;
        L = L_EVENTOS;
        fIda = 0.38;
        fEsp = 0.5;
        fVta = 0.88;
      }
      if (ruta) {
        let d: number;
        let ida = true;
        if (p < fIda) d = (p / fIda) * L;
        else if (p < fEsp) d = L;
        else if (p < fVta) {
          d = (1 - (p - fEsp) / (fVta - fEsp)) * L;
          ida = false;
        } else {
          d = 0;
        }
        const q = puntoEnRuta(ruta, d);
        ofi.position.set(q.x, 0, q.z);
        ofi.rotation.y = ida ? q.ang : q.ang + Math.PI;
        ofi.scale.setScalar(0.84);
      } else {
        ofi.position.set(ESTACIONES.oficinaPuerta[0], 0, ESTACIONES.oficinaPuerta[1]);
        const mira = paso === 1 ? Math.PI / 2 : Math.sin(now * 1.2) * 0.25;
        ofi.rotation.y = mira;
        ofi.scale.setScalar(0.84 + Math.sin(now * 3) * 0.012);
      }
    }

    /* ---- segundo empleado (suscriptor por la API) ---- */
    const emp = empleado.current;
    if (emp) {
      if (paso === 4) {
        let d: number;
        let ida = true;
        if (p < 0.36) d = (p / 0.36) * L_LLAMAR;
        else if (p < 0.48) d = L_LLAMAR;
        else if (p < 0.85) {
          d = (1 - (p - 0.48) / (0.85 - 0.48)) * L_LLAMAR;
          ida = false;
        } else {
          d = 0;
        }
        const q = puntoEnRuta(RUTA_LLAMAR, d);
        emp.position.set(q.x, 0, q.z);
        emp.rotation.y = ida ? q.ang : q.ang + Math.PI;
        emp.scale.setScalar(0.84);
      } else {
        emp.position.set(-6.7, 0, ESTACIONES.oficinaPuerta[1]);
        emp.rotation.y = Math.sin(now * 1.1 + 2) * 0.3;
        emp.scale.setScalar(0.84 + Math.sin(now * 3 + 1) * 0.012);
      }
    }

    /* ---- paquete ---- */
    const paq = paquete.current;
    if (paq) {
      let x = 0;
      let y = 0;
      let z = 0;
      let forma = 'comando';
      let visible = true;
      let escala = 1;

      if (paso === 0) {
        const q = puntoEnRuta(RUTA_CLIENTE, p * L_CLIENTE);
        x = q.x + 0.44;
        y = 0.5;
        z = q.z + 0.2;
        forma = p < 0.7875 ? 'json' : 'comando';
      } else if (paso === 1) {
        if (p < 0.5) {
          const q = puntoEnRuta(RUTA_GUARDAR, Math.min(p / 0.4, 1) * L_GUARDAR);
          x = q.x + 0.44;
          y = 0.5;
          z = q.z + 0.2;
          forma = 'comando';
          escala = rampa(p, 0, 0.03);
        } else {
          const q = puntoEnRuta(RUTA_GUARDAR, (1 - (p - 0.5) / 0.4) * L_GUARDAR);
          x = q.x + 0.44;
          y = 0.5;
          z = q.z + 0.2;
          forma = 'respuesta';
          if (p > 0.9) escala = 1 - rampa(p, 0.9, 0.98);
        }
      } else if (paso === 2) {
        if (p < 0.34) {
          const q = puntoEnRuta(RUTA_OFICINA, (p / 0.34) * L_OFICINA);
          x = q.x + 0.44;
          y = 0.5;
          z = q.z + 0.2;
          forma = 'comando';
        } else if (p < 0.5) {
          visible = false;
        } else {
          const d = (1 - (p - 0.5) / 0.34) * L_OFICINA;
          const q = puntoEnRuta(RUTA_OFICINA, d);
          x = q.x + 0.44;
          y = 0.5;
          z = q.z + 0.2;
          forma = 'pedido';
        }
      } else if (paso === 3) {
        const ad = adapts.current[1];
        if (p < 0.46) {
          const q = puntoEnRuta(RUTA_GUARDAR, Math.min(p / 0.4, 1) * L_GUARDAR);
          x = q.x + 0.44;
          y = 0.5;
          z = q.z + 0.2;
          forma = p < 0.42 ? 'pedido' : 'fila';
        } else if (p < 0.86 && ad) {
          x = ad.position.x + 0.44;
          y = 0.5;
          z = ad.position.z + 0.2;
          forma = 'fila';
        } else {
          const fin = puntoEnRuta(CARRY_REPO, L_CARRY_REPO);
          x = fin.x;
          y = 0.5;
          z = fin.z;
          forma = 'fila';
          escala = p < 0.86 ? 1 : 1 - rampa(p, 0.86, 0.93);
        }
      } else {
        visible = false;
      }

      paq.visible = visible && escala > 0.02;
      if (paq.visible) {
        paq.position.set(x, y, z);
        paq.scale.setScalar(escala);
        if (paqGiro.current) paqGiro.current.rotation.y = now * 1.6;
        setForma(paqueteRefs, forma, paqTag.current, etiquetas);
      }
    }

    /* ---- paquetes de evento (paso 5) ---- */
    for (let i = 0; i < 2; i++) {
      const g = paqEvt.current[i];
      if (!g) continue;
      let on = false;
      let x = 0;
      let z = 0;
      let esc = 1;
      const walker = i === 0 ? oficinero.current : empleado.current;
      const ad = adapts.current[i === 0 ? 3 : 2];
      const finPath = i === 0 ? CARRY_SMTP : CARRY_API;
      const finL = i === 0 ? L_CARRY_SMTP : L_CARRY_API;
      if (paso === 4) {
        if (p < 0.44 && walker) {
          x = walker.position.x + 0.44;
          z = walker.position.z + 0.2;
          on = true;
          esc = rampa(p, 0, 0.03);
        } else if (p < 0.84 && ad) {
          x = ad.position.x + 0.44;
          z = ad.position.z + 0.2;
          on = true;
        } else if (p < 0.9) {
          const fin = puntoEnRuta(finPath, finL);
          x = fin.x;
          z = fin.z;
          on = true;
          esc = 1 - rampa(p, 0.84, 0.9);
        }
      }
      g.visible = on && esc > 0.02;
      if (g.visible) {
        g.position.set(x, 0.5, z);
        g.scale.setScalar(Math.max(0.05, esc));
        const gi = paqEvtGiro.current[i];
        if (gi) gi.rotation.y = now * 1.8;
      }
    }

    /* ---- engranaje del agregado ---- */
    const en = engranaje.current;
    if (en) {
      const on = paso === 2 && p > 0.3 && p < 0.56;
      en.visible = on;
      if (on) {
        en.position.set(0, 2.5 + Math.sin(now * 4) * 0.08, -0.35);
        en.rotation.y = now * 5;
        const k = 0.8 + rampa(p, 0.3, 0.38) * 0.35;
        en.scale.setScalar(k);
      }
    }

    /* ---- adaptadores: se acercan, se enchufan y llevan el paquete ---- */
    const pinches = [
      paso === 0 ? rampa(p, 0.52, 0.82) : paso === 1 ? 1 - rampa(p, 0, 0.22) : 0,
      (paso === 1 ? rampa(p, 0.34, 0.42) * (1 - rampa(p, 0.52, 0.64)) : 0) +
        (paso === 3 ? rampa(p, 0.36, 0.46) * (1 - rampa(p, 0.84, 0.96)) : 0),
      paso === 4 ? rampa(p, 0.34, 0.44) * (1 - rampa(p, 0.84, 0.96)) : 0,
      paso === 4 ? rampa(p, 0.34, 0.44) * (1 - rampa(p, 0.84, 0.96)) : 0,
    ];

    for (let i = 0; i < ADAPT.length; i++) {
      const g = adapts.current[i];
      if (!g) continue;
      const cfg = ADAPT[i];
      const t = clamp01(pinches[i]);
      const [ix, iz] = cfg.idle;
      const [sx, sz] = cfg.en;
      const nx = sx - ix;
      const nz = sz - iz;
      const L = Math.hypot(nx, nz) || 1;
      const enHueco = i > 0;
      const px = enHueco ? sx : sx - (nx / L) * 0.9;
      const pz = enHueco ? sz : sz - (nz / L) * 0.9;
      let x = ix + (px - ix) * t;
      let z = iz + (pz - iz) * t;
      let ang = Math.atan2(px - ix, pz - iz);

      let carry: Vec2[] | null = null;
      let carryL = 0;
      if (i === 1 && paso === 3) {
        carry = CARRY_REPO;
        carryL = L_CARRY_REPO;
      } else if (i === 2 && paso === 4) {
        carry = CARRY_API;
        carryL = L_CARRY_API;
      } else if (i === 3 && paso === 4) {
        carry = CARRY_SMTP;
        carryL = L_CARRY_SMTP;
      }
      if (carry && p >= 0.46 && p < 0.96) {
        if (p < 0.84) {
          const q = puntoEnRuta(carry, rampa(p, 0.46, 0.84) * carryL);
          x = q.x;
          z = q.z;
          ang = q.ang;
        } else {
          const fin = puntoEnRuta(carry, carryL);
          const r = rampa(p, 0.84, 0.96);
          x = fin.x + (ix - fin.x) * r;
          z = fin.z + (iz - fin.z) * r;
          ang = Math.atan2(ix - fin.x, iz - fin.z);
        }
      }

      g.position.set(x, Math.sin(now * 3 + i) * 0.015 * (1 - t), z);
      g.rotation.y = ang;
      g.scale.setScalar(0.8);
      const sp = sparks.current[i];
      if (sp) {
        sp.visible = t > 0.55;
        if (sp.visible) {
          sp.position.set(sx, 1.25, sz);
          sp.scale.setScalar(0.8 + Math.sin(now * 7) * 0.25);
        }
      }
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

      <group ref={oficinero}>
        <Persona camisa="#8f6bd8" piel="#f2b98c" gorra="#ffc93c" />
      </group>

      <group ref={empleado}>
        <Persona camisa="#7ed957" piel="#ffd9b0" gorra="#ffc93c" />
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

      {ADAPT.map((a, i) => (
        <group
          key={i}
          ref={(el) => {
            adapts.current[i] = el;
          }}
        >
          <Persona camisa={a.camisa} piel={a.piel} gorra={a.gorra} />
        </group>
      ))}

      {ADAPT.map((a, i) => (
        <mesh
          key={`s${i}`}
          ref={(el) => {
            sparks.current[i] = el;
          }}
          position={[a.en[0], 1.25, a.en[1]]}
          rotation={[Math.PI / 2, 0, 0]}
          visible={false}
        >
          <torusGeometry args={[0.34, 0.05, 6, 18]} />
          <meshToonMaterial color={ENCHUFES[i].color} />
        </mesh>
      ))}

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

      {[0, 1].map((i) => (
        <group
          key={`evt${i}`}
          visible={false}
          ref={(el) => {
            paqEvt.current[i] = el;
          }}
        >
          <group
            ref={(el) => {
              paqEvtGiro.current[i] = el;
            }}
          >
            <mesh>
              <boxGeometry args={[0.44, 0.4, 0.48]} />
              <ToonMat color="#ffc93c" ramp={[0.55, 0.75, 1]} />
              <Outlines thickness={0.04} color={INK} />
            </mesh>
          </group>
          <Billboard position={[0, 0.85, 0.35]}>
            <mesh>
              <planeGeometry args={[2.2, 0.85]} />
              <meshBasicMaterial map={evtTag} transparent depthWrite={false} toneMapped={false} />
            </mesh>
          </Billboard>
        </group>
      ))}

      <mesh ref={engranaje} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <torusGeometry args={[0.2, 0.07, 6, 12]} />
        <meshToonMaterial color="#ffc93c" />
      </mesh>
    </group>
  );
}
