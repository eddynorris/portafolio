import { Component, useEffect, useState, type ReactNode } from 'react';
import { HERO_WEBGL_LOST, Scene } from './scene/Scene';

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

/**
 * Fallback estático (sin WebGL o con prefers-reduced-motion).
 * Escena CSS que respeta los tokens del tema: cielo, mar, isla y un
 * mini-carrito de ceviche dibujado con SVG. Sin canvas, sin animación.
 */
function HeroStatic() {
  return (
    <div className="heroStatic" aria-hidden="true">
      <div className="heroStatic__sky" />
      <div className="heroStatic__sea" />
      <div className="heroStatic__island" />
      <svg className="heroStatic__cart" viewBox="0 0 120 90" role="presentation">
        {/* toldo */}
        <path d="M18 34 Q60 6 102 34 L96 40 Q60 18 24 40 Z" fill="var(--aji)" stroke="var(--ink)" strokeWidth="3" />
        {/* chasis */}
        <rect x="30" y="40" width="60" height="22" rx="4" fill="var(--cream)" stroke="var(--ink)" strokeWidth="3" />
        <rect x="30" y="52" width="60" height="8" fill="var(--teal)" />
        {/* ruedas */}
        <circle cx="42" cy="66" r="7" fill="var(--ink)" />
        <circle cx="78" cy="66" r="7" fill="var(--ink)" />
        {/* letrero */}
        <rect x="44" y="20" width="32" height="16" rx="3" fill="var(--amarillo)" stroke="var(--ink)" strokeWidth="3" />
        {/* poste */}
        <rect x="58" y="30" width="4" height="12" fill="var(--ink)" />
      </svg>
    </div>
  );
}

/** Si la escena 3D revienta en render, mostramos el héroe estático en vez de un hueco. */
class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn('[hero] la escena 3D falló, uso el héroe estático:', err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function HeroScene() {
  const [mode, setMode] = useState<'scene' | 'static' | null>(null);

  useEffect(() => {
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setMode(reduced || !hasWebGL() ? 'static' : 'scene');
    const onLost = () => setMode('static');
    window.addEventListener(HERO_WEBGL_LOST, onLost);
    return () => window.removeEventListener(HERO_WEBGL_LOST, onLost);
  }, []);

  if (mode === null) return null; // resolvemos tras hidratar (evita SSR/cliente mismatch)
  if (mode === 'static') return <HeroStatic />;
  return (
    <SceneBoundary fallback={<HeroStatic />}>
      <Scene />
    </SceneBoundary>
  );
}
