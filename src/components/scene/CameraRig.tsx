import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { clamp01, easeOutQuint, prefersReduced } from './anim';
import { pointerNorm, scrollY } from './pointer';

const START = new THREE.Vector3(5.2, 8.6, 13.5);
const START_AT = new THREE.Vector3(0.4, 1.6, 0);

const START_M = new THREE.Vector3(3.4, 7.4, 17);
const START_AT_M = new THREE.Vector3(0, 1.4, 0);

const HERO_DESKTOP = {
  pos: new THREE.Vector3(0.3, 2.05, 7.2),
  at: new THREE.Vector3(-1.15, 1.45, 0),
};
const HERO_MOBILE = {
  pos: new THREE.Vector3(0, 2.65, 9.7),
  at: new THREE.Vector3(0, 1.05, 0),
};

const tmpPos = new THREE.Vector3();
const tmpAt = new THREE.Vector3();

export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const width = useThree((s) => s.size.width);
  const at = useRef(new THREE.Vector3());
  const reduced = prefersReduced();

  useFrame((state, dt) => {
    const t = state.clock.getElapsedTime();
    const mobile = width < 900;
    const hero = mobile ? HERO_MOBILE : HERO_DESKTOP;
    const start = mobile ? START_M : START;
    const startAt = mobile ? START_AT_M : START_AT;

    if (at.current.lengthSq() === 0) {
      at.current.copy(startAt);
      camera.position.copy(start);
      camera.lookAt(startAt);
    }

    const p = reduced ? 1 : easeOutQuint(clamp01((t - 0.15) / 2.2));
    tmpPos.copy(start).lerp(hero.pos, p);
    tmpAt.copy(startAt).lerp(hero.at, p);

    const settle = clamp01((p - 0.7) / 0.3);
    if (!reduced) {
      tmpPos.x += (Math.sin(t * 0.27) * 0.22 + pointerNorm.x * 0.5) * settle;
      tmpPos.y += (Math.cos(t * 0.21) * 0.12 + pointerNorm.y * 0.32) * settle;
      tmpAt.x += pointerNorm.x * 0.12 * settle;
      tmpAt.y += pointerNorm.y * 0.08 * settle;
    }

    const s = reduced ? 0 : scrollY();
    tmpPos.z += Math.min(s * 0.003, 4.5);
    tmpPos.y += Math.min(s * 0.0006, 1);
    tmpAt.y -= Math.min(s * 0.0005, 0.6);

    const k = 1 - Math.pow(0.0015, Math.min(dt, 0.05));
    camera.position.lerp(tmpPos, k);
    at.current.lerp(tmpAt, k);
    camera.lookAt(at.current);
  });

  return null;
}
