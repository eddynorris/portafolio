/* Contenido editable del portafolio.
   Cambia estos valores por los tuyos. */

export const perfil = {
  nombre: 'Eddy Arnold Orosco Prada',
  rol: 'Desarrollo de producto & agentes de IA',
  tagline:
    'Backend con Python, agentes de IA y video generativo; presentado con experiencias 3D que se sienten vivas.',
  ciudad: 'Lima, Perú',
  disponibilidad: 'Disponible para freelance',
};

export const whatsapp = {
  numero: '51927577215',
  visible: '+51 927 577 215',
  href: 'https://wa.me/51927577215',
};

export const enlaces = [
  { label: 'GitHub', href: 'https://github.com/eddynorris' },
];

export type Proyecto = {
  titulo: string;
  año: string;
  resumen: string;
  tags: string[];
  href: string;
  grad: string;
};

export const proyectos: Proyecto[] = [
  {
    titulo: 'Ceviche.js',
    año: '2025',
    resumen:
      'Librería de shaders cel-shading para la web: contornos estables, bandas de luz y controles de línea de velocidad.',
    tags: ['GLSL', 'Three.js', 'R&D'],
    href: '#',
    grad: 'linear-gradient(135deg, #7ed4ff 0%, #14a8a8 55%, #17122b 100%)',
  },
  {
    titulo: 'Feria Viva',
    año: '2025',
    resumen:
      'Sitio inmersivo para mercados gastronómicos con recorrido en cámara, puestos 3D y pedidos en línea.',
    tags: ['Astro', 'R3F', 'Stripe'],
    href: '#',
    grad: 'linear-gradient(135deg, #ffc93c 0%, #ff5a3c 60%, #ff4f9a 100%)',
  },
  {
    titulo: 'Ola Corta',
    año: '2024',
    resumen:
      'Visualizador de audio reactivo con ondas dibujadas a mano y sincronía a 60 fps en móviles.',
    tags: ['WebAudio', 'Canvas', 'Motion'],
    href: '#',
    grad: 'linear-gradient(135deg, #7ed957 0%, #14a8a8 50%, #2f9fe0 100%)',
  },
  {
    titulo: 'Kiosco',
    año: '2024',
    resumen:
      'Panel de contenidos con animaciones de transición tipo anime: squash, stretch y anticipation.',
    tags: ['React', 'GSAP', 'Design System'],
    href: '#',
    grad: 'linear-gradient(135deg, #fff7ea 0%, #ffc93c 45%, #ff5a3c 100%)',
  },
  {
    titulo: 'Moto Keep',
    año: '2023',
    resumen:
      'Aplicación de recordatorios con mascota 3D en WebGL que reacciona a tus hábitos.',
    tags: ['React Native', 'Expo', '3D'],
    href: '#',
    grad: 'linear-gradient(135deg, #17122b 0%, #4a4363 50%, #ff4f9a 100%)',
  },
  {
    titulo: 'Tinta Sur',
    año: '2023',
    resumen:
      'Identidad y sitio editorial para un colectivo de ilustración, con tipografía variable animada.',
    tags: ['Astro', 'CSS', 'Branding'],
    href: '#',
    grad: 'linear-gradient(135deg, #2f9fe0 0%, #7ed4ff 40%, #fff7ea 100%)',
  },
];

export const skills = [
  {
    grupo: 'Desarrollo y backend',
    items: ['Python', 'Flask', 'REST APIs', 'Supabase/PostgreSQL', 'Railway', 'HTML/JS'],
  },
  {
    grupo: 'Agentes de IA y desarrollo asistido',
    items: [
      'Claude Code',
      'Codex',
      'OpenCode',
      'Hermes Agent (Linux)',
      'Gemini API',
      'Bots de Telegram con IA',
    ],
  },
  {
    grupo: 'Video y contenido generativo',
    items: ['Seedance', 'Google Flow', 'ComfyUI', 'OBS'],
  },
];
