"""
Módulo `island`: la isla del carrito de ceviche, lo que la cámara ve más de cerca.

Objetos (6):
  island_arena             rejilla POLAR (anillos que siguen common.shore_r, con un anillo
                           exacto en t = 1 para que la línea de agua salga nítida y no
                           escalonada) con altura EXACTA common.sand_height (la espuma del
                           agua depende de ella), extendida hasta t ≈ 1.38 para que la arena
                           se hunda bajo el mar. Vertex colors: arena seca cálida, dunas con
                           variación fbm2, degradado seca → húmeda → mojada → línea de agua de
                           ≈ 1.4 u con borde irregular (±0.06 en t), somero verdoso y fondo
                           marino azulado bajo el agua; senda de arena pisada (~0.5 u) con
                           huellas como depresiones de color (óvalos planos de 0.16 × 0.08 u
                           dentro de la misma malla, pie izquierdo/derecho) de la orilla junto
                           al muelle (lado +X, bordeando los caballitos) al costado derecho
                           del carrito; arena oscurecida al pie de los
                           troncos y bajo las rocas. Textura de grano tileable de 256²
                           (tex_island_sand) con rizos de viento anisótropos (vector de onda
                           entero, ≈ 0.07 u) multiplicada por el color.
  island_palmeras_tronco   4 troncos curvos (Bézier) con anillos geométricos y de color,
                           bulbo de la copa y cocos (una sola cara).
  island_palmeras_hojas    frondas dobladas en V con nervio y giro, folíolos alternos
                           (dientes desfasados entre bordes, base lisa como pecíolo), cuatro
                           familias en capas (bajas, medias caídas, jóvenes y cortas de
                           relleno; double sided) y frondas secas colgando en las palmeras
                           grandes (dos en la más alta).
  island_hierba            matas de hierba de playa: abanicos de cintas (double sided).
  island_rocas             rocas redondeadas en el lado -X/-Z, lejos del muelle.
  island_conchas           conchas con franjas y umbo, guijarros oscuros y estrellas de mar
                           con brazos en relieve, diminutas, cerca de la orilla.

Todo determinista (ctx.rng), nada dentro de common.RESERVED ni sobre el muelle
(common.in_reserved) y nada más alto que 0.2 sobre la arena salvo palmeras y rocas.
"""

from __future__ import annotations

import math

import bmesh
import numpy as np

import common
from common import PAL, SEA_Y, clamp, col, fbm2, lerp, mix, noise2, shade, smoothstep

TAU = math.pi * 2.0

T_MAX = 1.38       # la rejilla polar llega hasta t = r / shore_r(θ) = 1.38 (≥ 1 u bajo el agua)
CULL_DEPTH = 1.0   # caras enteras por debajo de SEA_Y - CULL_DEPTH son invisibles: se quitan
SAND_TILE = 1.6    # unidades de mundo por repetición de la textura de grano
PALM_SINK = 0.05   # Palms.tsx apoya el tronco 0.05 bajo la arena
PROP_MAX_H = 0.2   # nada sobre la arena más alto que esto (salvo palmeras y rocas)

# --- paleta (sRGB → lineal) ---------------------------------------------------
C_DRY_A = col("#f1d8a4")      # arena seca clara (crestas de duna)
C_DRY_B = col("#d9ba7e")      # arena seca dorada (hondonadas)
C_DAMP = col("#c4a070")       # banda húmeda (t ≈ 0.76–0.90)
C_WET = col("#9b7a55")        # arena mojada junto a la orilla (t ≈ 0.88–0.98)
C_WET_LINE = col("#7a5f45")   # línea de agua
C_SHALLOW = col("#8aa38b")    # arena bajo agua somera (verdosa)
C_DEEP = PAL["sea_floor"]     # fondo marino azulado

C_TRUNK_A = col("#9a7048")
C_TRUNK_B = col("#6f4c2e")
C_TRUNK_RING = col("#b8926a")
C_BULB = col("#4e4324")
C_COCO = col("#6d4a26")
C_COCO_GREEN = col("#8d9b3c")
C_FROND_DARK = col("#2e6e33")
C_FROND_MID = col("#45943d")
C_FROND_TIP = col("#86bf52")
C_DRY_FROND_A = col("#7a6236")
C_DRY_FROND_B = col("#9c8650")

C_GRASS_A = col("#7f8f42")
C_GRASS_B = col("#b3b468")
C_GRASS_TIP = col("#e0d6a0")

C_ROCK = col("#6f655a")
C_ROCK_LIGHT = col("#a39584")
C_ROCK_WARM = col("#9c846a")

C_SHELL = (col("#efd3b8"), col("#e2b996"), col("#d8c3a6"))
C_SHELL_DARK = (col("#c9a98a"), col("#b08b6c"))
C_PEBBLE = PAL["rock"]
C_PEBBLE_LIGHT = PAL["rock_light"]
C_STAR = (col("#e86f44"), col("#d9562f"), col("#f08a56"))


# ---------------------------------------------------------------------------
# Utilidades de malla (acumulador + primitivas en coordenadas three)
# ---------------------------------------------------------------------------


class _Acc:
    """Acumula vértices/caras/colores de varias piezas para crear UN objeto."""

    def __init__(self) -> None:
        self.v: list = []
        self.f: list = []
        self.c: list = []

    def add(self, verts, faces, colors) -> None:
        o = len(self.v)
        self.v.extend(verts)
        self.c.extend(colors)
        self.f.extend(tuple(i + o for i in f) for f in faces)

    def mesh(self, name, ctx, material, smooth_angle=None, recalc=False):
        obj = common.new_mesh(name, self.v, self.f, ctx.collection, colors=self.c,
                              material=material, smooth=True, smooth_angle=smooth_angle)
        if recalc:
            _recalc(obj)
        return obj


