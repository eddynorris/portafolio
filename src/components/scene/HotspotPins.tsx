import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type * as THREE from 'three';
import { getFocus, hotspotApi, hover, introElapsed, type HotspotId } from './store';
import { storyProgress } from './story';

/** Dónde flota cada etiqueta (espacio local del carrito). */
const PINS: { id: HotspotId; label: string; pos: [number, number, number] }[] = [
  { id: 'proyectos', label: 'Proyectos', pos: [0.98, 1.2, 0.5] },
  { id: 'skills', label: 'Skills', pos: [-0.78, 1.62, 0.5] },
  { id: 'redes', label: 'Redes', pos: [0.05, 2.42, 0.3] },
];

/**
 * Etiquetas flotantes sobre el carrito: dicen qué se puede tocar.
 * Aparecen tras la entrada de cámara, solo en la estación del hero.
 */
export function HotspotPins({ nodes }: { nodes: Map<HotspotId, THREE.Object3D[]> }) {
  const [show, setShow] = useState(false);
  const shown = useRef(false);

  useFrame(() => {
    const next = nodes.size > 0 && introElapsed() > 2.4 && !getFocus() && storyProgress() < 0.45;
    if (next !== shown.current) {
      shown.current = next;
      setShow(next);
    }
  });

  if (!nodes.size) return null;

  return (
    <>
      {PINS.map((p, i) => (
        <Html key={p.id} position={p.pos} center zIndexRange={[5, 0]}>
          <button
            type="button"
            tabIndex={-1}
            className={`pin${show ? ' is-on' : ''}`}
            style={{ transitionDelay: show ? `${i * 90}ms` : '0ms' }}
            onPointerEnter={() => {
              hover.id = p.id;
            }}
            onPointerLeave={() => {
              hover.id = null;
            }}
            onClick={() => {
              hover.id = null;
              hotspotApi.focus?.(p.id);
            }}
          >
            <span className="pin__dot" aria-hidden="true" />
            {p.label}
          </button>
        </Html>
      ))}
    </>
  );
}
