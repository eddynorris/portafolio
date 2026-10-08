import { useMemo, useRef, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Outlines, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import {
  INK,
  RAMP_MAIN,
  RAMP_SOFT,
  badgeTexture,
  fishTexture,
  menuTexture,
  shadowTexture,
  signTexture,
  starTexture,
  stripeTexture,
  toonRamp,
} from './toon';
import { clamp01, easeOutBounce, easeOutQuint, lerp, prefersReduced, wave } from './anim';
import { setFocus, type HotspotId } from './store';

/** Partes clicables del carrito: ancho a encuadrar y offset del centro. */
const HOTSPOT = {
  proyectos: { fit: 2.1, offset: [0, 0.05, 0] },
  skills: { fit: 1.2, offset: [0, 0, 0] },
  redes: { fit: 3.6, offset: [1.5, 1.6, 0] },
} as const satisfies Record<HotspotId, { fit: number; offset: readonly [number, number, number] }>;

/* ------------------------------------------------------------------ */
/*  Primitivas                                                        */
/* ------------------------------------------------------------------ */

export function Toon({
  color,
  ramp = RAMP_MAIN,
  ...rest
}: { color: string; ramp?: string } & Omit<THREE.MeshToonMaterialParameters, 'color' | 'gradientMap'>) {
  const gradientMap = useMemo(
    () => toonRamp(ramp, ramp === RAMP_SOFT ? [0.52, 0.76, 1] : [0.4, 0.68, 1]),
    [ramp],
  );
  return <meshToonMaterial color={color} gradientMap={gradientMap} {...rest} />;
}

export function Ink({ t = 0.022 }: { t?: number }) {
  return <Outlines thickness={t} color={INK} />;
}

function Wheel({ position, r, w }: { position: [number, number, number]; r: number; w: number }) {
  const spin = useRef<THREE.Group>(null!);
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * 1.15;
  });
  return (
    <group position={position} rotation={[0, 0, Math.PI / 2]}>
      <group ref={spin}>
        <mesh>
          <torusGeometry args={[r * 0.8, r * 0.22, 10, 24]} />
          <Toon color="#2b2540" />
          <Ink t={0.02} />
        </mesh>
        <mesh>
          <cylinderGeometry args={[r * 0.82, r * 0.82, w * 0.55, 20]} />
          <Toon color="#fff7ea" ramp={RAMP_SOFT} />
        </mesh>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} rotation={[0, (i / 5) * Math.PI * 2, 0]}>
            <boxGeometry args={[r * 1.5, w * 0.72, 0.035]} />
            <Toon color={INK} ramp={RAMP_SOFT} />
          </mesh>
        ))}
        <mesh>
          <cylinderGeometry args={[r * 0.2, r * 0.2, w * 0.95, 12]} />
          <Toon color="#ff5a3c" />
        </mesh>
      </group>
    </group>
  );
}

function Fish({
  position,
  scale = 1,
  color = '#7ed4ff',
}: {
  position: [number, number, number];
  scale?: number;
  color?: string;
}) {
  return (
    <group position={position} scale={scale}>
      <mesh>
        <sphereGeometry args={[0.16, 16, 12]} />
        <Toon color={color} />
        <Ink t={0.03} />
      </mesh>
      <mesh position={[-0.2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.11, 0.16, 4]} />
        <Toon color="#ff5a3c" />
      </mesh>
      <mesh position={[0.1, 0.05, 0.13]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshBasicMaterial color={INK} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Destellos de 4 puntas que parpadean alrededor del letrero. */
function Sparkles({ count = 7, origin = [0, 0, 0] }: { count?: number; origin?: [number, number, number] }) {
  const group = useRef<THREE.Group>(null!);
  const map = useMemo(() => starTexture(), []);
  const items = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        pos: [
          Math.cos((i / count) * Math.PI * 2) * 1.45,
          1.7 + ((i * 0.53) % 1) * 1.3,
          Math.sin((i / count) * Math.PI * 2) * 0.95,
        ] as [number, number, number],
        phase: i * 1.37,
        size: 0.16 + ((i * 0.31) % 1) * 0.16,
      })),
    [count],
  );

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (!group.current) return;
    group.current.children.forEach((child, i) => {
      const it = items[i];
      const b = Math.max(0, Math.sin(t * 2.1 + it.phase));
      const pop = b * b * b;
      child.scale.setScalar(it.size * (0.12 + pop * 0.88));
      child.rotation.z = t * 0.7 + it.phase;
      child.visible = pop > 0.05;
    });
  });

  return (
    <group ref={group} position={origin}>
      {items.map((it, i) => (
        <sprite key={i} position={it.pos}>
          <spriteMaterial
            map={map}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </sprite>
      ))}
    </group>
  );
}

