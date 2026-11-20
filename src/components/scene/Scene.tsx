import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import {
  CanvasTexture,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PMREMGenerator,
  PlaneGeometry,
  Scene as Scene3,
  type WebGLRenderer,
} from 'three';
import type * as THREE from 'three';
import { CameraRig } from './CameraRig';
import { Sky } from './Sky';
import { Lights } from './Lights';
import { Env } from './Env';
import { ModelHost } from './ModelHost';
import { SceneThemeCtx, getSceneTheme, useSceneTheme } from './sceneTheme';
import { attachPointer } from './pointer';
import { prefersReduced } from './anim';
import { useTheme } from '../../scripts/theme';
import { NightMixDriver } from './beach/nightMix';
import { Water } from './beach/Water';
import { Island } from './beach/Island';
import { Palms } from './beach/Palms';
import { Boats, Caballitos, Crates, Pier, StringLights, Umbrella, WarmLight } from './beach/Props';
import { Cliffs, Islets, Lighthouse } from './beach/Backdrop';
import { Gulls, Pelicans } from './beach/Birds';
import { Clouds } from './beach/Clouds';
import { World } from './beach/World';

/** Balanceo suave del carrito en idle (la cámara se encarga del scroll). */
function CartIdle() {
  const g = useRef<THREE.Group>(null!);
  const reduced = prefersReduced();

  useEffect(() => {
    attachPointer();
  }, []);

  useFrame((state) => {
    if (!g.current || reduced) return;
    const t = state.clock.getElapsedTime();
    g.current.rotation.z = Math.sin(t * 0.55) * 0.008;
    g.current.rotation.y = Math.sin(t * 0.21) * 0.025;
  });

  return (
    <group ref={g}>
      <ModelHost offset={0.25} />
    </group>
  );
}

export const HERO_WEBGL_LOST = 'hero:webgl-lost';
/** Se emite cuando el modelo del carrito ya está en escena (para quitar el loader). */
export const HERO_READY = 'hero:ready';

/**
 * Sombra de contacto: mancha suave bajo el carrito (oclusión ambiental falsa).
 * Las sombras "reales" las pone la luz principal; esto solo lo asienta.
 */
function Contact() {
  const cfg = useSceneTheme();
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.45, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return new CanvasTexture(c);
  }, []);
  return (
    <mesh position={[0, 0.004, 0.02]} rotation={[-Math.PI / 2, 0, 0]} scale={[2.3, 1.4, 1]} renderOrder={2}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        alphaMap={tex}
        color={cfg.contactShadow.color}
        transparent
        opacity={cfg.contactShadow.opacity * 1.3}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-4}
      />
    </mesh>
  );
}

/**
 * Reflejos procedurales (sin red): una caja de luz imaginaria alrededor del
 * carrito, horneada a un PMREM de forma síncrona al crear el canvas. Así el
 * entorno existe antes de compilar cualquier shader y no hay recompilaciones.
 */
function bakeStudio(gl: WebGLRenderer) {
  const room = new Scene3();
  const add = (color: string, intensity: number, pos: [number, number, number], scale: [number, number], rotX = 0) => {
    const m = new Mesh(
      new PlaneGeometry(1, 1),
      new MeshBasicMaterial({ color: new Color(color).multiplyScalar(intensity), side: DoubleSide }),
    );
    m.position.set(...pos);
    m.scale.set(scale[0], scale[1], 1);
    m.rotation.x = rotX;
    m.lookAt(0, 0, 0);
    if (rotX) m.rotation.x = rotX;
    room.add(m);
  };
  room.background = new Color('#2a3140');
  add('#fff6e2', 1.6, [4, 6, 5], [8, 8]);
  add('#9adcff', 0.7, [-6, 3, -4], [8, 8]);
  add('#ffe9c9', 0.5, [0, -4, 2], [10, 10], Math.PI / 2);
  const pmrem = new PMREMGenerator(gl);
  const rt = pmrem.fromScene(room, 0.02);
  pmrem.dispose();
  return rt.texture;
}

/** Brisa: motas de arena de día, luciérnagas cálidas de noche. */
function Breeze({ night, mobile }: { night: boolean; mobile: boolean }) {
  if (prefersReduced()) return null;
  return (
    <Sparkles
      count={mobile ? 24 : 50}
      scale={[9, 3.2, 7]}
      position={[0, 1.5, 0.5]}
      size={night ? 3.2 : 2.2}
      speed={0.25}
      opacity={night ? 0.9 : 0.55}
      color={night ? '#ffcf7a' : '#fff3c4'}
      noise={1.2}
    />
  );
}

/**
 * Monta su contenido en una capa que la cámara no ve, compila los shaders
 * en paralelo (KHR_parallel_shader_compile vía compileAsync) y recién
 * entonces lo muestra: así la primera visita no congela la página.
 */
function Precompiled({ children }: { children: ReactNode }) {
  const g = useRef<THREE.Group>(null!);
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    const root = g.current;
    if (!root) return;
    let alive = true;
    const HIDDEN = 31;
    root.traverse((o) => o.layers.set(HIDDEN));
    const show = () => {
      if (!alive) return;
      root.traverse((o) => o.layers.set(0));
    };
    // da un frame para que los hijos creen sus materiales/geometrías
    const id = requestAnimationFrame(() => {
      gl.compileAsync(root, camera, scene).then(show, show);
    });
    return () => {
      alive = false;
      cancelAnimationFrame(id);
    };
  }, [gl, camera, scene]);

  return <group ref={g}>{children}</group>;
}

/** Fondo procedural antiguo: sólo si el diorama de Blender no carga. */
function ProceduralWorld() {
  return (
    <>
      <Island />
      <Palms />
      <Cliffs />
      <Islets />
      <Lighthouse />
    </>
  );
}

function Beach({ night, mobile }: { night: boolean; mobile: boolean }) {
  return (
    <>
      <Water />
      <World fallback={<ProceduralWorld />} />
      <Caballitos />
      <Crates />
      <Umbrella />
      <Pier />
      <Boats />
      <StringLights />
      <Clouds />
      <Pelicans />
      <Gulls />
      <Breeze night={night} mobile={mobile} />
    </>
  );
}

export function Scene() {
  const theme = useTheme();
  const cfg = getSceneTheme(theme);
  const [mobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 900);

  return (
    <Canvas
      flat
      shadows="percentage"
      dpr={mobile ? [1, 1.6] : [1, 2]}
      gl={{ antialias: true, alpha: false }}
      camera={{ fov: 36, near: 0.1, far: 400, position: [9, 11, 19] }}
      style={{ position: 'absolute', inset: 0 }}
      onCreated={({ gl, scene }) => {
        scene.environment = bakeStudio(gl);
        if (import.meta.env.DEV) {
          (window as unknown as Record<string, unknown>).__heroGL = gl;
          (window as unknown as Record<string, unknown>).__heroScene = scene;
        }
        // GPU/driver puede perder el contexto (crash, ahorro de energía).
        // Avisamos para caer al héroe estático en vez de dejar un hueco.
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          window.dispatchEvent(new Event(HERO_WEBGL_LOST));
        });
      }}
    >
      <SceneThemeCtx.Provider value={cfg}>
        <NightMixDriver />
        <Sky />
        <Lights mobile={mobile} />
        <WarmLight />
        <Env />

        <Precompiled>
          <Beach night={cfg.night > 0.5} mobile={mobile} />
        </Precompiled>

        <CartIdle />
        <Contact />

        <CameraRig />
      </SceneThemeCtx.Provider>
    </Canvas>
  );
}
