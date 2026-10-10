import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { CevicheCart } from './CevicheCart';
import {
  effectiveModelSrc,
  getSceneTheme,
  resolveModelUrl,
  useSceneTheme,
  type SceneThemeCfg,
} from './sceneTheme';
import { setFocus, type HotspotId } from './store';
import { useTheme } from '../../scripts/theme';

/** Ancho de encuadre por hotspot (unidades de mundo), para el zoom de cámara. */
const FIT: Record<HotspotId, number> = { proyectos: 2.1, skills: 1.2, redes: 3.6 };
const KNOWN = new Set<HotspotId>(['proyectos', 'skills', 'redes']);

/* ------------------------------------------------------------------ */
/*  Fallback si un GLB no carga (ruta mal escrita, 404, etc.)         */
/* ------------------------------------------------------------------ */

class ModelErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn('[hero] no se pudo cargar el GLB, uso el carrito procedural:', err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/* ------------------------------------------------------------------ */
/*  Modelo GLB                                                        */
/* ------------------------------------------------------------------ */

function prefixName(o: THREE.Object3D) {
  return o.name ?? '';
}

/**
 * Instancia un GLB: clona materiales (para no tocar la caché de drei),
 * cablea nodos `interact_*` (clics) y gestiona `emissive_*` (se encienden
 * de noche). El crossfade se controla con `opacity` (0..1).
 */
function GlbModel({
  url,
  cfg,
  offset,
  opacity,
  registerNodes,
}: {
  url: string;
  cfg: SceneThemeCfg;
  offset: number;
  /** objetivo de opacidad 0..1 (crossfade); se interpola en useFrame. */
  opacity: { current: number; target: number };
  registerNodes?: (nodes: Map<HotspotId, THREE.Object3D>) => void;
}) {
  const gltf = useGLTF(url);

  const built = useMemo(() => {
    const root = gltf.scene.clone(true);
    const mats: THREE.MeshStandardMaterial[] = [];
    const emissive: { mesh: THREE.Mesh; base: THREE.Color; baseI: number }[] = [];
    const interact = new Map<HotspotId, THREE.Object3D>();

    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        // clona materiales: la caché de drei conserva los originales
        const clone = (m: THREE.Material) => {
          const c = m.clone() as THREE.MeshStandardMaterial;
          if (c.emissive) {
            emissive.push({ mesh, base: c.emissive.clone(), baseI: c.emissiveIntensity ?? 1 });
          }
          return c;
        };
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map(clone)
          : clone(mesh.material as THREE.Material);
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) =>
          mats.push(m as THREE.MeshStandardMaterial),
        );
      }

      const name = prefixName(o);
      if (name.startsWith('interact_')) {
        const suffix = name.slice('interact_'.length) as HotspotId;
        const id = cfg.hotspots?.[name] ?? cfg.hotspots?.[suffix] ?? suffix;
        if (KNOWN.has(id)) interact.set(id, o);
        else console.warn(`[hero] nodo ${name} no mapea a un hotspot conocido`);
      }
    });

    return { root, mats, emissive, interact };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf, cfg.hotspots]);

  useEffect(() => {
    registerNodes?.(built.interact);
    return () => registerNodes?.(new Map());
  }, [built, registerNodes]);

  // crossfade + emisión, en un solo useFrame
  useFrame((_, dt) => {
    const k = 1 - Math.pow(0.0015, Math.min(dt, 0.05));
    opacity.current += (opacity.target - opacity.current) * k;
    const o = opacity.current;
    for (const m of built.mats) {
      if (o < 0.999) {
        m.transparent = true;
        m.opacity = o;
        m.depthWrite = o > 0.6;
      } else if (m.transparent) {
        m.transparent = false;
        m.opacity = 1;
        m.depthWrite = true;
      }
    }
    const em = cfg.emissionMultiplier;
    for (const e of built.emissive) {
      const target = e.baseI * em;
      const mat = e.mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity += (target - mat.emissiveIntensity) * k;
    }
  });

  return <primitive object={built.root} position={cfg.model.position} scale={cfg.model.scale} rotation={cfg.model.rotation} />;
}

/* ------------------------------------------------------------------ */
/*  Picking manual para nodos interact_* del GLB                       */
/* ------------------------------------------------------------------ */

