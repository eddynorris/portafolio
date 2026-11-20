"""
Módulo `park` del diorama Costa Verde: el malecón de Miraflores sobre el acantilado
(césped, paseo pavimentado, baranda, árboles redondos y palmeras, farolas, bancas,
jardineras, plaza circular, rampa de parapentes, monolitos azules, escenario con toldo
y Faro La Marina) más las palmeras y farolas del Circuito de Playas.

Todo se acumula en pocos objetos (una malla por tipo) para que cada uno sea un solo
draw call en la web. Coordenadas three.js (X derecha, Y arriba, Z hacia la cámara);
θ = atan2(z, x), θ = -π/2 es "el fondo".
"""

from __future__ import annotations

import math

import bmesh
import numpy as np

import common
from common import PAL, ROAD_Y

# ---------------------------------------------------------------------------
# Posiciones de la especificación
# ---------------------------------------------------------------------------

T0 = -math.pi / 2
TH_PLAZA = T0 + 0.08
TH_RAMP = T0 + 0.14
TH_MONO = (T0 - 0.14, T0 - 0.10)
TH_STAGE = T0 - 0.30
TH_FARO = T0 + 0.35

PARK_W = 6.0
PATH_W = 1.5
SURF_Y = 0.08    # césped y paseo sobre la meseta del terreno
DECAL_Y = 0.115  # caminos transversales, plaza y pavimentos sobre el césped

C_CONCRETE = common.col("#d2ccbf")
C_CONCRETE_D = common.col("#b9b3a6")
C_METAL = common.col("#454b52")
C_METAL_L = common.col("#8f959b")
C_WOOD = common.col("#a87b45")
C_SOIL = common.col("#5b4328")
C_FLOWERS = (common.col("#d94a7c"), common.col("#f0c23b"), common.col("#ece9df"), common.col("#e2552f"))
C_WATER = common.col("#3aa7cf")
C_DRY_FROND = common.col("#a08d55")
C_ORANGE = common.col("#f07a2a")

#: Zonas con elementos singulares: (θ, desplazamiento radial desde cliff_top_r, radio de exclusión)
FEATURES = (
    (TH_PLAZA, 3.5, 3.3),
    (TH_RAMP, 2.3, 3.7),
    (TH_MONO[0], 2.5, 2.0),
    (TH_MONO[1], 2.5, 2.0),
    (TH_STAGE, 3.2, 3.4),
    (TH_FARO, 1.5, 2.1),
)

_ICO_CACHE: dict[int, tuple[list, list]] = {}


# ---------------------------------------------------------------------------
# Utilidades geométricas
# ---------------------------------------------------------------------------


class _Acc:
    """Acumula vértices/caras/colores (y UVs opcionales) de muchas piezas → un objeto."""

    def __init__(self) -> None:
        self.v: list = []
        self.f: list = []
        self.c: list = []
        self.uv: list = []

    def add(self, verts, faces, colors, uvs=None) -> None:
        o = len(self.v)
        self.v.extend(verts)
        self.c.extend(colors)
        self.f.extend(tuple(i + o for i in f) for f in faces)
        if uvs is not None:
            self.uv.extend(uvs)

    def mesh(self, name, ctx, material, smooth_angle=40.0, recalc=False):
        uvs = None
        if self.uv:
            uvs = [self.uv[i] for f in self.f for i in f]
        obj = common.new_mesh(name, self.v, self.f, ctx.collection, colors=self.c, uvs=uvs,
                              material=material, smooth=True, smooth_angle=smooth_angle)
        if recalc:
            bm = bmesh.new()
            bm.from_mesh(obj.data)
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            bm.to_mesh(obj.data)
            bm.free()
            obj.data.update()
        return obj


def _norm(v):
    l = math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) or 1.0
    return (v[0] / l, v[1] / l, v[2] / l)


def _ground_y(th: float, r: float) -> float:
    """Altura de la meseta (igual que el perfil del terreno: sube 0.3 en 40 u desde el borde)."""
    x, z = common.polar(r, th)
    top = common.cliff_top_r(th)
    return common.cliff_h(th) + common.morro_h(x, z) + 0.3 * common.clamp((r - top) / 40.0, 0.0, 1.0)


def _pt(th: float, r: float, dy: float = 0.0):
    x, z = common.polar(r, th)
    return (x, _ground_y(th, r) + dy, z)


def _blocked(th: float, r: float, margin: float = 0.0) -> bool:
    """¿El punto cae sobre una zona singular (plaza, rampa, monolitos, escenario, faro)?"""
    x, z = common.polar(r, th)
    for fth, foff, frad in FEATURES:
        fx, fz = common.polar(common.cliff_top_r(fth) + foff, fth)
        if math.hypot(x - fx, z - fz) < frad + margin:
            return True
    return False


def _along(th0: float, th1: float, spacing: float, r_fn, rnd=None, jitter: float = 0.0, phase: float = 0.0):
    """θ cada `spacing` unidades de arco (radio r_fn(θ)), con jitter opcional."""
    out = []
    th = th0 + phase / r_fn(th0)
    while th < th1:
        out.append(th)
        step = spacing + (rnd.uniform(-jitter, jitter) if (rnd is not None and jitter) else 0.0)
        th += max(0.5, step) / r_fn(th)
    return out


_BOX_FACES = ((4, 6, 7, 5), (0, 1, 3, 2), (2, 3, 7, 6), (0, 4, 5, 1), (1, 5, 7, 3), (0, 2, 6, 4))


def _box(acc: _Acc, c, size, yaw: float, color, top: bool = True, bottom: bool = False, colors=None) -> None:
    """Caja con la base en c.y; local +x = dirección `yaw` (radial si yaw = θ), local z = tangente."""
    x, y, z = c
    w, h, d = size
    cy, sy = math.cos(yaw), math.sin(yaw)
    v = []
    for sx in (-1, 1):
        for syy in (0, 1):
            for sz in (-1, 1):
                lx, lz = sx * w / 2, sz * d / 2
                v.append((x + lx * cy - lz * sy, y + syy * h, z + lx * sy + lz * cy))
    faces = [f for k, f in enumerate(_BOX_FACES) if (top or k != 2) and (bottom or k != 3)]
    acc.add(v, faces, colors if colors is not None else [color] * 8)


