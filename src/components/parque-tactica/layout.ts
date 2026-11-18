/** Datos del Parque Táctica: la Ciudadela del Pedido (DDD táctico).
 *  Geometría, sitios, conceptos y pasos. Todo el texto en español. */

export type Vec2 = [number, number];

/** Sitios = objetos clicables del mundo 3D. */
export type SitioId =
  | 'torno'
  | 'ciudadela'
  | 'puente'
  | 'guardia'
  | 'sala'
  | 'cofre'
  | 'registro'
  | 'bodega'
  | 'bus'
  | 'correo';

/** Conceptos = fichas del panel de información. */
export type ConceptoId =
  | 'torno'
  | 'agregado'
  | 'raiz'
  | 'invariantes'
  | 'entidad'
  | 'vo'
  | 'evento'
  | 'publicacion';

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
/* Caminos (x, z) — el comando entra por el oeste y el commit sale     */
/* ------------------------------------------------------------------ */

/** Aproximación oeste hasta el torno. */
export const ESPINA: Vec2[] = [
  [-16.6, 0.8],
  [-6.9, 0.8],
];

/** Del torno, cruzando puente y portón, hasta la plaza de armas. */
export const TRAMO: Vec2[] = [
  [-6.9, 0.8],
  [-3.1, 0.8],
  [1.4, 0.8],
];

/** Plaza → sala de líneas (entidades). */
export const RAMA_SALA: Vec2[] = [
  [1.4, 0.8],
  [4.6, 0.8],
  [5.6, -1.4],
  [5.6, -3.35],
];

/** Plaza → cofre (value objects). */
export const RAMA_COFRE: Vec2[] = [
  [4.6, 0.8],
  [6.2, 1.42],
];

/** Plaza → registro de eventos. */
export const RAMA_REGISTRO: Vec2[] = [
  [1.4, 0.8],
  [2.2, -1.6],
  [2.4, -4.35],
];

/** Plaza → portón este → bodega (commit con el agregado y sus eventos). */
export const SALIDA_DATOS: Vec2[] = [
  [1.4, 0.8],
  [8.0, 0.8],
  [9.2, 0.8],
  [11.2, 0.8],
  [12.6, -1.5],
  [13.8, -2.3],
];

/** Bifurcación hacia el mástil del bus de eventos. */
export const RAMA_BUS: Vec2[] = [
  [11.2, 0.8],
  [12.9, 2.15],
];

/** Continuación hacia el correo (suscriptor). */
export const RAMA_CORREO: Vec2[] = [
  [12.9, 2.15],
  [14.2, 4.2],
  [15.4, 6.0],
  [15.85, 7.45],
];

/** Empalmes cortos: plaza → puerta de la guardia. */
export const STUBS: Vec2[][] = [[[1.4, 0.8], [-1.5, 0.65], [-1.5, 0.25]]];

/* ------------------------------------------------------------------ */
/* Estaciones del flujo                                                */
/* ------------------------------------------------------------------ */

export const ESTACIONES = {
  inicio: [-15.4, 0.8] as Vec2,
  /** el comando espera delante del torno */
  espera: [-7.9, 0.8] as Vec2,
  torno: [-6.9, 0.8] as Vec2,
  puente: [-3.1, 0.8] as Vec2,
  plaza: [1.4, 0.8] as Vec2,
  guardiaPuerta: [-1.5, 0.25] as Vec2,
  salaPuerta: [5.6, -3.35] as Vec2,
  cofrePuerta: [6.2, 1.42] as Vec2,
  registroPuerta: [2.4, -4.35] as Vec2,
  commit: [9.2, 0.8] as Vec2,
  bodegaPuerta: [13.8, -2.3] as Vec2,
  busBase: [12.9, 2.15] as Vec2,
  correoPuerta: [15.85, 7.45] as Vec2,
  /** reposo de los trabajadores */
  residenciaRest: [1.0, 1.9] as Vec2,
  guardiaRest: [-2.6, -0.15] as Vec2,
  subRest: [13.6, 3.9] as Vec2,
};

