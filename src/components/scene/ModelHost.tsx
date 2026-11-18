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
import { getFocus, hotspotApi, hover, intro, setFocus, type HotspotId } from './store';
import { HotspotPins } from './HotspotPins';

/** Tinte cálido que recibe la pieza del carrito bajo el cursor. */
const HOVER_GLOW = new THREE.Color('#5a3412');
import { useTheme } from '../../scripts/theme';

/** Ancho de encuadre por hotspot (unidades de mundo), para el zoom de cámara. */
const FIT: Record<HotspotId, number> = { proyectos: 1.9, skills: 1.75, redes: 3.4 };
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
 * cablea nodos interactivos (`interact_*` o nombres listados en `cfg.hotspots`)
 * y gestiona `emissive_*` (se encienden de noche). El crossfade se controla
 * con `opacity` (0..1).
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
  registerNodes?: (nodes: Map<HotspotId, THREE.Object3D[]>) => void;
}) {
  const gltf = useGLTF(url);

  const built = useMemo(() => {
    const root = gltf.scene.clone(true);
    const mats: THREE.MeshStandardMaterial[] = [];
    const emissive: { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; base: THREE.Color; baseI: number; id: HotspotId | null }[] = [];
    const interact = new Map<HotspotId, THREE.Object3D[]>();

    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        // clona materiales: la caché de drei conserva los originales
        const clone = (m: THREE.Material) => {
          const c = m.clone() as THREE.MeshStandardMaterial;
          if (c.emissive) {
            emissive.push({ mesh, mat: c, base: c.emissive.clone(), baseI: c.emissiveIntensity ?? 1, id: null });
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
      const isInteract = name.startsWith('interact_');
      const suffix = isInteract ? (name.slice('interact_'.length) as HotspotId) : null;
      const id = cfg.hotspots?.[name] ?? (suffix ? (cfg.hotspots?.[suffix] ?? suffix) : null);
      if (id && KNOWN.has(id)) {
        const bucket = interact.get(id);
        if (bucket) bucket.push(o);
        else interact.set(id, [o]);
      } else if (isInteract) {
        console.warn(`[hero] nodo ${name} no mapea a un hotspot conocido`);
      }
    });

    // a qué hotspot pertenece cada material (para resaltarlo al pasar el mouse)
    for (const [id, objs] of interact) {
      for (const obj of objs) {
        obj.traverse((o) => {
          for (const e of emissive) if (e.mesh === o) e.id = id;
        });
      }
    }

    return { root, mats, emissive, interact };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf, cfg.hotspots]);

  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    // compila los shaders del carrito en paralelo antes de mostrarlo (sin congelar la página)
    const root = built.root;
    let alive = true;
    root.traverse((o) => o.layers.set(31));
    const show = () => {
      if (!alive) return;
      root.traverse((o) => o.layers.set(0));
      requestAnimationFrame(() => {
        if (intro.at < 0) intro.at = performance.now() / 1000;
        window.dispatchEvent(new Event('hero:ready'));
      });
    };
    gl.compileAsync(root, camera, scene).then(show, show);
    return () => {
      alive = false;
    };
  }, [built, gl, camera, scene]);

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
    const kh = 1 - Math.pow(0.0005, Math.min(dt, 0.05));
    for (const e of built.emissive) {
      const target = e.baseI * em;
      e.mat.emissiveIntensity += (target - e.mat.emissiveIntensity) * k;
      const lit = e.id !== null && hover.id === e.id;
      e.mat.emissive.lerp(lit ? HOVER_GLOW : e.base, kh);
    }
  });

  return <primitive object={built.root} position={cfg.model.position} scale={cfg.model.scale} rotation={cfg.model.rotation} />;
}

/* ------------------------------------------------------------------ */
/*  Picking manual para nodos interact_* del GLB                       */
/* ------------------------------------------------------------------ */

function GlbPicker({
  nodes,
  offset,
}: {
  nodes: Map<HotspotId, THREE.Object3D[]>;
  offset: number;
}) {
  const gl = useThree((s) => s.gl);
  const raycaster = useThree((s) => s.raycaster);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const el = gl.domElement;
    if (!nodes.size) return;

    const pick = (cx: number, cy: number) => {
      const rect = el.getBoundingClientRect();
      const x = ((cx - rect.left) / rect.width) * 2 - 1;
      const y = -((cy - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
      let best: { id: HotspotId; d: number } | null = null;
      for (const [id, objs] of nodes) {
        for (const obj of objs) {
          const hit = raycaster.intersectObject(obj, true)[0];
          if (hit && (!best || hit.distance < best.d)) best = { id, d: hit.distance };
        }
      }
      return best;
    };

    /** Enfoca el centro real de la pieza (los nodos del GLB tienen origen en 0,0,0). */
    const focus = (id: HotspotId) => {
      const objs = nodes.get(id);
      if (!objs?.length) return;
      const box = new THREE.Box3();
      objs.forEach((o) => box.expandByObject(o));
      const center = box.getCenter(new THREE.Vector3());
      const anchor = objs[0];
      const offset = anchor.worldToLocal(center.clone());
      // de frente a la pieza, algo elevado y hacia el lado de la cámara
      const dir = camera.position.clone().sub(center);
      dir.y = Math.max(dir.y, 0.25 * dir.length());
      dir.normalize();
      setFocus({ id, anchor, offset, dir, fit: FIT[id] });
    };
    hotspotApi.focus = focus;

    const onMove = (e: PointerEvent) => {
      if (getFocus()) return;
      const hit = pick(e.clientX, e.clientY);
      hover.id = hit?.id ?? null;
      document.body.style.cursor = hit ? 'pointer' : '';
    };
    const onDown = (e: PointerEvent) => {
      if (getFocus()) return;
      const hit = pick(e.clientX, e.clientY);
      if (hit) focus(hit.id);
    };
    const onLeave = () => {
      hover.id = null;
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
      if (hotspotApi.focus === focus) hotspotApi.focus = null;
    };
  }, [nodes, gl, raycaster, camera, offset]);

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
  const [nodes, setNodes] = useState<Map<HotspotId, THREE.Object3D[]>>(new Map());
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
      <HotspotPins nodes={nodes} />
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
// arranca la descarga del GLB en cuanto carga este módulo (drei la deduplica con useGLTF)
if (typeof window !== 'undefined') preloadAll();
