import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneTheme } from '../sceneTheme';
import { prefersReduced } from '../anim';
import { COAST_GLSL, SEA_Y, SHORE_GLSL } from './shore';
import { nm } from './nightMix';
import { SUN_DIR } from './sun';

const NOISE_GLSL = /* glsl */ `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
`;

const vertex = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const fragment = /* glsl */ `
uniform float uTime;
uniform float uNight;
uniform vec3 uShallow; uniform vec3 uMid; uniform vec3 uDeep; uniform vec3 uHorizon;
uniform vec3 uFoam; uniform vec3 uGlitter; uniform vec3 uSunDir;
uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
varying vec3 vWorld;
${SHORE_GLSL}
${COAST_GLSL}
${NOISE_GLSL}
void main() {
  vec2 p = vWorld.xz;
  float r = length(p);
  float th = atan(p.y, p.x);
  float d = r - shoreR(th);
  float t = uTime;

  // distancia a la playa de la Costa Verde (positiva mar adentro, dentro de la bahía)
  float dc = coastR(th) - r;
  float coastMask = 1.0 - smoothstep(0.92, 1.0, abs(coastU(th)));
  dc = mix(60.0, dc, coastMask);

  // color por "profundidad": turquesa en la orilla, azul profundo mar adentro
  vec3 c = mix(uShallow, uMid, smoothstep(0.0, 5.5, d));
  c = mix(c, uDeep, smoothstep(5.5, 42.0, d));
  // bajíos turquesa junto a la playa de la costa
  c = mix(c, uShallow, (1.0 - smoothstep(0.0, 7.0, dc)) * 0.85);

  // brillo cáustico en los bajíos
  float n1 = noise(p * 1.25 + vec2(t * 0.22, -t * 0.17));
  float n2 = noise(p * 1.9 - vec2(t * 0.18, t * 0.24));
  float caust = pow(1.0 - abs(n1 - n2), 9.0) * (1.0 - smoothstep(0.2, 4.5, d));
  c += caust * 0.22 * (1.0 - uNight * 0.75);

  // olas que llegan a la orilla (crestas rotas por ruido)
  float wn = noise(p * 0.22 + t * 0.03);
  float crest = smoothstep(0.88, 0.985, sin(d * 1.45 + t * 1.05 + wn * 5.0));
  crest *= smoothstep(0.6, 2.4, d) * (1.0 - smoothstep(7.0, 24.0, d));
  crest *= smoothstep(0.32, 0.62, noise(p * 0.85 + vec2(t * 0.08, 0.0)));

  // vetas de mar abierto
  float sn = noise(vec2(p.x * 0.11, p.y * 0.45) + vec2(t * 0.025, 0.0));
  float streak = smoothstep(0.76, 0.86, sn) * smoothstep(9.0, 20.0, d) * (1.0 - smoothstep(55.0, 95.0, d)) * 0.3;

  // espuma de orilla que sube y baja
  float swash = 0.17 * sin(t * 0.85 + th * 3.0) + 0.07 * sin(t * 1.6 + th * 7.0);
  float edge = d - swash;
  float foamEdge = 1.0 - smoothstep(0.0, 0.2 + 0.12 * noise(p * 3.2 + t * 0.7), edge);

  // franja de espuma que entra cada pocos segundos
  float cyc = fract(t * 0.24 + noise(vec2(th * 2.5, 1.0)) * 0.35);
  float bandPos = (1.0 - cyc) * 1.7;
  float band = (1.0 - smoothstep(0.0, 0.1, abs(edge - bandPos))) * cyc;
  band *= smoothstep(0.28, 0.6, noise(p * 2.6 + 3.0));

  // --- playa de la Costa Verde: espuma en la orilla y rompientes paralelas ---
  float swashC = 0.3 * sin(t * 0.7 + th * 38.0) + 0.12 * sin(t * 1.3 + th * 91.0);
  float edgeC = dc - swashC;
  float foamC = 1.0 - smoothstep(0.0, 0.4 + 0.25 * noise(p * 1.4 + t * 0.6), edgeC);
  float brk = smoothstep(0.9, 0.99, sin(dc * 1.1 - t * 1.15 + noise(p * 0.3) * 4.0));
  brk *= smoothstep(0.6, 2.2, dc) * (1.0 - smoothstep(6.0, 15.0, dc));
  brk *= smoothstep(0.35, 0.6, noise(p * 0.5 + vec2(0.0, t * 0.1)));
  float cycC = fract(t * 0.2 + noise(vec2(th * 30.0, 2.0)) * 0.4);
  float bandC = (1.0 - smoothstep(0.0, 0.18, abs(edgeC - (1.0 - cycC) * 2.2))) * cycC;
  bandC *= smoothstep(0.3, 0.6, noise(p * 1.8 + 5.0));

  float foam = clamp(foamEdge + band * 0.9 + crest * 0.8 + streak + foamC + brk * 0.85 + bandC * 0.8, 0.0, 1.0);
  c = mix(c, uFoam, foam * (1.0 - uNight * 0.35));

  // destellos del sol (o la luna) sobre el agua
  vec3 V = normalize(cameraPosition - vWorld);
  vec2 g = vec2(noise(p * 2.6 + t * 0.55) - 0.5, noise(p * 2.6 - t * 0.45 + 7.0) - 0.5);
  vec3 N = normalize(vec3(g.x * 0.42, 1.0, g.y * 0.42));
  float s = pow(max(dot(reflect(-V, N), normalize(uSunDir)), 0.0), 90.0);
  float tw = step(0.7, hash(floor(p * 5.0) + floor(t * 5.0)));
  c += uGlitter * s * (0.5 + tw * 2.2);

  // horizonte + bruma
  float dist = length(cameraPosition - vWorld);
  c = mix(c, uHorizon, smoothstep(30.0, 150.0, dist) * 0.9);
  c = mix(c, uFogColor, smoothstep(uFogNear, uFogFar, dist) * 0.6);

  float alpha = mix(0.5, 1.0, smoothstep(0.0, 2.8, d));
  alpha = min(alpha, mix(0.55, 1.0, smoothstep(0.0, 3.5, dc)));
  gl_FragColor = vec4(c, max(alpha, foam));
  #include <colorspace_fragment>
}
`;