/** Los seis pasos del recorrido canónico de un cambio del agregado. */
export const PASOS = [
  {
    n: '1/6',
    t: 'El comando entra por el torno',
    d: 'Una instancia de agregado por transacción: el torno deja pasar un comando por vez. Los demás esperan su propia transacción.',
  },
  {
    n: '2/6',
    t: 'La raíz abre el puente',
    d: 'El puente es la única puerta de la ciudadela: ningún cambio toca el interior sin pasar por la raíz del agregado.',
  },
  {
    n: '3/6',
    t: 'La guardia valida las invariantes',
    d: 'Antes de cambiar nada se comprueban las reglas que nunca pueden romperse: si una falla, el cambio entero se rechaza.',
  },
  {
    n: '4/6',
    t: 'Cambian la entidad y el value object',
    d: 'La sala estrena una línea con identidad propia (entidad) y el cofre reemplaza su importe por un VO nuevo: los value objects no se mutan.',
  },
  {
    n: '5/6',
    t: 'El hecho queda registrado',
    d: 'El agregado anota LineaAgregada en su registro: nombre en pasado, dato inmutable. No llama a nadie; el hecho ya ocurrió.',
  },
  {
    n: '6/6',
    t: 'Commit juntos, publicación después',
    d: 'La bodega guarda agregado y eventos en la misma transacción; tras el commit, el bus publica y el correo entrega, cada uno en la suya.',
  },
];

/* ------------------------------------------------------------------ */
/* Sitios                                                              */
/* ------------------------------------------------------------------ */

export const SITIOS: Sitio[] = [
  {
    id: 'torno',
    concepto: 'torno',
    at: [-6.9, 0.8],
    ring: 1.5,
    badge: { main: 'TORNO', sub: '1 instancia', fill: '#ff5a3c' },
    labelAt: [-6.9, 3.9, 0.8],
  },
  {
    id: 'ciudadela',
    concepto: 'agregado',
    at: [3.0, -1.75],
    ring: 3.6,
    badge: { main: 'AGREGADO', sub: 'límite', fill: '#8f6bd8' },
    labelAt: [3.0, 6.4, -4.6],
  },
  {
    id: 'puente',
    concepto: 'raiz',
    at: [-3.1, 0.8],
    ring: 1.4,
    badge: { main: 'RAÍZ', sub: 'única puerta', fill: '#ff4f9a' },
    labelAt: [-3.1, 3.2, 0.8],
  },
  {
    id: 'guardia',
    concepto: 'invariantes',
    at: [-1.5, -0.8],
    ring: 1.3,
    badge: { main: 'GUARDIA', sub: 'invariantes', fill: '#7ed957' },
    labelAt: [-1.5, 4.5, -0.8],
  },
  {
    id: 'sala',
    concepto: 'entidad',
    at: [5.6, -4.4],
    ring: 2.4,
    badge: { main: 'LÍNEAS', sub: 'entidades', fill: '#2f9fe0' },
    labelAt: [5.6, 4.2, -4.4],
  },
  {
    id: 'cofre',
    concepto: 'vo',
    at: [6.2, 0.6],
    ring: 1.1,
    badge: { main: 'COFRE', sub: 'value objects', fill: '#ffc93c' },
    labelAt: [6.2, 2.9, 0.6],
  },
  {
    id: 'registro',
    concepto: 'evento',
    at: [2.4, -5.4],
    ring: 1.6,
    badge: { main: 'REGISTRO', sub: 'eventos', fill: '#ffc93c' },
    labelAt: [2.4, 6.3, -5.4],
  },
  {
    id: 'bodega',
    concepto: 'publicacion',
    at: [14.7, -4.3],
    ring: 3.0,
    badge: { main: 'BODEGA', sub: 'commit atómico', fill: '#14a8a8' },
    labelAt: [14.7, 5.3, -4.3],
  },
  {
    id: 'bus',
    concepto: 'publicacion',
    at: [13.2, 2.6],
    ring: 1.7,
    badge: { main: 'BUS', sub: 'publicar', fill: '#14a8a8' },
    labelAt: [13.2, 6.5, 2.6],
  },
  {
    id: 'correo',
    concepto: 'publicacion',
    at: [15.9, 6.2],
    ring: 1.5,
    badge: { main: 'CORREO', sub: 'suscriptor', fill: '#14a8a8' },
    labelAt: [15.9, 7.7, 6.2],
  },
];

