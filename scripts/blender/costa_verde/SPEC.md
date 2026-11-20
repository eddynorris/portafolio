# Diorama «Costa Verde» — especificación compartida

Escenario 3D para el hero del portafolio (Astro + React Three Fiber). Se modela en
**Blender 5.2** con scripts Python deterministas, se exporta a **un GLB** (`public/models/costa_verde.glb`)
y reemplaza al fondo procedural actual (`src/components/scene/beach/Backdrop.tsx`,
`Island.tsx`, `Palms.tsx`). El carrito de ceviche (GLB aparte), el agua, el cielo, las aves,
los botes, la utilería de la isla y las luces siguen en React.

Referencia visual: `scripts/blender/costa_verde/ref/costa-verde.jpg` (vista aérea de la
Costa Verde en Miraflores, Lima). **Léela con la herramienta Read antes de empezar** y vuelve
a mirarla cada vez que compares un render.

Meta: que parezca un portafolio de 100 mil dólares. Realista en proporciones y paleta,
limpio y legible (estilo "maqueta/diorama de arquitectura"), **ligero para la web**.

---

## 1. Qué se ve en la foto (y qué reproducimos)

Vista aérea desde el noroeste mirando hacia el sureste, a lo largo de la costa.

| Zona de la foto | Elemento real | En el diorama |
|---|---|---|
| Izquierda, primer plano | Torre curva de vidrio azul oscuro con bandas horizontales doradas (hotel JW Marriott), ~30 pisos | Torre `Torre_curva` a la izquierda del centro de la bahía |
| Izquierda / fondo | Skyline denso de Miraflores: torres residenciales blancas/crema de 10-20 pisos, balcones, azoteas con tanques; se difumina en la bruma | Ciudad sobre la meseta; densidad y altura bajan con la distancia; el fog de R3F la funde a 190 u |
| Centro-izquierda, arriba | Parque Salazar / malecón: césped muy verde, caminos beige, plaza circular, **dos monolitos azules en cuña** (~15 m), escenario triangular rojo con toldo blanco, jardineras redondas, palmeras y filas de árboles, farolas | Franja de parque de 6 u de ancho en todo el borde del acantilado |
| Centro | **Larcomar**: centro comercial en terrazas escalonadas incrustado en el borde del acantilado, fachada curva crema/blanca, sombrillas azules, barandas de vidrio, techos curvos; el parque queda sobre él | `Larcomar` centrado en θ = -π/2 |
| Centro, todo el ancho | Acantilado de ~70 m: tierra ocre/arena con **costillas verticales de erosión**, vegetación verde (enredadera) en la mitad superior, talud y muro de contención abajo | `cliff_h` ≈ 18 u, costillas por desplazamiento, degradado de color |
| Pie del acantilado | **Circuito de Playas**: autopista de 4 carriles con berma central, autos, fila de palmeras entre la pista y la playa, acera/muro | Pista `ROAD_W` = 7 u a `ROAD_Y`, palmeras, farolas, autos (`Auto_XX`) |
| Franja costera | Playa estrecha de canto rodado, **espigones** de rocas, olas rompiendo en líneas de espuma blanca | Playa `beach_w` ≈ 4.5 u, espigones cada ~0.3 rad; la espuma la pone el shader de agua |
| Derecha, mar | Mar turquesa → azul; **parapente azul** con piloto volando frente al acantilado | `Parapente` (R3F lo anima) |
| Fondo derecha | La bahía se curva hasta el **Morro Solar** (cerro pardo, antenas, bruma), más playas (Barranco, Chorrillos) | `morro_h` cierra la bahía; antenas y una cruz |
| Esquina inferior izquierda | Hotel con techo rojo, sombrillas rojas, piscina en azotea | Un edificio con azotea roja y piscina en el malecón izquierdo (opcional) |
| Cielo | Azul limpio, bruma en el horizonte | Lo pone R3F (Sky.tsx) |

---

## 2. Sistema de coordenadas (¡importante!)