/** Mar estilizado: un solo plano con shader (espuma, olas, bajíos y destellos). */
export function Water() {
  const cfg = useSceneTheme();
  const reduced = prefersReduced();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 8 },
      uNight: { value: cfg.night },
      uShallow: { value: new THREE.Color(cfg.water.shallow) },
      uMid: { value: new THREE.Color(cfg.water.mid) },
      uDeep: { value: new THREE.Color(cfg.water.deep) },
      uHorizon: { value: new THREE.Color(cfg.water.horizon) },
      uFoam: { value: new THREE.Color(cfg.water.foam) },
      uGlitter: { value: new THREE.Color(cfg.water.glitter) },
      uSunDir: { value: SUN_DIR.clone() },
      uFogColor: { value: new THREE.Color(cfg.fog?.color ?? '#ffffff') },
      uFogNear: { value: cfg.fog?.near ?? 1e4 },
      uFogFar: { value: cfg.fog?.far ?? 2e4 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const tmp = useMemo(() => new THREE.Color(), []);

  useFrame((_, dt) => {
    const k = 1 - Math.pow(0.002, Math.min(dt, 0.05));
    if (!reduced) uniforms.uTime.value += Math.min(dt, 0.05);
    uniforms.uNight.value = nm();
    const w = cfg.water;
    uniforms.uShallow.value.lerp(tmp.set(w.shallow), k);
    uniforms.uMid.value.lerp(tmp.set(w.mid), k);
    uniforms.uDeep.value.lerp(tmp.set(w.deep), k);
    uniforms.uHorizon.value.lerp(tmp.set(w.horizon), k);
    uniforms.uFoam.value.lerp(tmp.set(w.foam), k);
    uniforms.uGlitter.value.lerp(tmp.set(w.glitter), k);
    if (cfg.fog) {
      uniforms.uFogColor.value.lerp(tmp.set(cfg.fog.color), k);
      uniforms.uFogNear.value += (cfg.fog.near - uniforms.uFogNear.value) * k;
      uniforms.uFogFar.value += (cfg.fog.far - uniforms.uFogFar.value) * k;
    }
  });

  return (
    <mesh position={[0, SEA_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
      <circleGeometry args={[170, 128]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
        transparent
        depthWrite
      />
    </mesh>
  );
}
