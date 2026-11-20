# Diorama «Costa Verde» (Blender → GLB)

El fondo 3D del hero (`public/models/costa_verde.glb`) se genera con scripts Python para
Blender 5.2 que viven en `costa_verde/`. Todo es procedural y determinista: no hay `.blend`
que mantener, el código es la fuente.

```
costa_verde/
  SPEC.md       especificación: coordenadas, zonas, medidas, reglas y presupuesto
  common.py     API compartida (funciones de costa, mallas, materiales, texturas)
  build.py      orquestador: construye los módulos en la colección CostaVerde
  terrain.py    playa, pista, acantilado, meseta, Morro Solar, espigones
  city.py       ciudad, Torre curva, Larcomar
  park.py       malecón: césped, árboles, farolas, monolitos, Faro La Marina
  island.py     la isla del carrito y sus palmeras
  extras.py     parapente, autos, islotes, boyas, antenas
  smoke.py      litoral de relleno para probar módulos sueltos
  preview.py    renders headless (EEVEE) con las cámaras del sitio
  export.py     exportación final: AO horneado, unión por material, Draco + WebP
  ref/          foto de referencia
```

## Comandos (PowerShell, desde la raíz del repo)

Previsualizar (no toca el Blender abierto):

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --python scripts\blender\costa_verde\preview.py -- --cams hero,photo,contacto --out scripts\blender\costa_verde\shots\all
```

Opciones útiles: `--modules terrain,city` (subconjunto), `--fast` (menos detalle), `--night`,
`--samples 8`, `--blend salida.blend` (guardar el .blend para abrirlo en Blender).

Exportar el GLB definitivo (tarda ~1-3 min por el horneado de AO en GPU):

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --python scripts\blender\costa_verde\export.py
```

Opciones: `--no-ao` (sin oclusión ambiental), `--no-draco`, `--no-join`, `--blend salida.blend`.

## Cómo lo usa React

`src/components/scene/beach/World.tsx` carga el GLB (Draco con el decodificador local en
`public/draco/`, texturas WebP) y anima por nombre: `Parapente`, `Auto_00…11`, `Faro_lamp`
(haz del faro) y los materiales `CV_emissive_*` (ventanas, farolas y antenas que se encienden
de noche). Si el GLB no carga, cae al fondo procedural antiguo (`Backdrop.tsx`, `Island.tsx`,
`Palms.tsx`).

La línea de agua de la playa (`coast_r` en `common.py`) está replicada en
`src/components/scene/beach/shore.ts` (`coastR`) para que la espuma del shader de agua y los
autos coincidan con la geometría: si cambias una, cambia la otra.

## Blender abierto (MCP)

La extensión oficial «MCP» de Blender (Blender Lab) escucha en `localhost:9876` cuando
Blender está abierto. Para construir el diorama ahí mismo y verlo en el visor:

```python
import sys; sys.path.insert(0, r'C:\Users\Usuario\Documents\Default Project\scripts\blender\costa_verde')
import build; build.build()
```
