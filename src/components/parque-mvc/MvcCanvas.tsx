import { useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Island } from '../parque/park/Island';
import { simTick } from '../parque/park/simClock';
import { Structures } from './Structures';
import { Flow } from './Guests';
import { ESPINA, VALLAS, VALLAS_EXTRA, type SitioId } from './layout';

/** Unidades de mundo que deben caber en el menor lado del lienzo. */
const FIT_W = 45;
const FIT_H = 28;

/** Congela o acelera el reloj del parque. Va primero: los demás lo leen. */
function SimDriver({ playing, speed }: { playing: boolean; speed: number }) {
  useFrame((_, dt) => simTick(dt, playing, speed));
  return null;
}

/** Cámara isométrica que siempre encaja la isla entera. */
function Camara() {
  const { size, camera } = useThree();
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera;
    cam.position.set(48, 44, 48);
    cam.zoom = Math.min(size.width / FIT_W, size.height / FIT_H);
    cam.lookAt(0, 1.5, 0);
    cam.updateProjectionMatrix();
  }, [size, camera]);
  return null;
}

export function MvcCanvas({
  playing,
  speed,
  labels,
  selected,
  onSelect,
  resetTick,
}: {
  playing: boolean;
  speed: number;
  labels: boolean;
  selected: SitioId | null;
  onSelect: (id: SitioId | null) => void;
  resetTick: number;
}) {
  return (
    <Canvas
      flat
      dpr={[1, 2]}
      orthographic
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      camera={{ position: [48, 44, 48], near: 0.1, far: 400, zoom: 1 }}
      onPointerMissed={() => onSelect(null)}
      style={{ position: 'absolute', inset: 0 }}
    >
      <color attach="background" args={['#bde8ff']} />

      <SimDriver playing={playing} speed={speed} />
      <Camara />

      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#fff4dd', '#a8e6ff', 0.55]} />
      <directionalLight position={[14, 22, 10]} intensity={1.5} color="#fff6e2" />
      <directionalLight position={[-12, 8, -8]} intensity={0.5} color="#9adcff" />

      <Island paths={[ESPINA]} vallas={VALLAS} vallasExtra={VALLAS_EXTRA} />
      <Structures selected={selected} onSelect={onSelect} labels={labels} />
      <Flow playing={playing} speed={speed} resetTick={resetTick} />
    </Canvas>
  );
}
