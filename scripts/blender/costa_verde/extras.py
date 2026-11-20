"""
Módulo `extras` del diorama «Costa Verde».

Contenido (todo en ctx.collection):
  - `Parapente`        ala azul (PAL['umbrella_blue']) con celdas marcadas por color de vértice,
                       envergadura 3 u, arco elíptico, double_sided, 1.2 u sobre el piloto en +Y local;
                       extradós + intradós (espesor 0.07 u) con bocas de celda oscuras en el borde de
                       ataque; suspentes finos que convergen en los elevadores ~0.5 u sobre el piloto
                       (arnés tipo pod). Origen en el piloto, frente en +X local; se coloca en
                       (22, 14, -40) mirando hacia -X (yaw = π). React lo anima.
  - `Auto_00..Auto_11` autos de 1.6 × 0.6 × 0.75 u (origen en el centro de la base, frente en +X local):
                       carrocería de colores variados, cabina/ventanas oscuras, ruedas con flanco negro y
                       cubo gris, faros y pilotos; repartidos por la pista (road_r0 + carril) en ambos
                       sentidos (circulación por la derecha).
  - extras_islotes     3 islotes rocosos con guano (icosaedros deformados con ruido, base bajo SEA_Y)
                       en (-30,-40), (-22,-52), (-38,-31) con radios 6, 4, 3: cúpulas suaves (sólo las
                       crestas > 38° duras) con color por vértice, pie húmedo oscuro y parches de guano
                       crema; rocas satélite facetadas.
  - extras_boyas       boyas rojas/blancas de canal (con linterna) cerca de la isla y una línea de
                       flotadores amarillos lisos de zona de baño frente a la playa (fuera de BOATS,
                       del muelle y de los islotes).
  - extras_morro       3 mástiles de antenas de 12 u (pintura roja/blanca, plataformas, parabólica,
                       vientos, luces rojas `CV_emissive_antena`) y la cruz blanca de 4 u
                       (`CV_emissive_cruz`) en la cima del Morro Solar (máximo de cliff_h + morro_h,
                       ≈ (128, 51, 4): fuera del arco de la costa pero dentro de terrain.py).
  - extras_pelicanos   pelícanos posados en los islotes y en un par de boyas.

Todo se genera en coordenadas three (X derecha, Y arriba, Z hacia la cámara); `make_object`
convierte con `common.bl`. Sin texturas. Determinista (ctx.rng / ruido de common).
"""

from __future__ import annotations

import math

import bmesh
import bpy
from mathutils import Matrix, Vector

import common
from common import PAL, SEA_Y, col

# ---------------------------------------------------------------------------
# Parámetros
# ---------------------------------------------------------------------------

ISLETS = ((-30.0, -40.0, 6.0), (-22.0, -52.0, 4.0), (-38.0, -31.0, 3.0))
PARAPENTE_POS = (22.0, 14.0, -40.0)
N_AUTOS = 12
#: desde road_r0: 2 carriles lado mar (sentido +θ) | berma | 2 carriles lado acantilado (sentido -θ)
LANE_OFFSETS = (0.73, 2.18, 4.82, 6.27)
#: ventana de búsqueda de la cima del Morro: morro_h vive en coast_u ∈ [0.55, 1.6] y terrain.py
#: modela la meseta hasta COAST_T1 + 0.95; dejamos 0.1 rad (≈ 13 u) de margen para que las
#: zapatas y los anclajes de los vientos queden sobre terreno real. (smoke.py sólo cubre el arco
#: de la costa: en esa previsualización los mástiles usan la altura analítica.)
MORRO_T0 = -math.pi / 2 + 0.6
MORRO_T1 = common.COAST_T1 + 0.85
MAST_H = 12.0
CROSS_H = 4.0

# Colores (lineales)
C_GUANO = col("#e9e3d2")      # crema (no blanco puro: el blanco leía como nieve)
C_WET = col("#463f38")        # pie oscuro de las rocas (línea de agua)
C_YELLOW = col("#f0c419")
C_LINE = col("#e9e9e9")
C_MAST = col("#e6e6e6")
C_MAST_RED = col("#d2382e")
C_CONCRETE = col("#9d9a93")
C_STEEL = col("#8a8d93")
C_ROOF = col("#2a2c31")
C_TYRE = col("#1b1b1d")
C_RIM = col("#9a9ea6")
C_HEADLIGHT = col("#fff5c9")
C_TAIL = col("#d8262a")
C_BUMPER = col("#33353a")
C_LANTERN = col("#2b2b2e")
C_JACKET = col("#d7452a")
C_HARNESS = col("#2b2d33")
C_HELMET = col("#f4f4f4")
C_PELI_BODY = col("#8f8477")
C_PELI_HEAD = col("#f0ebe0")
C_BEAK = col("#d9a24a")
AUTO_COLORS = [col(h) for h in (
    "#f2f2f2", "#2b2e33", "#c9ccd1", "#b8232a", "#243f7a", "#e8c531",
    "#6b6f75", "#f4f4f4", "#8c1f2a", "#d9d9d9", "#2e5f3c", "#3b3d42",
)]


# ---------------------------------------------------------------------------
# Helpers locales (no existen en common.py): transformaciones y acumulador de malla
# ---------------------------------------------------------------------------


def T(x: float = 0.0, y: float = 0.0, z: float = 0.0) -> Matrix:
    return Matrix.Translation((x, y, z))


def RY(a: float) -> Matrix:
    """Giro alrededor de Y (como rotation.y de three: +X → (cos a, 0, -sin a))."""
    return Matrix.Rotation(a, 4, "Y")


def RX(a: float) -> Matrix:
    return Matrix.Rotation(a, 4, "X")


def RZ(a: float) -> Matrix:
    """Cabeceo: a > 0 inclina +Y hacia -X."""
    return Matrix.Rotation(a, 4, "Z")


