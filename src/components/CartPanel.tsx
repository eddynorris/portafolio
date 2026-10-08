import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { enlaces, proyectos, skills, whatsapp } from '../data/portfolio';
import { getFocus, setFocus, subscribe, type HotspotId } from './scene/store';
import '../styles/cart-panel.css';

const META: Record<HotspotId, { eyebrow: string; title: string; sub: string }> = {
  proyectos: {
    eyebrow: 'Letrero del carrito',
    title: 'Proyectos',
    sub: 'Lo que anuncia el letrero: trabajos seleccionados.',
  },
  skills: {
    eyebrow: 'Menú del carrito',
    title: 'Skills',
    sub: 'El menú de hoy: con qué trabajo a diario.',
  },
  redes: {
    eyebrow: 'Bajo la sombrilla',
    title: 'Redes',
    sub: 'Dónde encontrarme: escríbeme o sígueme.',
  },
};

function ProjectCard({ p, i }: { p: (typeof proyectos)[number]; i: number }) {
  const inner = (
    <>
      <div className="cpCard__top" style={{ background: p.grad }}>
        <span className="cpCard__num">{String(i + 1).padStart(2, '0')}</span>
        <span className="cpCard__year">{p.año}</span>
      </div>
      <div className="cpCard__body">
        <h3>{p.titulo}</h3>
        <p>{p.resumen}</p>
        <ul className="cpTags">
          {p.tags.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
    </>
  );

  if (p.href && !p.href.startsWith('#')) {
    return (
      <a className="cpCard" href={p.href} target="_blank" rel="noreferrer">
        {inner}
      </a>
    );
  }
  return <div className="cpCard">{inner}</div>;
}

export default function CartPanel() {
  const focus = useSyncExternalStore(subscribe, getFocus, () => null);
  const open = focus !== null;
  const [shown, setShown] = useState<HotspotId>('proyectos');
  const root = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focus) setShown(focus.id);
  }, [focus]);

  useEffect(() => {
    if (root.current) root.current.inert = !open;
    if (!open) return;

    const sw = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (sw > 0) document.body.style.paddingRight = `${sw}px`;
    closeRef.current?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocus(null);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const meta = META[shown];
  const close = () => setFocus(null);

  return (
    <div
      ref={root}
      className={`cp${open ? ' is-open' : ''}`}
      role="dialog"
      aria-modal={open}
      aria-label={meta.title}
      aria-hidden={!open}
    >
      <div className="cp__backdrop" onClick={close} />

      <section className="cp__panel">
        <header className="cp__head">
          <div>
            <p className="eyebrow">{meta.eyebrow}</p>
            <h2 className="cp__title">{meta.title}</h2>
          </div>
          <button ref={closeRef} className="cp__close" type="button" onClick={close} aria-label="Cerrar panel">
            ✕
          </button>
        </header>

        <div className="cp__body">
          <p className="cp__sub">{meta.sub}</p>

          {shown === 'proyectos' &&
            proyectos.map((p, i) => <ProjectCard key={p.titulo} p={p} i={i} />)}

          {shown === 'skills' &&
            skills.map((g, i) => (
              <article className="cpGroup" key={g.grupo} style={{ animationDelay: `${i * 70}ms` }}>
                <div className="cpGroup__head">
                  <span className="cpGroup__i">{String(i + 1).padStart(2, '0')}</span>
                  <h3>{g.grupo}</h3>
                </div>
                <ul className="cpChips">
                  {g.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              </article>
            ))}

          {shown === 'redes' && (
            <>
              <ul className="cpLinks">
                {enlaces.map((e) => (
                  <li key={e.label}>
                    <a className="cpLink" href={e.href} target="_blank" rel="noreferrer">
                      {e.label} <span>↗</span>
                    </a>
                  </li>
                ))}
              </ul>
              <a
                className="btn cpWpp"
                href={`${whatsapp.href}?text=${encodeURIComponent('Hola Eddy, te escribo desde tu portafolio.')}`}
                target="_blank"
                rel="noreferrer"
              >
                Escríbeme por WhatsApp <span aria-hidden="true">↗</span>
              </a>
              <p className="cpNote">{whatsapp.visible}</p>
            </>
          )}
        </div>

        <p className="cp__hint">Esc o toca el fondo para cerrar</p>
      </section>
    </div>
  );
}
