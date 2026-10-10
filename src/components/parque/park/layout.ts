/** Datos del parque: geometría, sitios y conceptos (todo el texto en español). */

export type Vec2 = [number, number];

/** Sitios = objetos clicables del mundo3D. */
export type SitioId =
  | 'taquilla'
  | 'castillo'
  | 'catalogo'
  | 'pedidos'
  | 'envios'
  | 'bodega'
  | 'correo'
  | 'antena'
  | 'bus';

/** Conceptos = fichas del panel de información (3 kiosks comparten uno). */
export type ConceptoId =
  | 'entrada'
  | 'dominio'
  | 'contextos'
  | 'repositorio'
  | 'correo'
  | 'api'
  | 'eventos';

export type Sitio = {
  id: SitioId;
  concepto: ConceptoId;
  /** centro aproximado en el suelo (para el anillo de selección) */
  at: Vec2;
  /** radio del anillo de selección */
  ring: number;
  /** etiqueta flotante */
  badge: { main: string; sub?: string; fill: string };
  /** ancla de la etiqueta flotante */
  labelAt: [number, number, number];
  /** rotación de la etiqueta (para que no tape el edificio) */
  labelYaw?: number;
};

export type Concepto = {
  id: ConceptoId;
  title: string;
  /** etiqueta corta para los botones del panel */
  corto: string;
  tag: string;
  /** texto corto del panel lateral */
  body: string;
  /** regla destacada */
  regla: string;
  /** texto largo del manual (tarjetas) */
  largo: string;
};

/* ------------------------------------------------------------------ */
/* Caminos (x, z) — el flujo entra por la izquierda y sale por la derecha */
/* ------------------------------------------------------------------ */

/** Espina principal: taquilla → plaza del castillo → bifurcación. */
export const ESPINA: Vec2[] = [
  [-16.6, 0.8],
  [-6, 0.8],
  [0, 0.8],
  [7, 0.8],
];

/** Tramo de entrada (hasta la plaza). */
export const ENTRADA_PATH: Vec2[] = ESPINA.slice(0, 3);

/** Ramas de salida: [desde la bifurcación hasta la puerta del edificio]. */
export const SALIDAS: Record<'db' | 'correo' | 'api', Vec2[]> = {
  db: [ESPINA[3], [9.8, -1.6], [12.1, -3.35]],
  correo: [ESPINA[3], [11.5, 0.5], [15.1, 1.95]],
  api: [ESPINA[3], [10.2, 3.4], [12.6, 5.05]],
};

/** Camino completo de salida = resto de la espina + rama. */
export function salidaPath(k: 'db' | 'correo' | 'api'): Vec2[] {
  return [...ESPINA.slice(2), ...SALIDAS[k].slice(1)];
}

/* ------------------------------------------------------------------ */
/* Sitios                                                             */
/* ------------------------------------------------------------------ */

export const SITIOS: Sitio[] = [
  {
    id: 'taquilla',
    concepto: 'entrada',
    at: [-11.7, 0.4],
    ring: 3.2,
    badge: { main: 'ENTRADA', sub: 'driving', fill: '#ff5a3c' },
    labelAt: [-12.4, 4.4, -1.1],
  },
  {
    id: 'castillo',
    concepto: 'dominio',
    at: [0, -1.9],
    ring: 3.1,
    badge: { main: 'DOMINIO', sub: 'reglas', fill: '#ffc93c' },
    labelAt: [0, 7.2, -1.9],
  },
  {
    id: 'catalogo',
    concepto: 'contextos',
    at: [0.8, -6],
    ring: 1.6,
    badge: { main: 'CATÁLOGO', fill: '#7ed957' },
    labelAt: [0.8, 3.3, -6],
  },
  {
    id: 'pedidos',
    concepto: 'contextos',
    at: [5, -6.2],
    ring: 1.6,
    badge: { main: 'PEDIDOS', fill: '#ffc93c' },
    labelAt: [5, 3.1, -6.2],
  },
  {
    id: 'envios',
    concepto: 'contextos',
    at: [-4.6, 5.9],
    ring: 1.6,
    badge: { main: 'ENVÍOS', fill: '#ff4f9a' },
    labelAt: [-4.6, 3.1, 5.9],
  },
  {
    id: 'bodega',
    concepto: 'repositorio',
    at: [13.3, -5.5],
    ring: 3.2,
    badge: { main: 'POSTGRES', sub: 'driven', fill: '#14a8a8' },
    labelAt: [13.3, 5.2, -5.5],
  },
  {
    id: 'correo',
    concepto: 'correo',
    at: [15.1, 0.6],
    ring: 1.9,
    badge: { main: 'CORREO', sub: 'driven', fill: '#14a8a8' },
    labelAt: [15.1, 7.6, 0.6],
  },
  {
    id: 'antena',
    concepto: 'api',
    at: [13.4, 5.7],
    ring: 2.1,
    badge: { main: 'API', sub: 'driven', fill: '#14a8a8' },
    labelAt: [13.4, 5.8, 5.7],
  },
  {
    id: 'bus',
    concepto: 'eventos',
    at: [4.8, 6.1],
    ring: 1.5,
    badge: { main: 'EVENTOS', fill: '#ffc93c' },
    labelAt: [4.8, 4.9, 6.1],
  },
];