def S(x: float, y: float | None = None, z: float | None = None) -> Matrix:
    y = x if y is None else y
    z = x if z is None else z
    m = Matrix.Identity(4)
    m[0][0], m[1][1], m[2][2] = x, y, z
    return m


class MeshBuilder:
    """Acumula vértices (three) y caras con color, índice de material y suavizado por cara."""

    def __init__(self) -> None:
        self.verts: list[tuple] = []
        self.faces: list[tuple] = []
        self.colors: list[tuple] = []
        self.mats: list[int] = []
        self.smooth: list[bool] = []

    def add(self, verts, faces, color=None, colors=None, mat: int = 0, smooth: bool = True, xf: Matrix | None = None) -> int:
        """colors[i] es un RGBA por cara o una lista de RGBA por esquina (colores interpolados)."""
        base = len(self.verts)
        if xf is not None:
            verts = [tuple(xf @ Vector(v)) for v in verts]
        self.verts.extend(tuple(v) for v in verts)
        for i, f in enumerate(faces):
            self.faces.append(tuple(base + k for k in f))
            self.colors.append(colors[i] if colors is not None else color)
            self.mats.append(mat)
            self.smooth.append(smooth)
        return base

    def tris(self) -> int:
        return sum(len(f) - 2 for f in self.faces)