def _recalc(obj) -> None:
    """Normales consistentes hacia afuera (sólo para cascarones cerrados)."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def _norm(v):
    l = math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) or 1.0
    return (v[0] / l, v[1] / l, v[2] / l)


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _bezier(p0, p1, p2, p3, t):
    u = 1.0 - t
    return tuple(u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k] for k in range(3))


def _sphere(cx, cy, cz, rx, ry, rz, segs, rings, color_fn, warp=None, yaw=0.0, vmax=1.0):
    """
    Esfera/elipsoide (o cúpula si vmax < 1) cerrada. color_fn(d, p, u, v) con d la dirección
    unitaria, p el punto final; warp(d) → factor radial (rocas). El bobinado se arregla luego
    con _recalc (cascarón cerrado).
    """
    verts, cols = [], []
    cy_, sy_ = math.cos(yaw), math.sin(yaw)

    def add(u, v):
        ph, th = u * TAU, v * math.pi
        d = (math.sin(th) * math.cos(ph), math.cos(th), math.sin(th) * math.sin(ph))
        k = warp(d) if warp is not None else 1.0
        lx, ly, lz = d[0] * rx * k, d[1] * ry * k, d[2] * rz * k
        p = (cx + lx * cy_ + lz * sy_, cy + ly, cz - lx * sy_ + lz * cy_)
        verts.append(p)
        cols.append(color_fn(d, p, u, v))

    add(0.0, 0.0)
    faces = []
    if vmax >= 1.0:
        for k in range(1, rings):
            for j in range(segs):
                add(j / segs, k / rings)
        add(0.0, 1.0)
        last = len(verts) - 1
        for j in range(segs):
            faces.append((0, 1 + (j + 1) % segs, 1 + j))
        for k in range(rings - 2):
            a = 1 + k * segs
            b = a + segs
            for j in range(segs):
                jn = (j + 1) % segs
                faces.append((a + j, a + jn, b + jn, b + j))
        a = 1 + (rings - 2) * segs
        for j in range(segs):
            faces.append((last, a + j, a + (j + 1) % segs))
    else:
        for k in range(1, rings + 1):
            for j in range(segs):
                add(j / segs, k / rings * vmax)
        for j in range(segs):
            faces.append((0, 1 + (j + 1) % segs, 1 + j))
        for k in range(rings - 1):
            a = 1 + k * segs
            b = a + segs
            for j in range(segs):
                jn = (j + 1) % segs
                faces.append((a + j, a + jn, b + jn, b + j))
        a = 1 + (rings - 1) * segs
        faces.append(tuple(range(a, a + segs))[::-1])  # tapa inferior (ngon)
    return verts, faces, cols


def _tube(pts, radii, radial, color_fn):
    """Tubo cerrado (tapas ngon) a lo largo de una polilínea con marco por transporte paralelo."""
    n = len(pts)
    tangents = []
    for i in range(n):
        a = pts[max(0, i - 1)]
        b = pts[min(n - 1, i + 1)]
        tangents.append(_norm((b[0] - a[0], b[1] - a[1], b[2] - a[2])))
    t0 = tangents[0]
    ref = (1.0, 0.0, 0.0) if abs(t0[0]) < 0.9 else (0.0, 0.0, 1.0)
    d = _dot(ref, t0)
    N = _norm((ref[0] - d * t0[0], ref[1] - d * t0[1], ref[2] - d * t0[2]))
    verts, cols = [], []
    for i in range(n):
        T = tangents[i]
        if i > 0:
            d = _dot(N, T)
            N = _norm((N[0] - d * T[0], N[1] - d * T[1], N[2] - d * T[2]))
        B = _cross(T, N)
        p, r, t = pts[i], radii[i], i / (n - 1)
        for j in range(radial):
            a = j / radial * TAU
            ca, sa = math.cos(a), math.sin(a)
            verts.append((p[0] + (N[0] * ca + B[0] * sa) * r, p[1] + (N[1] * ca + B[1] * sa) * r, p[2] + (N[2] * ca + B[2] * sa) * r))
            cols.append(color_fn(t, j / radial))
    faces = []
    for i in range(n - 1):
        a = i * radial
        b = a + radial
        for j in range(radial):
            jn = (j + 1) % radial
            faces.append((a + j, a + jn, b + jn, b + j))
    faces.append(tuple(range(radial))[::-1])
    faces.append(tuple(range((n - 1) * radial, n * radial)))
    return verts, faces, cols


def _scatter(rnd, count, t_range, th_ranges, taken, own_r, min_gap, margin=0.2, tries=800):
    """
    Puntos sobre la arena: t = r / shore_r(θ) en t_range, θ en alguno de th_ranges (ponderado
    por su anchura), fuera de lo reservado/muelle y a min_gap de lo ya ocupado (`taken` es una
    lista de (x, z, radio) que se amplía). Devuelve [(x, z, t, θ), ...].
    """
    out = []
    widths = [b - a for a, b in th_ranges]
    total = sum(widths)
    for _ in range(tries):
        if len(out) >= count:
            break
        u = rnd.random() * total
        th = th_ranges[-1][0]
        for (a, _b), w in zip(th_ranges, widths):
            if u <= w:
                th = a + u
                break
            u -= w
        t = lerp(t_range[0], t_range[1], rnd.random())
        x, z = common.polar(t * common.shore_r(th), th)
        if common.in_reserved(x, z, margin):
            continue
        if any(math.hypot(x - tx, z - tz) < tr + own_r + min_gap for tx, tz, tr in taken):
            continue
        out.append((x, z, t, th))
        taken.append((x, z, own_r))
    return out


# ---------------------------------------------------------------------------
# Arena
# ---------------------------------------------------------------------------


class _PolarGrid:
    """
    Rejilla polar de la arena: vértice 0 en el centro y anillos k = 1..len(t) en
    r = t_k · shore_r(θ_i), θ_i = -π + i·2π/n. Las filas siguen la orilla, así la línea de
    agua (t = 1) es una arista de la malla y la orilla sale nítida en vez de escalonada.
    """

    def __init__(self, n_th: int, t_rows) -> None:
        self.n = n_th
        self.t = list(t_rows)
        self.R = [common.shore_r(self.theta(i)) for i in range(n_th)]

    def theta(self, i: int) -> float:
        return -math.pi + (i % self.n) * TAU / self.n

    def index(self, i: int, k: int) -> int:
        """Índice de vértice del nodo (i, k); k = 0 es el centro."""
        return 0 if k == 0 else 1 + (k - 1) * self.n + (i % self.n)

    def xz(self, i: int, k: int):
        if k == 0:
            return (0.0, 0.0)
        return common.polar(self.t[k - 1] * self.R[i % self.n], self.theta(i))

def _footpath():
    """
    Camino de los clientes que llegan en bote: de la orilla junto al muelle (lado +X de su
    franja reservada, θ = PIER_THETA + 0.28) al costado derecho del carrito (2.5, 0.3),
    bordeando por fuera los caballitos de totora. Este lado queda a la vista en contacto,
    hero y educador (el lado -Z del muelle lo tapa el propio carrito desde contacto).
    Devuelve (sx, sz, ex, ez, L, dx, dz, px, pz): extremos, longitud, dirección unitaria y
    perpendicular (apunta en contra de los caballitos). La curva real es la recta arqueada
    0.3 u hacia la perpendicular (bow = sin(s·π)·0.3).
    """
    th_s = common.PIER_THETA + 0.28       # justo fuera de la franja del muelle (semiancho 1.2)
    sx, sz = common.polar(common.shore_r(th_s) * 0.975, th_s)
    ex, ez = 2.5, 0.3                     # fuera de RESERVED: carrito (2.3), jabas y caballitos
    L = math.hypot(ex - sx, ez - sz)
    dx, dz = (ex - sx) / L, (ez - sz) / L
    px, pz = -dz, dx
    cx, cz = common.RESERVED[1][0], common.RESERVED[1][1]   # caballitos
    mx, mz = (sx + ex) / 2, (sz + ez) / 2
    if px * (mx - cx) + pz * (mz - cz) < 0:
        px, pz = -px, -pz                 # el arco se aleja de los caballitos
    return sx, sz, ex, ez, L, dx, dz, px, pz


def _footpath_polyline(samples: int = 24):
    """Polilínea de la senda (misma curva arqueada que las huellas)."""
    sx, sz, ex, ez, _L, _dx, _dz, px, pz = _footpath()
    pts = []
    for i in range(samples + 1):
        s = i / samples
        bow = math.sin(s * math.pi) * 0.3
        pts.append((lerp(sx, ex, s) + px * bow, lerp(sz, ez, s) + pz * bow))
    return pts


def _dist_polyline(x, z, pts) -> float:
    """Distancia de (x, z) a una polilínea [(x, z), ...]."""
    best = float("inf")
    for (ax, az), (bx, bz) in zip(pts, pts[1:]):
        vx, vz = bx - ax, bz - az
        ll = vx * vx + vz * vz
        u = 0.0 if ll == 0.0 else clamp(((x - ax) * vx + (z - az) * vz) / ll, 0.0, 1.0)
        d = math.hypot(x - (ax + vx * u), z - (az + vz * u))
        if d < best:
            best = d
    return best


def _footprints(ctx, nv, nf, nc) -> int:
    """
    Camino de huellas del muelle al carrito (`_footpath`): arco suave y pasos de ≈ 0.4 u
    alternando pie izquierdo/derecho. Cada pisada es un óvalo plano de 10 lados
    (≈ 0.16 × 0.08 u, punta más ancha que el talón) apoyado unos cm sobre la arena, con el
    mismo material y UV de la arena y el color de la arena oscurecido (depresión de color,
    más honda en el centro). Se añade a la malla de la arena (sin objeto extra). Las pisadas
    que caerían sobre el muelle o los caballitos se omiten. Devuelve cuántas se pusieron.
    """
    sx, sz, ex, ez, L, dx, dz, px, pz = _footpath()
    count = max(8, int(round(L / 0.4)))
    lift = 0.04 if ctx.fast else 0.015    # por encima de la interpolación lineal de la rejilla
    placed = 0
    for i in range(count):
        s = i / (count - 1)
        bow = math.sin(s * math.pi) * 0.3
        side = 0.075 if i % 2 else -0.075
        cx = lerp(sx, ex, s) + px * (bow + side)
        cz = lerp(sz, ez, s) + pz * (bow + side)
        if common.in_reserved(cx, cz, 0.05) or math.hypot(cx, cz) > common.shore_r(math.atan2(cz, cx)) * 0.99:
            continue
        dbow = math.cos(s * math.pi) * math.pi * 0.3 / L
        ux, uz = _norm((dx + px * dbow, 0.0, dz + pz * dbow))[::2]
        ux, uz = (ux * math.cos(0.12 * (1 if i % 2 else -1)) - uz * math.sin(0.12 * (1 if i % 2 else -1)),
                  ux * math.sin(0.12 * (1 if i % 2 else -1)) + uz * math.cos(0.12 * (1 if i % 2 else -1)))
        vx, vz = -uz, ux
        base = _sand_color(cx, cz)
        o = len(nv)
        nv.append((cx, common.sand_height(cx, cz) + lift, cz))
        nc.append(shade(base, 0.52))
        m = 10
        for j in range(m):
            a = j / m * TAU
            ca, sa = math.cos(a), math.sin(a)
            along = 0.082 * ca
            across = 0.041 * sa * (1.0 + 0.25 * ca)      # punta más ancha que el talón
            x = cx + ux * along + vx * across
            z = cz + uz * along + vz * across
            nv.append((x, common.sand_height(x, z) + lift, z))
            nc.append(shade(base, 0.78))
        for j in range(m):
            nf.append((o, o + 1 + (j + 1) % m, o + 1 + j))      # normal hacia +Y
        placed += 1
    return placed


def _sand_color(x, z):
    r = math.hypot(x, z)
    th = math.atan2(z, x)
    R = common.shore_r(th)
    t = r / R
    # dunas: misma frecuencia que la altura → crestas claras y hondonadas doradas
    dune = noise2(x * 0.55, z * 0.55) - 0.35
    mottle = fbm2(x * 0.42 + 5.0, z * 0.42 + 2.0, 3)
    k = clamp(0.45 + dune * 1.5 + (mottle - 0.5) * 1.6, 0.0, 1.0)
    c = mix(C_DRY_B, C_DRY_A, k)
    # estrías anchas en la dirección del viento (−X, +Z); los rizos finos van en la textura
    streak = fbm2(x * 1.7 + 1.0, z * 1.7 + 9.0, 2)
    ripple = 0.5 + 0.5 * math.sin((x * 0.72 + z * 0.69) * 9.0 + 1.5 * noise2(x * 0.9, z * 0.9))
    band = smoothstep(0.3, 0.42, t) * smoothstep(0.78, 0.62, t)   # sólo t 0.3–0.78
    c = shade(c, 0.96 + 0.12 * (streak - 0.5) + 0.06 * (ripple - 0.5) * band)
    # orilla irregular (±0.06 en t): seca → húmeda → mojada → línea de agua, ≈ 1.4 u visibles
    tt = t + (noise2(x * 1.0 + 4.0, z * 1.0 + 1.0) - 0.5) * 0.12
    c = mix(c, C_DAMP, smoothstep(0.74, 0.88, tt))
    c = mix(c, C_WET, smoothstep(0.86, 0.975, tt))
    c = mix(c, C_WET_LINE, smoothstep(0.97, 1.005, tt))
    c = mix(c, C_SHALLOW, smoothstep(1.0, 1.08, t))
    c = mix(c, C_DEEP, smoothstep(1.06, 1.32, t))
    return c


def _sand_texture(ctx):
    """Grano tileable de 256² (valor cercano a 1: sólo rompe la planitud del vertex color)."""
    size = 256
    rnd = np.random.default_rng(ctx.rng(90).randrange(1 << 30))

    def tnoise(freq):
        lat = rnd.random((freq, freq))
        ys, xs = np.mgrid[0:size, 0:size].astype(np.float64) * (freq / size)
        x0 = np.floor(xs).astype(int)
        y0 = np.floor(ys).astype(int)
        fx, fy = xs - x0, ys - y0
        ux, uy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
        x1, y1 = (x0 + 1) % freq, (y0 + 1) % freq
        x0, y0 = x0 % freq, y0 % freq
        a, b, c, d = lat[y0, x0], lat[y0, x1], lat[y1, x0], lat[y1, x1]
        return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy

    g = 0.45 * tnoise(128) + 0.3 * tnoise(64) + 0.25 * tnoise(16)
    g = (g - g.mean()) / (g.std() + 1e-6)
    lum = 0.955 + 0.03 * g
    # rizos de viento: onda anisótropa con vector de onda ENTERO (-16, 16) por tile
    # (dirección 135° = viento −X/+Z, ≈ 22.6 ciclos/tile ≈ 0.07 u ≈ 30 cm reales) para
    # que la textura siga siendo tileable; la fase vaga con ruido tileable de baja frecuencia.
    vv, uu = np.mgrid[0:size, 0:size].astype(np.float64) / size
    phase = TAU * (-16.0 * uu + 16.0 * vv) + 2.6 * (tnoise(8) - 0.5) + 1.2 * (tnoise(32) - 0.5)
    lum = lum + 0.035 * np.sin(phase) + 0.012 * np.sin(2.0 * phase + 0.9)
    sp = rnd.random((size, size))
    lum = np.where(sp > 0.994, lum * 0.84, lum)
    lum = np.where(sp < 0.004, lum * 1.05, lum)
    lum = np.clip(lum, 0.0, 1.0)
    arr = np.stack([lum, lum * 0.995, lum * 0.975, np.ones_like(lum)], axis=-1).astype(np.float32)
    return common.image_from_array("tex_island_sand", arr)


def _build_sand(ctx, mat, contacts):
    """
    Arena en rejilla polar. `contacts` = [(x, z, radio, cantidad)]: zonas (pie de troncos,
    rocas) cuyos vértices se oscurecen (arena húmeda / sombra de contacto; sólo color).
    """
    n_th = ctx.detail(128, 72)
    rows: list = []

    def span(t0, t1, m):
        rows.extend(t0 + (t1 - t0) * (k + 1) / m for k in range(m))

    span(0.0, 0.86, ctx.detail(14, 8))      # interior: ≈ 0.4 u entre anillos (bajo el carrito nadie mira)
    span(0.86, 1.0, ctx.detail(10, 5))      # banda húmeda → línea de agua (anillo exacto en t = 1)
    span(1.0, 1.12, ctx.detail(8, 4))       # somero
    span(1.12, T_MAX, ctx.detail(5, 3))     # fondo marino hasta la profundidad de descarte
    grid = _PolarGrid(n_th, rows)
    nrings = len(rows)

    verts = [(0.0, common.sand_height(0.0, 0.0), 0.0)]
    for k in range(1, nrings + 1):
        for i in range(n_th):
            x, z = grid.xz(i, k)
            verts.append((x, common.sand_height(x, z), z))
    cols = [_sand_color(x, z) for (x, _y, z) in verts]

    # senda: franja de arena pisada (~0.5 u) que enmarca las huellas y se lee desde arriba
    path = _footpath_polyline()
    pxs, pzs = [p[0] for p in path], [p[1] for p in path]
    bx0, bx1, bz0, bz1 = min(pxs) - 0.32, max(pxs) + 0.32, min(pzs) - 0.32, max(pzs) + 0.32
    for vi, (x, _y, z) in enumerate(verts):
        if bx0 < x < bx1 and bz0 < z < bz1:
            d = _dist_polyline(x, z, path)
            if d < 0.30:
                cols[vi] = shade(cols[vi], 1.0 - 0.14 * (1.0 - smoothstep(0.12, 0.30, d)))

    # asentamiento de troncos y rocas: sólo color (toda la cantidad dentro del radio, borde corto)
    for vi, (x, _y, z) in enumerate(verts):
        f = 1.0
        for cx, cz, rad, amt in contacts:
            lim = rad * 1.15
            if abs(x - cx) < lim and abs(z - cz) < lim:
                d = math.hypot(x - cx, z - cz)
                if d < lim:
                    f *= 1.0 - amt * (1.0 - smoothstep(rad * 0.9, lim, d))
        if f < 1.0:
            cols[vi] = shade(cols[vi], f)

    faces = [(0, grid.index(i + 1, 1), grid.index(i, 1)) for i in range(n_th)]
    for k in range(1, nrings):
        for i in range(n_th):
            faces.append((grid.index(i, k), grid.index(i + 1, k), grid.index(i + 1, k + 1), grid.index(i, k + 1)))

    # fuera las caras enteras bajo el agua profunda (invisibles) y reindexar
    limit = SEA_Y - CULL_DEPTH
    remap: dict = {}
    nv, nc, nf = [], [], []
    for f in faces:
        if not any(verts[vi][1] > limit for vi in f):
            continue
        out = []
        for vi in f:
            k = remap.get(vi)
            if k is None:
                k = len(nv)
                remap[vi] = k
                nv.append(verts[vi])
                nc.append(cols[vi])
            out.append(k)
        nf.append(tuple(out))
    ctx.stats["footprints"] = _footprints(ctx, nv, nf, nc)
    uvs = [(nv[vi][0] / SAND_TILE, nv[vi][2] / SAND_TILE) for f in nf for vi in f]
    obj = common.new_mesh("island_arena", nv, nf, ctx.collection, colors=nc, uvs=uvs,
                          material=mat, smooth=True, smooth_angle=None)
    ctx.stats["sand_verts"] = len(nv)
    ctx.stats["sand_grid"] = f"polar {n_th}x{nrings}"
    return obj


# ---------------------------------------------------------------------------
# Palmeras
# ---------------------------------------------------------------------------


def _frond(origin, yaw, tilt, length, droop, width, seed, steps, roll=0.0, dry=False):
    """
    Hoja: cinta a lo largo de una curva que cae, doblada en V sobre el nervio (el pliegue se
    cierra hacia la punta), con un giro `roll` alrededor del nervio para que no sea plana y
    folíolos alternos: los dientes de un borde van desfasados un paso respecto al otro.
    """
    verts, cols = [], []
    cy, sy = math.cos(yaw), math.sin(yaw)
    ct, st = math.cos(tilt), math.sin(tilt)
    cr, sr = math.cos(roll), math.sin(roll)
    tone = 0.94 + 0.12 * common.hash2(seed * 0.37, 0.5)
    for i in range(steps + 1):
        t = i / steps
        x = t * length
        y = math.sin(t * math.pi * 0.55) * length * 0.22 - t * t * droop
        # ancho: 0 en la base, máximo a ~40 %, punta que se afila de verdad (sin cola fina)
        if t < 0.8:
            base = math.sin(min(1.0, t * 1.15) * math.pi) * width
        else:
            base = math.sin(0.92 * math.pi) * width * (1.0 - t) / 0.2
        base = max(base, 0.002) + (0.004 if t < 0.5 else 0.0)
        jit = 0.9 + 0.1 * math.sin(seed + i)
        if t < 0.15:
            saw_l = saw_r = 1.0          # base lisa: se lee como pecíolo
        else:
            saw_l = 1.0 if i % 2 == 0 else 0.78
            saw_r = 0.78 if i % 2 == 0 else 1.0
        wl, wr = base * saw_l * jit, base * saw_r * jit
        fold = base * lerp(0.45, 0.55, t)
        for dy, dz, rib in ((-fold, -wl, False), (0.0, 0.0, True), (-fold, wr, False)):
            dzr, dyr = dz * cr - dy * sr, dz * sr + dy * cr      # giro alrededor del nervio
            yy, zz = y + dyr, dzr
            xr, yr = x * ct - yy * st, x * st + yy * ct
            xw, zw = xr * cy + zz * sy, -xr * sy + zz * cy
            verts.append((origin[0] + xw, origin[1] + yr, origin[2] + zw))
            if dry:
                c = shade(C_DRY_FROND_A, 0.7) if rib else mix(C_DRY_FROND_A, C_DRY_FROND_B, t * 0.8)
            else:
                c = shade(mix(C_FROND_DARK, C_FROND_MID, t * 0.5), 0.85) if rib else mix(C_FROND_MID, C_FROND_TIP, t * 0.8)
                c = shade(c, tone)
            cols.append(c)
    faces = []
    for i in range(steps):
        a = 3 * i
        b = a + 3
        faces.append((a, b, b + 1, a + 1))
        faces.append((a + 1, b + 1, b + 2, a + 2))
    return verts, faces, cols


def _build_palm(ctx, trunk_acc, frond_acc, p, idx):
    rnd = ctx.rng(100 + p["seed"])
    bx, bz = p["x"], p["z"]
    by = common.sand_height(bx, bz) - PALM_SINK
    lx, lz = p["lean"]
    h = p["height"]
    P0 = (bx, by, bz)
    P1 = (bx + lx * 0.05, by + h * 0.35, bz + lz * 0.05)
    P2 = (bx + lx * 0.55, by + h * 0.75, bz + lz * 0.55)
    P3 = (bx + lx, by + h, bz + lz)

    segs = ctx.detail(36, 18)
    radial = ctx.detail(10, 7)
    n_rings = 12
    pts, radii = [], []
    for i in range(segs + 1):
        t = i / segs
        pts.append(_bezier(P0, P1, P2, P3, t))
        taper = 0.17 * (1 - t * 0.45) + max(0.0, 0.06 - t * 0.5)
        ring = 0.5 + 0.5 * math.cos(TAU * t * n_rings)
        radii.append(taper * (1 + 0.07 * ring * ring))

    def trunk_color(t, u):
        ring = 0.5 + 0.5 * math.cos(TAU * t * n_rings)
        c = mix(C_TRUNK_B, C_TRUNK_A, ring)
        c = mix(c, C_TRUNK_RING, ring ** 4 * 0.5)
        fiber = 0.5 + 0.5 * math.sin(u * TAU * 5 + t * 3)
        return shade(c, 0.92 + 0.12 * fiber)

    trunk_acc.add(*_tube(pts, radii, radial, trunk_color))

    top = P3
    trunk_acc.add(*_sphere(top[0], top[1] - 0.02, top[2], 0.15, 0.14, 0.15, 8, 5,
                           lambda d, q, u, v: shade(C_BULB, 0.9 + 0.2 * d[1])))
    for k in range(3):
        a = k / 3 * TAU + 0.4 + p["seed"] * 0.1
        cx, cz = top[0] + math.cos(a) * 0.15, top[2] + math.sin(a) * 0.15
        base_c = C_COCO_GREEN if k == 1 else C_COCO
        trunk_acc.add(*_sphere(cx, top[1] - 0.14, cz, 0.1, 0.115, 0.1, 7, 4,
                               lambda d, q, u, v, bc=base_c: shade(bc, 0.85 + 0.25 * max(0.0, d[1]))))

    # copa: tres familias en capas. Las hojas viejas (bajas, largas) nacen 0.04 u por debajo
    # de la copa sobre el eje del tronco y cuelgan abrazando el bulbo; las medias llenan y
    # caen; las jóvenes van algo erguidas y desfasadas media vuelta de paso para no alinearse
    # con las bajas. Una cuarta familia de frondas cortas (6) tapa los huecos del centro.
    axis = _norm((P3[0] - P2[0], P3[1] - P2[1], P3[2] - P2[2]))
    low_origin = (top[0] - axis[0] * 0.04, top[1] - axis[1] * 0.04, top[2] - axis[2] * 0.04)
    n = (11, 11, 9, 9)[idx]
    steps = ctx.detail(24, 12)
    for i in range(n):
        fam = i % 3
        yaw = i / n * TAU + p["seed"] * 0.37 + (rnd.random() - 0.5) * 0.25 + (math.pi / n if fam == 2 else 0.0)
        tilt = (0.02, 0.30, 0.50)[fam] + (rnd.random() - 0.5) * 0.20
        length = (1.5 + ((i * 37 + p["seed"]) % 5) * 0.12) * (1.05 * 1.15, 1.0, 0.9)[fam]
        droop = (1.8, 1.5, 0.9)[fam]
        roll = 0.08 if rnd.random() < 0.5 else -0.08
        origin = low_origin if fam == 0 else top
        frond_acc.add(*_frond(origin, yaw, tilt, length, droop, 0.30, p["seed"] + i, steps, roll=roll))
    # cuarta familia: 6 frondas cortas entre las medias, nacen en la copa y rellenan el centro
    n4 = 6
    short_steps = ctx.detail(16, 8)
    for i in range(n4):
        yaw = (i + 0.5) / n4 * TAU + p["seed"] * 0.37 + (rnd.random() - 0.5) * 0.3
        tilt = 0.42 + (rnd.random() - 0.5) * 0.2
        length = (1.0 + ((i * 11 + p["seed"]) % 3) * 0.08)
        roll = 0.12 if rnd.random() < 0.5 else -0.12
        frond_acc.add(*_frond(top, yaw, tilt, length, 1.0, 0.26, p["seed"] * 7 + i, short_steps, roll=roll))
    if idx < 2:
        # frondas secas colgando del cuello de la copa (palmeras grandes), separadas del tronco
        n_dry = 2 if idx == 0 else 1
        for k in range(n_dry):
            yaw = rnd.random() * TAU
            roll = 0.3 if rnd.random() < 0.5 else -0.3
            frond_acc.add(*_frond((top[0], top[1] - 0.1, top[2]), yaw, -1.05, 1.4, 0.5, 0.18,
                                  p["seed"] * 3 + k, max(6, steps // 2), roll=roll, dry=True))


# ---------------------------------------------------------------------------
# Hierba, rocas, conchas y estrellas
# ---------------------------------------------------------------------------


def _tuft(acc, rnd, x, z, blades, h_max, c_base, c_tip):
    y0 = common.sand_height(x, z) - 0.01
    for b in range(blades):
        a = b / blades * TAU + rnd.random() * 0.9
        dx, dz = math.cos(a), math.sin(a)
        bh = h_max * (0.6 + 0.4 * rnd.random())
        lean = 0.3 + 0.6 * rnd.random()
        w = 0.028 + 0.02 * rnd.random()
        ox, oz = x + dx * 0.025, z + dz * 0.025
        sx, sz = -dz, dx

        def P(s):
            return (ox + dx * lean * bh * s * s, y0 + bh * s * (1 - 0.12 * s * s), oz + dz * lean * bh * s * s)

        p0, p1, p2 = P(0.0), P(0.55), P(1.0)
        w1 = w * 0.6
        verts = [
            (p0[0] - sx * w, p0[1], p0[2] - sz * w), (p0[0] + sx * w, p0[1], p0[2] + sz * w),
            (p1[0] - sx * w1, p1[1], p1[2] - sz * w1), (p1[0] + sx * w1, p1[1], p1[2] + sz * w1),
            p2,
        ]
        cb = shade(c_base, 0.8)
        cm = mix(c_base, c_tip, 0.5)
        acc.add(verts, [(0, 1, 3, 2), (2, 3, 4)], [cb, cb, cm, cm, c_tip])


def _rock_params(ctx, taken):
    """Posición, semiejes y giro de las rocas (misma secuencia aleatoria de siempre)."""
    rnd = ctx.rng(31)
    rocks = _scatter(rnd, ctx.detail(14, 7), (0.84, 1.06), [(-2.95, -1.75)], taken, 0.22, 0.05, margin=0.3)
    out = []
    for i, (x, z, t, th) in enumerate(rocks):
        s = 0.14 + 0.2 * rnd.random() ** 1.5 + (0.08 if t > 0.99 else 0.0)
        rx = s * (0.9 + 0.3 * rnd.random())
        rz = s * (0.9 + 0.3 * rnd.random())
        yaw = rnd.random() * TAU
        out.append((x, z, rx, s * 0.7, rz, yaw, 7.0 + i))
    return out


def _rock(acc, x, z, rx, ry, rz, yaw, seed):
    yb = common.sand_height(x, z)
    cy = yb + ry * 0.25   # tres cuartos de la roca asoman; el resto queda enterrado

    def warp(d):
        k = 1.0 + (fbm2(d[0] * 1.6 + seed, d[2] * 1.6 + d[1] * 1.1 + seed * 0.37, 3) - 0.5) * 0.85
        # fondo aplanado: la roca apoya en la arena en vez de hundirse como un huevo
        k *= lerp(1.0, 0.75, smoothstep(-0.3, -0.55, d[1]))
        return k

    def color(d, p, u, v):
        n = noise2(d[0] * 2.3 + seed, d[2] * 2.3 + d[1] * 1.7)
        c = mix(C_ROCK, C_ROCK_LIGHT, n)
        c = mix(c, C_ROCK_WARM, 0.45 * (0.5 + fbm2(d[0] * 3 + 1, d[1] * 3 + seed, 2)))   # pardo/ocre
        c = shade(c, 0.70 + 0.30 * smoothstep(-0.4, 0.6, d[1]))
        if p[1] < SEA_Y + 0.06:
            c = shade(c, 0.78)   # línea húmeda
        return c

    acc.add(*_sphere(x, cy, z, rx, ry, rz, 9, 6, color, warp=warp, yaw=yaw))


def _shell(acc, x, z, yaw, size, c):
    """Concha: cúpula achatada con franjas radiales marcadas y umbo oscuro en el borde trasero."""
    y0 = common.sand_height(x, z) + 0.003
    dark = shade(c, 0.65)

    def color(d, p, u, v):
        cc = c if int(u * 8) % 2 == 0 else dark
        cc = shade(cc, 0.9 + 0.15 * d[1])
        if v >= 0.49 and 0.36 <= u <= 0.64:
            cc = shade(cc, 0.6)   # umbo (charnela) en el borde trasero
        return cc

    acc.add(*_sphere(x, y0, z, size * 1.2, size * 0.55, size, 8, 3, color, yaw=yaw, vmax=0.5))


def _pebble(acc, x, z, yaw, size, seed):
    """Guijarro oscuro: la misma cúpula que la concha, más pequeña y en gris cálido."""
    y0 = common.sand_height(x, z) + 0.003

    def color(d, p, u, v):
        n = noise2(d[0] * 2.0 + seed, d[2] * 2.0 + d[1])
        return shade(mix(C_PEBBLE, C_PEBBLE_LIGHT, n * 0.6), 0.85 + 0.2 * d[1])

    acc.add(*_sphere(x, y0, z, size * 1.25, size * 0.6, size, 8, 3, color, yaw=yaw, vmax=0.5))


def _starfish(acc, x, z, scale, rot, c):
    """
    Estrella de mar con relieve: centro alto, un nudillo por brazo (hombros elevados a ambos
    lados del eje) y puntas levantadas; cara inferior enterrada y oscura.
    """
    y0 = common.sand_height(x, z) + 0.004
    n = 20
    # por índice mod 4: punta, hombro, valle entre brazos, hombro → (radio, altura, sombra)
    prof = ((1.0, 0.12, 0.85), (0.62, 0.22, 1.02), (0.42, 0.17, 0.95), (0.62, 0.22, 1.02))
    verts, cols, faces = [], [], []
    for i in range(n):
        a = i / n * TAU + rot
        rr, yy, sh = prof[i % 4]
        verts.append((x + math.cos(a) * rr * scale, y0 + yy * scale, z + math.sin(a) * rr * scale))
        cols.append(shade(c, sh))
    center = len(verts)
    verts.append((x, y0 + 0.45 * scale, z))
    cols.append(shade(c, 1.12))
    nb = len(verts)
    for i in range(n):
        a = i / n * TAU + rot
        rr = prof[i % 4][0]
        verts.append((x + math.cos(a) * rr * scale, y0 - 0.1 * scale, z + math.sin(a) * rr * scale))
        cols.append(shade(c, 0.7))
    for i in range(n):
        j = (i + 1) % n
        faces.append((center, i, j))
        faces.append((i, nb + i, nb + j, j))
    faces.append(tuple(range(nb, nb + n))[::-1])
    acc.add(verts, faces, cols)


# ---------------------------------------------------------------------------
# build
# ---------------------------------------------------------------------------


def build(ctx: common.BuildContext):
    """Crea la isla dentro de ctx.collection y devuelve la lista de objetos."""
    tex = _sand_texture(ctx)
    m_sand = common.make_material("CV_island_sand", vcol=True, image=tex, roughness=1.0)
    m_trunk = common.make_material("CV_island_trunk", vcol=True, roughness=0.95)
    m_frond = common.make_material("CV_island_frond", vcol=True, roughness=0.8, double_sided=True)
    m_grass = common.make_material("CV_island_grass", vcol=True, roughness=0.9, double_sided=True)
    m_rock = common.make_material("CV_island_rock", vcol=True, roughness=0.92)
    m_shell = common.make_material("CV_island_shell", vcol=True, roughness=0.7)

    taken = [(p["x"], p["z"], 0.4) for p in common.PALMS]

    # --- rocas: lado -X/-Z, de la arena seca a la orilla (fuera del muelle) -------
    # (se calculan antes que la arena para oscurecerla bajo cada una)
    rocks = _rock_params(ctx, taken)

    # --- arena -------------------------------------------------------------------
    contacts = [(p["x"], p["z"], 0.35, 0.12) for p in common.PALMS]
    contacts += [(x, z, 1.1 * max(rx, rz), 0.08) for (x, z, rx, _ry, rz, _yaw, _seed) in rocks]
    objs = [_build_sand(ctx, m_sand, contacts)]

    # --- palmeras ------------------------------------------------------------
    trunk_acc, frond_acc = _Acc(), _Acc()
    for idx, p in enumerate(common.PALMS):
        _build_palm(ctx, trunk_acc, frond_acc, p, idx)
    objs.append(trunk_acc.mesh("island_palmeras_tronco", ctx, m_trunk, smooth_angle=50, recalc=True))
    objs.append(frond_acc.mesh("island_palmeras_hojas", ctx, m_frond, smooth_angle=30))

    rock_acc = _Acc()
    for (x, z, rx, ry, rz, yaw, seed) in rocks:
        _rock(rock_acc, x, z, rx, ry, rz, yaw, seed)
    objs.append(rock_acc.mesh("island_rocas", ctx, m_rock, smooth_angle=None, recalc=True))

    # --- hierba de playa: fuera del primer plano del hero (+Z) ---------------------
    grass_acc = _Acc()
    rnd = ctx.rng(32)
    tufts = _scatter(rnd, ctx.detail(16, 8), (0.46, 0.86), [(-3.1, -0.15), (2.45, 3.1), (0.15, 0.7)], taken, 0.18, 0.25)
    for x, z, t, th in tufts:
        c_base = mix(C_GRASS_A, C_GRASS_B, rnd.random())
        _tuft(grass_acc, rnd, x, z, 5 + rnd.randrange(3), PROP_MAX_H * (0.75 + 0.25 * rnd.random()), c_base, C_GRASS_TIP)
    objs.append(grass_acc.mesh("island_hierba", ctx, m_grass, smooth_angle=None))

    # --- conchas, guijarros y estrellas de mar ---------------------------------------
    shell_acc = _Acc()
    rnd = ctx.rng(33)
    # a mano: lo que cae en el primer plano del hero (z ≲ 2.7) y de skills, fuera de lo reservado
    stars = [(-3.9, 1.35, 0.11, 0.4)]
    shells = [(2.2, 1.5, 0.3), (-2.0, 3.3, 1.1), (-3.4, 0.2, 2.0)]
    taken.extend((x, z, 0.14) for x, z, _s, _r in stars)
    taken.extend((x, z, 0.08) for x, z, _y in shells)
    # cono inferior del hero (z > 2.4, |x| < 1.6): nada que quede cortado por el borde del encuadre
    taken.append((0.0, 3.2, 1.4))
    for x, z, t, th in _scatter(rnd, ctx.detail(4, 2), (0.62, 0.95), [(-math.pi, math.pi)], taken, 0.14, 0.3):
        stars.append((x, z, 0.08 + 0.04 * rnd.random(), rnd.random() * TAU))
    for i, (x, z, s, rot) in enumerate(stars):
        _starfish(shell_acc, x, z, s, rot, C_STAR[i % len(C_STAR)])
    for x, z, t, th in _scatter(rnd, ctx.detail(10, 5), (0.6, 0.96), [(-math.pi, math.pi)], taken, 0.08, 0.25):
        if z > 2.4 and abs(x) < 1.6:
            continue
        shells.append((x, z, rnd.random() * TAU))
    n_pebbles = 0
    for i, (x, z, yaw) in enumerate(shells):
        u = rnd.random()
        if i >= 3 and i % 2 == 1:
            # guijarro oscuro (se lee al instante sobre la arena clara)
            _pebble(shell_acc, x, z, yaw, 0.03 + 0.02 * u, 11.0 + i)
            n_pebbles += 1
        else:
            pal = C_SHELL_DARK if i % 2 == 0 else C_SHELL     # mitad con la paleta oscura
            _shell(shell_acc, x, z, yaw, 0.045 + 0.03 * u, pal[(i // 2) % len(pal)])
    objs.append(shell_acc.mesh("island_conchas", ctx, m_shell, smooth_angle=40, recalc=True))

    ctx.stats.update(palms=len(common.PALMS), rocks=len(rocks), tufts=len(tufts), shells=len(shells) - n_pebbles,
                     pebbles=n_pebbles, starfish=len(stars), textures=["tex_island_sand"])
    return objs
