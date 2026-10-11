/** Datos del Parque Capas: geometría, sitios y conceptos (texto en español).
 *  Enseña la arquitectura en N capas / N niveles: las capas lógicas son
 *  siempre tres edificios; los niveles (tiers) son una decisión de despliegue
 *  que el visitante alterna con el conmutador. Reutiliza la isla compartida. */

import { ARBOLES, ARBUSTOS, BANCOS, FAROLAS, type Vec2 } from '../parque/park/layout';

export type { Vec2 };

/** Los tres edificios = las tres capas lógicas (siempre presentes). */
export type SitioId = 'presentacion' | 'negocio' | 'datos';

/** Conceptos = fichas del panel. Incluye «niveles», el concepto estrella. */
export type ConceptoId = 'presentacion' | 'negocio' | 'datos' | 'niveles';

/** Cómo se despliegan las capas. Es una decisión física, no lógica. */
export type Despliegue = 'unico' | 'varios';

export type Sitio = {
  id: SitioId;
  concepto: ConceptoId;
  /** centro aproximado en el suelo (para el anillo de selección) */
  at: Vec2;
  ring: number;
  badge: { main: string; sub?: string; fill: string };
  labelAt: [number, number, number];
  /** color de la capa, para las fichas y las aristas */
  color: string;
  /** altura del edificio (variable para reforzar la jerarquía visual) */
  alto: number;
};

export type Concepto = {
  id: ConceptoId;
  title: string;
  corto: string;
  tag: string;
  body: string;
  regla: string;
  largo: string;
};

/* ------------------------------------------------------------------ */
/* Ruta del invitado: la petición baja por el stack y el resultado     */
/* sube de vuelta (presentación → negocio → datos → negocio →          */
/* presentación). Es el flujo típico de una llamada en capas.          */
/* ------------------------------------------------------------------ */

/** Espina principal (z ≈ 1); los edificios quedan al norte (z < 0).
 *  El invitado recorre: baja presentación→negocio→datos y sube de vuelta. */
export const ESPINA: Vec2[] = [
  [-16.6, 1.0],
  [-11, 1.0], // presentación (baja)
  [0, 1.0], // negocio (baja)
  [11, 1.0], // datos (baja, recoge el dato)
  [0, 1.0], // negocio (sube, procesa)
  [-11, 1.0], // presentación (sube, renderiza)
  [-16.6, 1.0], // salida con la respuesta
];

/** Índices de la espina donde el invitado se detiene (5 paradas). */
export const PARADAS = [1, 2, 3, 4, 5] as const;

/** Camino completo del invitado (una sola trayectoria de ida y vuelta). */
export const RUTA: Vec2[] = ESPINA;

/* ------------------------------------------------------------------ */
/* Sitios (los tres edificios de las capas)                            */
/* ------------------------------------------------------------------ */

export const SITIOS: Sitio[] = [
  {
    id: 'presentacion',
    concepto: 'presentacion',
    at: [-11, -1.4],
    ring: 2.7,
    badge: { main: 'PRESENTACIÓN', fill: '#ff4f9a' },
    labelAt: [-11, 5.2, -3.2],
    color: '#ff4f9a',
    alto: 3.0,
  },
  {
    id: 'negocio',
    concepto: 'negocio',
    at: [0, -1.6],
    ring: 2.7,
    badge: { main: 'NEGOCIO', fill: '#ffc93c' },
    labelAt: [0, 5.6, -3.4],
    color: '#ffc93c',
    alto: 3.5,
  },
  {
    id: 'datos',
    concepto: 'datos',
    at: [11, -1.4],
    ring: 2.7,
    badge: { main: 'DATOS', fill: '#14a8a8' },
    labelAt: [11, 5.2, -3.2],
    color: '#14a8a8',
    alto: 3.0,
  },
];

export const SITIO_A_CONCEPTO: Record<SitioId, ConceptoId> = SITIOS.reduce(
  (acc, s) => ({ ...acc, [s.id]: s.concepto }),
  {} as Record<SitioId, ConceptoId>,
);

/* ------------------------------------------------------------------ */
/* Conceptos (fichas del panel + manual)                               */
/* ------------------------------------------------------------------ */