- **Toda cifra de este documento está en coordenadas de three.js**: X derecha, **Y arriba**,
  Z hacia la cámara. El carrito está en el origen, apoyado en y = 0. La cámara del hero está
  en (1.6, 2.0, 6.6) mirando al carrito, es decir mira hacia **-Z**: "el fondo" es -Z.
- Polares: **θ = atan2(z, x)**. θ = -π/2 apunta al fondo (-Z); θ = 0 a la derecha (+X);
  θ = -π a la izquierda (-X). `common.polar(r, θ)` → (x, z).
- Blender es Z-up. **Nunca conviertas a mano**: `common.bl(x, y, z)` convierte un punto y
  `common.new_mesh()` recibe vértices three. `common.place(obj, x, y, z, yaw)` coloca objetos.
  El exportador deshace la conversión (`export_yup=True`), así que lo que midas aquí es lo
  que verá three.js.
- Unidades: 1 u ≈ 4 m reales (el acantilado de 70 m mide 18 u). El carrito mide ~2.5 u.

### Funciones compartidas (`common.py`) — úsalas, no las reimplementes

| Función | Qué devuelve |
|---|---|
| `SEA_Y = -0.42` | nivel del mar (plano de agua de R3F) |
| `shore_r(θ)`, `sand_height(x, z)` | orilla y altura de la **isla del carrito** (idénticas a `shore.ts`; la espuma del agua depende de ellas) |
| `coast_r(θ)` | radio de la **línea de agua de la playa** de la Costa Verde (≈ 70 al fondo, ≈ 61 a la derecha) — se replica en el shader de agua, **no cambiar** |
| `beach_w(θ)` | ancho de la playa (línea de agua → acera): ≈ 4.5 ± 1.5 |
| `road_r0(θ)` / `road_r1(θ)` | bordes de la pista (ancho `ROAD_W` = 7, altura `ROAD_Y` = 0.48) |
| `cliff_foot_r(θ)` | pie del acantilado (= `road_r1` + 1.2) |
| `cliff_top_r(θ)` | borde superior (= pie + 7.5 en horizontal) |
| `cliff_h(θ)` | altura de la meseta: ≈ 18 ± 2 |
| `morro_h(x, z)` | altura extra del cerro Morro Solar (0 fuera de él; sumar a `cliff_h` para el terreno de la derecha) |
| `COAST_T0`, `COAST_T1` | arco de la costa: -π/2 ± 1.5 rad |
| `coast_u(θ)` | posición normalizada a lo largo de la costa: -1 izquierda … 0 fondo … +1 derecha |
| `in_reserved(x, z, margen)` | True si el punto cae sobre utilería de React o el muelle (isla) |
| `PALMS`, `RESERVED`, `BOATS`, `PIER_*` | posiciones ya ocupadas |
| `noise2`, `fbm2`, `hash2`, `smoothstep`, `lerp`, `clamp`, `rng(seed)` | ruido y utilidades deterministas |
| `col('#hex')`, `mix(a, b, t)`, `shade(c, k)`, `PAL[...]` | colores lineales y paleta de la foto |
| `arc_grid(...)`, `grid(...)`, `box(...)`, `cylinder(...)`, `new_mesh(...)`, `join(...)` | geometría |
| `image_from_array(name, arr)`, `make_material(...)` | texturas procedurales (numpy) y materiales glTF |
| `BuildContext`: `ctx.collection`, `ctx.fast`, `ctx.rng(salt)`, `ctx.detail(full, fast)`, `ctx.stats` | contexto del módulo |

Perfil transversal de la costa (de mar a tierra), para cualquier θ:

```
mar ──► coast_r (línea de agua, y = SEA_Y) ──► playa sube hasta ROAD_Y - 0.45 ──► muro/acera ──►
pista [road_r0, road_r1] a y = ROAD_Y ──► berma 1.2 ──► pie del acantilado ──► cara (7.5 en horizontal,
cliff_h en vertical) ──► borde superior cliff_top_r ──► parque 6 u ──► ciudad hasta r ≈ 170
```

---

## 3. Zonas y medidas