/** Puffs de vapor estilizados que suben desde el plato. */
function Steam({ origin, count = 5 }: { origin: [number, number, number]; count?: number }) {
  const group = useRef<THREE.Group>(null!);
  const puffs = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        delay: (i / count) * 2.6,
        x: (((i * 0.37) % 1) - 0.5) * 0.14,
        z: (((i * 0.61) % 1) - 0.5) * 0.12,
        size: 0.07 + ((i * 0.29) % 1) * 0.05,
      })),
    [count],
  );

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    group.current?.children.forEach((c, i) => {
      const p = puffs[i];
      const cycle = 2.6;
      const k = (((t + p.delay) % cycle) + cycle) % cycle;
      const u = k / cycle;
      c.position.set(p.x + Math.sin(u * 5 + i) * 0.07, u * 0.7, p.z + Math.cos(u * 4 + i) * 0.05);
      const s = p.size * (0.35 + u * 1.6) * (1 - u * 0.3);
      c.scale.setScalar(Math.max(0.001, s));
      c.visible = u > 0.02 && u < 0.97;
    });
  });

  return (
    <group ref={group} position={origin}>
      {puffs.map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshToonMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Rayas de velocidad: solo viven durante la entrada del carrito. */
function SpeedLines({ offset, reduced }: { offset: number; reduced: boolean }) {
  const group = useRef<THREE.Group>(null!);
  const mat = useRef<THREE.MeshBasicMaterial>(null!);
  const lines = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        y: 0.3 + ((i * 0.47) % 1) * 2.5,
        z: -1.6 - ((i * 0.73) % 1) * 1.4,
        len: 1.4 + ((i * 0.19) % 1) * 2.4,
        speed: 9 + ((i * 0.53) % 1) * 7,
        offset: ((i * 0.83) % 1) * 14,
      })),
    [],
  );

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const enter = reduced ? 1 : clamp01((t - offset) / 1.5);
    const life = enter < 1 ? Math.sin(enter * Math.PI) : 0;
    if (group.current) {
      group.current.visible = life > 0.02;
      group.current.children.forEach((c, i) => {
        const l = lines[i];
        const x = ((t * l.speed + l.offset) % 16) - 8;
        c.position.set(x, l.y, l.z);
        c.scale.set(l.len * Math.max(0.05, 1 - Math.abs(x) / 9), 1, 1);
      });
    }
    if (mat.current) mat.current.opacity = life * 0.8;
  });

  return (
    <group ref={group}>
      {lines.map((_, i) => (
        <mesh key={i}>
          <boxGeometry args={[1, 0.028, 0.028]} />
          <meshBasicMaterial ref={i === 0 ? mat : undefined} color="#ffffff" transparent opacity={0.8} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  El carrito cevichero                                               */
/* ------------------------------------------------------------------ */

/** Chapa flotante que marca una parte clicable del carrito. */
function Badge({
  label,
  fill,
  position,
}: {
  label: string;
  fill: string;
  position: [number, number, number];
}) {
  const ref = useRef<THREE.Sprite>(null!);
  const tex = useMemo(() => badgeTexture(label, fill), [label, fill]);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.position.y = position[1] + Math.sin(t * 1.7 + position[0] * 2) * 0.055;
  });
  return (
    <sprite ref={ref} position={position} scale={[1.1, 0.43, 1]}>
      <spriteMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </sprite>
  );
}

export function CevicheCart({ offset = 0 }: { offset?: number }) {
  const root = useRef<THREE.Group>(null!);
  const squash = useRef<THREE.Group>(null!);
  const umbrella = useRef<THREE.Group>(null!);
  const canopy = useRef<THREE.Group>(null!);
  const tassels = useRef<THREE.Group>(null!);
  const shadow = useRef<THREE.Mesh>(null!);
  const hop = useRef<THREE.Group>(null!);
  const sign = useRef<THREE.Group>(null!);
  const menu = useRef<THREE.Group>(null!);
  const sombrilla = useRef<THREE.Group>(null!);

  const [hover, setHover] = useState<HotspotId | null>(null);
  const camera = useThree((s) => s.camera);

  const reduced = prefersReduced();

  /** handlers de puntero para cada parte clicable del carrito */
  const spot = (id: HotspotId) => ({
    onPointerEnter: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setHover(id);
      document.body.style.cursor = 'pointer';
    },
    onPointerLeave: () => {
      setHover((h) => (h === id ? null : h));
      document.body.style.cursor = '';
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      const cfg = HOTSPOT[id];
      const anchor = e.eventObject as THREE.Object3D;
      const offset = new THREE.Vector3(...cfg.offset);
      const world = offset.clone();
      anchor.localToWorld(world);
      const dir = camera.position.clone().sub(world).normalize();
      setFocus({ id, anchor, offset, dir, fit: cfg.fit });
    },
  });

  const canopyGeo = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 16; i++) {
      const u = i / 16;
      pts.push(new THREE.Vector2(Math.max(1e-4, u * 1.5), -0.66 * Math.pow(u, 2.05)));
    }
    return new THREE.LatheGeometry(pts, 36);
  }, []);

  const bowlGeo = useMemo(() => {
    const pts = [
      new THREE.Vector2(1e-4, 0),
      new THREE.Vector2(0.07, 0.006),
      new THREE.Vector2(0.14, 0.05),
      new THREE.Vector2(0.19, 0.11),
      new THREE.Vector2(0.205, 0.17),
    ];
    return new THREE.LatheGeometry(pts, 26);
  }, []);

  const stripes = useMemo(() => stripeTexture('#ff5a3c', '#fff7ea', 10), []);
  const signTex = useMemo(() => signTexture('CEVICHE', 'S/ 10  ·  DEL MAR'), []);
  const menuTex = useMemo(() => menuTexture(['Ceviche', 'Tiradito', 'Jalea', 'Chicha']), []);
  const fishTex = useMemo(() => fishTexture(), []);
  const shadowTex = useMemo(() => shadowTexture(), []);

  useFrame((state, dt) => {
    const t = state.clock.getElapsedTime();
    const enter = reduced ? 1 : clamp01((t - offset) / 1.5);
    const settled = enter >= 1 ? 1 : 0;

    if (root.current) {
      const drop = reduced ? 0 : lerp(7.5, 0, easeOutBounce(enter));
      root.current.position.y = drop + Math.sin(t * 1.55) * 0.035 * enter;
      root.current.rotation.y = reduced ? 0 : lerp(-Math.PI * 0.72, 0, easeOutQuint(enter));
      root.current.rotation.z = Math.sin(t * 1.55 + 0.5) * 0.017 * enter;
      root.current.rotation.x = wave(t, 1.05, 1.9) * 0.011 * enter;
    }

    if (squash.current) {
      const impact = reduced ? 0 : Math.max(0, Math.sin(clamp01((enter - 0.52) / 0.48) * Math.PI));
      const idle = Math.sin(t * 3.1) * 0.02 * (0.35 + 0.65 * settled);
      const s = idle - impact * 0.24;
      squash.current.scale.set(1 - s * 0.5, 1 + s, 1 - s * 0.5);
    }

    if (umbrella.current) {
      umbrella.current.rotation.z = Math.sin(t * 0.9 - 0.7) * 0.055 * (0.4 + 0.6 * settled);
      umbrella.current.rotation.x = Math.cos(t * 0.72 - 0.4) * 0.04 * (0.4 + 0.6 * settled);
    }
    if (canopy.current) canopy.current.rotation.y = t * 0.14;

    if (tassels.current) {
      tassels.current.children.forEach((c, i) => {
        c.rotation.x = Math.sin(t * 2.4 + i * 0.7) * 0.32;
        c.rotation.z = Math.cos(t * 2.1 + i * 0.5) * 0.22;
      });
    }

    if (sign.current) {
      sign.current.rotation.y = Math.sin(t * 1.1) * 0.05;
      sign.current.position.y = 2.07 + wave(t, 1.6, 0.4) * 0.02;
    }

    if (hop.current) {
      const c = 1.9;
      const u = (((t + 0.35) % c) + c) % c / c;
      const lift = Math.abs(Math.sin(u * Math.PI));
      hop.current.position.y = lift * 0.2;
      const sq = lift < 0.12 ? 0.16 : 0;
      hop.current.scale.set(1 - sq * 0.5, 1 + sq, 1 - sq * 0.5);
      hop.current.rotation.z = Math.sin(u * Math.PI * 2) * 0.3;
    }

    if (shadow.current && root.current) {
      const k = 1 - clamp01(root.current.position.y / 3) * 0.6;
      shadow.current.scale.setScalar(Math.max(0.2, k) * (1 + Math.sin(t * 1.55) * 0.03));
    }

    /* realce de la parte bajo el puntero */
    const kh = 1 - Math.pow(0.0006, Math.min(dt, 0.05));
    const hl = (o: THREE.Object3D | null, on: boolean) => {
      if (!o) return;
      o.scale.setScalar(THREE.MathUtils.lerp(o.scale.x, on ? 1.07 : 1, kh));
    };
    hl(sign.current, hover === 'proyectos');
    hl(menu.current, hover === 'skills');
    hl(sombrilla.current, hover === 'redes');
  });

  return (
    <>
      <mesh ref={shadow} position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.6, 1.9]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} toneMapped={false} />
      </mesh>

      <SpeedLines offset={offset} reduced={reduced} />

      <group ref={root}>
        <group ref={squash}>
          {/* chasis */}
          <RoundedBox args={[2.3, 0.12, 1.08]} radius={0.05} smoothness={3} position={[0, 0.44, 0]}>
            <Toon color="#2b2540" />
            <Ink t={0.018} />
          </RoundedBox>

          <RoundedBox args={[2.02, 0.56, 0.96]} radius={0.06} smoothness={4} position={[0, 0.78, 0]}>
            <Toon color="#fff7ea" ramp={RAMP_SOFT} />
            <Ink t={0.02} />
          </RoundedBox>

          <mesh position={[0, 0.56, 0]}>
            <boxGeometry args={[2.05, 0.1, 0.99]} />
            <Toon color="#14a8a8" />
          </mesh>

          <RoundedBox args={[0.66, 0.34, 0.05]} radius={0.03} position={[-0.55, 0.86, 0.5]}>
            <Toon color="#ffc93c" />
            <Ink t={0.02} />
          </RoundedBox>
          <mesh position={[-0.55, 0.86, 0.53]}>
            <planeGeometry args={[0.58, 0.29]} />
            <meshBasicMaterial map={fishTex} toneMapped={false} />
          </mesh>

          <RoundedBox args={[2.24, 0.1, 1.12]} radius={0.04} smoothness={4} position={[0, 1.1, 0]}>
            <Toon color="#e8b879" ramp={RAMP_SOFT} />
            <Ink t={0.018} />
          </RoundedBox>

          {/* ruedas */}
          <Wheel position={[-0.94, 0.3, -0.34]} r={0.3} w={0.12} />
          <Wheel position={[0.94, 0.3, -0.34]} r={0.3} w={0.12} />
          <Wheel position={[-0.9, 0.2, 0.4]} r={0.2} w={0.1} />
          <Wheel position={[0.9, 0.2, 0.4]} r={0.2} w={0.1} />

          {/* manija */}
          <mesh position={[0, 1.02, -0.64]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 1.4, 10]} />
            <Toon color="#2b2540" />
          </mesh>
          {[-0.7, 0.7].map((x) => (
            <mesh key={x} position={[x, 0.8, -0.58]} rotation={[0.35, 0, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.55, 10]} />
              <Toon color="#2b2540" />
            </mesh>
          ))}

          {/* vitrina */}
          <group position={[0.3, 0, 0]}>
            <RoundedBox args={[1.18, 0.08, 0.7]} radius={0.03} position={[0, 1.19, 0]}>
              <Toon color="#14a8a8" />
              <Ink t={0.016} />
            </RoundedBox>
            <mesh position={[0, 1.45, 0]}>
              <boxGeometry args={[1.14, 0.44, 0.66]} />
              <meshStandardMaterial
                color="#d6f1ff"
                transparent
                opacity={0.26}
                roughness={0.06}
                metalness={0}
                depthWrite={false}
              />
            </mesh>
            {[
              [-0.57, -0.33],
              [0.57, -0.33],
              [-0.57, 0.33],
              [0.57, 0.33],
            ].map(([x, z], i) => (
              <mesh key={i} position={[x, 1.45, z]}>
                <cylinderGeometry args={[0.022, 0.022, 0.46, 8]} />
                <Toon color="#14a8a8" />
              </mesh>
            ))}
            <RoundedBox args={[1.2, 0.06, 0.74]} radius={0.025} position={[0, 1.68, 0]}>
              <Toon color="#14a8a8" />
              <Ink t={0.016} />
            </RoundedBox>
            {[-0.26, 0.26].map((x, i) => (
              <group key={i}>
                <mesh position={[x, 1.27, 0]}>
                  <boxGeometry args={[0.46, 0.05, 0.5]} />
                  <Toon color={i ? '#ff5a3c' : '#7ed957'} ramp={RAMP_SOFT} />
                </mesh>
                <Fish position={[x, 1.36, 0]} scale={0.7} color={i ? '#fff7ea' : '#7ed4ff'} />
              </group>
            ))}
          </group>

          {/* letrero */}
          {[-0.72, 0.72].map((x) => (
            <mesh key={x} position={[x, 1.6, -0.44]}>
              <cylinderGeometry args={[0.03, 0.03, 1.0, 8]} />
              <Toon color="#2b2540" />
            </mesh>
          ))}
          <group ref={sign} position={[0, 2.07, -0.44]} {...spot('proyectos')}>
            <RoundedBox args={[1.72, 0.86, 0.07]} radius={0.04} smoothness={4}>
              <Toon color="#ff5a3c" />
              <Ink t={0.02} />
            </RoundedBox>
            <mesh position={[0, 0, 0.045]}>
              <planeGeometry args={[1.64, 0.8]} />
              <meshBasicMaterial map={signTex} toneMapped={false} />
            </mesh>
            <Badge label="PROYECTOS" fill="#ffc93c" position={[0, 0.8, 0]} />
          </group>

          {/* mesón */}
          <RoundedBox args={[0.62, 0.06, 0.42]} radius={0.025} position={[-0.58, 1.18, 0.22]}>
            <Toon color="#f0c88a" ramp={RAMP_SOFT} />
            <Ink t={0.016} />
          </RoundedBox>
          <group position={[-0.58, 1.24, 0.2]}>
            <mesh position={[0.1, 0.02, 0.02]} rotation={[0, 0.4, 0]}>
              <boxGeometry args={[0.3, 0.015, 0.07]} />
              <Toon color="#dfe7ef" ramp={RAMP_SOFT} />
            </mesh>
            <mesh position={[-0.13, 0.03, -0.02]} rotation={[0, 0.4, 0]}>
              <boxGeometry args={[0.16, 0.045, 0.05]} />
              <Toon color="#ff5a3c" />
            </mesh>
          </group>

          <group position={[-0.62, 1.15, -0.22]}>
            <mesh geometry={bowlGeo}>
              <Toon color="#14a8a8" />
              <Ink t={0.03} />
            </mesh>
            <mesh position={[0, 0.14, 0]} scale={[1, 0.5, 1]}>
              <sphereGeometry args={[0.17, 16, 10]} />
              <Toon color="#ffe6b8" ramp={RAMP_SOFT} />
            </mesh>
            <Steam origin={[0, 0.2, 0]} />
          </group>

          <group ref={hop} position={[-0.2, 1.16, 0.36]}>
            <mesh>
              <sphereGeometry args={[0.07, 14, 12]} />
              <Toon color="#7ed957" />
              <Ink t={0.04} />
            </mesh>
          </group>
          {[
            [-0.05, 1.16, 0.3],
            [-0.34, 1.16, 0.44],
          ].map((p, i) => (
            <mesh key={i} position={p as [number, number, number]}>
              <sphereGeometry args={[0.065, 14, 12]} />
              <Toon color={i ? '#5cbe46' : '#8fe36b'} />
              <Ink t={0.045} />
            </mesh>
          ))}

          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[-0.95, 1.19 + i * 0.075, -0.3]}>
              <cylinderGeometry args={[0.055, 0.045, 0.08, 12]} />
              <Toon color="#fff7ea" ramp={RAMP_SOFT} />
            </mesh>
          ))}

          <group position={[0.95, 1.15, -0.3]}>
            <mesh position={[0, 0.14, 0]}>
              <cylinderGeometry args={[0.1, 0.09, 0.28, 16]} />
              <Toon color="#8b5cf6" />
              <Ink t={0.03} />
            </mesh>
            <mesh position={[0, 0.29, 0]}>
              <cylinderGeometry args={[0.105, 0.105, 0.03, 16]} />
              <Toon color="#ffc93c" />
            </mesh>
            <mesh position={[0.03, 0.42, 0]} rotation={[0.18, 0, 0.22]}>
              <cylinderGeometry args={[0.012, 0.012, 0.3, 6]} />
              <Toon color="#ff5a3c" />
            </mesh>
          </group>

          <group ref={menu} position={[-1.45, 0.36, 0.52]} rotation={[0, 0.42, 0.06]} {...spot('skills')}>
            <RoundedBox args={[0.56, 0.7, 0.05]} radius={0.02}>
              <Toon color="#2b2540" />
              <Ink t={0.02} />
            </RoundedBox>
            <mesh position={[0, 0, 0.03]}>
              <planeGeometry args={[0.5, 0.64]} />
              <meshBasicMaterial map={menuTex} toneMapped={false} />
            </mesh>
            <Badge label="SKILLS" fill="#14a8a8" position={[0, 0.62, 0]} />
          </group>

          {/* sombrilla */}
          <group
            ref={sombrilla}
            position={[-0.95, 1.15, -0.35]}
            rotation={[0, 0, 0.17]}
            {...spot('redes')}
          >
            <Badge label="REDES" fill="#ff5a3c" position={[2.7, 1.1, 0.3]} />
            <group ref={umbrella}>
              <mesh position={[0, 1.15, 0]}>
                <cylinderGeometry args={[0.035, 0.035, 2.3, 10]} />
                <Toon color="#fff7ea" ramp={RAMP_SOFT} />
                <Ink t={0.05} />
              </mesh>
              <group ref={canopy} position={[0, 2.32, 0]}>
                <mesh geometry={canopyGeo}>
                  <meshToonMaterial
                    map={stripes}
                    gradientMap={toonRamp(RAMP_MAIN, [0.4, 0.68, 1])}
                    side={THREE.DoubleSide}
                  />
                  <Ink t={0.014} />
                </mesh>
                <group ref={tassels}>
                  {Array.from({ length: 16 }, (_, i) => {
                    const a = (i / 16) * Math.PI * 2;
                    return (
                      <mesh
                        key={i}
                        position={[Math.cos(a) * 1.47, -0.7, Math.sin(a) * 1.47]}
                        rotation={[0, -a, 0]}
                      >
                        <boxGeometry args={[0.055, 0.16, 0.02]} />
                        <Toon color={i % 2 ? '#ffc93c' : '#14a8a8'} ramp={RAMP_SOFT} />
                      </mesh>
                    );
                  })}
                </group>
              </group>
              <mesh position={[0, 2.44, 0]}>
                <sphereGeometry args={[0.06, 12, 10]} />
                <Toon color="#ff5a3c" />
              </mesh>
            </group>
          </group>

          <Sparkles origin={[0, 0, 0]} />
        </group>
      </group>
    </>
  );
}