def _cyl(acc: _Acc, c, r0: float, r1: float, h: float, segs: int, color, top: bool = False,
         bottom: bool = False, rings: int = 1, lean=(0.0, 0.0), color_fn=None, color_top=None,
         phase: float = 0.0, flip: bool = False) -> None:
    """Cilindro/cono con la base en c.y, normales hacia afuera (`flip` → hacia adentro); `lean` desplaza la parte alta."""
    x0, y0, z0 = c
    verts, cols, faces = [], [], []
    for lv in range(rings + 1):
        t = lv / rings
        r = common.lerp(r0, r1, t)
        cx, cz = x0 + lean[0] * t, z0 + lean[1] * t
        for k in range(segs):
            a = phase + 2 * math.pi * k / segs
            verts.append((cx + r * math.cos(a), y0 + h * t, cz + r * math.sin(a)))
            cols.append(color_fn(t, k) if color_fn else color)
    for lv in range(rings):
        b = lv * segs
        tp = b + segs
        for k in range(segs):
            n = (k + 1) % segs
            faces.append((b + k, tp + k, tp + n, b + n))
    if bottom:
        faces.append(tuple(range(segs)))
    if top:
        base = rings * segs
        if color_top is not None:
            base = len(verts)
            for k in range(segs):
                verts.append(verts[rings * segs + k])
                cols.append(color_top)
        faces.append(tuple(range(base, base + segs))[::-1])
    if flip:
        faces = [f[::-1] for f in faces]
    acc.add(verts, faces, cols)


def _tube(acc: _Acc, p, q, dy: float, s: float, color) -> None:
    """Tubo cuadrado de lado s entre p y q, elevado dy (rieles de la baranda)."""
    dx, dz = q[0] - p[0], q[2] - p[2]
    l = math.hypot(dx, dz) or 1.0
    nx, nz = -dz / l, dx / l
    corners = ((nx * s / 2, -s / 2, nz * s / 2), (nx * s / 2, s / 2, nz * s / 2),
               (-nx * s / 2, s / 2, -nz * s / 2), (-nx * s / 2, -s / 2, -nz * s / 2))
    verts = []
    for base in (p, q):
        for cx, cy, cz in corners:
            verts.append((base[0] + cx, base[1] + dy + cy, base[2] + cz))
    faces = [(i, 4 + i, 4 + (i + 1) % 4, (i + 1) % 4) for i in range(4)]
    acc.add(verts, faces, [color] * 8)


def _prism(acc: _Acc, pts, y0: float, h: float, color, bottom: bool = True, colors=None) -> None:
    """Prisma recto: pts (x, z) en orden antihorario visto desde arriba (ángulo decreciente)."""
    n = len(pts)
    verts = [(x, y0, z) for x, z in pts] + [(x, y0 + h, z) for x, z in pts]
    faces = [tuple(range(n, 2 * n))]
    if bottom:
        faces.append(tuple(range(n))[::-1])
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, j, n + j, n + i))
    acc.add(verts, faces, colors if colors is not None else [color] * (2 * n))


def _disc(acc: _Acc, cx: float, cz: float, y_fn, r0: float, r1: float, segs: int, color, uv_v: float = 0.25,
          color_in=None) -> None:
    """Anillo horizontal (abanico si r0 = 0) con normal hacia arriba; y_fn(x, z) da la altura."""
    verts, cols, uvs, faces = [], [], [], []
    if r0 <= 1e-6:
        verts.append((cx, y_fn(cx, cz), cz))
        cols.append(color_in or color)
        uvs.append((0.0, uv_v))
        for k in range(segs):
            a = 2 * math.pi * k / segs
            x, z = cx + r1 * math.cos(a), cz + r1 * math.sin(a)
            verts.append((x, y_fn(x, z), z))
            cols.append(color)
            uvs.append((a * r1 / 4.0, uv_v))
        for k in range(segs):
            faces.append((0, 1 + (k + 1) % segs, 1 + k))
    else:
        for k in range(segs):
            a = 2 * math.pi * k / segs
            for r, c in ((r0, color_in or color), (r1, color)):
                x, z = cx + r * math.cos(a), cz + r * math.sin(a)
                verts.append((x, y_fn(x, z), z))
                cols.append(c)
                uvs.append((a * r / 4.0, uv_v))
        for k in range(segs):
            n = (k + 1) % segs
            faces.append((2 * k, 2 * n, 2 * n + 1, 2 * k + 1))
    acc.add(verts, faces, cols, uvs)


