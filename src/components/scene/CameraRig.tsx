import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { clamp, clamp01, easeOutQuint, prefersReduced } from './anim';
import { pointerNorm } from './pointer';
import { getFocus, introElapsed } from './store';
import { storyProgress } from './story';

type Station = {
  pos: THREE.Vector3;
  at: THREE.Vector3;
  /** dónde cae el sujeto en pantalla (0..1 desde la izquierda / desde abajo) */
  fx: number;
  fy: number;
};

const S = (pos: [number, number, number], at: [number, number, number], fx = 0.5, fy = 0.5): Station => ({
  pos: new THREE.Vector3(...pos),
  at: new THREE.Vector3(...at),
  fx,
  fy,
});

/* Estaciones del recorrido: hero, proyectos, educador, skills, contacto. */
const DESKTOP: Station[] = [
  S([1.6, 2.0, 6.6], [0.05, 1.2, 0], 0.68, 0.48),
  S([3.5, 1.85, 4.0], [0.7, 1.35, -0.4], 0.7, 0.5),
  S([14, 5.2, 5.5], [7, 0.3, -10], 0.68, 0.5),
  S([-1.7, 1.75, 3.0], [0, 1.4, 0.25], 0.7, 0.5),
  S([-10, 8.5, 12.5], [1.0, 0.2, -3.0], 0.64, 0.5),
];

const MOBILE: Station[] = [
  S([1.0, 2.6, 10.8], [0, 1.2, 0], 0.5, 0.67),
  S([4.6, 2.3, 6.4], [1.3, 1.35, -0.7], 0.5, 0.7),
  S([12.5, 4.2, 4.0], [8, 0.3, -9], 0.5, 0.7),
  S([-2.0, 2.4, 5.4], [0, 1.4, 0.2], 0.5, 0.7),
  S([-11, 10, 15.5], [0.5, 0, -3], 0.5, 0.66),
];

const START = new THREE.Vector3(9, 11, 19);
const START_M = new THREE.Vector3(6, 12, 24);

const PANEL_W = 470;

const tmpPos = new THREE.Vector3();
const tmpAt = new THREE.Vector3();
const tmpAnchor = new THREE.Vector3();

/** Interpola entre estaciones con una pausa en cada una (el sujeto "se queda" mientras lees). */
function sample(list: Station[], s: number, outPos: THREE.Vector3, outAt: THREE.Vector3) {
  const max = list.length - 1;
  const c = clamp(s, 0, max);
  const i = Math.min(Math.floor(c), max - 1);
  const f = c - i;
  const e = f < 0.2 ? 0 : f > 0.8 ? 1 : ((f - 0.2) / 0.6) ** 2 * (3 - 2 * ((f - 0.2) / 0.6));
  const a = list[i];
  const b = list[i + 1];
  outPos.copy(a.pos).lerp(b.pos, e);
  outAt.copy(a.at).lerp(b.at, e);
  return { fx: a.fx + (b.fx - a.fx) * e, fy: a.fy + (b.fy - a.fy) * e };
}

/** Desplaza el centro óptico para que el sujeto caiga en (fx, fy) de la pantalla. */
function applyShift(camera: THREE.PerspectiveCamera, fx: number, fy: number) {
  camera.updateProjectionMatrix();
  const e = camera.projectionMatrix.elements;
  e[8] += 1 - 2 * fx;
  e[9] += 1 - 2 * fy;
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}

export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const width = useThree((s) => s.size.width);
  const at = useRef(new THREE.Vector3());
  const shift = useRef({ fx: 0.5, fy: 0.5, init: false });
  const reduced = prefersReduced();

  useFrame((state, dt) => {
    const t = state.clock.getElapsedTime();
    const mobile = width < 900;
    const list = mobile ? MOBILE : DESKTOP;
    const start = mobile ? START_M : START;

    const s = storyProgress();
    const { fx, fy } = sample(list, s, tmpPos, tmpAt);

    if (!shift.current.init) {
      shift.current = { fx, fy, init: true };
      at.current.copy(tmpAt);
      camera.position.copy(start);
      camera.lookAt(tmpAt);
    }

    // entrada: desde lo alto hacia la primera estación (≈2.4 s), cuando ya cargó el carrito
    const ie = introElapsed();
    const p = reduced ? 1 : ie < 0 ? 0 : easeOutQuint(clamp01((ie - 0.15) / 2.4));
    tmpPos.lerpVectors(start, tmpPos, p);

    const settle = clamp01((p - 0.75) / 0.25);
    if (!reduced) {
      tmpPos.x += (Math.sin(t * 0.27) * 0.16 + pointerNorm.x * 0.38) * settle;
      tmpPos.y += (Math.cos(t * 0.21) * 0.08 + pointerNorm.y * 0.22) * settle;
      tmpAt.x += pointerNorm.x * 0.08 * settle;
      tmpAt.y += pointerNorm.y * 0.05 * settle;
    }

    let tfx = fx;
    let tfy = fy;

    /* zoom hacia la parte clicada del carrito */
    const f = getFocus();
    if (f) {
      tmpAnchor.copy(f.offset);
      f.anchor.localToWorld(tmpAnchor);
      const vTan = Math.tan((camera.fov * Math.PI) / 360);
      const hTan = vTan * Math.max(camera.aspect, 0.4);
      const d = clamp(f.fit / 2 / (hTan * 0.62), 1.4, 9);
      tmpPos.copy(tmpAnchor).addScaledVector(f.dir, d);
      tmpPos.y = Math.max(tmpPos.y, tmpAnchor.y - 1.2, 0.7);
      tmpAt.copy(tmpAnchor);
      // el panel tapa la derecha: el sujeto se centra en lo que queda visible
      const W = state.size.width;
      tfx = mobile ? 0.5 : Math.max(0.2, (W - Math.min(PANEL_W, W)) / 2 / W);
      tfy = mobile ? 0.62 : 0.5;
    }

    const k = 1 - Math.pow(f ? 0.03 : p < 1 ? 1e-9 : 0.012, Math.min(dt, 0.05));
    camera.position.lerp(tmpPos, k);
    at.current.lerp(tmpAt, k);
    camera.lookAt(at.current);

    const ks = 1 - Math.pow(0.02, Math.min(dt, 0.05));
    shift.current.fx += (tfx - shift.current.fx) * ks;
    shift.current.fy += (tfy - shift.current.fy) * ks;
    applyShift(camera, shift.current.fx, shift.current.fy);
  });

  return null;
}