def make_object(name: str, mb: MeshBuilder, collection, mats, smooth_angle: float | None = 40.0, recalc: bool = True):
    """Crea UN objeto malla (varios materiales, color por cara en `Col`, suavizado por cara)."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([common.bl(*v) for v in mb.verts], [], mb.faces)
    me.validate(verbose=False)
    me.update()
    if len(me.polygons) != len(mb.faces):
        common.log(f"AVISO {name}: validate() cambió el nº de caras ({len(me.polygons)} vs {len(mb.faces)})")
    n = len(me.polygons)
    attr = me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="CORNER")
    flat: list[float] = []
    for poly, c in zip(me.polygons, mb.colors):
        if isinstance(c[0], (tuple, list)):
            for k in range(poly.loop_total):      # un color por esquina (se interpola en la cara)
                flat.extend(c[k % len(c)])
        else:
            flat.extend(list(c) * poly.loop_total)
    attr.data.foreach_set("color", flat)
    idx = me.color_attributes.find("Col")
    me.color_attributes.active_color_index = idx
    me.color_attributes.render_color_index = idx
    me.polygons.foreach_set("use_smooth", mb.smooth[:n])
    me.polygons.foreach_set("material_index", mb.mats[:n])
    if recalc:
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
        me.update()
    if smooth_angle is not None:
        common.set_sharp_from_angle(me, smooth_angle)
        # set_sharp_from_angle pone TODAS las caras suaves: restaurar las marcadas planas por el constructor
        me.polygons.foreach_set("use_smooth", mb.smooth[:n])
        me.update()
    for m in mats:
        me.materials.append(m)
    obj = bpy.data.objects.new(name, me)
    collection.objects.link(obj)
    return obj


# ---------------------------------------------------------------------------
# Primitivas (caras orientadas hacia afuera; `xf` transforma los vértices al final)
# ---------------------------------------------------------------------------


def cube(mb: MeshBuilder, center, size, color, mat: int = 0, xf: Matrix | None = None, colors=None) -> None:
    """Caja centrada en `center` (three): size=(w, h, d). Orden de caras: +x, -x, +y, -y, +z, -z."""
    cx, cy, cz = center
    w, h, d = size
    v = [(cx + sx * w / 2, cy + sy * h / 2, cz + sz * d / 2) for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]
    faces = [(4, 6, 7, 5), (0, 1, 3, 2), (2, 3, 7, 6), (0, 4, 5, 1), (1, 5, 7, 3), (0, 2, 6, 4)]
    mb.add(v, faces, color=color, colors=colors, mat=mat, smooth=False, xf=xf)


def prism_xy(mb: MeshBuilder, poly, z0: float, z1: float, color=None, colors=None, mat: int = 0,
             smooth: bool = False, xf: Matrix | None = None) -> None:
    """
    Prisma: polígono (x, y) en orden CCW (x derecha, y arriba) extruido de z0 a z1.
    Orden de caras: tapa z1, tapa z0, lado 0 (arista 0→1), lado 1, …
    """
    n = len(poly)
    verts = []
    for (x, y) in poly:
        verts.append((x, y, z0))
        verts.append((x, y, z1))
    faces = [tuple(2 * i + 1 for i in range(n)), tuple(2 * i for i in reversed(range(n)))]
    for i in range(n):
        j = (i + 1) % n
        faces.append((2 * i, 2 * j, 2 * j + 1, 2 * i + 1))
    mb.add(verts, faces, color=color, colors=colors, mat=mat, smooth=smooth, xf=xf)


def lathe(mb: MeshBuilder, profile, segs: int, color=None, ring_colors=None, mat: int = 0,
          smooth: bool = True, xf: Matrix | None = None, caps: bool = True) -> None:
    """Superficie de revolución alrededor de Y. profile=[(r, y)] de abajo arriba; r=0 → polo (abanico).
    ring_colors[j] colorea la banda entre profile[j] y profile[j+1]."""
    verts, faces, cols, rings = [], [], [], []
    for (r, y) in profile:
        if r <= 1e-6:
            rings.append([len(verts)])
            verts.append((0.0, y, 0.0))
        else:
            idx = []
            for k in range(segs):
                a = 2 * math.pi * k / segs
                idx.append(len(verts))
                verts.append((r * math.cos(a), y, r * math.sin(a)))
            rings.append(idx)

    def c(j):
        return ring_colors[j] if ring_colors is not None else color

    for j in range(len(profile) - 1):
        A, B = rings[j], rings[j + 1]
        if len(A) == 1 and len(B) == 1:
            continue
        if len(A) == 1:
            for k in range(segs):
                faces.append((A[0], B[k], B[(k + 1) % segs]))
                cols.append(c(j))
        elif len(B) == 1:
            for k in range(segs):
                faces.append((B[0], A[(k + 1) % segs], A[k]))
                cols.append(c(j))
        else:
            for k in range(segs):
                nk = (k + 1) % segs
                faces.append((A[k], B[k], B[nk], A[nk]))
                cols.append(c(j))
    if caps and len(rings[0]) > 1:
        faces.append(tuple(rings[0]))
        cols.append(c(0))
    if caps and len(rings[-1]) > 1:
        faces.append(tuple(reversed(rings[-1])))
        cols.append(c(len(profile) - 2))
    mb.add(verts, faces, colors=cols, mat=mat, smooth=smooth, xf=xf)


def line(mb: MeshBuilder, p0, p1, r: float, color, mat: int = 0, sides: int = 3, xf: Matrix | None = None) -> None:
    """Prisma fino cerrado entre dos puntos (líneas del parapente, vientos de las antenas).
    `xf` transforma los extremos (el radio no se escala)."""
    a, b = Vector(p0), Vector(p1)
    if xf is not None:
        a, b = xf @ a, xf @ b
    d = b - a
    if d.length < 1e-6:
        return
    d.normalize()
    u = d.cross(Vector((0.0, 1.0, 0.0)))
    if u.length < 1e-3:
        u = d.cross(Vector((1.0, 0.0, 0.0)))
    u.normalize()
    v = d.cross(u)
    ra = [a + (u * math.cos(2 * math.pi * k / sides) + v * math.sin(2 * math.pi * k / sides)) * r for k in range(sides)]
    rb = [p + (b - a) for p in ra]
    verts = [tuple(p) for p in ra] + [tuple(p) for p in rb]
    faces = []
    for k in range(sides):
        nk = (k + 1) % sides
        faces.append((k, nk, sides + nk, sides + k))
    faces.append(tuple(reversed(range(sides))))
    faces.append(tuple(range(sides, 2 * sides)))
    mb.add(verts, faces, color=color, mat=mat, smooth=False)


_ICO_CACHE: dict[int, tuple] = {}


def icosphere(subdiv: int):
    """Esfera unitaria (icosaedro subdividido) con caras hacia afuera. Devuelve (verts, tris)."""
    if subdiv in _ICO_CACHE:
        return _ICO_CACHE[subdiv]
    t = (1 + 5 ** 0.5) / 2
    v = [Vector(p).normalized() for p in (
        (-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t),
        (0, -1, -t), (0, 1, -t), (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1))]
    f = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2),
         (10, 7, 6), (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5),
         (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
    f = [fa if (v[fa[1]] - v[fa[0]]).cross(v[fa[2]] - v[fa[0]]).dot(v[fa[0]]) > 0 else (fa[0], fa[2], fa[1]) for fa in f]
    for _ in range(subdiv):
        cache: dict[tuple, int] = {}

        def mid(a, b):
            key = (min(a, b), max(a, b))
            if key not in cache:
                cache[key] = len(v)
                v.append(((v[a] + v[b]) / 2).normalized())
            return cache[key]

        nf = []
        for a, b, c in f:
            ab, bc, ca = mid(a, b), mid(b, c), mid(c, a)
            nf += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
        f = nf
    out = ([tuple(p) for p in v], f)
    _ICO_CACHE[subdiv] = out
    return out


def ellipsoid(mb: MeshBuilder, center, radii, color, mat: int = 0, subdiv: int = 1, smooth: bool = True,
              xf: Matrix | None = None) -> None:
    verts, tris = icosphere(subdiv)
    cx, cy, cz = center
    rx, ry, rz = radii
    v = [(cx + x * rx, cy + y * ry, cz + z * rz) for (x, y, z) in verts]
    mb.add(v, tris, color=color, mat=mat, smooth=smooth, xf=xf)


def terrain_y(x: float, z: float) -> float:
    """Altura analítica de la meseta + Morro en (x, z) three."""
    th = math.atan2(z, x)
    return common.cliff_h(th) + common.morro_h(x, z)


_GROUND_PREFIXES = ("terrain", "smoke")
_GROUND_STATS = {"raycast": 0, "analitico": 0}


def ground_y(x: float, z: float) -> float:
    """
    Altura real del terreno bajo (x, z): rayo hacia abajo sobre las mallas de terreno ya
    construidas (objetos `terrain_*` o `smoke_*`, que se construyen antes que `extras`).
    Si no hay ninguna, devuelve la altura analítica `terrain_y`.
    """
    try:
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get()
        scene = bpy.context.scene
        origin = common.bl(x, 500.0, z)
        down = Vector((0.0, 0.0, -1.0))
        for _ in range(6):
            hit, loc, _n, _i, obj, _m = scene.ray_cast(dg, origin, down)
            if not hit:
                break
            if obj is not None and obj.name.startswith(_GROUND_PREFIXES):
                _GROUND_STATS["raycast"] += 1
                return loc.z  # Z de Blender = Y de three
            origin = loc + down * 0.05
    except Exception as exc:  # pragma: no cover - sólo en contextos sin escena
        common.log("ground_y: raycast no disponible:", exc)
    _GROUND_STATS["analitico"] += 1
    return terrain_y(x, z)


# ---------------------------------------------------------------------------
# Parapente
# ---------------------------------------------------------------------------

WING_SPAN = 3.0
WING_PHIM = math.radians(76.0)
WING_A = (WING_SPAN / 2) / math.sin(WING_PHIM)   # semieje horizontal del arco elíptico
WING_B = 0.86                                    # semieje vertical
WING_YC = 1.2 - WING_B                           # centro del arco (el intradós central queda a y = 1.2)
WING_CHORD = 0.68
WING_THICK = 0.07                                # espesor del ala inflada (~10 % de cuerda)


def wing_normal(s: float):
    """Normal local (hacia afuera del arco) en la posición s de la envergadura."""
    phi = s * WING_PHIM
    ny, nz = math.cos(phi) / WING_B, math.sin(phi) / WING_A
    nl = math.hypot(ny, nz)
    return (0.0, ny / nl, nz / nl)


def wing_point(s: float, t: float):
    """Punto del extradós: s ∈ [-1, 1] a lo largo de la envergadura, t ∈ [0, 1] borde de fuga → borde de ataque."""
    phi = s * WING_PHIM
    c = WING_CHORD * (0.42 + 0.58 * math.sqrt(max(0.0, 1 - s * s)))
    x = 0.12 + (t - 0.45) * c
    camber = 0.09 * (c / WING_CHORD) * math.sin(math.pi * t)
    cy, cz = math.cos(phi), math.sin(phi)
    _, ny, nz = wing_normal(s)
    return (x, WING_YC + WING_B * cy + camber * ny, WING_A * cz + camber * nz)


def wing_lower(s: float, t: float):
    """Punto del intradós: el extradós desplazado hacia adentro; el espesor se afina hacia el borde de fuga."""
    x, y, z = wing_point(s, t)
    _, ny, nz = wing_normal(s)
    th = WING_THICK * (0.3 + 0.7 * t)
    return (x, y - th * ny, z - th * nz)


def build_parapente(ctx: common.BuildContext, mats):
    mb = MeshBuilder()
    ns = ctx.detail(28, 16)
    nc = 4
    base = PAL["umbrella_blue"]
    light = common.mix(base, PAL["white"], 0.22)
    white = col("#eef3f8")
    dark = common.shade(base, 0.62)
    n_cells = ns // 2

    def cell_color(i: int, j: int):
        cell = i // 2
        if cell < 1 or cell >= n_cells - 1:
            c = white
        elif cell % 2 == 0:
            c = base
        else:
            c = light
        if j == nc - 1:
            c = common.mix(c, dark, 0.3)        # sombra del borde de ataque
        elif j == 0:
            c = common.mix(c, dark, 0.25)
        return c

    # extradós (índice i*(nc+1)+j) e intradós (desplazado WING_THICK hacia adentro, con bocas de celda)
    stride = nc + 1
    n_up = (ns + 1) * stride
    verts = [wing_point(-1 + 2 * i / ns, j / nc) for i in range(ns + 1) for j in range(nc + 1)]
    verts += [wing_lower(-1 + 2 * i / ns, j / nc) for i in range(ns + 1) for j in range(nc + 1)]
    faces, cols = [], []
    for i in range(ns):
        for j in range(nc):
            a0 = i * stride + j
            c = cell_color(i, j)
            faces.append((a0, a0 + stride, a0 + stride + 1, a0 + 1))
            cols.append(c)
            b0 = n_up + a0
            faces.append((b0, b0 + 1, b0 + stride + 1, b0 + stride))
            cols.append(common.mix(c, dark, 0.3))
    # anillo del borde de ataque (bocas de celda, oscuras) y del borde de fuga (cerrado, fino)
    for i in range(ns):
        a_le, b_le = i * stride + nc, n_up + i * stride + nc
        faces.append((a_le, a_le + stride, b_le + stride, b_le))
        cols.append(dark)
        a_te, b_te = i * stride, n_up + i * stride
        faces.append((a_te, b_te, b_te + stride, a_te + stride))
        cols.append(common.mix(cell_color(i, 0), dark, 0.3))
    # puntas (cierran el perfil en los extremos)
    for i in (0, ns):
        for j in range(nc):
            a, b = i * stride + j, n_up + i * stride + j
            faces.append((a, a + 1, b + 1, b) if i == 0 else (a, b, b + 1, a + 1))
            cols.append(common.mix(white, dark, 0.3))
    mb.add(verts, faces, colors=cols, mat=1, smooth=True)

    # líneas (suspentes): A (borde de ataque), B (centro) y frenos (borde de fuga) al intradós,
    # convergiendo en los elevadores ~0.5 u por encima del piloto (no en el casco)
    for side in (1, -1):
        riser = (0.0, 0.34, 0.09 * side)
        for (s, t) in ((0.14, 0.86), (0.42, 0.86), (0.70, 0.86), (0.93, 0.86),
                       (0.28, 0.50), (0.56, 0.50), (0.84, 0.50), (0.50, 0.06)):
            line(mb, riser, wing_lower(s * side, t), 0.007, C_LINE, mat=0)
        # elevadores (cintas) desde los hombros del arnés hasta el punto de convergencia
        line(mb, (-0.03, 0.16, 0.085 * side), riser, 0.012, C_HARNESS, mat=0)

    # piloto (~0.45 u ≈ 1.8 m) en arnés pod, reclinado, mirando a +X
    lean = RZ(math.radians(22.0))
    cube(mb, (0.0, 0.04, 0.0), (0.12, 0.22, 0.17), C_JACKET, mat=0, xf=lean)        # torso
    cube(mb, (-0.10, 0.01, 0.0), (0.08, 0.20, 0.19), C_HARNESS, mat=0, xf=lean)     # respaldo / contenedor
    pod = [(-0.08, -0.10), (0.30, -0.06), (0.36, -0.01), (0.33, 0.05), (0.02, 0.06)]
    prism_xy(mb, pod, -0.095, 0.095, color=C_HARNESS, mat=0)                        # pod (piernas)
    ellipsoid(mb, (-0.07, 0.21, 0.0), (0.058, 0.062, 0.058), C_HELMET, mat=0, subdiv=1)
    for side in (1, -1):
        line(mb, (-0.045, 0.12, 0.085 * side), (0.0, 0.30, 0.10 * side), 0.018, C_JACKET, mat=0, sides=4)

    obj = make_object("Parapente", mb, ctx.collection, mats, smooth_angle=40.0, recalc=True)
    common.place(obj, *PARAPENTE_POS, yaw=math.pi)
    return obj


# ---------------------------------------------------------------------------
# Autos
# ---------------------------------------------------------------------------


def car_mesh(mb: MeshBuilder, body_color, segs: int = 8) -> None:
    """Auto de 1.6 × 0.6 × 0.75 con la base en y = 0, centrado en x/z, frente en +X."""
    hw = 0.375
    body = [(-0.80, 0.12), (0.80, 0.12), (0.80, 0.26), (0.76, 0.40), (0.40, 0.44), (-0.60, 0.44), (-0.80, 0.40)]
    prism_xy(mb, body, -hw, hw, color=body_color, mat=0)
    # la base de la cabina queda 0.04 dentro de la carrocería (sin caras coplanares con el techo)
    cabin = [(0.38, 0.40), (0.12, 0.74), (-0.28, 0.76), (-0.52, 0.72), (-0.60, 0.40)]
    glass = PAL["glass_dark"]
    cabin_cols = [glass, glass, glass, C_ROOF, C_ROOF, glass, body_color]
    prism_xy(mb, cabin, -hw + 0.055, hw - 0.055, colors=cabin_cols, mat=0)
    # ruedas (eje a lo largo de Z), sobresalen 0.01 del costado
    for x in (0.52, -0.52):
        for sz in (1, -1):
            xf = T(x, 0.14, sz * 0.335) @ RX(math.pi / 2)
            # flanco de neumático negro y sólo el cubo (r < 0.085) gris
            lathe(mb, [(0.0, -0.05), (0.085, -0.05), (0.14, -0.05), (0.14, 0.05), (0.085, 0.05), (0.0, 0.05)], segs,
                  ring_colors=[C_RIM, C_TYRE, C_TYRE, C_TYRE, C_RIM], mat=0, smooth=True, xf=xf)
    # faros, pilotos y parachoques
    for sz in (1, -1):
        cube(mb, (0.80, 0.33, sz * 0.25), (0.03, 0.08, 0.14), C_HEADLIGHT, mat=0)
        cube(mb, (-0.80, 0.34, sz * 0.25), (0.03, 0.07, 0.14), C_TAIL, mat=0)
    cube(mb, (0.80, 0.18, 0.0), (0.04, 0.10, 0.72), C_BUMPER, mat=0)
    cube(mb, (-0.80, 0.18, 0.0), (0.04, 0.10, 0.72), C_BUMPER, mat=0)


def build_autos(ctx: common.BuildContext, mats):
    r = ctx.rng(31)
    lanes = (0, 3, 1, 2, 0, 2, 1, 3, 0, 3, 2, 1)
    objs = []
    for i in range(N_AUTOS):
        mb = MeshBuilder()
        car_mesh(mb, AUTO_COLORS[i % len(AUTO_COLORS)], segs=ctx.detail(8, 6))
        obj = make_object(f"Auto_{i:02d}", mb, ctx.collection, mats, smooth_angle=40.0, recalc=True)
        u = -0.82 + 1.64 * (i + 0.5) / N_AUTOS + r.uniform(-0.05, 0.05)
        th = -math.pi / 2 + 1.5 * u
        lane = lanes[i]
        rr = common.road_r0(th) + LANE_OFFSETS[lane]
        x, z = common.polar(rr, th)
        yaw = (-th - math.pi / 2) if lane < 2 else (-th + math.pi / 2)
        common.place(obj, x, common.ROAD_Y, z, yaw)
        objs.append(obj)
    return objs


# ---------------------------------------------------------------------------
# Islotes con guano
# ---------------------------------------------------------------------------


def islet_rock(mb: MeshBuilder, cx: float, cz: float, R: float, h_top: float, yaw: float, stretch: float,
               seed: float, subdiv: int, mat: int, perches: list | None = None, n_perch: int = 0,
               smooth: bool = True) -> None:
    verts, tris = icosphere(subdiv)
    cy, sy = math.cos(yaw), math.sin(yaw)
    depth = 0.22 * R + 0.6
    out = []
    for (x, y, z) in verts:
        # irregularidad en planta (baja frecuencia) + crestas (alta frecuencia)
        n1 = common.fbm2(x * 1.4 + seed, z * 1.4 + y * 0.9 + seed * 0.37, 3)
        n2 = common.noise2(x * 3.8 + seed * 2.0, z * 3.8 + y * 2.5)
        k = 0.62 + 0.55 * n1 + 0.18 * (n2 - 0.5)
        if y >= 0:
            kk = k * (1 - 0.3 * y * y)                       # la cima se estrecha
            wy = SEA_Y + (y ** 0.62) * h_top * (0.55 + 0.7 * n1) * (0.9 + 0.2 * n2)
        else:
            kk = k
            wy = SEA_Y + y * depth
        lx, lz = R * x * stretch * kk, R * z * kk
        wx = cx + lx * cy - lz * sy
        wz = cz + lx * sy + lz * cy
        out.append((wx, wy, wz))
    dry = col("#8d7d66")

    def rock_color(c: Vector, n: Vector, jitter: float):
        """Color de la roca en el punto c con normal n (jitter ∈ [0, 1])."""
        hf = (c.y - SEA_Y) / h_top
        # roca gris-parda (más oscura que la playa para que el guano destaque)
        base = common.mix(common.shade(PAL["rock"], 0.85), PAL["rock_light"], 0.1 + 0.65 * common.noise2(c.x * 0.9 + seed, c.z * 0.9))
        base = common.mix(base, dry, 0.3 * common.smoothstep(0.2, 0.8, hf))
        # pie húmedo oscuro (línea de agua)
        if hf < 0.22:
            base = common.mix(base, C_WET, common.clamp(1 - hf / 0.22, 0.0, 1.0) * 0.85)
        # guano: parches estrictos en las zonas altas que miran arriba (roca desnuda entre medias),
        # con chorreones en las laderas
        # (frecuencia 1.0: parches de ~1 u, mayores que el paso de vértices del icosaedro subdiv 3,
        #  para que sobrevivan a la interpolación por vértice)
        patch = common.smoothstep(0.48, 0.72, common.noise2(c.x * 1.0 + seed, c.z * 1.0 - seed))
        g = common.smoothstep(0.55, 0.9, hf) * common.clamp((n.y - 0.45) / 0.4, 0.0, 1.0) * patch
        drip = 0.45 if common.noise2(c.x * 3.1 + seed, c.z * 3.1 + seed * 0.5) > 0.6 else 0.0
        g += common.smoothstep(0.42, 0.75, hf) * drip * common.clamp(1 - n.y, 0.0, 1.0)
        cfin = common.mix(base, C_GUANO, min(0.65, g))
        return common.shade(cfin, 0.92 + 0.14 * jitter)

    face_n = []
    for (i0, i1, i2) in tris:
        p0, p1, p2 = Vector(out[i0]), Vector(out[i1]), Vector(out[i2])
        n = (p1 - p0).cross(p2 - p0)
        if n.length > 1e-9:
            n.normalize()
        face_n.append(n)
    if smooth:
        # color por vértice (interpolado en las caras) con normal promediada: la cúpula suave no
        # dibuja sus triángulos, y las manchas de guano quedan como lamparones continuos
        vn = [Vector((0.0, 0.0, 0.0)) for _ in out]
        for (i0, i1, i2), n in zip(tris, face_n):
            vn[i0] += n
            vn[i1] += n
            vn[i2] += n
        vcols = []
        for i, p in enumerate(out):
            pv = Vector(p)
            nn = vn[i].normalized() if vn[i].length > 1e-9 else Vector((0.0, 1.0, 0.0))
            vcols.append(rock_color(pv, nn, common.noise2(pv.x * 1.1 + seed * 0.7, pv.z * 1.1 + pv.y * 0.8)))
        cols = [[vcols[i0], vcols[i1], vcols[i2]] for (i0, i1, i2) in tris]
    else:
        cols = []
        for (i0, i1, i2), n in zip(tris, face_n):
            c = (Vector(out[i0]) + Vector(out[i1]) + Vector(out[i2])) / 3
            cols.append(rock_color(c, n, common.hash2(i0 * 0.37 + seed, i1 * 0.11)))
    mb.add(out, tris, colors=cols, mat=mat, smooth=smooth)
    if perches is not None and n_perch > 0:
        for p in sorted(out, key=lambda q: -q[1]):
            if all(math.hypot(p[0] - q[0], p[2] - q[2]) > 0.3 * R for q in perches):
                perches.append(p)
                if len(perches) >= n_perch:
                    break


def build_islotes(ctx: common.BuildContext, mats, perches_out: list):
    mb = MeshBuilder()
    r = ctx.rng(41)
    subdiv = ctx.detail(3, 2)
    for k, (cx, cz, R) in enumerate(ISLETS):
        perches: list = []
        islet_rock(mb, cx, cz, R, 0.55 * R, r.uniform(0, math.pi), 1.0 + 0.35 * r.random(), 10.0 + 7.0 * k,
                   subdiv, 0, perches, n_perch=(3, 2, 1)[k])
        perches_out.extend(perches)
        for _ in range(ctx.detail(3, 2)):
            a = r.uniform(0, 2 * math.pi)
            d = R * (1.2 + 0.4 * r.random())
            s = R * (0.16 + 0.14 * r.random())
            # rocas satélite facetadas (toque de maqueta); los islotes grandes van suaves
            islet_rock(mb, cx + d * math.cos(a), cz + d * math.sin(a), s, 0.6 * s, r.uniform(0, math.pi),
                       1.0 + 0.5 * r.random(), 30.0 + r.random() * 20.0, max(1, subdiv - 2), 0, smooth=False)
    # cúpulas suaves; sólo las crestas (> 38°) quedan duras
    return make_object("extras_islotes", mb, ctx.collection, mats, smooth_angle=38.0, recalc=True)


# ---------------------------------------------------------------------------
# Boyas
# ---------------------------------------------------------------------------


def buoy(mb: MeshBuilder, pos, yaw: float, tilt: float, main, segs: int, mat: int = 0):
    xf = T(*pos) @ RY(yaw) @ RX(tilt)
    white = PAL["white"]
    dark = common.shade(main, 0.55)
    prof = [(0.0, -0.55), (0.14, -0.55), (0.20, -0.12), (0.31, -0.02), (0.32, 0.16), (0.27, 0.30),
            (0.20, 0.30), (0.20, 0.42), (0.16, 0.42), (0.16, 0.52), (0.055, 0.52), (0.055, 0.98), (0.0, 0.98)]
    ring_colors = [dark, dark, main, main, main, white, white, white, main, main, C_STEEL, C_STEEL]
    lathe(mb, prof, segs, ring_colors=ring_colors, mat=mat, smooth=True, xf=xf)
    ellipsoid(mb, (0.0, 1.03, 0.0), (0.075, 0.08, 0.075), C_LANTERN, mat=mat, subdiv=0, smooth=False, xf=xf)
    top = xf @ Vector((0.0, 1.1, 0.0))
    return tuple(top)


def swim_buoy(mb: MeshBuilder, pos, yaw: float, tilt: float, segs: int, mat: int = 0) -> None:
    """Boya de zona de baño: flotador liso y pequeño, sin linterna ni mástil (distinto de la boya de canal)."""
    xf = T(*pos) @ RY(yaw) @ RX(tilt)
    white = PAL["white"]
    dark = common.shade(C_YELLOW, 0.55)
    prof = [(0.0, -0.3), (0.17, -0.3), (0.24, -0.05), (0.24, 0.12), (0.14, 0.3), (0.0, 0.3)]
    lathe(mb, prof, segs, ring_colors=[dark, C_YELLOW, C_YELLOW, white, C_YELLOW], mat=mat, smooth=True, xf=xf)


def build_boyas(ctx: common.BuildContext, mats, tops_out: list):
    mb = MeshBuilder()
    r = ctx.rng(51)
    segs = ctx.detail(10, 8)
    placed: list[tuple] = []

    def free(x, z):
        if common.in_reserved(x, z, 3.0):
            return False
        if any(math.hypot(x - bx, z - bz) < 5.0 for bx, bz in common.BOATS):
            return False
        if any(math.hypot(x - ix, z - iz) < R + 3.0 for ix, iz, R in ISLETS):
            return False
        if any(math.hypot(x - px, z - pz) < 6.0 for px, pz in placed):
            return False
        th = math.atan2(z, x)
        rr = math.hypot(x, z)
        return common.shore_r(th) + 5.0 < rr < common.coast_r(th) - 9.0

    # boyas de canal (rojas/blancas) entre la isla y la playa
    n_red = ctx.detail(6, 4)
    tries = 0
    while len(placed) < n_red and tries < 200:
        tries += 1
        th = r.uniform(-2.65, -0.45)
        rr = r.uniform(13.0, 44.0)
        x, z = common.polar(rr, th)
        if free(x, z):
            placed.append((x, z))
            tops_out.append(buoy(mb, (x, SEA_Y, z), r.uniform(0, 6.28), math.radians(r.uniform(-6, 6)), PAL["red"], segs))
    # línea de boyas amarillas (zona de baño) frente a la playa del fondo
    n_yellow = ctx.detail(4, 3)
    for k in range(n_yellow):
        th = -math.pi / 2 + (-0.21 + 0.42 * k / max(1, n_yellow - 1)) + r.uniform(-0.015, 0.015)
        rr = common.coast_r(th) - 8.5
        x, z = common.polar(rr, th)
        placed.append((x, z))
        # sin linterna y fuera de tops_out: los pelícanos sólo se posan en las boyas de canal
        swim_buoy(mb, (x, SEA_Y, z), r.uniform(0, 6.28), math.radians(r.uniform(-6, 6)), segs)
    ctx.stats["boyas"] = len(placed)
    return make_object("extras_boyas", mb, ctx.collection, mats, smooth_angle=40.0, recalc=True)


# ---------------------------------------------------------------------------
# Morro Solar: antenas y cruz
# ---------------------------------------------------------------------------


def find_morro_summit():
    """Máximo de cliff_h + morro_h en [MORRO_T0, MORRO_T1] (malla gruesa + refinado local)."""
    best = (-1e9, 0.0, 0.0)
    nt = 200
    for i in range(nt + 1):
        th = MORRO_T0 + (MORRO_T1 - MORRO_T0) * i / nt
        cr = common.coast_r(th)
        for k in range(90):
            x, z = common.polar(cr + 8 + k, th)
            y = terrain_y(x, z)
            if y > best[0]:
                best = (y, x, z)
    y, x, z = best
    step = 0.5
    for _ in range(3):
        for dx in (-step, 0.0, step):
            for dz in (-step, 0.0, step):
                th = math.atan2(z + dz, x + dx)
                if th > MORRO_T1 or th < MORRO_T0:
                    continue
                yy = terrain_y(x + dx, z + dz)
                if yy > best[0]:
                    best = (yy, x + dx, z + dz)
        y, x, z = best
        step *= 0.5
    return best


def antenna_mast(mb: MeshBuilder, x: float, z: float, h: float, yaw: float, mat_body: int, mat_light: int) -> None:
    y0 = ground_y(x, z)
    xf = T(x, y0, z) @ RY(yaw)
    cube(mb, (0.0, -0.1, 0.0), (1.7, 0.6, 1.7), C_CONCRETE, mat=mat_body, xf=xf)          # zapata
    prof = [(0.0, 0.0), (0.50, 0.0), (0.40, h * 0.25), (0.31, h * 0.5), (0.22, h * 0.75), (0.14, h), (0.0, h)]
    lathe(mb, prof, 3, ring_colors=[C_MAST_RED, C_MAST_RED, C_MAST, C_MAST_RED, C_MAST, C_MAST],
          mat=mat_body, smooth=False, xf=xf)
    for yy, s in ((h * 0.55, 1.1), (h * 0.92, 0.8)):                                     # plataformas
        cube(mb, (0.0, yy, 0.0), (s, 0.08, s), C_STEEL, mat=mat_body, xf=xf)
    ellipsoid(mb, (0.45, h * 0.7, 0.0), (0.18, 0.5, 0.5), PAL["white"], mat=mat_body, subdiv=1, xf=xf)  # parabólica
    lathe(mb, [(0.0, h - 0.3), (0.06, h - 0.3), (0.04, h + 2.2), (0.0, h + 2.2)], 4, color=C_STEEL, mat=mat_body, smooth=False, xf=xf)
    ellipsoid(mb, (0.0, h + 2.3, 0.0), (0.16, 0.18, 0.16), PAL["red"], mat=mat_light, subdiv=0, smooth=False, xf=xf)
    # luces de obstrucción intermedias en los bordes de la plataforma baja (fuera del cuerpo del mástil)
    for sx in (0.48, -0.48):
        ellipsoid(mb, (sx, h * 0.55 + 0.14, 0.0), (0.12, 0.13, 0.12), PAL["red"], mat=mat_light, subdiv=0, smooth=False, xf=xf)
    # vientos a tres anclajes en el terreno
    for a in (math.pi / 2, math.pi / 2 + 2 * math.pi / 3, math.pi / 2 + 4 * math.pi / 3):
        ax, az = x + 4.5 * math.cos(a + yaw), z + 4.5 * math.sin(a + yaw)
        line(mb, (x, y0 + h * 0.78, z), (ax, ground_y(ax, az) - 0.25, az), 0.015, C_STEEL, mat=mat_body)


def build_morro(ctx: common.BuildContext, mats):
    mb = MeshBuilder()
    y, x, z = find_morro_summit()
    ctx.stats["morro_cima"] = [round(x, 1), round(y, 1), round(z, 1)]
    th = math.atan2(z, x)
    tx, tz = -math.sin(th), math.cos(th)         # tangente de la costa
    rx, rz = -math.cos(th), -math.sin(th)        # hacia el mar
    for k, (along, inward) in enumerate(((-3.6, 0.0), (0.0, 0.4), (3.6, -0.2))):
        mx = x + tx * along + rx * inward
        mz = z + tz * along + rz * inward
        antenna_mast(mb, mx, mz, MAST_H, k * 0.7, 0, 2)
    # cruz blanca (brazo a lo largo de la costa, mirando a la bahía), 5 u hacia el mar
    cx, cz = x + rx * 5.0, z + rz * 5.0
    cy = ground_y(cx, cz)
    xf = T(cx, cy, cz) @ RY(-th + math.pi / 2)
    cube(mb, (0.0, -0.1, 0.0), (1.6, 0.6, 1.6), C_CONCRETE, mat=0, xf=xf)
    cube(mb, (0.0, CROSS_H / 2, 0.0), (0.34, CROSS_H, 0.34), PAL["white"], mat=1, xf=xf)
    # brazo con profundidad distinta al poste (0.40 vs 0.34): sin planos coplanares en el cruce
    cube(mb, (0.0, CROSS_H * 0.72, 0.0), (2.4, 0.30, 0.40), PAL["white"], mat=1, xf=xf)
    ctx.stats["morro_suelo"] = "raycast" if _GROUND_STATS["raycast"] else "analitico"
    return make_object("extras_morro", mb, ctx.collection, mats, smooth_angle=40.0, recalc=True)


# ---------------------------------------------------------------------------
# Pelícanos
# ---------------------------------------------------------------------------


def pelican(mb: MeshBuilder, pos, yaw: float, segs: int = 7, mat: int = 0, scale: float = 1.0) -> None:
    xf = T(*pos) @ RY(yaw) @ S(scale)
    body = [(0.0, -0.24), (0.08, -0.16), (0.12, -0.02), (0.10, 0.12), (0.05, 0.22), (0.0, 0.26)]
    lathe(mb, body, segs, color=C_PELI_BODY, mat=mat, smooth=True, xf=xf @ T(0.0, 0.12, 0.0) @ RZ(-math.pi / 2))
    line(mb, (0.16, 0.2, 0.0), (0.28, 0.32, 0.0), 0.035 * scale, C_PELI_HEAD, mat=mat, sides=4, xf=xf)
    ellipsoid(mb, (0.30, 0.33, 0.0), (0.085, 0.075, 0.075), C_PELI_HEAD, mat=mat, subdiv=0, xf=xf)
    # pico largo apuntando hacia adelante y un poco abajo
    beak = [(0.0, 0.0), (0.035, 0.0), (0.012, 0.36), (0.0, 0.36)]
    lathe(mb, beak, 5, color=C_BEAK, mat=mat, smooth=True, xf=xf @ T(0.34, 0.31, 0.0) @ RZ(-math.pi / 2 - 0.3))


def build_pelicanos(ctx: common.BuildContext, mats, perches: list, buoy_tops: list):
    mb = MeshBuilder()
    r = ctx.rng(61)
    n = 0
    for p in perches[: ctx.detail(6, 3)]:
        pelican(mb, (p[0], p[1] - 0.03, p[2]), r.uniform(0, 2 * math.pi), mat=0, scale=1.0 + 0.15 * r.random())
        n += 1
    for p in buoy_tops[: ctx.detail(2, 1)]:
        pelican(mb, (p[0], p[1] - 0.02, p[2]), r.uniform(0, 2 * math.pi), mat=0, scale=0.9)
        n += 1
    ctx.stats["pelicanos"] = n
    return make_object("extras_pelicanos", mb, ctx.collection, mats, smooth_angle=60.0, recalc=True)


# ---------------------------------------------------------------------------
# build
# ---------------------------------------------------------------------------


def build(ctx: common.BuildContext):
    """Crea todo dentro de ctx.collection y devuelve la lista de objetos."""
    mat_rock = common.make_material("CV_extras_roca", vcol=True, roughness=1.0)
    mat_boya = common.make_material("CV_extras_boya", vcol=True, roughness=0.55)
    mat_auto = common.make_material("CV_extras_auto", vcol=True, roughness=0.45, metallic=0.1)
    mat_para = common.make_material("CV_extras_parapente", vcol=True, roughness=0.8)
    mat_ala = common.make_material("CV_extras_parapente_ala", vcol=True, roughness=0.7, double_sided=True)
    mat_morro = common.make_material("CV_extras_morro", vcol=True, roughness=0.75)
    mat_cruz = common.make_material("CV_emissive_cruz", base=PAL["white"], roughness=0.6, emissive="#ffffff", emissive_strength=0.35)
    mat_antena = common.make_material("CV_emissive_antena", base="#ff3b30", roughness=0.4, emissive="#ff1e14", emissive_strength=3.0)
    mat_peli = common.make_material("CV_extras_pelicano", vcol=True, roughness=0.9)

    objs = [build_parapente(ctx, [mat_para, mat_ala])]
    objs += build_autos(ctx, [mat_auto])
    perches: list = []
    objs.append(build_islotes(ctx, [mat_rock], perches))
    buoy_tops: list = []
    objs.append(build_boyas(ctx, [mat_boya], buoy_tops))
    objs.append(build_morro(ctx, [mat_morro, mat_cruz, mat_antena]))
    objs.append(build_pelicanos(ctx, [mat_peli], perches, buoy_tops))

    ctx.stats["autos"] = N_AUTOS
    ctx.stats["objetos_sin_autos_ni_parapente"] = len(objs) - N_AUTOS - 1
    return objs