- **Isla del carrito** (módulo `island`): arena según `sand_height`, orilla `shore_r` (r ≈ 6.4).
  Palmeras en `PALMS` (4). Nada dentro de `RESERVED` ni sobre el muelle (`in_reserved`).
- **Mar**: lo dibuja React (plano a `SEA_Y`, radio 170). Todo lo que esté por debajo de
  `SEA_Y - 0.1` es invisible salvo muy cerca de la orilla (agua semitransparente).
- **Costa**: arco `COAST_T0..COAST_T1`. Lo que importa de verdad está en |`coast_u`| ≤ 0.7
  (visible desde el hero y la vista aérea); los extremos pueden ser más simples.
- **Larcomar**: centrado en θ = -π/2, ancho ≈ 0.16 rad (≈ 14 u), 3 terrazas que bajan desde
  la meseta por la cara del acantilado (cada terraza ~2.2 u más baja y ~2.5 u más adentro),
  fachada curva crema, barandas, sombrillas azules, techo del nivel superior = parque.
- **Torre curva** (JW Marriott): θ = -π/2 - 0.22, r = `cliff_top_r` + 12, planta elíptica 7 × 4.5,
  altura 26, vidrio azul oscuro `PAL['glass_dark']` con bandas `PAL['yellow_band']` cada 1.6 u.
- **Monolitos azules**: dos cuñas de `PAL['blue_monolith']`, alturas 6 y 5, en θ = -π/2 - 0.14 y
  -π/2 - 0.10, r = `cliff_top_r` + 2.5.
- **Escenario con toldo**: θ = -π/2 - 0.30, estructura roja triangular + toldo blanco de 4 × 4.
- **Faro La Marina**: torre de 7 u a rayas negras/blancas, θ = -π/2 + 0.35, r = `cliff_top_r` + 1.5.
  La lámpara superior es un objeto aparte llamado **`Faro_lamp`** con material `CV_emissive_faro`.
- **Parque**: franja [`cliff_top_r`, `cliff_top_r` + 6] en todo el arco: césped `PAL['lawn']`,
  paseo pavimentado de 1.5 u junto al borde (`PAL['path']`), baranda baja, árboles cada 3-5 u
  (palmeras altas + árboles redondos), farolas cada 4 u (cabeza con `CV_emissive_lamp`), bancas,
  jardineras, una plaza circular en θ = -π/2 + 0.08, rampa de despegue de parapentes en θ = -π/2 + 0.14.
- **Ciudad**: desde `cliff_top_r` + 6 hasta r = 170 en todo el arco. Manzanas alineadas a la
  tangente de la costa; calles de 2 u (suelo gris oscuro). Alturas: borde 6-14 (torres sueltas
  hasta 22), interior 3-10, lejos (r > 125) bloques simples sin ventanas en `PAL['haze']`.
  Fachadas con textura de ventanas repetida (UV por `uv_tile`) y versión nocturna emisiva.
- **Pista**: asfalto `PAL['asphalt']`, líneas blancas discontinuas (tiras de 0.08 u de ancho,
  1.2 u de largo, 1.2 u de hueco), doble línea amarilla en la berma central, bordillos `PAL['curb']`.
  Palmeras cada ~6 u en el lado mar (entre acera y playa), farolas cada ~8 u.
- **Playa**: canto rodado `PAL['pebble']`, banda húmeda `PAL['wet_sand']` de 1 u junto al agua,
  fondo marino `PAL['sea_floor']` bajo el agua hasta 6 u mar adentro (se ve a través del agua).
  **Espigones**: montículos de rocas de 6 u de largo × 2.5 de ancho, desde la línea de agua hacia
  el mar, cada ~0.3 rad en |`coast_u`| ≤ 0.8.
- **Acantilado**: cara con costillas verticales (ruido de alta frecuencia en θ, amplitud 0.5-0.8 u,
  más marcadas en la mitad inferior), talud de tierra oscura al pie, degradado de color de
  `cliff_dark` (abajo) → `cliff_b` → `cliff_a` (arriba) con manchas `cliff_veg` en el tercio superior.
  Un muro de contención de concreto gris en un tramo (θ ≈ -π/2 + 0.5 … + 0.7).