export const CONCEPTOS: Concepto[] = [
  {
    id: 'presentacion',
    title: 'Presentación: la cara visible',
    corto: 'Presentación',
    tag: 'Capa 1 · interfaz',
    body: 'Recibe la interacción del usuario (HTTP, clics, formularios), la traduce en una orden al negocio y dibuja la respuesta. No decide reglas de negocio.',
    regla: 'La presentación depende del negocio, nunca al revés.',
    largo:
      'La capa de presentación —a veces llamada interfaz de usuario o de cliente— es la única que habla el idioma del humano: pantallas, plantillas, componentes, controladores web. Su trabajo es delgado: validar el formato de la entrada, invocar un caso de uso del negocio y pintar el resultado. Aquí vive el patrón MVC (modelo-vista-controlador), que reparte papeles dentro de esta misma capa. Si empieza a calcular descuentos o a escribir SQL, la capa se ha engordado y el resto de la arquitectura pierde su razón de ser.',
  },
  {
    id: 'negocio',
    title: 'Negocio / Dominio: las reglas',
    corto: 'Negocio',
    tag: 'Capa 2 · el corazón',
    body: 'El corazón del sistema: entidades, casos de uso, validaciones e invariantes. No sabe que existen pantallas, HTTP ni SQL: recibe datos, aplica reglas y devuelve resultados.',
    regla: 'El dominio no depende de la presentación ni del acceso a datos.',
    largo:
      'La capa de negocio —o de dominio— concentra lo que hace valioso al software: las reglas que un experto del área reconocería. Se modela con entidades, value objects, servicios de dominio y casos de uso, y se expresa en el lenguaje ubicuo del negocio. Su mayor virtud es que no conoce a nadie: ni a la base de datos, ni al framework web, ni a la librería de UI. Ese aislamiento es lo que permite probar el corazón del sistema con rapidez y cambiar sus dependencias sin mover una coma de las reglas.',
  },
  {
    id: 'datos',
    title: 'Acceso a datos: la persistencia',
    corto: 'Datos',
    tag: 'Capa 3 · persistencia',
    body: 'La única capa que sabe de SQL, ORMs, archivos o APIs externas. Expone repositorios en el lenguaje del dominio y traduce a la tecnología concreta.',
    regla: 'La tecnología de persistencia se cambia tocando solo esta capa.',
    largo:
      'La capa de acceso a datos es el adaptador que conecta el dominio con el mundo exterior del almacenamiento: bases de datos, cachés, colas, servicios de terceros. Ofrece una abstracción en el idioma del negocio —«guardar pedido», «buscar cliente por email»— y traduce esa intención a SQL, a un ORM o a un archivo. Cambiar Postgres por MongoDB, o un ORM por consultas a mano, debería afectar únicamente a esta capa. En la arquitectura hexagonal esta capa implementa los puertos salientes que el dominio define.',
  },
  {
    id: 'niveles',
    title: 'Niveles: ¿dónde corre cada capa?',
    corto: 'Niveles',
    tag: 'Despliegue · tiers',
    body: 'Un nivel (tier) es una frontera física de despliegue: un proceso, un contenedor, una máquina. N capas NO significan N niveles: las tres pueden correr en un solo proceso (monolito) o en tres (distribuido).',
    regla: 'Capas = lógica del código. Niveles = frontera física. Son decisiones distintas.',
    largo:
      'Aquí está la confusión más común de la arquitectura en capas. «Tres capas» describe cómo se organiza el CÓDIGO (presentación, negocio, datos); «tres niveles» describe DÓNDE CORRE (tres procesos o máquinas separadas por red). Puedes tener tres capas en un solo proceso —un monolito bien ordenado— o desplegarlas en tres niveles —cliente, servidor de aplicación y base de datos—. Cada frontera de nivel cuesta red: serialización, latencia y nuevos modos de fallo. Por eso se despliega en varios niveles solo cuando hay una razón real (aislamiento de seguridad, escalado independiente, ciclo de vida separado), no porque «sean tres capas».',
  },
];

export const CONCEPTO_POR_ID = CONCEPTOS.reduce(
  (acc, c) => ({ ...acc, [c.id]: c }),
  {} as Record<ConceptoId, Concepto>,
);

/* ------------------------------------------------------------------ */
/* Geometría de despliegue (por nivel)                                 */
/* ------------------------------------------------------------------ */

/** Recuadro que engloba las tres capas cuando todo corre en UN proceso. */
export const PLOT_UNICO: [Vec2, Vec2] = [
  [-15.4, -5.6],
  [15.4, 3.2],
];

/** Un recuadro por capa cuando cada una corre en su propio proceso. */
export const PLOTS_VARIOS: [Vec2, Vec2][] = [
  [
    [-15.0, -5.2],
    [-7.0, 1.6],
  ],
  [
    [-3.6, -5.4],
    [3.6, 1.8],
  ],
  [
    [7.0, -5.2],
    [15.0, 1.6],
  ],
];

/** Cables de red entre capas contiguas (solo visibles con 3 niveles).
 *  Son arcos elevados por los que viajan los paquetes. */
export const CABLES: [Vec2, Vec2][] = [
  [
    [-11, -1.4],
    [0, -1.6],
  ],
  [
    [0, -1.6],
    [11, -1.4],
  ],
];

/* ------------------------------------------------------------------ */
/* Mobiliario del parque (mismo que los otros parques)                 */
/* ------------------------------------------------------------------ */

export { ARBOLES, ARBUSTOS, BANCOS, FAROLAS };

/** Capas no cierran terrenos propios salvo en modo distribuido; por eso
 *  las vallas del mundo se dejan vacías y se dibujan por despliegue. */
export const VALLAS: [Vec2, Vec2][] = [];
export const VALLAS_EXTRA: [Vec2, Vec2][] = [];

/** Entrada y salida del parque (arcos). */
export const ENTRADA: Vec2 = [-16.6, 1.0];
export const SALIDA: Vec2 = [-16.6, 1.0];