def _ico(subdiv: int):
    """Icosfera unitaria (caras antihorarias hacia afuera)."""
    if subdiv in _ICO_CACHE:
        return _ICO_CACHE[subdiv]
    t = (1.0 + math.sqrt(5.0)) / 2.0
    verts = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t),
             (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
    faces = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2),
             (10, 7, 6), (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5),
             (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
    verts = [_norm(v) for v in verts]
    for _ in range(subdiv):
        cache: dict = {}

        def mid(a, b):
            key = (min(a, b), max(a, b))
            if key not in cache:
                va, vb = verts[a], verts[b]
                verts.append(_norm(((va[0] + vb[0]) / 2, (va[1] + vb[1]) / 2, (va[2] + vb[2]) / 2)))
                cache[key] = len(verts) - 1
            return cache[key]

        nf = []
        for a, b, c in faces:
            ab, bc, ca = mid(a, b), mid(b, c), mid(c, a)
            nf += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
        faces = nf
    _ICO_CACHE[subdiv] = (verts, faces)
    return verts, faces


def _blob(acc: _Acc, center, radii, subdiv: int, color_fn, seed: float, amp: float = 0.18) -> None:
    """Icosfera deformada por ruido (copas, arbustos). color_fn(dirección, punto)."""
    verts, faces = _ico(subdiv)
    out, cols = [], []
    for d in verts:
        k = 1.0 + amp * (common.noise2(d[0] * 1.9 + seed, d[2] * 1.9 + d[1] * 1.4 + seed * 0.37) - 0.5) * 2.0
        p = (center[0] + d[0] * radii[0] * k, center[1] + d[1] * radii[1] * k, center[2] + d[2] * radii[2] * k)
        out.append(p)
        cols.append(color_fn(d, p))
    acc.add(out, faces, cols)


# ---------------------------------------------------------------------------
# Piezas
# ---------------------------------------------------------------------------


def _lawn_color(x: float, z: float):
    n = common.fbm2(x * 0.09 + 3.0, z * 0.09 + 1.0, 3)
    c = common.mix(PAL["lawn"], PAL["top_grass"], common.smoothstep(0.25, 0.7, n))
    dry = common.smoothstep(0.6, 0.82, common.noise2(x * 0.23 + 5.0, z * 0.23 + 9.0))
    c = common.mix(c, PAL["dry_grass"], dry * 0.6)
    return common.shade(c, 1.08)


def _path_color(x: float, z: float, k: float = 1.0):
    return common.shade(PAL["path"], k * (0.96 + 0.07 * common.noise2(x * 0.5, z * 0.5)))


def _tree(acc: _Acc, rnd, x: float, z: float, y: float, scale: float, tone, subdiv: int, seed: float,
          double: bool = False) -> None:
    """Árbol redondo: tronco + copa icosaédrica deformada (o dos blobs pegados si `double`)."""
    trunk_h = 0.95 * scale
    rc = 1.15 * scale
    _cyl(acc, (x, y - 0.06, z), 0.12 * scale, 0.08 * scale, trunk_h + rc * 0.6, 5, PAL["trunk"],
         phase=rnd.random() * 6.28)
    light = common.mix(tone, PAL["tree_light"], 0.25)

    def color(d, p):
        t = 0.5 + 0.5 * d[1]
        c = common.mix(common.shade(tone, 0.5), common.shade(light, 1.05), t)
        return common.shade(c, 0.93 + 0.14 * common.hash2(p[0] * 3.1, p[2] * 2.7))

    cy = y + trunk_h + rc * 0.78
    if double:
        a = rnd.uniform(0.0, math.pi)
        ox, oz = 0.4 * rc * math.cos(a), 0.4 * rc * math.sin(a)
        for s, dy, k in ((-1, -0.05, rnd.uniform(0.72, 0.86)), (1, 0.12, rnd.uniform(0.76, 0.9))):
            radii = (rc * k, rc * k * rnd.uniform(0.8, 0.95), rc * k)
            _blob(acc, (x + s * ox, cy + dy * rc, z + s * oz), radii, 0, color, seed + s * 3.1, amp=0.22)
        return
    radii = (rc * rnd.uniform(0.85, 1.15), rc * rnd.uniform(0.7, 1.0), rc * rnd.uniform(0.85, 1.15))
    _blob(acc, (x, cy, z), radii, subdiv, color, seed, amp=0.3)


def _frond(acc: _Acc, base, yaw: float, length: float, width: float, tilt0: float, droop: float, color,
           steps: int) -> None:
    dx, dz = math.cos(yaw), math.sin(yaw)
    nx, nz = -dz, dx
    pts = [tuple(base)]
    p = list(base)
    seg = length / steps
    for s in range(steps):
        t = (s + 0.5) / steps
        ang = tilt0 - droop * t * t
        p = [p[0] + dx * math.cos(ang) * seg, p[1] + math.sin(ang) * seg, p[2] + dz * math.cos(ang) * seg]
        pts.append(tuple(p))
    verts, cols = [], []
    for s, q in enumerate(pts):
        t = s / steps
        w = width * (0.3 + 0.7 * math.sin(math.pi * min(1.0, 0.1 + t * 0.95)))
        sag = 0.14 * w  # hoja con sección en V (nervio central alto, bordes caídos)
        verts.append((q[0] + nx * w / 2, q[1] - sag, q[2] + nz * w / 2))
        verts.append((q[0], q[1], q[2]))
        verts.append((q[0] - nx * w / 2, q[1] - sag, q[2] - nz * w / 2))
        c = common.shade(color, 0.8 + 0.32 * t)
        cols += [common.shade(c, 0.9), c, common.shade(c, 0.9)]
    faces = []
    for s in range(steps):
        b = 3 * s
        faces.append((b, b + 1, b + 4, b + 3))
        faces.append((b + 1, b + 2, b + 5, b + 4))
    acc.add(verts, faces, cols)


def _palm(trunk_acc: _Acc, frond_acc: _Acc, rnd, x: float, z: float, y: float, h: float, n_fronds: int,
          steps: int, frond_len: float, seed: float) -> None:
    la = rnd.uniform(0.0, 2 * math.pi)
    lean = rnd.uniform(0.08, 0.32)
    lx, lz = math.cos(la) * lean, math.sin(la) * lean
    base_c = common.shade(PAL["palm_trunk"], rnd.uniform(0.85, 1.1))

    def trunk_color(t, k):
        return common.shade(base_c, 0.9 + 0.18 * ((int(t * 3 + 0.5) + k) % 2))

    _cyl(trunk_acc, (x, y - 0.06, z), 0.15, 0.09, h, 6, base_c, rings=3, lean=(lx, lz), color_fn=trunk_color,
         phase=rnd.random() * 6.28)
    top = (x + lx, y + h - 0.06, z + lz)
    ball_c = common.shade(PAL["palm_trunk"], 0.7)
    _blob(trunk_acc, (top[0], top[1] - 0.02, top[2]), (0.2, 0.22, 0.2), 0, lambda d, p: ball_c, seed, amp=0.1)
    frond_c = common.shade(PAL["palm_frond"], rnd.uniform(0.88, 1.12))
    for k in range(n_fronds):
        yaw = 2 * math.pi * k / n_fronds + rnd.uniform(-0.2, 0.2)
        tilt0 = (1.1, 0.75, 0.4)[k % 3] + rnd.uniform(-0.1, 0.1)
        droop = tilt0 + rnd.uniform(1.0, 1.3)
        c = common.shade(frond_c, rnd.uniform(0.92, 1.08))
        _frond(frond_acc, top, yaw, frond_len * rnd.uniform(0.9, 1.1), 0.56, tilt0, droop, c, steps)
    for k in range(2):
        yaw = rnd.uniform(0.0, 2 * math.pi)
        _frond(frond_acc, (top[0], top[1] - 0.06, top[2]), yaw, frond_len * 0.65, 0.3, -0.95, 0.5,
               C_DRY_FROND, max(2, steps - 1))


def _lamp(post_acc: _Acc, head_acc: _Acc, x: float, z: float, y: float, th: float, h: float, size: float,
          post_c) -> None:
    _box(post_acc, (x, y - 0.06, z), (0.07, h + 0.06, 0.07), th, post_c)
    _box(head_acc, (x, y + h - size * 0.5, z), (size, size, size), th, PAL["white"])
    _box(post_acc, (x, y + h + size * 0.5, z), (size * 1.25, 0.05, size * 1.25), th, post_c)


def _road_lamp(post_acc: _Acc, head_acc: _Acc, x: float, z: float, y: float, th: float) -> None:
    h = 3.0
    _box(post_acc, (x, y - 0.08, z), (0.09, h + 0.08, 0.09), th, C_METAL_L)
    _box(post_acc, (x, y + h - 0.06, z), (2.3, 0.07, 0.07), th, C_METAL_L)
    cy, sy = math.cos(th), math.sin(th)
    for s in (-1.05, 1.05):
        _box(head_acc, (x + s * cy, y + h - 0.12, z + s * sy), (0.42, 0.1, 0.18), th, PAL["white"])


def _bench(acc: _Acc, x: float, z: float, y: float, yaw: float) -> None:
    """Banca con el respaldo en el lado local +x (mira hacia local -x)."""
    cy, sy = math.cos(yaw), math.sin(yaw)
    _box(acc, (x, y + 0.17, z), (0.22, 0.05, 0.62), yaw, C_WOOD, bottom=True)
    _box(acc, (x + 0.1 * cy, y + 0.22, z + 0.1 * sy), (0.05, 0.22, 0.62), yaw, C_WOOD)
    for s in (-0.26, 0.26):
        _box(acc, (x - s * sy, y - 0.03, z + s * cy), (0.2, 0.2, 0.04), yaw, C_METAL)


def _planter(acc: _Acc, rnd, x: float, z: float, y: float, r: float, seed: float) -> None:
    _cyl(acc, (x, y - 0.06, z), r, r * 1.05, 0.38, 8, C_CONCRETE, top=True, color_top=C_SOIL,
         phase=rnd.random() * 6.28)
    fl = C_FLOWERS[int(rnd.random() * len(C_FLOWERS))]
    green = common.mix(PAL["tree_light"], PAL["tree"], rnd.random() * 0.6)

    def color(d, p):
        c = common.mix(common.shade(green, 0.7), common.shade(green, 1.15), 0.5 + 0.5 * d[1])
        if d[1] > -0.2 and common.hash2(p[0] * 7.3, p[2] * 5.1) > 0.62:
            return common.mix(c, fl, 0.8)
        return c

    _blob(acc, (x, y + 0.32 + r * 0.55, z), (r * 1.1, r * 0.8, r * 1.1), 0, color, seed, amp=0.16)


def _monolith(acc: _Acc, x: float, z: float, y: float, th: float, h: float, w: float, d: float) -> None:
    """
    Cuña azul (como los monolitos del Parque Salazar): prisma alto que se estrecha hacia arriba y
    cuya cara superior está cortada en diagonal: la arista alta mira al mar (local -x).
    """
    cy, sy = math.cos(th), math.sin(th)

    def P(lx, ly, lz):
        return (x + lx * cy - lz * sy, y + ly, z + lx * sy + lz * cy)

    blue = PAL["blue_monolith"]
    deep = common.shade(blue, 0.5)
    side = common.shade(blue, 0.95)
    top = common.mix(blue, PAL["white"], 0.35)
    drop = h * 0.28
    base = [P(-d / 2, -0.3, -w / 2), P(-d / 2, -0.3, w / 2), P(d / 2, -0.3, w / 2), P(d / 2, -0.3, -w / 2),
            P(-d * 0.36, h, -w * 0.33), P(-d * 0.36, h, w * 0.33), P(d * 0.3, h - drop, w * 0.33), P(d * 0.3, h - drop, -w * 0.33)]
    # cara: (índices, colores por esquina). Vértices duplicados por cara → color plano por cara con
    # degradado vertical en las tangentes; la cara -x (mar) queda en sombra.
    spec = [((0, 1, 2, 3), (deep, deep, deep, deep)),
            ((4, 5, 6, 7), (top, top, top, top)),
            ((0, 1, 5, 4), (deep, deep, deep, deep)),
            ((3, 2, 6, 7), (deep, deep, side, side)),
            ((0, 4, 7, 3), (deep, side, side, deep)),
            ((1, 2, 6, 5), (deep, deep, side, side))]
    cx = sum(p[0] for p in base) / 8
    cy_ = sum(p[1] for p in base) / 8
    cz = sum(p[2] for p in base) / 8
    verts, cols, faces = [], [], []
    for idx, fc in spec:
        q = [base[i] for i in idx]
        e1 = (q[1][0] - q[0][0], q[1][1] - q[0][1], q[1][2] - q[0][2])
        e2 = (q[2][0] - q[0][0], q[2][1] - q[0][1], q[2][2] - q[0][2])
        nrm = (e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0])
        fcx = sum(p[0] for p in q) / 4 - cx
        fcy = sum(p[1] for p in q) / 4 - cy_
        fcz = sum(p[2] for p in q) / 4 - cz
        o = len(verts)
        order = range(4) if (nrm[0] * fcx + nrm[1] * fcy + nrm[2] * fcz) > 0 else range(3, -1, -1)
        for k in order:
            verts.append(q[k])
            cols.append(fc[k])
        faces.append((o, o + 1, o + 2, o + 3))
    acc.add(verts, faces, cols)