/** Del sitio a su concepto. */
export const SITIO_A_CONCEPTO: Record<SitioId, ConceptoId> = SITIOS.reduce(
  (acc, s) => ({ ...acc, [s.id]: s.concepto }),
  {} as Record<SitioId, ConceptoId>,
);

/* ------------------------------------------------------------------ */
/* Conceptos (fichas del panel + manual)                              */
/* ------------------------------------------------------------------ */

export const CONCEPTOS: Concepto[] = [
  {
    id: 'entrada',
    title: 'Puerto de entrada (driving)',
    corto: 'Entrada',
    tag: 'Hexagonal · lado primario',
    body: 'La taquilla es por donde entran los visitantes. El puerto de entrada define qué puede pedir la aplicación; los adaptadores primarios —REST, CLI, tests— son quienes inician la conversación.',
    regla: 'Quien inicia la conversación = driving (primary).',
    largo:
      'El puerto es una interfaz que posee la aplicación, por ejemplo CrearPedidoUseCase.ejecutar(). El controlador REST, la línea de comandos o un test automático son adaptadores que hablan ese idioma y arrancan un caso de uso. Ninguno de ellos se conoce entre sí: todos llegan al mismo puerto, y la aplicación no sabe quién está al otro lado.',
  },
  {
    id: 'dominio',
    title: 'Núcleo del dominio',
    corto: 'Dominio',
    tag: 'DDD · donde viven las reglas',
    body: 'El castillo no mira al exterior: aquí no hay HTTP, ni SQL, ni SMTP. Solo reglas de negocio expresadas en entidades, value objects y servicios de dominio.',
    regla: 'El núcleo no depende del exterior: los adaptadores importan los puertos, nunca al revés.',
    largo:
      'Los visitantes entran por la puerta y nadie rodea el castillo: así se protege el agregado (su raíz y su interior). Si mañana cambias el framework web o la base de datos, estas paredes no se mueven. Aquí también vive el lenguaje ubicuo: el código del castillo habla el mismo idioma que el negocio, sin traducciones raras.',
  },
  {
    id: 'contextos',
    title: 'Contexto acotado',
    corto: 'Contextos',
    tag: 'DDD · fronteras de modelo',
    body: 'Las tres zonas cercadas son un mismo término con modelos distintos: “Producto” en Catálogo lleva precio; en Envíos, peso y dimensiones. Cada valla es una frontera de contexto.',
    regla: 'Dentro de la valla manda el lenguaje ubicuo de ese contexto.',
    largo:
      'Un bounded context es la frontera dentro de la cual un modelo tiene un significado preciso. En vez de forzar un modelo global, cada contexto tiene su propio lenguaje, sus entidades y hasta su propia base de datos. Los contextos se comunican con traducciones explícitas: anticorruption layer, eventos publicados o APIs con lenguaje publicado.',
  },
  {
    id: 'repositorio',
    title: 'Repositorio: puerto saliente y adaptador',
    corto: 'Repositorio',
    tag: 'Hexagonal · lado driven',
    body: 'La aplicación define el puerto “guardar pedido” en términos del dominio: ni siquiera sabe que existe una base de datos. Esta bodega es el adaptador que lo implementa con SQL.',
    regla: 'Cambias Postgres por MongoDB: nace un adaptador nuevo y el castillo no se entera.',
    largo:
      'En DDD el repositorio se declara en el dominio y se implementa en la infraestructura, y solo el agregado raíz tiene repositorio: guardar una línea de pedido por su cuenta saltaría sus reglas. En hexagonal, la interfaz del repositorio es el puerto saliente (driven port) que posee la aplicación, y su implementación es el adaptador que enchufa la tecnología.',
  },
  {
    id: 'correo',
    title: 'Adaptador driven (SMTP)',
    corto: 'Correo',
    tag: 'Hexagonal · notificaciones',
    body: 'Avisar al cliente es una salida: el dominio emite el hecho a través de un puerto y este adaptador lo traduce a SMTP. Si mañana cambias de mensajería, solo cambia este edificio.',
    regla: 'Quien es llamado por la aplicación = driven (secondary).',
    largo:
      'Al mismo puerto pueden enchufarse varios adaptadores: SMTP, un webhook, una cola de mensajes. El núcleo solo conoce la interfaz del puerto, jamás la tecnología que hay detrás.',
  },
  {
    id: 'api',
    title: 'Adaptador driven (API externa)',
    corto: 'API externa',
    tag: 'Hexagonal · integración',
    body: 'La antena habla con servicios de terceros: pasarela de pagos, mapa, proveedor de IA. Es otro adaptador enchufado a un puerto de salida definido por la aplicación.',
    regla: 'La app no sabe que hay internet: solo llama a su puerto.',
    largo:
      'El patrón exige que la aplicación nunca nombre tecnología externa: todo lo externo le llega como parámetro por un puerto que ella misma define. Así puedes reemplazar la integración por un doble en memoria y probar el castillo completo sin red.',
  },
  {
    id: 'eventos',
    title: 'Eventos de dominio',
    corto: 'Eventos',
    tag: 'DDD · hechos, no órdenes',
    body: 'Cuando el castillo termina un trabajo, a veces lanza un orbe: PedidoConfirmado. Es un hecho ya ocurrido; quién lo escuche —correo, analítica, inventario— es asunto de la infraestructura.',
    regla: 'Publicar no acopla: el dominio no sabe quién suscribe.',
    largo:
      'Los eventos de dominio no aparecen en el libro de Evans (2003): son una adición posterior y hoy forman parte del DDD táctico. Se modelan como datos inmutables, con nombre en pasado, y se publican dentro de la misma transacción del agregado que los originó.',
  },
];

