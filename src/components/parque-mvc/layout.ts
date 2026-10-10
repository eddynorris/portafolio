/** Datos del Parque MVC: geometría, sitios y conceptos (texto en español).
 *  Reutiliza la isla y el mobiliario del parque DDD (mismo Educador). */

import { ARBOLES, ARBUSTOS, BANCOS, FAROLAS, type Vec2 } from '../parque/park/layout';

export type { Vec2 };

/** Sitios = objetos clicables del mundo 3D. */
export type SitioId = 'taquilla' | 'controlador' | 'modelo' | 'vista';

/** Conceptos = fichas del panel de información. */
export type ConceptoId = 'peticion' | 'controlador' | 'modelo' | 'vista';

export type Sitio = {
  id: SitioId;
  concepto: ConceptoId;
  /** centro aproximado en el suelo (para el anillo de selección) */
  at: Vec2;
  ring: number;
  badge: { main: string; sub?: string; fill: string };
  labelAt: [number, number, number];
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
/* Ruta del invitado: petición → controlador → modelo → vista → salida */
/* ------------------------------------------------------------------ */

/** Espina principal (z ≈ 0.8); los edificios quedan al norte (z < 0). */
export const ESPINA: Vec2[] = [
  [-16.6, 0.8],
  [-10.8, 0.8],
  [-5.6, 0.8],
  [0.2, 0.8],
  [6.4, 0.8],
  [11.5, 1.4],
  [15.8, 3.4],
];

/** Índices de la espina donde el invitado se detiene (frente a cada edificio). */
export const PARADAS = [2, 3, 4] as const;

/** Camino completo del invitado (una sola trayectoria). */
export const RUTA: Vec2[] = ESPINA;

/* ------------------------------------------------------------------ */
/* Sitios                                                             */
/* ------------------------------------------------------------------ */

export const SITIOS: Sitio[] = [
  {
    id: 'taquilla',
    concepto: 'peticion',
    at: [-12.0, 0.3],
    ring: 3.0,
    badge: { main: 'PETICIÓN', fill: '#ff5a3c' },
    labelAt: [-12.4, 4.6, -1.1],
  },
  {
    id: 'controlador',
    concepto: 'controlador',
    at: [-5.6, -1.0],
    ring: 1.9,
    badge: { main: 'CONTROLADOR', fill: '#14a8a8' },
    labelAt: [-5.6, 3.7, -1.9],
  },
  {
    id: 'modelo',
    concepto: 'modelo',
    at: [0.2, -1.2],
    ring: 2.6,
    badge: { main: 'MODELO', fill: '#ffc93c' },
    labelAt: [0.2, 4.6, -2.2],
  },
  {
    id: 'vista',
    concepto: 'vista',
    at: [6.4, -1.1],
    ring: 2.4,
    badge: { main: 'VISTA', fill: '#ff4f9a' },
    labelAt: [6.4, 4.1, -2.0],
  },
];

export const SITIO_A_CONCEPTO: Record<SitioId, ConceptoId> = SITIOS.reduce(
  (acc, s) => ({ ...acc, [s.id]: s.concepto }),
  {} as Record<SitioId, ConceptoId>,
);

/* ------------------------------------------------------------------ */
/* Conceptos (fichas del panel + manual)                              */
/* ------------------------------------------------------------------ */

export const CONCEPTOS: Concepto[] = [
  {
    id: 'peticion',
    title: 'Petición: el usuario habla',
    corto: 'Petición',
    tag: 'MVC · entrada',
    body: 'El invitado llega con una petición: GET /pedidos, un clic, un submit. En MVC eso es un evento de entrada que el sistema debe interpretar — no es lógica de negocio.',
    regla: 'La entrada es un hecho del usuario, no una decisión del negocio.',
    largo:
      'La taquilla y el arco son el borde del sistema: por ahí entran las peticiones HTTP, los clics y los tests. El patrón MVC no dice cómo llega la entrada —eso es asunto del marco web (front controller, router)— sino quién la traduce después: el controlador.',
  },
  {
    id: 'controlador',
    title: 'Controlador: traduce y despacha',
    corto: 'Controlador',
    tag: 'MVC · el papel de en medio',
    body: 'Recibe la petición, le da forma, pide al modelo lo que hace falta y elige qué vista la mostrará. No guarda estado y no escribe HTML.',
    regla: 'Controlador = traductor de entradas en acciones sobre el modelo.',
    largo:
      'En Smalltalk-80 cada vista tenía su controlador pareja, encargado de traducir el ratón y el teclado en órdenes al modelo y/o a la vista (Burbeck, 1987). En la web (Model 2: el handler de Spring MVC, el controller de Rails) el controlador es más bien un despachador: parsea la URL, ejecuta la acción en el modelo y devuelve la vista elegida — en Django ese papel lo cumple la capa llamada «vista». En ambos mundos vale la misma regla: si el controlador empieza a guardar estado o a armar HTML, el papel se le está yendo de las manos.',
  },
  {
    id: 'modelo',
    title: 'Modelo: estado y reglas',
    corto: 'Modelo',
    tag: 'MVC · el corazón',
    body: 'El estado y las reglas: entidades, cálculos, invariantes. No sabe que existen pantallas ni controladores; simplemente cambia y notifica.',
    regla: 'El modelo no importa vistas: en Smalltalk las vistas lo observan.',
    largo:
      'El nombre engaña: el “modelo” no es solo el esquema de la base de datos ni el ORM. Es el dominio con su lenguaje y sus reglas —lo que en DDD llamarías agregados y servicios de dominio—. Su contrato con el resto del mundo es doble: recibe acciones (agregar pedido, aplicar descuento) y publica cambios (PedidoCreado) para que quien quiera escuche.',
  },
  {
    id: 'vista',
    title: 'Vista: dibuja el estado',
    corto: 'Vista',
    tag: 'MVC · presentación',
    body: 'La vista lee el modelo y lo dibuja: template HTML, componente React, pantalla de una app nativa. Muestra el estado; no lo decide.',
    regla: 'La vista decide cómo se ve, nunca qué significa.',
    largo:
      'En Smalltalk la vista observaba al modelo con el patrón observer: cambiaba el modelo y la pantalla se repintaba sola. En la web no se repinta: alguien vuelve a ejecutar la vista con el estado vigente (render de la plantilla). Da igual el mecanismo; lo que importa es la dirección de la flecha: la vista depende del modelo, jamás al revés. Si el modelo empieza a construir HTML, MVC se ha roto.',
  },
];

export const CONCEPTO_POR_ID = CONCEPTOS.reduce(
  (acc, c) => ({ ...acc, [c.id]: c }),
  {} as Record<ConceptoId, Concepto>,
);

/* ------------------------------------------------------------------ */
/* Mobiliario del parque (mismo que el parque DDD)                     */
/* ------------------------------------------------------------------ */

export { ARBOLES, ARBUSTOS, BANCOS, FAROLAS };

/** MVC no cerca nada: el patrón vive dentro de una aplicación. */
export const VALLAS: [Vec2, Vec2][] = [];
export const VALLAS_EXTRA: [Vec2, Vec2][] = [];

/* ------------------------------------------------------------------ */
/* Notificación modelo → vista (orbe)                                 */
/* ------------------------------------------------------------------ */

export const ORBE = {
  desde: [0.2, 3.6, -2.2] as [number, number, number],
  ctrl: [3.3, 5.8, -1.0] as [number, number, number],
  hasta: [6.4, 3.1, -2.0] as [number, number, number],
};