def _stage(red: _Acc, canopy: _Acc, x: float, z: float, y: float, th: float, n: int) -> None:
    cy, sy = math.cos(th), math.sin(th)

    def P(lx, lz):
        return (x + lx * cy - lz * sy, z + lx * sy + lz * cy)

    # tarima triangular (vértice hacia el mar = local -x), con escalón
    tri = [P(-2.3, 0.0), P(1.25, 1.95), P(1.25, -1.95)]
    _prism(red, tri, y - 0.3, 0.62, PAL["red"])
    inner = [P(-1.7, 0.0), P(0.95, 1.45), P(0.95, -1.45)]
    _prism(red, inner, y + 0.32, 0.14, common.shade(PAL["red"], 1.15), bottom=False)
    # vela triangular de 3 puntas (como la de la foto): 3 mástiles rojos en las esquinas + mástil
    # central más alto; la tela es un abanico desde el pico con los bordes curvados hacia adentro.
    h0, peak = 2.3, 1.0
    corners = ((-1.9, 0.0), (1.5, 1.9), (1.5, -1.9))
    ccx = sum(c[0] for c in corners) / 3
    ccz = sum(c[1] for c in corners) / 3
    mast_c = common.shade(PAL["red"], 0.9)
    for lx, lz in corners:
        px, pz = P(lx, lz)
        _box(red, (px, y - 0.2, pz), (0.12, h0 + 0.25, 0.12), th, mast_c)
    mx, mz = P(ccx, ccz)
    _box(red, (mx, y + 0.3, mz), (0.1, h0 + peak - 0.3, 0.1), th, mast_c)
    rim = []
    for i in range(3):
        a0, a1 = corners[i], corners[(i + 1) % 3]
        rim.append((a0[0], a0[1], 0.05))
        for t in (1.0 / 3.0, 2.0 / 3.0):
            ex, ez = common.lerp(a0[0], a1[0], t), common.lerp(a0[1], a1[1], t)
            # borde cóncavo: el punto intermedio se acerca al centro y sube un poco
            pull = 0.2
            rim.append((common.lerp(ex, ccx, pull), common.lerp(ez, ccz, pull), 0.32))
    verts, cols = [(mx, y + h0 + peak, mz)], [PAL["white"]]
    for lx, lz, dy in rim:
        px, pz = P(lx, lz)
        verts.append((px, y + h0 + dy, pz))
        cols.append(common.shade(PAL["white"], 0.94 + 0.06 * (dy / 0.32)))
    m = len(rim)
    faces = [(0, 1 + (k + 1) % m, 1 + k) for k in range(m)]
    canopy.add(verts, faces, cols)


