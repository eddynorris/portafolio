/* Contenido editable del portafolio.
   Datos alineados al CV de Eddy Arnold Orosco Prada. */

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export const perfil = {
  nombre: 'Eddy Arnold Orosco Prada',
  rol: 'Desarrollador de Software',
  tagline:
    'Full-Stack con Angular y Flask (Python), apps móviles con React Native, despliegues en la nube y herramientas de IA; presentado con experiencias 3D que se sienten vivas.',
  ciudad: 'Abancay, Perú',
  disponibilidad: 'Disponible para freelance',
};

export const cv = {
  nombre: 'Eddy Arnold Orosco Prada — CV',
  href: `${base}/cv/Eddy-Arnold-Orosco-Prada-CV.pdf`,
};

export const whatsapp = {
  numero: '51927577215',
  visible: '+51 927 577 215',
  href: 'https://wa.me/51927577215',
};

export const enlaces = [
  { label: 'GitHub', href: 'https://github.com/eddynorris' },
  { label: 'Email', href: 'mailto:eddy.sagitario.97@gmail.com' },
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
    titulo: 'Ventas e inventario',
    año: '2024–2025',
    resumen:
      'Manngo j&k — Análisis de procesos de negocio y solución digital integral: plataforma web en Angular y app móvil en React Native para ventas e inventario, con análisis de datos para decisiones estratégicas.',
    tags: ['Angular', 'React Native', 'Datos'],
    href: '#',
    grad: 'linear-gradient(135deg, #ffc93c 0%, #ff5a3c 60%, #ff4f9a 100%)',
  },
  {
    titulo: 'Plataforma web en Angular',
    año: '2025',
    resumen:
      'RUWAYTECH S.R.L. — Desarrollo e implementación de nuevas funcionalidades en la plataforma web con Angular y colaboración en el mantenimiento del código existente.',
    tags: ['Angular', 'Front-End'],
    href: '#',
    grad: 'linear-gradient(135deg, #7ed4ff 0%, #14a8a8 55%, #17122b 100%)',
  },
  {
    titulo: 'Gestión de hosting',
    año: '2022',
    resumen:
      'CODIDEEP EIRL — Plataforma web y landing page para la gestión de compras de servicios de hosting, con procesamiento de pedidos y gestión de clientes.',
    tags: ['Plataforma web', 'Pedidos', 'Clientes'],
    href: '#',
    grad: 'linear-gradient(135deg, #7ed957 0%, #14a8a8 50%, #2f9fe0 100%)',
  },
];

export const skills = [
  {
    grupo: 'Desarrollo Full-Stack',
    items: ['Angular', 'Flask (Python)', 'APIs REST', 'React Native'],
  },
  {
    grupo: 'Despliegue en la nube',
    items: ['Vercel', 'Railway', 'AWS', 'DNS'],
  },
  {
    grupo: 'Herramientas de desarrollo con IA',
    items: ['Cursor', 'Antigravity', 'Trae IDE', 'Claude Code', 'OpenCode'],
  },
  {
    grupo: 'Formación',
    items: [
      'Maestría en Gestión de TI — Newman (2025)',
      'Ing. Informática y Sistemas — UNAMBA (2024)',
    ],
  },
  {
    grupo: 'Idiomas',
    items: ['Inglés C1 (avanzado)', 'Español (nativo)'],
  },
  {
    grupo: 'Certificados',
    items: [
      'Data Structures & Backend with Java — Board Infinity',
      'AI Fundamentals — IBM',
      'Agile Explorer — IBM',
      'Foundations: Data, Data, Everywhere — Google',
      'Programación de Aplicaciones en Tiempo Real — CODIDEEP',
      'Marketing Digital & Social Media — Google',
    ],
  },
];