- **Morro Solar**: cerro definido por `morro_h`; roca seca `PAL['rock_light']` / `PAL['cliff_b']`
  con matorral escaso; 3 mástiles de antenas (12 u, con luces rojas `CV_emissive_antena`) y una
  cruz de 4 u en la cima.
- **Extras en el mar**: islotes rocosos con guano en (-30, -40), (-22, -52), (-38, -31) (radios 6, 4, 3);
  boyas rojas/amarillas; nada en `BOATS` ni sobre el muelle.
- **Parapente**: objeto **`Parapente`** (ala azul `PAL['umbrella_blue']` de 3 u de envergadura con
  celdas, piloto colgado 1.2 u debajo con líneas), colocado inicialmente en (22, 14, -40) mirando
  hacia -X. React lo moverá, así que su origen debe estar en el piloto y el ala en +Y local.
- **Autos**: 12 objetos **`Auto_00` … `Auto_11`** (1.6 × 0.6 × 0.75 u; carrocería de colores
  variados, ventanas oscuras, ruedas) con origen en el centro de la base y el frente en **+X local**,
  colocados inicialmente repartidos por la pista (React los animará a lo largo de `road_r0/1`).

---

## 4. Módulos (un agente por módulo) y presupuestos

| Módulo | Archivo | Contenido | Tris máx. | Texturas |
|---|---|---|---|---|
| `terrain` | `terrain.py` | fondo marino cercano, playa, muro, pista con marcas, bordillos, berma, acantilado con costillas, meseta base hasta r = 200 (parque = césped liso, ciudad = gris), muro de contención, Morro Solar, espigones, el suelo bajo la ciudad | 70 000 | ≤ 2 de 256² |
| `city` | `city.py` | edificios (fachadas con ventanas día/noche), Torre curva, Larcomar, azoteas con tanques/antenas, árboles entre manzanas (pocos) | 50 000 | ≤ 3 de 512² (fachadas día + noche) |
| `park` | `park.py` | césped detallado, paseo, barandas, árboles y palmeras del malecón, monolitos, escenario con toldo, Faro La Marina (`Faro_lamp`), farolas del malecón y de la pista, palmeras de la pista, bancas, plaza, rampa de parapentes | 35 000 | ≤ 1 |
| `island` | `island.py` | arena de la isla (vertex color: seca/húmeda/mojada/bajo el agua, huellas sutiles), 4 palmeras bonitas (tronco curvo con anillos, 8-10 frondas, cocos), matas de hierba, rocas pequeñas en el lado -X/-Z, conchas, estrellas de mar | 25 000 | ≤ 1 |
| `extras` | `extras.py` | `Parapente`, `Auto_00..11`, islotes con guano, boyas, antenas y cruz del Morro, aves posadas (opcional) | 20 000 | 0 |

Total objetivo ≤ 180 000 tris y GLB final ≤ 3 MB (Draco + WebP).

Cada módulo es un archivo `scripts/blender/costa_verde/<módulo>.py` con:

```python
import common
from common import PAL, SEA_Y

def build(ctx: common.BuildContext):
    """Crea todo dentro de ctx.collection y devuelve la lista de objetos."""
    ...
    return list(ctx.collection.objects)
```

---

## 5. Reglas técnicas

1. **Sólo edita tu módulo.** No toques `common.py`, `build.py`, `preview.py`, `smoke.py` ni los
   módulos de otros. Si te falta un helper, escríbelo dentro de tu módulo y anótalo en el informe.
2. **Determinista**: toda aleatoriedad con `ctx.rng(salt)` / `common.rng(seed)`. Dos ejecuciones
   deben dar la misma malla.
3. **Colores**: siempre lineales vía `common.col('#hex')` o `PAL`. Vertex colors en el atributo
   `Col` (lo crean `new_mesh(colors=…)` / `face_colors=…`). Materiales sólo con
   `common.make_material(...)`: `vcol=True` para multiplicar por `Col`.