def _ramp(acc: _Acc, x: float, z: float, y: float, th: float) -> None:
    """Rampa de despegue: plataforma de césped con bordillo de concreto y manga de viento."""
    cy, sy = math.cos(th), math.sin(th)
    _box(acc, (x, y - 0.3, z), (4.4, 0.5, 5.0), th, C_CONCRETE_D)
    _box(acc, (x, y + 0.2, z), (4.0, 0.1, 4.6), th, common.shade(PAL["lawn"], 1.05))
    for s in (-1, 1):
        _box(acc, (x + s * 2.075 * cy, y + 0.2, z + s * 2.075 * sy), (0.25, 0.14, 5.0), th, C_CONCRETE)
        _box(acc, (x - s * 2.375 * sy, y + 0.2, z + s * 2.375 * cy), (3.9, 0.14, 0.25), th, C_CONCRETE)
    # escalones de acceso en el lado ciudad
    for k in range(3):
        _box(acc, (x + (2.3 + 0.2 * k) * cy, y - 0.3 + 0.16 * (2 - k), z + (2.3 + 0.2 * k) * sy), (0.2, 0.16, 1.4), th, C_CONCRETE)
    px, pz = x + 1.6 * cy - 2.0 * sy, z + 1.6 * sy + 2.0 * cy
    _box(acc, (px, y + 0.3, pz), (0.05, 1.3, 0.05), th, C_METAL_L)
    _box(acc, (px, y + 1.45, pz), (0.12, 0.12, 0.55), th, C_ORANGE)


def _faro(acc: _Acc, x: float, z: float, y: float, segs: int) -> float:
    """Faro La Marina: zócalo, torre cónica a rayas, galería, linterna y cúpula. Devuelve y de la linterna."""
    _cyl(acc, (x, y - 0.3, z), 1.05, 1.0, 0.75, 8, C_CONCRETE, top=True, color_top=C_CONCRETE_D)
    y0 = y + 0.45
    bands, band_h, r_b, r_t = 7, 0.74, 0.7, 0.42
    for b in range(bands):
        t0, t1 = b / bands, (b + 1) / bands
        c = PAL["white"] if b % 2 == 0 else PAL["black"]
        _cyl(acc, (x, y0 + band_h * b, z), common.lerp(r_b, r_t, t0), common.lerp(r_b, r_t, t1), band_h, segs, c)
    ytop = y0 + bands * band_h
    _cyl(acc, (x, ytop - 0.04, z), 0.78, 0.78, 0.16, segs, PAL["black"], top=True, bottom=True)
    _cyl(acc, (x, ytop + 0.5, z), 0.76, 0.76, 0.04, segs, PAL["black"])
    for k in range(8):
        a = 2 * math.pi * k / 8
        _box(acc, (x + 0.74 * math.cos(a), ytop + 0.12, z + 0.74 * math.sin(a)), (0.03, 0.4, 0.03), a, PAL["black"])
    for k in range(6):
        a = 2 * math.pi * k / 6
        _box(acc, (x + 0.4 * math.cos(a), ytop + 0.12, z + 0.4 * math.sin(a)), (0.05, 0.7, 0.05), a, PAL["black"])
    _cyl(acc, (x, ytop + 0.8, z), 0.52, 0.34, 0.2, segs, PAL["black"], bottom=True)
    _cyl(acc, (x, ytop + 1.0, z), 0.34, 0.02, 0.32, segs, common.shade(PAL["black"], 1.3), top=True)
    _box(acc, (x, ytop + 1.3, z), (0.04, 0.25, 0.04), 0.0, PAL["black"])
    return ytop + 0.12


# ---------------------------------------------------------------------------
# Textura del césped (ruido periódico + franjas de corte)
# ---------------------------------------------------------------------------