export const CONCEPTO_POR_ID = CONCEPTOS.reduce(
  (acc, c) => ({ ...acc, [c.id]: c }),
  {} as Record<ConceptoId, Concepto>,
);

/* ------------------------------------------------------------------ */
/* Decoración                                                         */
/* ------------------------------------------------------------------ */

/** Valla de la aplicación: tramos [x1,z1]→[x2,z2] con huecos para los caminos. */
export const VALLAS: [Vec2, Vec2][] = [
  // norte (fondo)
  [
    [-7.4, -8.4],
    [7.4, -8.4],
  ],
  // sur (frente)
  [
    [-7.4, 8.4],
    [7.4, 8.4],
  ],
  // oeste, con hueco en z=0
  [
    [-7.4, -8.4],
    [-7.4, -1.6],
  ],
  [
    [-7.4, 1.6],
    [-7.4, 8.4],
  ],
  // este, con hueco en z=0
  [
    [7.4, -8.4],
    [7.4, -1.6],
  ],
  [
    [7.4, 1.6],
    [7.4, 8.4],
  ],
];

/** Recintos de contexto: una valla cerrada por cada kiosco (frontera de contexto). */
const RECTOS_CONTEXTO: [Vec2, Vec2][] = [
  [
    [-1, -7.8],
    [2.6, -4.2],
  ], // Catálogo
  [
    [3.2, -8],
    [6.8, -4.4],
  ], // Pedidos
  [
    [-6.4, 4.1],
    [-2.8, 7.7],
  ], // Envíos
];

/** Segmentos [x1,z1]→[x2,z2] de los tres recintos. */
export const VALLAS_CONTEXTO: [Vec2, Vec2][] = RECTOS_CONTEXTO.flatMap(([a, b]) => [
  [
    [a[0], a[1]],
    [b[0], a[1]],
  ],
  [
    [b[0], a[1]],
    [b[0], b[1]],
  ],
  [
    [b[0], b[1]],
    [a[0], b[1]],
  ],
  [
    [a[0], b[1]],
    [a[0], a[1]],
  ],
]);

/** Árboles dispersos fuera de los caminos. */
export const ARBOLES: Vec2[] = [
  [-15.5, -5.5],
  [-10.5, -7.5],
  [-16.8, 6],
  [-12, 7.8],
  [-8.5, 4.6],
  [10.5, -8],
  [15.8, -7.6],
  [17.4, 3.4],
  [16.6, 8],
  [9.4, 7.6],
  [2.5, -9.4],
  [-3.4, -9.6],
];

/** Farolas a lo largo de la espina. */
export const FAROLAS: Vec2[] = [
  [-13.6, -1.9],
  [-8.4, -1.9],
  [-3.4, -1.9],
  [3.4, -1.9],
  [8.6, -1.4],
];

/** Bancos. */
export const BANCOS: Vec2[] = [
  [-9.4, 2.6],
  [-1.2, 3],
  [5.6, 2.8],
];

/** Arbustos (para rellenar el contorno). */
export const ARBUSTOS: Vec2[] = [
  [-17.6, -2.8],
  [-14.6, 4.4],
  [0.6, 3.6],
  [-2.2, -7.6],
  [7.8, -6.4],
  [17.6, -2.2],
  [11.8, 8.6],
  [1.6, 7.4],
];

/* ------------------------------------------------------------------ */
/* Eventos de dominio: arco desde el castillo hasta el mástil          */
/* ------------------------------------------------------------------ */

export const ORBE = {
  desde: [0.6, 4.9, -1.9] as [number, number, number],
  ctrl: [3.6, 7.6, 1.4] as [number, number, number],
  hasta: [4.8, 3.3, 6.1] as [number, number, number],
};