4. **Materiales emisivos** (se encienden de noche en React): nombre que empiece por
   **`CV_emissive_`**. Ventanas: `CV_emissive_windows` (textura día + textura noche).
   Lámparas: `CV_emissive_lamp`. Faro: `CV_emissive_faro`. Antenas: `CV_emissive_antena`.
5. **Texturas**: genera con numpy y `common.image_from_array('tex_<módulo>_<nombre>', arr)`;
   tamaño ≤ 512². Nada de descargar ni de rutas externas.
6. **Normales**: una sola cara por defecto (`make_material` activa backface culling). Las
   caras deben mirar hacia afuera / arriba; si ves caras negras o huecos en el render es un
   problema de normales (`fix_up=True` en mallas de altura, `bmesh.ops.recalc_face_normals`
   en sólidos). `double_sided=True` sólo para hojas, toldos, banderas.
7. **Nombres**: objetos `<módulo>_<lo que es>` (p. ej. `city_torre_curva`, `park_farola_03`).
   Los especiales exactamente como se indica: `Parapente`, `Auto_00`…`Auto_11`, `Faro_lamp`.
8. **Modificadores**: evita dejarlos; si usas uno (p. ej. Displace), aplícalo con
   `common.apply_modifiers(obj)` para que los tris contados sean reales.
9. **Draw calls**: en la web cada objeto es un draw call. Une lo repetido con `common.join([...], 'nombre')`
   (farolas, árboles, bancas, autos NO —los autos y el parapente van sueltos—). Objetivo:
   ≤ 25 objetos por módulo al terminar (sin contar `Auto_XX`).
10. **Nada bajo el agua** salvo lo que se ve a través de ella (fondo marino cerca de las orillas).
11. **`bpy.ops`** en background falla a menudo por contexto: prefiere `bmesh` y la API de datos.
    Blender está en español: **no busques nodos por nombre** ("Principled BSDF" no existe);
    `make_material` ya crea los nodos.
12. **Modo rápido**: respeta `ctx.fast` con `ctx.detail(full, fast)` para que `--fast` construya
    en < 10 s. Sin `--fast` el módulo debe construir en < 90 s.
13. **Cercanía a la cámara**: lo que esté a menos de 15 u del origen (isla) se ve de cerca;
    lo demás se ve a ≥ 60 u, no gastes tris en detalles menores de 0.3 u fuera de la isla.

---

## 6. Cómo probar

Render headless (EEVEE, sin bloquear el Blender abierto del usuario):

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --python scripts\blender\costa_verde\preview.py -- --modules smoke,<módulo> --cams hero,photo,front --fast --out scripts\blender\costa_verde\shots\<módulo>
```

- `smoke` es un litoral de relleno (playa + pista + acantilado + bloques); úsalo como contexto
  para `city`, `park`, `island` y `extras`. Para `terrain` usa `--modules terrain` a secas.
- Cámaras: `hero` (estación 0 del sitio, la que más importa), `proyectos`, `educador`, `skills`,
  `contacto` (vista aérea de la isla, estación 4), `photo` (encuadre parecido a la foto),
  `top` (cenital para distribución), `front` (desde el mar al malecón centro), `left`, `right`.
- `--fast` reduce detalle; antes de entregar renderiza **sin** `--fast` al menos `hero`, `photo` y
  `contacto` y comprueba que el tiempo de construcción y los tris están dentro del presupuesto.
- Lee los PNG con la herramienta Read y compáralos con la foto de referencia. Itera hasta que
  la forma, proporciones, colores y nivel de detalle estén a la altura. Mira también si hay
  caras negras (normales), huecos, z-fighting (caras coplanares parpadeando), objetos flotando o
  enterrados.
- La salida termina con `PREVIEW_STATS {...}` (tris por módulo y tiempos).
- Si el render tarda más de 60 s por cámara, baja `--samples 8`.

---

## 7. Entrega

Al terminar, informa: módulo, archivo, tris en modo completo, segundos de construcción,
texturas creadas, objetos especiales, rutas de los renders finales, resumen de lo construido,
problemas conocidos y helpers que te hubiera gustado tener en `common.py`.