def _grass_texture():
    n = 256

    def pnoise(cells: int, seed: int):
        g = np.random.default_rng(seed).random((cells, cells))
        f = n // cells
        idx = np.arange(n) / f
        i0 = np.floor(idx).astype(int)
        fr = idx - i0
        fr = fr * fr * (3 - 2 * fr)
        iy, ix = i0[:, None], i0[None, :]
        fy, fx = fr[:, None], fr[None, :]
        a = g[iy % cells, ix % cells]
        b = g[iy % cells, (ix + 1) % cells]
        c = g[(iy + 1) % cells, ix % cells]
        d = g[(iy + 1) % cells, (ix + 1) % cells]
        return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy

    noise = 0.5 * pnoise(8, 11) + 0.3 * pnoise(32, 12) + 0.2 * pnoise(64, 13)
    val = 0.78 + 0.22 * noise
    stripes = np.ones((n, n))
    band = ((np.arange(n) // 32) % 2).astype(np.float64)
    stripes[n // 2:, :] = 0.90 + 0.10 * band[None, :]  # mitad que usa el césped (v ≥ 0.5)
    val = val * stripes
    arr = np.ones((n, n, 4), np.float32)
    arr[..., 0] = val
    arr[..., 1] = val
    arr[..., 2] = val
    return common.image_from_array("tex_park_grass", arr)


# ---------------------------------------------------------------------------
# Construcción
# ---------------------------------------------------------------------------


def _shared_material(name: str, **kw):
    """Materiales con nombre compartido entre módulos: se reutilizan si ya existen."""
    import bpy

    mat = bpy.data.materials.get(name)
    return mat if mat is not None else common.make_material(name, **kw)


def build(ctx: common.BuildContext):
    fast = ctx.fast
    lim = 1.2 if fast else 1.42
    th_a, th_b = T0 - lim, T0 + lim
    r_top = common.cliff_top_r

    tex = _grass_texture()
    m_ground = common.make_material("CV_park_ground", vcol=True, image=tex, roughness=1.0)
    m_rail = common.make_material("CV_park_rail", vcol=True, roughness=0.55, metallic=0.2)
    m_foliage = common.make_material("CV_park_foliage", vcol=True, roughness=0.9)
    m_palm = common.make_material("CV_park_palm", vcol=True, roughness=0.9)
    m_frond = common.make_material("CV_park_frond", vcol=True, roughness=0.8, double_sided=True)
    m_post = common.make_material("CV_park_post", vcol=True, roughness=0.6, metallic=0.2)
    m_lamp = _shared_material("CV_emissive_lamp", base="#fff4da", emissive="#ffd27a", emissive_strength=1.0, roughness=0.5)
    m_furn = common.make_material("CV_park_furniture", vcol=True, roughness=0.85)
    m_mono = common.make_material("CV_park_monolith", vcol=True, roughness=0.18, metallic=0.05)
    m_red = common.make_material("CV_park_red", vcol=True, roughness=0.6)
    m_canopy = common.make_material("CV_park_canopy", vcol=True, roughness=0.7, double_sided=True)
    m_faro = common.make_material("CV_park_faro", vcol=True, roughness=0.7)
    m_faro_lamp = _shared_material("CV_emissive_faro", base="#fff6d8", emissive="#fff0b0", emissive_strength=2.0, roughness=0.4)

    ground, rail, trees, palms, fronds = _Acc(), _Acc(), _Acc(), _Acc(), _Acc()
    posts, heads, furn, mono, red, canopy, faro = _Acc(), _Acc(), _Acc(), _Acc(), _Acc(), _Acc(), _Acc()
    counts = {"trees": 0, "palms": 0, "lamps": 0, "benches": 0, "planters": 0}

    # ---- 1. suelo: muro del borde, paseo, césped, vereda interior ------------------------
    n = ctx.detail(260, 110)
    lawn_rows = ctx.detail(6, 4)

    def band(r_in, r_out, rows, dy_in, dy_out, color_fn, v0, v1):
        def point(th, j):
            t = j / (rows - 1)
            r = r_top(th) + common.lerp(r_in, r_out, t)
            x, z = common.polar(r, th)
            return (x, _ground_y(th, r) + common.lerp(dy_in, dy_out, t), z)

        def color(th, j, p):
            return color_fn(th, j / (rows - 1), p)

        v, f, c = common.arc_grid(common.COAST_T0, common.COAST_T1, n, rows, point, color)
        uvs = []
        for i in range(n + 1):
            th = common.COAST_T0 + (common.COAST_T1 - common.COAST_T0) * i / n
            for j in range(rows):
                uvs.append(((th - T0) * 90.0 / 4.0, common.lerp(v0, v1, j / (rows - 1))))
        ground.add(v, f, c, uvs)

    band(-0.03, 0.0, 2, -0.45, SURF_Y, lambda th, t, p: C_CONCRETE, 0.05, 0.1)
    band(0.0, PATH_W, 2, SURF_Y, SURF_Y, lambda th, t, p: _path_color(p[0], p[2]), 0.1, 0.4)
    band(PATH_W, 5.3, lawn_rows, SURF_Y, SURF_Y, lambda th, t, p: _lawn_color(p[0], p[2]), 0.5, 1.0)
    band(5.3, PARK_W, 2, SURF_Y, SURF_Y, lambda th, t, p: _path_color(p[0], p[2], 0.93), 0.1, 0.3)
    band(PARK_W, PARK_W + 0.04, 2, SURF_Y, -0.35, lambda th, t, p: C_CONCRETE_D, 0.05, 0.1)  # bordillo interior

    def gy(dy):
        return lambda x, z: _ground_y(math.atan2(z, x), math.hypot(x, z)) + dy

    # caminos transversales (calcomanías sobre el césped)
    cross_ths = []
    for th in _along(th_a, th_b, 17.0, r_top, phase=6.0):
        if _blocked(th, r_top(th) + 3.4, 2.2):
            continue
        cross_ths.append(th)
        dth = 0.65 / r_top(th)
        quad = [(th - dth, PATH_W - 0.05), (th + dth, PATH_W - 0.05), (th + dth, 5.35), (th - dth, 5.35)]
        verts = [_pt(t, r_top(t) + ro, DECAL_Y) for t, ro in quad]
        ground.add(verts, [(0, 1, 2, 3)], [_path_color(v[0], v[2], 0.97) for v in verts],
                   [(0.0, 0.15), (0.3, 0.15), (0.3, 0.35), (0.0, 0.35)])

    # ---- 2. plaza circular con fuente (plataforma real 0.2 sobre el césped, con bordillo) ----
    pcx, pcz = common.polar(r_top(TH_PLAZA) + 3.5, TH_PLAZA)
    segs_p = ctx.detail(28, 16)
    PLAZA_DY = SURF_Y + 0.2
    gp = _ground_y(TH_PLAZA, r_top(TH_PLAZA) + 3.5)
    py = gp + PLAZA_DY
    # el anillo oscuro queda fuera de la pileta (r 1.2) para que se lea desde lejos
    rings = ((0.0, 1.3, common.shade(PAL["path"], 1.05)), (1.3, 1.72, common.shade(PAL["path"], 0.72)),
             (1.72, 2.05, _path_color(pcx, pcz, 1.0)))
    for r0, r1, c in rings:
        _disc(ground, pcx, pcz, gy(PLAZA_DY), r0, r1, segs_p, c, 0.2)
    skirt = _Acc()
    # falda exterior (desde bajo tierra hasta la coronación del bordillo), tapa anular y cara interior
    _cyl(skirt, (pcx, gp - 0.15, pcz), 2.3, 2.3, PLAZA_DY + 0.15 + 0.12, segs_p, C_CONCRETE_D)
    _cyl(skirt, (pcx, py, pcz), 2.05, 2.05, 0.12, segs_p, C_CONCRETE_D, flip=True)
    ground.add(skirt.v, skirt.f, skirt.c, [(0.0, 0.08)] * len(skirt.v))
    _disc(ground, pcx, pcz, lambda x, z: py + 0.12, 2.05, 2.3, segs_p, C_CONCRETE_D, 0.08)
    # fuente: pileta ancha con agua, surtidor de 1.1 u con copa
    _cyl(furn, (pcx, py - 0.02, pcz), 1.2, 1.24, 0.3, 16, C_CONCRETE, top=True, color_top=C_WATER)
    _cyl(furn, (pcx, py + 0.2, pcz), 0.16, 0.1, 0.9, 8, C_CONCRETE_D, top=True)
    _cyl(furn, (pcx, py + 1.02, pcz), 0.36, 0.3, 0.1, 10, C_CONCRETE, top=True, color_top=C_WATER)
    rnd_p = ctx.rng(31)
    for k in range(4):
        a = TH_PLAZA + math.pi / 4 + k * math.pi / 2
        bx, bz = pcx + 1.75 * math.cos(a), pcz + 1.75 * math.sin(a)
        _bench(furn, bx, bz, py, a)
        counts["benches"] += 1
        a2 = a + math.pi / 4
        qx, qz = pcx + 2.75 * math.cos(a2), pcz + 2.75 * math.sin(a2)
        _planter(furn, rnd_p, qx, qz, gy(SURF_Y)(qx, qz), 0.5, 40 + k)
        counts["planters"] += 1
    for k in range(6):
        a = TH_PLAZA + k * math.pi / 3 + 0.26
        qx, qz = pcx + 3.1 * math.cos(a), pcz + 3.1 * math.sin(a)
        if math.hypot(qx, qz) > r_top(math.atan2(qz, qx)) + PARK_W - 0.4:
            continue
        _palm(palms, fronds, rnd_p, qx, qz, gy(SURF_Y)(qx, qz), rnd_p.uniform(3.0, 3.8), ctx.detail(9, 6),
              ctx.detail(3, 2), 1.4, 50 + k)
        counts["palms"] += 1

    # ---- 3. rampa de parapentes, monolitos, escenario, faro ---------------------------------
    rx, rz = common.polar(r_top(TH_RAMP) + 2.3, TH_RAMP)
    _ramp(furn, rx, rz, _ground_y(TH_RAMP, r_top(TH_RAMP) + 2.3) + SURF_Y - 0.02, TH_RAMP)

    for th, h in zip(TH_MONO, (6.0, 5.0)):
        mx, mz = common.polar(r_top(th) + 2.5, th)
        _disc(ground, mx, mz, gy(DECAL_Y), 0.0, 1.7, 18, common.shade(PAL["path"], 0.9), 0.2)
        _monolith(mono, mx, mz, _ground_y(th, r_top(th) + 2.5) + DECAL_Y, th, h, 1.7, 1.05)

    sx, sz = common.polar(r_top(TH_STAGE) + 3.2, TH_STAGE)
    _stage(red, canopy, sx, sz, _ground_y(TH_STAGE, r_top(TH_STAGE) + 3.2) + SURF_Y, TH_STAGE, ctx.detail(6, 4))

    fx, fz = common.polar(r_top(TH_FARO) + 1.5, TH_FARO)
    fy = _ground_y(TH_FARO, r_top(TH_FARO) + 1.5) + SURF_Y
    _disc(ground, fx, fz, gy(DECAL_Y), 0.0, 1.9, 20, common.shade(PAL["path"], 0.95), 0.2)
    lamp_y = _faro(faro, fx, fz, fy, ctx.detail(16, 12))

    # ---- 4. baranda del borde ---------------------------------------------------------------
    r_rail = lambda th: r_top(th) + 0.14  # noqa: E731
    ths = _along(th_a, th_b, 5.0 if fast else 2.5, r_rail)
    pts = [_pt(th, r_rail(th), SURF_Y) for th in ths]
    ok = [not _blocked(th, r_rail(th), 0.2) for th in ths]
    for i, th in enumerate(ths):
        if not ok[i]:
            continue
        # sin riel a ninguno de los dos lados → poste suelto: se omite
        if not ((i > 0 and ok[i - 1]) or (i + 1 < len(ths) and ok[i + 1])):
            continue
        p = pts[i]
        _box(rail, p, (0.05, 0.3, 0.05), th, C_METAL)
        if i + 1 < len(ths) and ok[i + 1]:
            for hh in (0.285, 0.16):
                _tube(rail, p, pts[i + 1], hh, 0.035, C_METAL)

    # ---- 5. farolas y bancas del paseo ------------------------------------------------------
    lamp_s = []
    for th in _along(th_a, th_b, 4.0, lambda t: r_top(t) + 1.3, phase=2.0):
        if _blocked(th, r_top(th) + 1.3, 0.4):
            continue
        p = _pt(th, r_top(th) + 1.3, SURF_Y)
        _lamp(posts, heads, p[0], p[2], p[1], th, 1.3, 0.2, C_METAL)
        lamp_s.append(th * 90.0)
        counts["lamps"] += 1
    for th in _along(th_a, th_b, 10.0, lambda t: r_top(t) + 1.1, phase=1.0):
        if _blocked(th, r_top(th) + 1.1, 0.6) or any(abs(th * 90.0 - s) < 0.7 for s in lamp_s):
            continue
        p = _pt(th, r_top(th) + 1.1, SURF_Y)
        _bench(furn, p[0], p[2], p[1], th)
        counts["benches"] += 1

    # ---- 6. jardineras ----------------------------------------------------------------------
    rnd_j = ctx.rng(7)
    for th in _along(th_a, th_b, 13.0, lambda t: r_top(t) + 4.0, phase=5.5):
        if _blocked(th, r_top(th) + 4.0, 1.0):
            continue
        p = _pt(th, r_top(th) + 4.0, SURF_Y)
        _planter(furn, rnd_j, p[0], p[2], p[1], rnd_j.uniform(0.45, 0.6), th * 10.0)
        counts["planters"] += 1
    for th in TH_MONO:
        p = _pt(th, r_top(th) + 4.6, SURF_Y)
        _planter(furn, rnd_j, p[0], p[2], p[1], 0.42, th * 7.0)
        counts["planters"] += 1

    # setos bajos recortados en el borde del césped junto al paseo (en tramos, con huecos)
    hedge_c = common.shade(PAL["tree"], 0.9)
    hedge_top = common.mix(PAL["tree"], PAL["tree_light"], 0.55)
    hedge_cols = [hedge_c, hedge_c, hedge_top, hedge_top] * 2
    for th in _along(th_a, th_b, 3.0, lambda t: r_top(t) + 1.95, phase=0.8):
        r = r_top(th) + 1.95
        if _blocked(th, r, 1.7) or any(abs(th - c) * r < 2.0 for c in cross_ths):
            continue
        if common.hash2(round(th * 40.0), 2.0) < 0.3:
            continue
        p = _pt(th, r, SURF_Y)
        _box(furn, (p[0], p[1] - 0.03, p[2]), (0.45, 0.4, 2.35), th, hedge_c, colors=hedge_cols)
        counts["hedges"] = counts.get("hedges", 0) + 1

    # ---- 7. árboles y palmeras del malecón --------------------------------------------------
    subdiv = ctx.detail(1, 0)
    rnd_t = ctx.rng(11)
    # tonos siempre más oscuros que el césped (en la foto los árboles contrastan con el pasto)
    tones = (common.shade(PAL["tree"], 0.8), PAL["tree"], common.mix(PAL["tree"], PAL["tree_light"], 0.35))
    n_fr, fr_steps = ctx.detail(9, 6), ctx.detail(3, 2)
    for i, th in enumerate(_along(th_a, th_b, 3.8, lambda t: r_top(t) + 5.0, rnd_t, 0.6)):
        ro = 4.9 + rnd_t.uniform(-0.35, 0.35)
        if _blocked(th, r_top(th) + ro, 1.2):
            continue
        p = _pt(th, r_top(th) + ro, SURF_Y)
        if i % 3 != 2 or rnd_t.random() < 0.2:
            _tree(trees, rnd_t, p[0], p[2], p[1], rnd_t.uniform(0.9, 1.35), tones[i % 3], subdiv, i * 1.7,
                  double=(i % 4 == 3))
            counts["trees"] += 1
        else:
            _palm(palms, fronds, rnd_t, p[0], p[2], p[1], rnd_t.uniform(3.4, 4.8), n_fr, fr_steps, 1.6, i * 2.3)
            counts["palms"] += 1
    rnd_b = ctx.rng(12)
    for i, th in enumerate(_along(th_a, th_b, 6.0, lambda t: r_top(t) + 2.5, rnd_b, 1.2, phase=3.0)):
        ro = 2.5 + rnd_b.uniform(-0.3, 0.6)
        if _blocked(th, r_top(th) + ro, 1.6) or rnd_b.random() < 0.3:
            continue
        p = _pt(th, r_top(th) + ro, SURF_Y)
        _tree(trees, rnd_b, p[0], p[2], p[1], rnd_b.uniform(0.75, 1.15), tones[(i + 1) % 3], subdiv, 100 + i * 1.3,
              double=(i % 4 == 1))
        counts["trees"] += 1

    # ---- 8. pista: palmeras en el lado mar y farolas en la berma ---------------------------
    ulim = 0.8 if fast else 0.95
    ra, rb = T0 - 1.5 * ulim, T0 + 1.5 * ulim
    rnd_r = ctx.rng(21)
    for i, th in enumerate(_along(ra, rb, 6.0, lambda t: common.road_r0(t) + 0.35, rnd_r, 0.5, phase=3.0)):
        x, z = common.polar(common.road_r0(th) + 0.35, th)
        # macetero bajo y del tono de la acera (no debe llamar más la atención que la palmera)
        _cyl(palms, (x, ROAD_Y - 0.08, z), 0.34, 0.33, 0.16, 8, common.shade(PAL["curb"], 0.9), top=True,
             color_top=C_SOIL)
        _palm(palms, fronds, rnd_r, x, z, ROAD_Y + 0.12, rnd_r.uniform(2.7, 3.7), ctx.detail(9, 6),
              ctx.detail(3, 2), 1.5, 300 + i * 1.9)
        counts["palms"] += 1
    for th in _along(ra, rb, 8.0, lambda t: (common.road_r0(t) + common.road_r1(t)) / 2, phase=4.0):
        r = (common.road_r0(th) + common.road_r1(th)) / 2
        x, z = common.polar(r, th)
        _road_lamp(posts, heads, x, z, ROAD_Y, th)
        counts["lamps"] += 1

    # ---- objetos ----------------------------------------------------------------------------
    objs = [
        ground.mesh("park_cesped", ctx, m_ground, smooth_angle=35.0),
        rail.mesh("park_baranda", ctx, m_rail),
        trees.mesh("park_arboles", ctx, m_foliage, smooth_angle=60.0),
        common.join([palms.mesh("park_palmeras_tronco", ctx, m_palm, smooth_angle=50.0),
                     fronds.mesh("park_palmeras_frondas", ctx, m_frond, smooth_angle=60.0)], "park_palmeras"),
        common.join([posts.mesh("park_farolas_poste", ctx, m_post),
                     heads.mesh("park_farolas_luz", ctx, m_lamp)], "park_farolas"),
        furn.mesh("park_mobiliario", ctx, m_furn, smooth_angle=50.0),
        mono.mesh("park_monolitos", ctx, m_mono, smooth_angle=None),
        common.join([red.mesh("park_escenario_rojo", ctx, m_red),
                     canopy.mesh("park_escenario_toldo", ctx, m_canopy, smooth_angle=80.0)], "park_escenario"),
        faro.mesh("park_faro", ctx, m_faro, smooth_angle=50.0),
        common.cylinder("Faro_lamp", ctx.collection, (fx, lamp_y, fz), 0.3, 0.3, 0.62, segments=10,
                        material=m_faro_lamp),
    ]
    ctx.stats.update(counts)
    return [o for o in objs if o is not None]