/** Del sitio a su concepto. */
export const SITIO_A_CONCEPTO: Record<SitioId, ConceptoId> = SITIOS.reduce(
  (acc, s) => ({ ...acc, [s.id]: s.concepto }),
  {} as Record<SitioId, ConceptoId>,
);

/* ------------------------------------------------------------------ */
/* Conceptos (fichas del panel + manual)                               */
/* ------------------------------------------------------------------ */

export const CONCEPTOS: Concepto[] = [
  {
    id: 'torno',
    title: 'Una instancia de agregado por transacción',
    corto: 'Transacción',
    tag: 'DDD táctico · consistencia',
    body: 'El torno deja pasar a un grupo por vez: en una transacción se modifica una única instancia de agregado. Los demás comandos esperan —o van en su propia transacción.',
    regla: 'Modifica una instancia de agregado por transacción; entre agregados, consistencia eventual.',
    largo:
      'Puedes cargar varios agregados para leer, pero solo una instancia se modifica en cada transacción. Ese límite mantiene pequeñas las transacciones y deja todas las reglas dentro de un único alcance. Lo que ocurre en otros agregados —enviar el correo, actualizar un contador— no participa de esta transacción: reacciona después, a su propio ritmo, con eventos. Vaughn Vernon lo resume como la regla de diseño que más conflictos evita: modela agregados pequeños y toca uno por transacción.',
  },
  {
    id: 'agregado',
    title: 'El agregado y su frontera de consistencia',
    corto: 'Agregado',
    tag: 'DDD táctico · unidad de consistencia',
    body: 'La ciudadela entera es el agregado: un racimo de objetos que cambia como una unidad y se guarda como una unidad. El muro marca su límite: lo que queda fuera no comparte transacción.',
    regla: 'El agregado es la unidad de consistencia: lo que debe quedar bien a la vez, junto; lo demás, fuera.',
    largo:
      'El agregado agrupa entidades y value objects bajo una raíz y define qué se guarda junto. Un pedido con sus líneas es el ejemplo clásico: las líneas no tienen vida propia fuera del pedido. Mantenerlo pequeño —raíz, pocos objetos, referencias por identidad a otros agregados— reduce conflictos entre transacciones y acelera las cargas. La frontera no la dicta la base de datos: la dicta la regla de negocio que debe cumplirse en cada cambio.',
  },
  {
    id: 'raiz',
    title: 'La raíz del agregado',
    corto: 'Raíz',
    tag: 'DDD táctico · la única puerta',
    body: 'El puente es la única entrada: ningún comando toca las salas de dentro sin pasar por la raíz. Ella valida, decide y mantiene vivas las invariantes.',
    regla: 'Se entra al interior solo por la raíz; desde fuera se guardan referencias a la raíz, nunca a los objetos internos.',
    largo:
      'La raíz es la entidad que representa al agregado completo, y los repositorios existen por y para ella: se carga y se guarda el agregado entero. El resto del código no sostiene referencias duraderas a objetos internos. Una buena prueba de que el límite está bien trazado: ¿puede cambiar una línea de pedido sin pasar por Pedido? Si la respuesta es sí, ese límite está mal trazado.',
  },
  {
    id: 'invariantes',
    title: 'Invariantes',
    corto: 'Invariantes',
    tag: 'DDD táctico · reglas que no se rompen',
    body: 'La guardia no negocia: comprueba las reglas que nunca pueden dejar de cumplirse —sin líneas duplicadas, importes positivos, un máximo de líneas— antes y después de cada cambio.',
    regla: 'Si un cambio rompería una invariante, no se aplica: la raíz rechaza la operación entera.',
    largo:
      'Las invariantes son condiciones que deben ser ciertas siempre, no solo al final del caso de uso. La raíz las hace cumplir en cada comando y, si el cambio las rompe, no se aplica ni parcialmente. Este es el motivo profundo de que el agregado sea la unidad de consistencia: agrupa exactamente aquello que debe quedar coherente a la vez. Y es también la razón de mantener la frontera ajustada: más objetos dentro es más superficie que validar en cada operación.',
  },
  {
    id: 'entidad',
    title: 'Entidades dentro del agregado',
    corto: 'Entidad',
    tag: 'DDD táctico · identidad',
    body: 'Cada línea de la sala tiene identidad propia: la línea 3 sigue siendo la línea 3 aunque cambie su cantidad o su precio. La raíz las coordina; desde fuera no se tocan.',
    regla: 'Entidad = identidad + ciclo de vida: igualdad por identidad, nunca por atributos.',
    largo:
      'Dentro del agregado, las entidades viven con ciclo de vida propio —se añaden, se modifican, se eliminan— pero siempre a través de la raíz. Comparten el lenguaje ubicuo del modelo: LineaDePedido, Reserva, Asiento. Su identidad es local al agregado: el número de línea de un pedido no compite con el de otro pedido, y dos líneas con el mismo producto siguen siendo objetos distintos.',
  },
  {
    id: 'vo',
    title: 'Value Objects',
    corto: 'VO',
    tag: 'DDD táctico · valor puro',
    body: 'El cofre no guarda cosas mutables: guarda importes, direcciones, monedas. Un value object es inmutable: cuando el valor cambia, se reemplaza por un objeto nuevo.',
    regla: 'VO = inmutable y sin identidad: dos importes de 30,00 € son el mismo importe.',
    largo:
      'El value object se define por sus atributos, no por una identidad: Dinero, Dirección, RangoDeFechas. Dentro del agregado se usa y se reemplaza: cambiar el importe de una línea no "setea" el número, instala un Dinero nuevo. Esa inmutabilidad los hace seguros de compartir y fáciles de razonar, y los convierte en el mejor lugar para validar al construirse —una moneda conocida, un rango coherente—: si el VO existe, es válido.',
  },
  {
    id: 'evento',
    title: 'El evento de dominio',
    corto: 'Evento',
    tag: 'DDD táctico · hechos, no órdenes',
    body: 'Al cambiar, el agregado anota el hecho en su registro: LineaAgregada, nombre en pasado, dato inmutable. El registro de eventos viaja pegado al agregado.',
    regla: 'El evento se registra dentro del agregado y sale con él: nunca llama al exterior por su cuenta.',
    largo:
      'Cada cambio relevante deja un evento de dominio como registro del hecho: PedidoCreado, LineaAgregada, PedidoConfirmado. Nacen dentro de la raíz, en el momento del cambio, y se apilan en el registro del agregado. No son mensajes técnicos ni órdenes: describen algo que ya ocurrió, en lenguaje del negocio, y no saben quién —si alguien— los escuchará. Escribirlos en pasado no es un capricho de estilo: es la señal de que el estado ya cambió y de que el evento no se puede rechazar.',
  },
  {
    id: 'publicacion',
    title: 'Persistencia transaccional y publicación',
    corto: 'Commit',
    tag: 'DDD táctico · dentro y fuera del commit',
    body: 'La bodega guarda el agregado y sus eventos en una misma transacción. Solo después del commit cruzan la antena: el bus publica y cada suscriptor, como el correo, entrega en su propia transacción.',
    regla: 'Juntos en el commit, separados en la entrega: primero se guarda, después se publica.',
    largo:
      'El patrón es guardar el agregado y sus eventos en la misma transacción de base de datos —así nunca queda un cambio sin su hecho ni un hecho sin su cambio— y publicar solo tras el commit. A partir de ahí el evento viaja como mensaje de integración: puede cambiar de forma y de nombre para cruzar a otros contextos, y cada suscriptor lo procesa en su propia transacción. Si el correo falla, el pedido ya está a salvo. No hay que confundir el evento de dominio (LineaAgregada, lenguaje del modelo) con el de integración (PedidoLineaAñadida, esquema publicado para otros contextos).',
  },
];

export const CONCEPTO_POR_ID = CONCEPTOS.reduce(
  (acc, c) => ({ ...acc, [c.id]: c }),
  {} as Record<ConceptoId, Concepto>,
);

/* ------------------------------------------------------------------ */
/* Decoración                                                          */
/* ------------------------------------------------------------------ */

/** Nada de vallas genéricas: la ciudadela trae sus propios muros. */
export const VALLAS: [Vec2, Vec2][] = [];
export const VALLAS_EXTRA: [Vec2, Vec2][] = [];
