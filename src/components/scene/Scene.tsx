import { useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import { CevicheCart } from './CevicheCart';
import { CameraRig } from './CameraRig';
import { Clouds, Ground, Sea } from './Ground';
import { Sky } from './Sky';
import { attachPointer, scrollY } from './pointer';
import { prefersReduced } from './anim';

/** Da vueltas al carrito conforme haces scroll. */
function SpinOnScroll() {
  const g = useRef<THREE.Group>(null!);
  const target = useRef(0);
  const reduced = prefersReduced();

  useEffect(() => {
    attachPointer();
    const on = () => (target.current = reduced ? 0 : -scrollY() * 0.0022);
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
      <CevicheCart offset={0.25} />
    </group>
  );
}

export function Scene() {
  return (
    <Canvas
      flat
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      camera={{ fov: 36, near: 0.1, far: 300, position: [4, 11, 26] }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Sky />

      <ambientLight intensity={0.5} />
      <hemisphereLight args={['#fff4dd', '#8ed7ff', 0.55]} />
      <directionalLight position={[5, 8, 6]} intensity={1.55} color="#fff6e2" />
      <directionalLight position={[-6, 3, -4]} intensity={0.55} color="#9adcff" />

      <Sea />
      <Ground />
      <Clouds />
      <SpinOnScroll />

      <CameraRig />

      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={0.55} luminanceThreshold={0.92} luminanceSmoothing={0.2} />
        <Vignette offset={0.26} darkness={0.42} />
      </EffectComposer>
    </Canvas>
  );
}
