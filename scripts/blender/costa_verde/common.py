"""
Base compartida del diorama "Costa Verde" (Blender 5.2 · Python 3.13).

CONVENCIONES (léelas antes de escribir un módulo):

- Toda la especificación está en coordenadas de three.js: X derecha, Y arriba,
  Z hacia la cámara. El carrito de ceviche está en el origen (su base en y = 0)
  y la cámara del hero está en +Z mirando hacia -Z. Los ángulos polares usan
  θ = atan2(z, x): θ = -π/2 apunta "al fondo" (-Z), θ = 0 a la derecha (+X).
- Blender es Z-up. `bl(x, y, z)` convierte un punto three → Blender y
  `new_mesh()` recibe vértices three y los convierte por ti. El exportador glTF
  (export_yup=True) deshace la conversión: lo que se ve en three.js coincide con
  los números de esta especificación.
- Los colores de vértice se guardan lineales: usa `col('#rrggbb')`.
- Todo es determinista: usa `rng(seed)` en vez de `random` global.
- En modo background `bpy.ops` es lento y depende del contexto: prefiere la API
  de datos (`bpy.data`) y `bmesh`. `bpy.ops.import_scene.gltf` / `export_scene.gltf`
  sí funcionan en background.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

PACKAGE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = PACKAGE_DIR.parents[2]
TEXTURE_DIR = PACKAGE_DIR / "textures"
SHOTS_DIR = PACKAGE_DIR / "shots"
CART_GLB = PROJECT_DIR / "public" / "models" / "Ceviche_Tidehunter_Carrito.glb"

# ---------------------------------------------------------------------------
# Constantes de la escena three.js (deben coincidir con src/components/scene)
# ---------------------------------------------------------------------------

#: Nivel del mar (plano de agua de Water.tsx).
SEA_Y = -0.42

#: Orilla de la isla del carrito: R(θ) = r0 + Σ a·sin(k·θ + p). Igual que shore.ts.
SHORE = {"r0": 6.4, "a": (0.75, 0.5, 0.28), "k": (2, 3, 5), "p": (0.6, 2.1, 4.0)}

#: Dirección hacia el sol del cielo (Sky.tsx) y luz principal (sceneTheme.keyPos).
SUN_DIR = (0.2103, 0.0976, -0.9727)
KEY_LIGHT_POS = (5.0, 8.0, 6.0)
FILL_LIGHT_POS = (-6.0, 3.0, -4.0)

#: Palmeras actuales de la isla (Palms.tsx): x, z, altura, inclinación (dx, dz).
PALMS = (
    {"x": -3.3, "z": -2.7, "height": 4.2, "lean": (0.7, 0.3), "seed": 1},
    {"x": 3.9, "z": -3.1, "height": 3.6, "lean": (-0.75, 0.2), "seed": 7},
    {"x": -4.6, "z": 0.6, "height": 2.9, "lean": (-0.4, 0.5), "seed": 13},
    {"x": 1.2, "z": -3.9, "height": 3.1, "lean": (0.5, -0.3), "seed": 21},
)

#: Zonas de la isla ya ocupadas por utilería de React (no poner nada encima).
#: (x, z, radio)
RESERVED = (
    (0.0, 0.0, 2.3),      # carrito + sombra de contacto
    (2.85, -1.6, 0.9),    # caballitos de totora
    (1.42, -0.55, 0.7),   # jabas de pescado y limones
    (-2.35, 1.75, 1.3),   # sombrilla, toalla y cooler
)

#: Muelle (Props.tsx): sale de la orilla en θ = -0.78 rad y mide 9.5 unidades.
PIER_THETA = -0.78
PIER_LENGTH = 9.5
#: Botes de React (x, z): no poner rocas ni nada encima.
BOATS = ((-9.5, -11.0), (13.0, 2.5))

# ---------------------------------------------------------------------------
# Costa Verde: geometría del litoral (todo en función de θ)
# ---------------------------------------------------------------------------

#: Arco que ocupa la costa (centrado en -π/2, "al fondo").
COAST_T0 = -math.pi / 2 - 1.5
COAST_T1 = -math.pi / 2 + 1.5
#: Ancho total de la pista (Circuito de Playas): 2 + 2 carriles + berma central.
ROAD_W = 7.0
#: Altura de la pista sobre el nivel del mar.
ROAD_Y = SEA_Y + 0.9
#: Alto de la escalera/acera que separa playa y pista.
SEAWALL_H = 0.45


def smoothstep(a: float, b: float, x: float) -> float:
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def clamp(x: float, lo: float, hi: float) -> float:
    return lo if x < lo else hi if x > hi else x


def hash2(x: float, y: float) -> float:
    """Hash determinista 2D → [0, 1). Igual que shore.ts."""
    s = math.sin(x * 127.1 + y * 311.7) * 43758.5453
    return s - math.floor(s)


def noise2(x: float, y: float) -> float:
    """Ruido de valor suave 2D en [0, 1]. Igual que shore.ts."""
    ix, iy = math.floor(x), math.floor(y)
    fx, fy = x - ix, y - iy
    ux = fx * fx * (3 - 2 * fx)
    uy = fy * fy * (3 - 2 * fy)
    a = hash2(ix, iy)
    b = hash2(ix + 1, iy)
    c = hash2(ix, iy + 1)
    d = hash2(ix + 1, iy + 1)
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy


def fbm2(x: float, y: float, octaves: int = 4, gain: float = 0.5, lac: float = 2.0) -> float:
    """Ruido fractal en [0, 1] aprox."""
    s, amp, tot = 0.0, 1.0, 0.0
    for _ in range(octaves):
        s += amp * noise2(x, y)
        tot += amp
        x, y = x * lac + 17.3, y * lac + 9.1
        amp *= gain
    return s / tot


def shore_r(theta: float) -> float:
    """Radio de la orilla de la isla en θ (igual que shoreR de shore.ts)."""
    r0, a, k, p = SHORE["r0"], SHORE["a"], SHORE["k"], SHORE["p"]
    return r0 + a[0] * math.sin(k[0] * theta + p[0]) + a[1] * math.sin(k[1] * theta + p[1]) + a[2] * math.sin(k[2] * theta + p[2])


def sand_height(x: float, z: float) -> float:
    """Altura de la arena de la isla en (x, z) (igual que sandHeight de shore.ts)."""
    r = math.hypot(x, z)
    R = shore_r(math.atan2(z, x))
    t = r / R
    fall = smoothstep(0.42, 1.0, t) ** 1.25
    y = SEA_Y * fall
    if t > 1:
        y -= (t - 1) * R * 0.55
    dune = smoothstep(0.4, 0.55, t) * (1 - smoothstep(0.72, 0.9, t))
    y += dune * (noise2(x * 0.55, z * 0.55) - 0.35) * 0.22
    return min(y, 0.0 if r < 2.2 else 0.2)


def coast_u(theta: float) -> float:
    """Posición normalizada a lo largo de la costa: -1 (izquierda) … 0 (fondo) … 1 (derecha)."""
    return (theta + math.pi / 2) / 1.5


def coast_r(theta: float) -> float:
    """
    Radio de la LÍNEA DE AGUA de la playa de la Costa Verde en θ.
    La bahía se cierra hacia la derecha (el Morro se acerca al espectador).
    Se replica en GLSL en Water.tsx para la espuma: no cambiar sin avisar.
    """
    u = coast_u(theta)
    r = 70.0 - 9.0 * smoothstep(0.15, 1.0, u)
    r += 2.2 * math.sin(3 * theta + 0.4) + 1.1 * math.sin(7 * theta + 2.0) + 0.6 * math.sin(13 * theta + 1.0)
    return r


def beach_w(theta: float) -> float:
    """Ancho de la playa de canto rodado (línea de agua → muro/acera de la pista)."""
    return 4.5 + 1.5 * math.sin(5 * theta + 1.3)


def road_r0(theta: float) -> float:
    """Radio del borde interior (lado mar) de la pista."""
    return coast_r(theta) + beach_w(theta)


def road_r1(theta: float) -> float:
    """Radio del borde exterior (lado acantilado) de la pista."""
    return road_r0(theta) + ROAD_W


def cliff_foot_r(theta: float) -> float:
    """Pie del acantilado (tras una berma de 1.2)."""
    return road_r1(theta) + 1.2


def cliff_h(theta: float) -> float:
    """Altura de la meseta (malecón) sobre y = 0 en θ. ~18 unidades (≈ 70 m reales)."""
    return 18.0 + 1.6 * math.sin(2.3 * theta + 0.7) + 1.2 * (noise2(theta * 4.0 + 3.0, 1.5) - 0.5)


def cliff_top_r(theta: float) -> float:
    """Borde superior del acantilado (la pendiente avanza ~7.5 en horizontal)."""
    return cliff_foot_r(theta) + 7.5


def morro_h(x: float, z: float) -> float:
    """
    Altura del cerro (Morro Solar) que cierra la bahía por la derecha, en (x, z).
    0 fuera de su huella. Suma a cliff_h para el terreno del fondo derecho.
    """
    th = math.atan2(z, x)
    u = coast_u(th)
    r = math.hypot(x, z)
    along = smoothstep(0.55, 1.05, u) * (1 - smoothstep(1.35, 1.6, u))
    depth = smoothstep(coast_r(th) + 8, coast_r(th) + 30, r) * (1 - smoothstep(coast_r(th) + 70, coast_r(th) + 95, r))
    return 28.0 * along * depth * (0.8 + 0.4 * fbm2(x * 0.03, z * 0.03, 3))


def polar(r: float, theta: float) -> tuple[float, float]:
    """(x, z) three.js desde polares."""
    return r * math.cos(theta), r * math.sin(theta)


def in_reserved(x: float, z: float, margin: float = 0.0) -> bool:
    """¿El punto (x, z) cae sobre utilería de React o el muelle?"""
    for cx, cz, rad in RESERVED:
        if math.hypot(x - cx, z - cz) < rad + margin:
            return True
    # muelle: franja de 2.4 de ancho desde la orilla hacia afuera
    dx, dz = math.cos(PIER_THETA), math.sin(PIER_THETA)
    along = x * dx + z * dz
    across = abs(-x * dz + z * dx)
    r_shore = shore_r(PIER_THETA)
    if r_shore - 2.0 < along < r_shore + PIER_LENGTH + 1 and across < 1.2 + margin:
        return True
    return False


# ---------------------------------------------------------------------------
# Conversión de coordenadas y utilidades
# ---------------------------------------------------------------------------


def bl(x: float, y: float, z: float) -> Vector:
    """Punto three.js (X, Y arriba, Z) → Blender (X, Y, Z arriba)."""
    return Vector((x, -z, y))


def three(v) -> tuple[float, float, float]:
    """Punto Blender → three.js."""
    return (v[0], v[2], -v[1])


def rng(seed: int) -> random.Random:
    return random.Random(seed)


def srgb_to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def col(hex_or_rgb, alpha: float = 1.0) -> tuple[float, float, float, float]:
    """'#rrggbb' (sRGB) o (r, g, b) sRGB 0..1 → RGBA lineal para color attributes/materiales."""
    if isinstance(hex_or_rgb, str):
        h = hex_or_rgb.lstrip("#")
        r, g, b = (int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))
    else:
        r, g, b = hex_or_rgb[:3]
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), alpha)


def mix(a, b, t: float):
    """Interpola dos RGBA."""
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(4))


def shade(c, k: float):
    """Oscurece (k < 1) o aclara (k > 1) un RGBA lineal."""
    return (min(1.0, c[0] * k), min(1.0, c[1] * k), min(1.0, c[2] * k), c[3])


# Paleta (tomada de la foto de referencia). Todas lineales.
PAL = {
    "cliff_a": col("#c69a6a"),
    "cliff_b": col("#a97c52"),
    "cliff_dark": col("#8a6140"),
    "cliff_veg": col("#6f9b47"),
    "top_grass": col("#6a9f3f"),
    "lawn": col("#5cb53c"),
    "dry_grass": col("#9fb35c"),
    "path": col("#dccdab"),
    "asphalt": col("#45484e"),
    "asphalt_light": col("#5a5d63"),
    "lane": col("#f1f1ec"),
    "lane_yellow": col("#e9c84a"),
    "curb": col("#cdc7bb"),
    "sand": col("#d9c396"),
    "pebble": col("#bba47d"),
    "wet_sand": col("#9a8b68"),
    "rock": col("#6f665c"),
    "rock_light": col("#8e8377"),
    "building": [col("#f0e9dc"), col("#e5dbcc"), col("#f7f3ea"), col("#d9cdbc"), col("#cfd8dc"), col("#e8e0d0")],
    "glass": col("#5f8fb8"),
    "glass_dark": col("#213a57"),
    "yellow_band": col("#e4bf3c"),
    "blue_monolith": col("#4b73a8"),
    "umbrella_blue": col("#3d7fc4"),
    "red": col("#c8322b"),
    "white": col("#f6f4ee"),
    "black": col("#1f1f22"),
    "tree": col("#3f7d32"),
    "tree_light": col("#64a63f"),
    "trunk": col("#6e4d2e"),
    "palm_frond": col("#4f9b3a"),
    "palm_trunk": col("#8d6a45"),
    "sea_floor": col("#2d7da0"),
    "haze": col("#9fb3c6"),
}


def log(*args) -> None:
    print("[costa_verde]", *args, flush=True)


# ---------------------------------------------------------------------------
# Colecciones, mallas y materiales
# ---------------------------------------------------------------------------

ROOT_COLLECTION = "CostaVerde"


def get_collection(name: str) -> bpy.types.Collection:
    """Colección `name` dentro de `CostaVerde` (se crea si hace falta)."""
    scene = bpy.context.scene
    root = bpy.data.collections.get(ROOT_COLLECTION)
    if root is None:
        root = bpy.data.collections.new(ROOT_COLLECTION)
    if root.name not in scene.collection.children:
        scene.collection.children.link(root)
    sub = bpy.data.collections.get(name)
    if sub is None:
        sub = bpy.data.collections.new(name)
    if sub.name not in root.children:
        root.children.link(sub)
    return sub


def clear_collection(name: str) -> None:
    """Borra los objetos (y sus mallas) de una colección."""
    sub = bpy.data.collections.get(name)
    if sub is None:
        return
    for obj in list(sub.objects):
        data = obj.data
        bpy.data.objects.remove(obj, do_unlink=True)
        if isinstance(data, bpy.types.Mesh) and data.users == 0:
            bpy.data.meshes.remove(data)


def new_mesh(
    name: str,
    verts,
    faces,
    collection: bpy.types.Collection,
    colors=None,
    face_colors=None,
    uvs=None,
    material: bpy.types.Material | None = None,
    smooth: bool = True,
    smooth_angle: float | None = 40.0,
    fix_up: bool = False,
) -> bpy.types.Object:
    """
    Crea un objeto malla a partir de vértices THREE (x, y, z) y caras (índices).

    colors:      un RGBA lineal por vértice  (dominio POINT)
    face_colors: un RGBA lineal por cara     (dominio CORNER, look facetado)
    uvs:         lista de (u, v) por esquina de cara (en orden de `faces` aplanado)
    smooth:      sombreado suave; `smooth_angle` marca aristas más cerradas como duras
    fix_up:      invierte las caras cuya normal apunte hacia abajo (para mallas de altura)
    """
    me = bpy.data.meshes.new(name)
    me.from_pydata([bl(*v) for v in verts], [], [tuple(f) for f in faces])
    me.validate(verbose=False)
    me.update()

    if fix_up:
        import bmesh

        bm = bmesh.new()
        bm.from_mesh(me)
        flip = [f for f in bm.faces if f.normal.z < 0]
        if flip:
            bmesh.ops.reverse_faces(bm, faces=flip)
        bm.to_mesh(me)
        bm.free()
        me.update()

    if colors is not None:
        attr = me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="POINT")
        flat = [c for v in colors for c in v]
        attr.data.foreach_set("color", flat)
        _activate_color(me, attr)
    elif face_colors is not None:
        attr = me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="CORNER")
        flat = []
        for poly, c in zip(me.polygons, face_colors):
            flat.extend(list(c) * poly.loop_total)
        attr.data.foreach_set("color", flat)
        _activate_color(me, attr)

    if uvs is not None:
        layer = me.uv_layers.new(name="UVMap")
        flat = [c for uv in uvs for c in uv]
        layer.data.foreach_set("uv", flat)

    if smooth:
        me.shade_smooth()
        if smooth_angle is not None:
            set_sharp_from_angle(me, smooth_angle)
    else:
        me.shade_flat()

    if material is not None:
        me.materials.append(material)

    obj = bpy.data.objects.new(name, me)
    collection.objects.link(obj)
    return obj


def _activate_color(me: bpy.types.Mesh, attr) -> None:
    idx = me.color_attributes.find(attr.name)
    me.color_attributes.active_color_index = idx
    me.color_attributes.render_color_index = idx


def set_sharp_from_angle(me: bpy.types.Mesh, angle_deg: float) -> None:
    """Marca como duras las aristas más cerradas que `angle_deg` (equivale a auto smooth)."""
    fn = getattr(me, "set_sharp_from_angle", None)
    if fn is not None:
        fn(angle=math.radians(angle_deg))
        return
    # Respaldo: cálculo manual por arista
    import bmesh

    bm = bmesh.new()
    bm.from_mesh(me)
    limit = math.cos(math.radians(angle_deg))
    for e in bm.edges:
        if len(e.link_faces) == 2:
            n0, n1 = e.link_faces[0].normal, e.link_faces[1].normal
            e.smooth = n0.dot(n1) >= limit
    bm.to_mesh(me)
    bm.free()


def set_colors(obj: bpy.types.Object, colors) -> None:
    """Reemplaza/crea el color attribute POINT 'Col' de una malla existente."""
    me = obj.data
    attr = me.color_attributes.get("Col") or me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="POINT")
    attr.data.foreach_set("color", [c for v in colors for c in v])
    _activate_color(me, attr)


def tri_count(objs) -> int:
    """Triángulos de la malla base (sin modificadores) de una lista de objetos."""
    n = 0
    for o in objs:
        if o.type == "MESH":
            n += sum(max(0, len(p.vertices) - 2) for p in o.data.polygons)
    return n


def apply_modifiers(obj: bpy.types.Object) -> None:
    """Aplica todos los modificadores evaluando la malla (sin bpy.ops)."""
    if not obj.modifiers:
        return
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
    old = obj.data
    obj.modifiers.clear()
    obj.data = me
    if old.users == 0:
        bpy.data.meshes.remove(old)


def place(obj: bpy.types.Object, x: float, y: float, z: float, yaw: float = 0.0, scale=None) -> None:
    """Coloca un objeto en coordenadas three (yaw en radianes alrededor de Y-arriba)."""
    obj.location = bl(x, y, z)
    obj.rotation_euler = (0.0, 0.0, yaw)
    if scale is not None:
        s = scale if isinstance(scale, (tuple, list)) else (scale, scale, scale)
        obj.scale = (s[0], s[2], s[1])


# ---------------------------------------------------------------------------
# Generadores de geometría
# ---------------------------------------------------------------------------


def arc_grid(th0: float, th1: float, n_th: int, rows: int, point_fn, color_fn=None):
    """
    Rejilla (n_th+1) × rows barrida a lo largo de un arco de θ.
    point_fn(th, j) → (x, y, z) three; las filas j van de ADENTRO (mar) hacia AFUERA,
    así las normales quedan hacia arriba / hacia el mar.
    color_fn(th, j, p) → RGBA lineal (opcional).
    Devuelve (verts, faces, colors).
    """
    verts, cols, faces = [], [], []
    for i in range(n_th + 1):
        th = th0 + (th1 - th0) * i / n_th
        for j in range(rows):
            p = point_fn(th, j)
            verts.append(p)
            if color_fn is not None:
                cols.append(color_fn(th, j, p))
    for i in range(n_th):
        for j in range(rows - 1):
            a = i * rows + j
            b = a + rows
            faces.append((a, b, b + 1, a + 1))
    return verts, faces, (cols if color_fn is not None else None)


def grid(nx: int, nz: int, point_fn, color_fn=None):
    """
    Rejilla plana (nx+1) × (nz+1): point_fn(i, j) → (x, y, z) three con i a lo largo de X
    y j a lo largo de Z. Normales hacia arriba. Devuelve (verts, faces, colors).
    """
    verts, cols, faces = [], [], []
    for i in range(nx + 1):
        for j in range(nz + 1):
            p = point_fn(i, j)
            verts.append(p)
            if color_fn is not None:
                cols.append(color_fn(i, j, p))
    for i in range(nx):
        for j in range(nz):
            a = i * (nz + 1) + j
            b = a + (nz + 1)
            faces.append((a, a + 1, b + 1, b))
    return verts, faces, (cols if color_fn is not None else None)


def box(
    name: str,
    collection: bpy.types.Collection,
    center,
    size,
    yaw: float = 0.0,
    color=None,
    material=None,
    uv_tile=None,
    uv_offset=(0.0, 0.0),
    smooth: bool = False,
) -> bpy.types.Object:
    """
    Caja con la base en center.y (three): center=(x, y, z), size=(w, h, d), yaw alrededor de Y.
    uv_tile=(tw, th): tamaño en unidades de mundo de una repetición de textura (fachadas).
    color: RGBA lineal para todas las caras.
    """
    x, y, z = center
    w, h, d = size
    cy, sy = math.cos(yaw), math.sin(yaw)

    def P(sx, syy, sz):
        lx, lz = sx * w / 2, sz * d / 2
        return (x + lx * cy - lz * sy, y + syy * h, z + lx * sy + lz * cy)

    v = [P(sx, syy, sz) for sx in (-1, 1) for syy in (0, 1) for sz in (-1, 1)]
    faces = [(4, 6, 7, 5), (0, 1, 3, 2), (2, 3, 7, 6), (0, 4, 5, 1), (1, 5, 7, 3), (0, 2, 6, 4)]
    uvs = None
    if uv_tile is not None:
        tw, th = uv_tile
        ou, ov = uv_offset
        # (+x, -x, top, bottom, +z, -z): extensión horizontal de cada cara
        spans = [(d, h), (d, h), (w, d), (w, d), (w, h), (w, h)]
        uvs = []
        for (su, sv) in spans:
            uu, vv = su / tw, sv / th
            uvs.extend([(ou, ov), (ou + uu, ov), (ou + uu, ov + vv), (ou, ov + vv)])
    return new_mesh(
        name, v, faces, collection,
        face_colors=([color] * 6 if color is not None else None),
        uvs=uvs, material=material, smooth=smooth, smooth_angle=None,
    )


def cylinder(
    name: str,
    collection: bpy.types.Collection,
    center,
    r_bottom: float,
    r_top: float,
    height: float,
    segments: int = 12,
    color=None,
    material=None,
    cap: bool = True,
) -> bpy.types.Object:
    """Cilindro/cono con la base en center.y (three)."""
    x, y, z = center
    verts, faces = [], []
    for k in range(segments):
        a = 2 * math.pi * k / segments
        verts.append((x + r_bottom * math.cos(a), y, z + r_bottom * math.sin(a)))
    for k in range(segments):
        a = 2 * math.pi * k / segments
        verts.append((x + r_top * math.cos(a), y + height, z + r_top * math.sin(a)))
    for k in range(segments):
        n = (k + 1) % segments
        faces.append((k, n, n + segments, k + segments))
    if cap:
        faces.append(tuple(range(segments))[::-1])
        faces.append(tuple(range(segments, 2 * segments)))
    obj = new_mesh(name, verts, faces, collection, face_colors=([color] * len(faces) if color else None),
                   material=material, smooth=True, smooth_angle=50.0)
    # las caras laterales en orden k→n recorren +θ; con la base abajo la normal queda hacia afuera
    import bmesh

    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    return obj


def join(objs, name: str) -> bpy.types.Object | None:
    """Une varios objetos malla en uno (sin bpy.ops). Conserva colores 'Col', UVs y materiales."""
    import bmesh

    objs = [o for o in objs if o.type == "MESH"]
    if not objs:
        return None
    bm = bmesh.new()
    mats: list[bpy.types.Material] = []
    for o in objs:
        for m in o.data.materials:
            if m not in mats:
                mats.append(m)
    # asegurar que todas tengan el color attribute (mismo dominio) para que bmesh lo fusione
    need_uv = any(o.data.uv_layers for o in objs)
    any_corner = any((o.data.color_attributes.get("Col") or o.data.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="POINT")).domain == "CORNER" for o in objs)
    for o in objs:
        me = o.data
        a = me.color_attributes.get("Col")
        if a is None:
            a = me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="POINT")
            a.data.foreach_set("color", [1.0, 1.0, 1.0, 1.0] * len(me.vertices))
        if any_corner and a.domain == "POINT":
            # POINT → CORNER sin pérdida (cada esquina toma el color de su vértice)
            src = np.empty(len(me.vertices) * 4, np.float32)
            a.data.foreach_get("color", src)
            vidx = np.empty(len(me.loops), np.int32)
            me.loops.foreach_get("vertex_index", vidx)
            me.color_attributes.remove(a)
            a = me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="CORNER")
            a.data.foreach_set("color", src.reshape(-1, 4)[vidx].ravel())
        _activate_color(me, a)
        if need_uv and not me.uv_layers:
            me.uv_layers.new(name="UVMap")
    for o in objs:
        me = o.data.copy()
        me.transform(o.matrix_world)
        # reasignar índices de material al conjunto global
        remap = [mats.index(m) if m is not None else 0 for m in me.materials] or [0]
        for p in me.polygons:
            p.material_index = remap[min(p.material_index, len(remap) - 1)]
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    out = bpy.data.meshes.new(name)
    bm.to_mesh(out)
    bm.free()
    for m in mats:
        out.materials.append(m)
    obj = bpy.data.objects.new(name, out)
    coll = objs[0].users_collection[0]
    coll.objects.link(obj)
    for o in objs:
        data = o.data
        bpy.data.objects.remove(o, do_unlink=True)
        if data.users == 0:
            bpy.data.meshes.remove(data)
    return obj


# ---------------------------------------------------------------------------
# Texturas procedurales y materiales
# ---------------------------------------------------------------------------


def image_from_array(name: str, arr: np.ndarray, srgb: bool = True) -> bpy.types.Image:
    """
    Crea (o reemplaza) una imagen a partir de un array float32 (h, w, 4) en 0..1 y la guarda
    en textures/<name>.png para que el exportador la empaquete. `srgb=False` para datos no color.
    """
    TEXTURE_DIR.mkdir(parents=True, exist_ok=True)
    h, w = arr.shape[:2]
    old = bpy.data.images.get(name)
    if old is not None:
        bpy.data.images.remove(old)
    img = bpy.data.images.new(name, w, h, alpha=True, float_buffer=False)
    img.colorspace_settings.name = "sRGB" if srgb else "Non-Color"
    img.pixels.foreach_set(np.ascontiguousarray(arr, dtype=np.float32).ravel())
    img.filepath_raw = str(TEXTURE_DIR / f"{name}.png")
    img.file_format = "PNG"
    img.save()
    return img


def make_material(
    name: str,
    base="#ffffff",
    roughness: float = 0.9,
    metallic: float = 0.0,
    vcol: bool = False,
    image: bpy.types.Image | None = None,
    emissive_image: bpy.types.Image | None = None,
    emissive_strength: float = 1.0,
    emissive=None,
    alpha: float | None = None,
    double_sided: bool = False,
) -> bpy.types.Material:
    """
    Material Principled apto para glTF.
    - base: '#hex' o RGBA lineal. Si vcol=True, se multiplica por el color attribute 'Col'.
    - image: textura de color (UV) que se multiplica con lo anterior.
    - emissive_image / emissive: emisión (ventanas de noche, lámparas). R3F la escala con nightMix
      en los materiales cuyo nombre empiece por `CV_emissive_`.
    - alpha: < 1 → material transparente (BLEND).
    - double_sided: sólo para hojas, banderas, toldos; lo demás es de una cara (más barato en web).
    """
    mat = bpy.data.materials.get(name)
    if mat is not None:
        bpy.data.materials.remove(mat)
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out_node = nt.nodes.new("ShaderNodeOutputMaterial")
    out_node.location = (300, 0)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (0, 0)
    nt.links.new(bsdf.outputs["BSDF"], out_node.inputs["Surface"])
    base_rgba = col(base) if isinstance(base, str) else tuple(base)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic

    source = None  # socket de color acumulado
    if image is not None:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = image
        tex.interpolation = "Linear"
        tex.location = (-700, 300)
        source = tex.outputs["Color"]
    if vcol:
        vc = nt.nodes.new("ShaderNodeVertexColor")
        vc.layer_name = "Col"
        vc.location = (-700, 0)
        if source is None:
            source = vc.outputs["Color"]
        else:
            m = nt.nodes.new("ShaderNodeMix")
            m.data_type = "RGBA"
            m.blend_type = "MULTIPLY"
            m.inputs[0].default_value = 1.0
            m.location = (-400, 150)
            nt.links.new(source, m.inputs[6])
            nt.links.new(vc.outputs["Color"], m.inputs[7])
            source = m.outputs[2]
    if source is not None:
        nt.links.new(source, bsdf.inputs["Base Color"])
        # el factor base se aplica como color constante (glTF baseColorFactor)
        if base_rgba[:3] != (1.0, 1.0, 1.0):
            m2 = nt.nodes.new("ShaderNodeMix")
            m2.data_type = "RGBA"
            m2.blend_type = "MULTIPLY"
            m2.inputs[0].default_value = 1.0
            m2.inputs[7].default_value = base_rgba
            m2.location = (-200, 150)
            nt.links.new(source, m2.inputs[6])
            nt.links.new(m2.outputs[2], bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = base_rgba

    if emissive_image is not None:
        et = nt.nodes.new("ShaderNodeTexImage")
        et.image = emissive_image
        et.location = (-700, -300)
        nt.links.new(et.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = emissive_strength
    elif emissive is not None:
        bsdf.inputs["Emission Color"].default_value = col(emissive) if isinstance(emissive, str) else tuple(emissive)
        bsdf.inputs["Emission Strength"].default_value = emissive_strength

    if alpha is not None and alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        mat.surface_render_method = "BLENDED"
    mat.use_backface_culling = not double_sided
    return mat


# ---------------------------------------------------------------------------
# Contexto de construcción que recibe cada módulo
# ---------------------------------------------------------------------------


@dataclass
class BuildContext:
    """Lo que recibe `build(ctx)` de cada módulo."""

    #: colección donde el módulo debe enlazar TODO lo que cree
    collection: bpy.types.Collection
    #: True → menos subdivisiones/instancias, para iterar rápido
    fast: bool = False
    #: semilla base
    seed: int = 1
    #: estadísticas que el módulo puede rellenar (se imprimen al final)
    stats: dict = field(default_factory=dict)

    def rng(self, salt: int = 0) -> random.Random:
        return rng(self.seed * 1000 + salt)

    def detail(self, full: int, fast: int | None = None) -> int:
        """Resolución según el modo: `full` normal, `fast` (o full//2) en modo rápido."""
        return (fast if fast is not None else max(2, full // 2)) if self.fast else full
