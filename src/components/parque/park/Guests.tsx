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
const DUR = [3.2, 4.2, 5.2, 8, 8];

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

/** Offset con el que el paquete/orbe viaja pegado a su portador. */
const OFX = 0.44;
const OFZ = 0.2;

/* ---------------- flujo canónico CrearPedido ---------------- */

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
  const repartidor = useRef<THREE.Group>(null!);
  const paquete = useRef<THREE.Group>(null!);
  const paqGiro = useRef<THREE.Group>(null!);
  const paqTag = useRef<THREE.Mesh>(null!);
  const paqueteRefs = useRef<(THREE.Group | null)[]>([]);
  const paqEvt = useRef<(THREE.Group | null)[]>([]);
  const paqEvtGiro = useRef<(THREE.Group | null)[]>([]);
  const paqEvtTag = useRef<(THREE.Mesh | null)[]>([]);
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
  const evtDomainTag = useMemo(() => badgeTexture('PedidoCreado', '#ffc93c'), []);
  const evtOutboxTag = useMemo(() => badgeTexture('OUTBOX', '#ffc93c'), []);
  const evtIntegrationTag = useMemo(() => badgeTexture('INTEGRACIÓN', '#ffc93c'), []);
  const etiquetas = useMemo(
    () => FORMAS.map((n) => badgeTexture(n === 'fila' ? 'AGREGADO' : n.toUpperCase(), '#fff7ea')),
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

    /* ---- cliente (la solicitud) ---- */
    const cli = cliente.current;
    if (cli) {
      if (paso === 0) {
        s.esc = Math.min(1, s.esc + dt * 7);
        const q = puntoEnRuta(RUTA_CLIENTE, p * L_CLIENTE);
        cli.position.set(q.x, 0, q.z);
        cli.rotation.y = q.ang;
      } else {
        s.esc = paso === 4 ? (p < 0.8 ? 1 : Math.max(0, (1 - p) / 0.2)) : 1;
        cli.position.set(ESTACIONES.espera[0], 0, ESTACIONES.espera[1]);
        cli.rotation.y = Math.PI / 2;
      }
      cli.visible = s.esc > 0.02;
      cli.scale.setScalar(0.82 * s.esc);
    }

    /* ---- oficinero (caso de uso / servicio de aplicación) ---- */
    const ofi = oficinero.current;
    if (ofi) {
      let d = 0;
      let ida = true;
      let sobreRuta = false;
      if (paso === 1) {
        // la aplicación lleva el comando al agregado
        d = Math.min(p / 0.9, 1) * L_OFICINA;
        ida = true;
        sobreRuta = true;
      } else if (paso === 2) {
        // el agregado devuelve el resultado: vuelve a la oficina
        d = (1 - Math.min(p / 0.9, 1)) * L_OFICINA;
        ida = false;
        sobreRuta = true;
      } else if (paso === 3) {
        // la aplicación persiste el agregado y el mensaje de integración (outbox) por el puerto de guardar
        if (p < 0.42) {
          d = (p / 0.42) * L_GUARDAR;
          ida = true;
        } else if (p < 0.55) {
          d = L_GUARDAR;
          ida = true;
        } else {
          d = (1 - (p - 0.55) / 0.45) * L_GUARDAR;
          ida = false;
        }
        sobreRuta = true;
      }
      if (sobreRuta) {
        const ruta = paso === 3 ? RUTA_GUARDAR : RUTA_OFICINA;
        const q = puntoEnRuta(ruta, d);
        ofi.position.set(q.x, 0, q.z);
        ofi.rotation.y = ida ? q.ang : q.ang + Math.PI;
        ofi.scale.setScalar(0.84);
      } else {
        ofi.position.set(ESTACIONES.oficinaPuerta[0], 0, ESTACIONES.oficinaPuerta[1]);
        const mira = paso === 0 ? Math.PI / 2 : Math.sin(now * 1.2) * 0.25;
        ofi.rotation.y = mira;
        ofi.scale.setScalar(0.84 + Math.sin(now * 3) * 0.012);
      }
    }

    /* ---- dispatchers (outbox): publican el mensaje de integración tras el commit ---- */
    const dispatchers = [
      { ref: empleado, ruta: RUTA_EVENTOS, L: L_EVENTOS, idle: [-6.7, -0.25] as Vec2, f: 2 },
      { ref: repartidor, ruta: RUTA_LLAMAR, L: L_LLAMAR, idle: [-4.9, -0.25] as Vec2, f: 1 },
    ];
    for (const w of dispatchers) {
      const g = w.ref.current;
      if (!g) continue;
      if (paso === 4) {
        let d: number;
        let ida = true;
        if (p < 0.42) {
          d = (p / 0.42) * w.L;
          ida = true;
        } else if (p < 0.5) {
          d = w.L;
          ida = true;
        } else if (p < 0.95) {
          d = (1 - (p - 0.5) / 0.45) * w.L;
          ida = false;
        } else {
          d = 0;
          ida = true;
        }
        const q = puntoEnRuta(w.ruta, d);
        g.position.set(q.x, 0, q.z);
        g.rotation.y = ida ? q.ang : q.ang + Math.PI;
        g.scale.setScalar(0.84);
      } else {
        g.position.set(w.idle[0], 0, w.idle[1]);
        g.rotation.y = Math.sin(now * 1.1 + w.f) * 0.3;
        g.scale.setScalar(0.84 + Math.sin(now * 3 + w.f) * 0.012);
      }
    }

    /* ---- paquete principal (json → comando → pedido → fila) ---- */
    const paq = paquete.current;
    if (paq) {
      const ofiPos = ofi ? ofi.position : null;
      let x = 0;
      let y = 0.5;
      let z = 0;
      let forma = 'comando';
      let visible = true;
      let escala = 1;

      if (paso === 0) {
        const q = puntoEnRuta(RUTA_CLIENTE, p * L_CLIENTE);
        x = q.x + OFX;
        y = 0.5;
        z = q.z + OFZ;
        forma = p < 0.55 ? 'json' : 'comando';
      } else if (paso === 1 && ofiPos) {
        x = ofiPos.x + OFX;
        z = ofiPos.z + OFZ;
        forma = 'comando';
      } else if (paso === 2 && ofiPos) {
        x = ofiPos.x + OFX;
        z = ofiPos.z + OFZ;
        forma = p < 0.22 ? 'comando' : 'pedido';
      } else if (paso === 3) {
        if (p < 0.46 && ofiPos) {
          x = ofiPos.x + OFX;
          z = ofiPos.z + OFZ;
          forma = p < 0.4 ? 'pedido' : 'fila';
        } else {
          const ad = adapts.current[1];
          if (ad) {
            x = ad.position.x + OFX + 1.2;
            z = ad.position.z + OFZ + 0.65;
          }
          forma = 'fila';
          if (p > 0.9) escala = 1 - rampa(p, 0.9, 0.97);
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

    /* ---- orbes de evento (PedidoCreado → mensaje de integración) ---- */
    // orb 0: el agregado registra el evento de dominio PedidoCreado; la aplicación lo mapea al
    //        mensaje de integración (PedidoCreadoIntegration), se registra en la tabla outbox y, tras el
    //        commit, el dispatcher lo publica hacia correo (SMTP).
    // orb 1: entrega del mismo mensaje de integración (asíncrona) al suscriptor de la API externa.
    for (let i = 0; i < 2; i++) {
      const g = paqEvt.current[i];
      if (!g) continue;
      const tagMaterial = paqEvtTag.current[i]?.material as THREE.MeshBasicMaterial | undefined;
      const tagTexture = i === 0 && paso === 2 ? evtDomainTag : paso === 3 ? evtOutboxTag : evtIntegrationTag;
      if (tagMaterial && tagMaterial.map !== tagTexture) {
        tagMaterial.map = tagTexture;
        tagMaterial.needsUpdate = true;
      }
      let on = false;
      let x = 0;
      let z = 0;
      let esc = 1;

      if (i === 0) {
        if (paso === 2) {
          // el agregado registra el evento de dominio y lo devuelve al caso de uso
          if (p > 0.3) {
            const o = oficinero.current;
            if (o) {
              x = o.position.x + OFX;
              z = o.position.z + OFZ;
              on = true;
              esc = rampa(p, 0.3, 0.42);
            }
          }
        } else if (paso === 3) {
          // el agregado y el mensaje de integración se persisten en la misma transacción; el mensaje queda en la tabla outbox
          if (p < 0.46) {
            const o = oficinero.current;
            if (o) {
              x = o.position.x + OFX;
              z = o.position.z + OFZ;
              on = true;
            }
          } else {
            const ad = adapts.current[1];
            if (ad) {
              x = ad.position.x + OFX - 1.2;
              z = ad.position.z + OFZ - 0.65;
              on = true;
            }
          }
          if (p > 0.86) esc = 1 - rampa(p, 0.86, 0.94);
        } else if (paso === 4) {
          // el dispatcher publica el mensaje de integración por el puerto de eventos tras el commit
          if (p < 0.45) {
            const w = empleado.current;
            if (w) {
              x = w.position.x + OFX;
              z = w.position.z + OFZ;
              on = true;
              esc = rampa(p, 0, 0.05);
            }
          } else {
            const ad = adapts.current[3];
            if (ad) {
              x = ad.position.x + OFX;
              z = ad.position.z + OFZ;
              on = true;
            }
            esc = 1 - rampa(p, 0.8, 0.9);
          }
        }
      } else {
        if (paso === 4) {
          // segundo suscriptor: la API externa, entrega asíncrona del mensaje de integración
          if (p < 0.45) {
            const w = repartidor.current;
            if (w) {
              x = w.position.x + OFX;
              z = w.position.z + OFZ;
              on = true;
              esc = rampa(p, 0, 0.05);
            }
          } else {
            const ad = adapts.current[2];
            if (ad) {
              x = ad.position.x + OFX;
              z = ad.position.z + OFZ;
              on = true;
            }
            esc = 1 - rampa(p, 0.78, 0.88);
          }
        }
      }

      g.visible = on && esc > 0.02;
      if (g.visible) {
        const deliveryOffset = paso === 4 ? (i === 0 ? 0.6 : -0.6) : 0;
        const y = paso === 4 && i === 1 ? 1.25 : 0.72;
        g.position.set(x, y, z + deliveryOffset);
        g.scale.setScalar(Math.max(0.05, esc));
        const gi = paqEvtGiro.current[i];
        if (gi) gi.rotation.y = now * 1.8;
      }
    }

    /* ---- engranaje del agregado (valida y registra) ---- */
    const en = engranaje.current;
    if (en) {
      const on = paso === 2 && p > 0.04 && p < 0.5;
      en.visible = on;
      if (on) {
        en.position.set(0, 2.5 + Math.sin(now * 4) * 0.08, -0.35);
        en.rotation.y = now * 5;
        const k = 0.8 + rampa(p, 0.04, 0.14) * 0.35;
        en.scale.setScalar(k);
      }
    }

    /* ---- adaptadores: se acercan, se enchufan y llevan el paquete ---- */
    const pinches = [
      paso === 0 ? rampa(p, 0.5, 0.8) : paso === 1 ? 1 - rampa(p, 0, 0.18) : 0,
      paso === 3 ? rampa(p, 0.34, 0.46) : paso === 4 ? 1 - rampa(p, 0, 0.2) : 0,
      paso === 4 ? rampa(p, 0.24, 0.4) : paso === 0 ? 1 - rampa(p, 0, 0.18) : 0,
      paso === 4 ? rampa(p, 0.24, 0.4) : paso === 0 ? 1 - rampa(p, 0, 0.18) : 0,
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
      let carryEnd = 0.94;
      if (i === 1 && paso === 3) {
        carry = CARRY_REPO;
        carryL = L_CARRY_REPO;
        carryEnd = 0.97;
      } else if (i === 2 && paso === 4) {
        carry = CARRY_API;
        carryL = L_CARRY_API;
        carryEnd = 0.92;
      } else if (i === 3 && paso === 4) {
        carry = CARRY_SMTP;
        carryL = L_CARRY_SMTP;
        carryEnd = 0.94;
      }
      if (carry && p >= 0.46 && p < carryEnd) {
        if (p < 0.84) {
          const q = puntoEnRuta(carry, rampa(p, 0.46, 0.84) * carryL);
          x = q.x;
          z = q.z;
          ang = q.ang;
        } else {
          const fin = puntoEnRuta(carry, carryL);
          const r = rampa(p, 0.84, carryEnd);
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

      <group ref={repartidor}>
        <Persona camisa="#2f9fe0" piel="#f2b98c" gorra="#ffc93c" />
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
            <mesh
              ref={(el) => {
                paqEvtTag.current[i] = el;
              }}
            >
              <planeGeometry args={[2.2, 0.85]} />
              <meshBasicMaterial
                map={i === 0 ? evtDomainTag : evtIntegrationTag}
                transparent
                depthWrite={false}
                toneMapped={false}
              />
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
