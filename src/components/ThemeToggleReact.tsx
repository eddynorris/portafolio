import { useEffect, useState } from 'react';
import { getTheme, toggleTheme, useTheme } from '../scripts/theme';

/**
 * Toggle de tema accesible para las barras hechas en React (parques).
 * Misma fuente de verdad que ThemeToggle.astro: src/scripts/theme.ts.
 */
export function ThemeToggleReact() {
  const theme = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Durante el render en servidor / primer frame no conocemos el tema real;
  // tras montar, useTheme() ya refleja el atributo data-theme.
  const night = mounted ? theme === 'night' : false;

  return (
    <button
      className="themeToggle"
      type="button"
      aria-pressed={night}
      aria-label={night ? 'Cambiar a modo día' : 'Cambiar a modo noche'}
      title="Cambiar tema (día / noche)"
      onClick={() => {
        toggleTheme();
      }}
    >
      <svg
        className="themeToggle__icon themeToggle__icon--sun"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="4.2" fill="currentColor" />
        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="1.5" x2="12" y2="4" />
          <line x1="12" y1="20" x2="12" y2="22.5" />
          <line x1="1.5" y1="12" x2="4" y2="12" />
          <line x1="20" y1="12" x2="22.5" y2="12" />
          <line x1="4.6" y1="4.6" x2="6.4" y2="6.4" />
          <line x1="17.6" y1="17.6" x2="19.4" y2="19.4" />
          <line x1="4.6" y1="19.4" x2="6.4" y2="17.6" />
          <line x1="17.6" y1="6.4" x2="19.4" y2="4.6" />
        </g>
      </svg>
      <svg
        className="themeToggle__icon themeToggle__icon--moon"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path fill="currentColor" d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1Z" />
      </svg>
    </button>
  );
}
