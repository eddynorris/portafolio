import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import { CameraRig } from './CameraRig';
import { Clouds, Ground, Sea } from './Ground';
import { Sky } from './Sky';
import { Lights } from './Lights';
import { Env } from './Env';
import { ModelHost } from './ModelHost';
import { SceneThemeCtx, getSceneTheme, useSceneTheme } from './sceneTheme';
import { attachPointer, scrollY } from './pointer';
import { prefersReduced } from './anim';
import { getFocus } from './store';
import { useTheme } from '../../scripts/theme';

/** Da vueltas al modelo conforme haces scroll. */
function SpinOnScroll() {
  const g = useRef<THREE.Group>(null!);
  const target = useRef(0);
  const reduced = prefersReduced();

  useEffect(() => {
    attachPointer();
    const on = () => {
      if (getFocus()) return;
      target.current = reduced ? 0 : -scrollY() * 0.0022;
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [reduced]);

  useFrame((_, dt) => {
    if (!g.current) return;
    const k = 1 - Math.pow(0.004, Math.min(dt, 0.05));
    g.current.rotation.y += (target.current - g.current.rotation.y) * k;
  });

  return (
    <group ref={g}>
      <ModelHost offset={0.25} />
    </group>
  );
}

/** Pausa el render cuando el hero sale del viewport (no en móviles reducidos). */
function FrameloopPause() {
  const gl = useThree((s) => s.gl);
  const setFrameloop = useThree((s) => s.setFrameloop);
  useEffect(() => {
    const el = gl.domElement.parentElement;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([e]) => setFrameloop(e.isIntersecting ? 'always' : 'never'),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [gl, setFrameloop]);
  return null;
}

/** Bloom + viñeta, cargados en diferido y solo en escritorio sin reduced-motion. */
const PostFX = lazy(async () => {
  const m = await import('@react-three/postprocessing');
  function FX() {
    const cfg = useSceneTheme();
    return (
      <m.EffectComposer multisampling={4}>
        <m.Bloom
          mipmapBlur
          intensity={cfg.bloom.intensity}
          luminanceThreshold={cfg.bloom.threshold}
          luminanceSmoothing={0.2}
        />
        <m.Vignette offset={0.26} darkness={0.42} />
      </m.EffectComposer>
    );
  }
  return { default: FX };
});

function BloomGate() {
  const width = useThree((s) => s.size.width);
  const reduced = prefersReduced();
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (reduced || width < 900) {
      setOn(false);
      return;
    }
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const id = ric ? ric(() => setOn(true)) : window.setTimeout(() => setOn(true), 350);
    return () => {
      if (!ric && id) window.clearTimeout(id as number);
    };
  }, [reduced, width]);
  if (!on) return null;
  return (
    <Suspense fallback={null}>
      <PostFX />
    </Suspense>
  );
}

export function Scene() {
  const theme = useTheme();
  const cfg = getSceneTheme(theme);

  return (
    <Canvas
      flat
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      camera={{ fov: 36, near: 0.1, far: 300, position: [4, 11, 26] }}
      style={{ position: 'absolute', inset: 0 }}
      onCreated={({ gl, scene }) => {
        if (import.meta.env.DEV) {
          (window as unknown as Record<string, unknown>).__heroGL = gl;
          (window as unknown as Record<string, unknown>).__heroScene = scene;
        }
      }}
    >
      <SceneThemeCtx.Provider value={cfg}>
        <Sky />
        <Lights />
        <Env />

        <Sea />
        <Ground />
        <Clouds />
        <SpinOnScroll />

        <CameraRig />
        <BloomGate />
        <FrameloopPause />
      </SceneThemeCtx.Provider>
    </Canvas>
  );
}