function GlbPicker({ nodes, offset }: { nodes: Map<HotspotId, THREE.Object3D>; offset: number }) {
  const gl = useThree((s) => s.gl);
  const raycaster = useThree((s) => s.raycaster);
  const camera = useThree((s) => s.camera);
  const [hover, setHover] = useState<HotspotId | null>(null);

  useEffect(() => {
    const el = gl.domElement;
    if (!nodes.size) return;

    const pick = (cx: number, cy: number) => {
      const rect = el.getBoundingClientRect();
      const x = ((cx - rect.left) / rect.width) * 2 - 1;
      const y = -((cy - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
      for (const [id, obj] of nodes) {
        if (raycaster.intersectObject(obj, true).length) return { id, obj };
      }
      return null;
    };

    const onMove = (e: PointerEvent) => {
      const hit = pick(e.clientX, e.clientY);
      setHover(hit?.id ?? null);
      document.body.style.cursor = hit ? 'pointer' : '';
    };
    const onDown = (e: PointerEvent) => {
      const hit = pick(e.clientX, e.clientY);
      if (!hit) return;
      const anchor = hit.obj;
      const world = new THREE.Vector3(0, 0, 0);
      anchor.localToWorld(world);
      const dir = camera.position.clone().sub(world).normalize();
      setFocus({ id: hit.id, anchor, offset: world.clone().sub(anchor.getWorldPosition(new THREE.Vector3())), dir, fit: FIT[hit.id] });
    };
    const onLeave = () => {
      setHover(null);
      document.body.style.cursor = '';
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerleave', onLeave);
      document.body.style.cursor = '';
    };
  }, [nodes, gl, raycaster, camera, offset]);

  // realce sencillo al pasar el puntero
  useFrame(() => {
    for (const [id, obj] of nodes) {
      const s = hover === id ? 1.06 : 1;
      obj.scale.lerp(new THREE.Vector3(s, s, s), 0.2);
    }
  });

  return null;
}

/* ------------------------------------------------------------------ */
/*  Anfitrión: procedural o GLB (con crossfade entre temas)            */
/* ------------------------------------------------------------------ */

let uid = 0;

export function ModelHost({ offset = 0 }: { offset?: number }) {
  const theme = useTheme();
  const cfg = useSceneTheme();
  const desiredUrl = useMemo(() => {
    const src = effectiveModelSrc(theme);
    return src ? resolveModelUrl(src) : null;
  }, [theme]);

  // Instancias vivas: { url|null (null = procedural), opacidad }
  const [live, setLive] = useState<{ key: number; url: string | null; opacity: { current: number; target: number } }[]>([
    { key: uid++, url: desiredUrl, opacity: { current: 1, target: 1 } },
  ]);
  const currentUrl = live.length ? live[live.length - 1].url : null;

  useEffect(() => {
    if (desiredUrl === currentUrl) return;

    const bothGlb = desiredUrl !== null && currentUrl !== null;
    // crossfade solo entre dos GLB distintos; con procedural es swap seco
    const fadeOld = bothGlb;

    const incoming = {
      key: uid++,
      url: desiredUrl,
      opacity: { current: fadeOld ? 0 : 1, target: 1 },
    };

    setLive((prev) => {
      const kept = prev.map((p) => ({ ...p, opacity: { ...p.opacity, target: fadeOld ? 0 : p.opacity.target } }));
      return [...kept, incoming];
    });
    // limpieza de las que terminaron de fundirse
    const t = setTimeout(() => {
      setLive((prev) => prev.filter((p) => p.opacity.target !== 0 || p.url === desiredUrl));
    }, 700);
    return () => clearTimeout(t);
  }, [desiredUrl, currentUrl]);

  // recolecta nodos interact_* del modelo activo (el último)
  const [nodes, setNodes] = useState<Map<HotspotId, THREE.Object3D>>(new Map());
  const activeKey = live.length ? live[live.length - 1].key : -1;

  return (
    <>
      {live.map((inst) => {
        if (inst.url === null) {
          // carrito procedural
          return <CevicheCart key={inst.key} offset={offset} />;
        }
        return (
          <ModelErrorBoundary key={inst.key} fallback={<CevicheCart offset={offset} />}>
            <Suspense fallback={null}>
              <GlbModel
                url={inst.url}
                cfg={cfg}
                offset={offset}
                opacity={inst.opacity}
                registerNodes={inst.key === activeKey ? setNodes : undefined}
              />
            </Suspense>
          </ModelErrorBoundary>
        );
      })}
      <GlbPicker nodes={nodes} offset={offset} />
    </>
  );
}

/* Preload de los GLB definidos para que el crossfade no parpadee. */
function preloadAll() {
  for (const id of ['light', 'night'] as const) {
    const src = getSceneTheme(id).model.src;
    if (src) {
      try {
        useGLTF.preload(resolveModelUrl(src));
      } catch {
        /* la precarga es best-effort */
      }
    }
  }
}
if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
  (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(preloadAll);
} else if (typeof window !== 'undefined') {
  setTimeout(preloadAll, 2000);
}
