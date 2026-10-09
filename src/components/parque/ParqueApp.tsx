import { useEffect, useState } from 'react';
import { ParkCanvas } from './park/ParkCanvas';
import {
  CONCEPTOS,
  CONCEPTO_POR_ID,
  SITIOS,
  SITIO_A_CONCEPTO,
  type SitioId,
} from './park/layout';
import { prefersReduced } from '../scene/anim';
import '../../styles/parque.css';

const VELOCIDADES = [0.5, 1, 2];

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

const IconPause = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="5" y="4" width="5" height="16" rx="1.4" />
    <rect x="14" y="4" width="5" height="16" rx="1.4" />
  </svg>
);

const IconPlay = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 4.6v14.8c0 1 1.1 1.6 2 1.1l11-7.4c.8-.5.8-1.7 0-2.2L9 3.5c-.9-.5-2 .1-2 1.1z" />
  </svg>
);

const IconReset = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 5a7 7 0 1 0 6.3 4l-1.9.6A5 5 0 1 1 12 7v3l4.5-3.5L12 3v2z" />
  </svg>
);

const IconTag = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M11.6 3H20a1 1 0 0 1 1 1v8.4a1 1 0 0 1-.3.7l-7.6 7.6a1 1 0 0 1-1.4 0l-7.4-7.4a1 1 0 0 1 0-1.4l7.6-7.6a1 1 0 0 1 .7-.3zM16.5 7.5a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z" />
  </svg>
);

const IconDown = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M11.3 3.3a1 1 0 0 1 1.4 0l7.6 7.6a1 1 0 0 1-1.4 1.4L13 6.4V20a1 1 0 1 1-2 0V6.4L5.5 12.3a1 1 0 0 1-1.4-1.4l7.2-7.6z" />
  </svg>
);

const IDS_POR_CONCEPTO = CONCEPTOS.map((c) => SITIOS.find((s) => s.concepto === c.id)!.id);

export default function ParqueApp() {
  const [playing, setPlaying] = useState(() => !prefersReduced());
  const [speed, setSpeed] = useState(1);
  const [labels, setLabels] = useState(true);
  const [selected, setSelected] = useState<SitioId | null>(null);
  const [resetTick, setResetTick] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'BUTTON' || t.tagName === 'A' || t.tagName === 'INPUT')) return;
      e.preventDefault();
      setPlaying((p) => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const concepto = selected ? CONCEPTO_POR_ID[SITIO_A_CONCEPTO[selected]] : null;

  return (
    <div className="pk">
      <div className="pkStage">
        <div className="pkCanvas">
          <ParkCanvas
            playing={playing}
            speed={speed}
            labels={labels}
            selected={selected}
            onSelect={setSelected}
            resetTick={resetTick}
          />
        </div>

        <div className="pkHud">
          <div className="pkHead">
            <a className="pkHome" href={`${base}/`}>
              ← Inicio
            </a>
            <p className="pkCrumb">
              <a href={`${base}/educador`}>Educador</a>
              <span aria-hidden="true">/</span>
              DDD, Puertos y Adaptadores
            </p>
            <h1 className="pkTitle">Parque DDD</h1>
            <p className="pkSub">Dominio, puertos y adaptadores en miniatura</p>
          </div>

          <div className="pkControls" role="group" aria-label="Controles de la simulación">
            <button
              className="pkPlay"
              data-pausado={!playing}
              onClick={() => setPlaying((p) => !p)}
              aria-pressed={!playing}
              aria-label={playing ? 'Pausar el flujo' : 'Reanudar el flujo'}
              title={playing ? 'Pausar (espacio)' : 'Reanudar (espacio)'}
            >
              {playing ? <IconPause /> : <IconPlay />}
            </button>

            <div className="pkSeg" role="group" aria-label="Velocidad del flujo">
              <span>velocidad</span>
              {VELOCIDADES.map((v) => (
                <button
                  key={v}
                  onClick={() => setSpeed(v)}
                  aria-pressed={speed === v}
                  aria-label={`Velocidad ${v === 0.5 ? '0,5' : v} veces`}
                >
                  {v === 0.5 ? '0,5×' : `${v}×`}
                </button>
              ))}
            </div>

            <button
              className="pkBtn"
              onClick={() => {
                setResetTick((t) => t + 1);
                setSelected(null);
              }}
            >
              <IconReset />
              Reiniciar
            </button>

            <button
              className="pkBtn"
              onClick={() => setLabels((l) => !l)}
              aria-pressed={labels}
              aria-label="Mostrar u ocultar etiquetas"
            >
              <IconTag />
              Etiquetas
            </button>

            <a className="pkBtn" href="#manual">
              <IconDown />
              Manual
            </a>

            <span className="pkState" data-on={playing} aria-live="polite">
              <i />
              {playing ? `Flujo activo · ${speed === 0.5 ? '0,5' : speed}×` : 'Flujo en pausa'}
            </span>
          </div>
        </div>
      </div>

      <aside className="pkPanel" aria-label="Ficha del concepto seleccionado">
        <span className="pkPanelTag">{concepto ? concepto.tag : 'El parque'}</span>

        {concepto ? (
          <>
            <h2>{concepto.title}</h2>
            <p>{concepto.body}</p>
            <div className="pkRegla">
              <b>Regla:</b>
              {concepto.regla}
            </div>
          </>
        ) : (
          <>
            <h2>Dominio, puertos y adaptadores</h2>
            <div className="pkIntro">
              <p>
                Los invitados son <strong>solicitudes</strong> que entran por la taquilla, se
                procesan en el castillo y salen hacia la infraestructura. Toca un edificio —o usa
                los botones— para ver qué concepto representa.
              </p>
              <ul>
                <li>
                  <span className="pkSwatch" style={{ background: '#ff5a3c' }} />
                  Entrada: quien inicia la conversación (driving)
                </li>
                <li>
                  <span className="pkSwatch" style={{ background: '#14a8a8' }} />
                  Salida: a quien la aplicación llama (driven)
                </li>
                <li>
                  <span className="pkSwatch" style={{ background: '#ffc93c' }} />
                  Amarillo: selección y eventos de dominio
                </li>
              </ul>
            </div>
          </>
        )}

        <div className="pkChips" role="group" aria-label="Ir a un concepto">
          {CONCEPTOS.map((c, i) => (
            <button
              key={c.id}
              className="pkChip"
              aria-pressed={concepto?.id === c.id}
              onClick={() => setSelected(IDS_POR_CONCEPTO[i])}
            >
              {c.corto}
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
