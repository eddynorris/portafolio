"""
terrain.py — Relieve del diorama «Costa Verde» (módulo `terrain`).

Objetos (todos en ctx.collection, 10 en total):
  terrain_fondo_marino  fondo marino visible a través del agua (6 u mar adentro)
  terrain_playa         playa de canto rodado con banda húmeda
  terrain_bordillos     muro/acera entre playa y pista, bordillos y berma central
  terrain_pista         asfalto del Circuito de Playas
  terrain_marcas        líneas discontinuas blancas, doble amarilla y líneas de borde
  terrain_acantilado    berma, talud, cara con costillas de erosión y borde redondeado
  terrain_muro          muro de contención de concreto (θ ≈ -π/2 + 0.5 … +0.7)
  terrain_meseta        meseta base (parque = césped, ciudad = concreto) hasta r = 200
  terrain_morro         la misma meseta en el tramo del Morro Solar (filas más densas)
  terrain_espigones     espigones de rocas en la playa

Todo el barrido es en función de θ con las funciones compartidas de common.py. El barrido
angular no es uniforme: denso en el arco de la costa y ralo en las colas (la cola derecha
llega hasta coast_u ≈ 1.6 para que el Morro —definido por morro_h— quede completo).

Reglas de encaje con los demás módulos:
  - La pista está a y = ROAD_Y exacto; la acera a ROAD_Y + 0.10; las marcas a ROAD_Y + 0.01.
  - El borde superior del acantilado está en (cliff_top_r, cliff_h + morro_h − 0.02) y la
    meseta a cliff_h + morro_h − 0.05: cualquier cosa colocada a cliff_h + morro_h queda
    apoyada sin z-fighting.
"""

from __future__ import annotations

import math

import numpy as np

import common
from common import (COAST_T0, COAST_T1, PAL, ROAD_Y, SEA_Y, SEAWALL_H, clamp, col, fbm2, hash2, lerp, mix,
                    noise2, shade, smoothstep)

# ---------------------------------------------------------------------------
# Parámetros
# ---------------------------------------------------------------------------

#: Barrido angular total y zona "core" (densidad completa).
T_LEFT = COAST_T0 - 0.35
T_RIGHT = COAST_T1 + 0.95  # morro_h llega hasta coast_u = 1.6
CORE0 = COAST_T0 - 0.15
CORE1 = COAST_T1 + 0.15
TAIL_DENSITY = 0.3
#: Radio típico de la cara del acantilado: s = θ·R_REF ≈ longitud de arco en unidades.
R_REF = 78.0

#: Acera (muro) entre la playa y la pista.
SIDEWALK_W = 1.0
SIDEWALK_H = 0.10
#: Muro de contención (tramo de θ).
WALL_T0 = -math.pi / 2 + 0.5
WALL_T1 = -math.pi / 2 + 0.7
WALL_DY = 3.6  # altura del muro en el perfil normalizado (0..18)

#: Perfil transversal normalizado del acantilado: (dr desde road_r1, dy en 0..18).
#: borde del bordillo → pie (berma) → talud → cara → hombro redondeado → labio plano.
H_REF = 18.0
PROFILE = [
    (-0.05, 0.01),   # bajo el bordillo exterior
    (1.20, 0.30),    # pie del acantilado (cliff_foot_r)
    (2.40, 1.70),    # talud (~49°)
    (3.70, 4.40),    # talud alto (~64°)
    (4.60, 8.00),    # cara (~76°)
    (5.30, 11.60),   # cara (~79°)
    (6.10, 14.70),   # cara (~75°)
    (7.00, 16.80),   # hombro
    (7.90, 17.70),   # hombro redondeado
    (8.70, 17.98),   # borde superior (cliff_top_r), 0.02 bajo cliff_h
    (9.20, 17.98),   # labio plano que tapa el arranque de la meseta
]

#: Filas de la meseta: distancia desde cliff_top_r; (d, f) → interpolación entre top+d y r = 200;
#: None → r = 200 absoluto. (top+92 ≤ 183 en todo el arco: las filas nunca se pliegan hacia atrás.)
PLATEAU_ROWS = [0.15, 1.5, 6.0, 6.08, 11, 17, 24, 32, 41, 51, 62, 75, 92, (92, 0.4), (92, 0.72), None]
MORRO_ROWS = [0.15, 1.5, 6.0, 6.08, 9, 12, 15, 18, 21, 24, 28, 32, 36, 40, 45, 50, 55, 60, 66, 72, 80, 92, (92, 0.4), (92, 0.72), None]


def plateau_r(p: dict, d) -> float:
    if d is None:
        return 200.0
    if isinstance(d, tuple):
        return lerp(p["top"] + d[0], 200.0, d[1])
    return p["top"] + d

# Colores adicionales (lineales)
CONCRETE = col("#9b9893")        # suelo de la ciudad
CONCRETE_WALL = col("#9d9b95")   # muro de contención
SEAWALL = col("#b9b4a8")         # muro de la acera
SIDEWALK = mix(PAL["path"], PAL["curb"], 0.55)
DIRT = col("#7d5c3f")
CLIFF_PALE = col("#d8bd92")      # arena pálida de las crestas y la parte alta
GULLY_DARK = col("#6b4a30")      # fondo de los barrancos (sombra + humedad)
MORRO_ROCK = mix(PAL["rock_light"], PAL["cliff_b"], 0.65)   # cerro pardo, seco y mate
MORRO_BUSH = col("#6b7d3c")


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------


def sn(x: float, y: float) -> float:
    """noise2 con signo, en [-1, 1]."""
    return noise2(x, y) * 2.0 - 1.0


def sf(x: float, y: float, octaves: int = 3) -> float:
    """fbm2 con signo, ≈ [-1, 1]."""
    return (fbm2(x, y, octaves) - 0.5) * 2.0


def catmull_rom(pts, per_seg: int = 32):
    """Curva Catmull-Rom (uniforme) por los puntos; índice k*per_seg cae exactamente en pts[k]."""
    P = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for k in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[k - 1], P[k], P[k + 1], P[k + 2]
        for q in range(per_seg):
            t = q / per_seg
            t2, t3 = t * t, t * t * t
            out.append(tuple(
                0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2
                       + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)
                for c in range(2)))
    out.append(tuple(pts[-1]))
    return out


def resample(curve, k: int):
    """k puntos de la polilínea a distancia de arco uniforme (incluye extremos)."""
    d = [0.0]
    for a, b in zip(curve, curve[1:]):
        d.append(d[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
    total = d[-1]
    out, j = [], 0
    for i in range(k):
        target = total * i / (k - 1)
        while j < len(d) - 2 and d[j + 1] < target:
            j += 1
        seg = d[j + 1] - d[j]
        f = 0.0 if seg <= 1e-12 else clamp((target - d[j]) / seg, 0.0, 1.0)
        out.append((lerp(curve[j][0], curve[j + 1][0], f), lerp(curve[j][1], curve[j + 1][1], f)))
    return out


class Sweep:
    """Columnas de un barrido en θ: índice 0..n ↔ θ, con densidad distinta por tramo."""

    def __init__(self, cols_per_rad: float):
        segs = ((T_LEFT, CORE0, TAIL_DENSITY), (CORE0, CORE1, 1.0), (CORE1, T_RIGHT, TAIL_DENSITY))
        self.thetas: list[float] = []
        for a, b, dens in segs:
            k = max(2, int(round((b - a) * cols_per_rad * dens)))
            for q in range(0 if not self.thetas else 1, k + 1):
                self.thetas.append(a + (b - a) * q / k)
        self.n = len(self.thetas) - 1

    def index(self, s: float) -> int:
        return min(self.n, max(0, int(round(s * self.n))))

    def index_of_theta(self, th: float) -> int:
        return min(range(self.n + 1), key=lambda i: abs(self.thetas[i] - th))


class Coast:
    """Datos del perfil de la costa por columna (memoizados)."""

    def __init__(self, sweep: Sweep):
        self.sw = sweep
        self._cache: list = [None] * (sweep.n + 1)

    def at(self, s: float) -> dict:
        i = self.sw.index(s)
        p = self._cache[i]
        if p is None:
            th = self.sw.thetas[i]
            cr = common.coast_r(th)
            r0 = common.road_r0(th)
            r1 = common.road_r1(th)
            top = common.cliff_top_r(th)
            xt, zt = common.polar(top, th)
            p = {
                "i": i, "th": th, "u": common.coast_u(th), "s": th * R_REF,
                "c": math.cos(th), "sn": math.sin(th),
                "cr": cr, "bw": r0 - cr, "r0": r0, "r1": r1, "rm": 0.5 * (r0 + r1),
                "foot": common.cliff_foot_r(th), "top": top, "h": common.cliff_h(th),
                "m_top": common.morro_h(xt, zt),
                "core": smoothstep(T_LEFT, CORE0 + 0.05, th) * (1 - smoothstep(CORE1 - 0.05, T_RIGHT, th)),
            }
            self._cache[i] = p
        return p


def pt(p: dict, r: float, y: float):
    return (r * p["c"], y, r * p["sn"])


class Acc:
    """Acumula varias rejillas en una sola malla."""

    def __init__(self):
        self.v, self.f, self.c = [], [], []

    def add(self, verts, faces, cols=None):
        o = len(self.v)
        self.v.extend(verts)
        self.f.extend(tuple(i + o for i in face) for face in faces)
        if cols:
            self.c.extend(cols)


def tileable_noise(rng: np.random.Generator, n: int, px: int, py: int, octaves: int = 4, gain: float = 0.5) -> np.ndarray:
    """Ruido de valor periódico n×n en 0..1 (numpy); px/py celdas en la primera octava."""
    out = np.zeros((n, n), np.float32)
    amp, tot = 1.0, 0.0
    for _ in range(octaves):
        lattice = rng.random((py, px)).astype(np.float32)
        ys, xs = np.mgrid[0:n, 0:n].astype(np.float32)
        xs *= px / n
        ys *= py / n
        ix, iy = np.floor(xs).astype(int), np.floor(ys).astype(int)
        fx, fy = xs - ix, ys - iy
        ux, uy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
        a = lattice[iy % py, ix % px]
        b = lattice[iy % py, (ix + 1) % px]
        c = lattice[(iy + 1) % py, ix % px]
        d = lattice[(iy + 1) % py, (ix + 1) % px]
        out += amp * (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy)
        tot += amp
        amp *= gain
        px, py = px * 2, py * 2
    return out / tot


#: Tamaño en unidades de una repetición de la textura del acantilado y ganancia que compensa
#: su brillo medio (≈ 0.86) en los colores de vértice que multiplica.
CLIFF_TILE = 6.0
TEX_GAIN = 1.16


def cliff_texture(seed: int = 7) -> "bpy.types.Image":
    """Textura 256² tileable (gris) para la cara del acantilado: grano, estratos, chorreras y cantos."""
    n = 256
    rng = np.random.default_rng(seed)
    grain = tileable_noise(rng, n, 16, 16, 4)                       # grano fino (0.37 u)
    medium = tileable_noise(rng, n, 4, 4, 2)                        # manchas medias (1.5 u)
    streak = tileable_noise(rng, n, 48, 3, 3)                       # chorreras verticales
    strata = tileable_noise(rng, n, 1, 4, 3)[:, :1]                 # perfil 1D de estratos (se extiende en x)
    wave = tileable_noise(rng, n, 6, 1, 2)[:1, :]                   # ondulación de los estratos
    fade = tileable_noise(rng, n, 3, 1, 2)[:1, :]                   # las líneas aparecen y desaparecen en x
    k = 0.9 + 0.14 * grain
    k *= 0.95 + 0.1 * (medium - 0.5)
    k *= 0.96 + 0.08 * (strata - 0.5)
    # líneas finas y oscuras en algunos límites de estratos (onduladas, discontinuas, sutiles)
    ys = (np.arange(n, dtype=np.float32)[:, None] + 8.0 * (wave - 0.5)) % n
    prof = strata[:, 0]
    s_at = prof[ys.astype(int) % n]
    line = np.exp(-((s_at - 0.5) / 0.03) ** 2) + 0.7 * np.exp(-((s_at - 0.64) / 0.022) ** 2)
    line *= np.clip((fade - 0.45) * 3.0, 0, 1)
    k *= 1 - 0.035 * np.clip(line, 0, 1)
    k *= 1 - 0.06 * np.clip((streak - 0.6) * 4.0, 0, 1)
    # cantos rodados del conglomerado: motas suaves oscuras y claras
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    for _ in range(300):
        cx, cy, rad = rng.uniform(0, n), rng.uniform(0, n), rng.uniform(1.2, 2.6)
        tone = rng.uniform(0.78, 0.9) if rng.random() < 0.7 else rng.uniform(1.06, 1.12)
        dx = (xx - cx + n / 2) % n - n / 2
        dy = (yy - cy + n / 2) % n - n / 2
        g = np.exp(-(dx * dx + dy * dy) / (rad * rad))
        k *= 1 + (tone - 1) * g
    k = np.clip(k, 0.0, 1.0).astype(np.float32)
    arr = np.ones((n, n, 4), np.float32)
    arr[..., 0] = k
    arr[..., 1] = k * 0.99
    arr[..., 2] = k * 0.97
    return common.image_from_array("tex_terrain_cliff", arr)


def facing(face, verts, outward):
    """Devuelve `face` con el orden que hace que su normal apunte hacia `outward` (coords three)."""
    a, b, c = (verts[face[0]], verts[face[1]], verts[face[2]])
    e1 = (b[0] - a[0], b[1] - a[1], b[2] - a[2])
    e2 = (c[0] - a[0], c[1] - a[1], c[2] - a[2])
    n = (e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0])
    dot = n[0] * outward[0] + n[1] * outward[1] + n[2] * outward[2]
    return tuple(face) if dot >= 0 else tuple(reversed(face))


def park_color(s: float, d: float):
    """Césped liso de la franja del parque (d = distancia desde el borde)."""
    n = fbm2(s / 3.0 + 2.0, d * 0.6 + 1.0, 2)
    n2 = fbm2(s / 0.9 + 5.0, d * 2.0, 2)
    c = mix(PAL["lawn"], PAL["top_grass"], 0.3 + 0.4 * n)
    return shade(c, 0.92 + 0.16 * n2)


def morro_color(x: float, y: float, z: float, m: float, bush_k: float = 1.0):
    """Roca seca con matorral escaso del Morro Solar. El ruido también depende de y para que en la
    cara (casi vertical) las manchas no degeneren en chorreras verticales."""
    n = fbm2(x * 0.09 + 3.0 + y * 0.12, z * 0.09 + y * 0.08, 3)
    n2 = fbm2(x * 0.25 + 7.0 + y * 0.3, z * 0.25 + 1.0 + y * 0.2, 2)
    rock = mix(MORRO_ROCK, PAL["cliff_b"], 0.3 * (n - 0.5))     # pardo, variación tenue
    rock = shade(rock, 0.95 + 0.2 * n2)
    bush = smoothstep(0.62, 0.72, n2) * (1 - smoothstep(6.0, 18.0, m))   # sólo manchas
    return mix(rock, MORRO_BUSH, bush * 0.7 * bush_k)


# ---------------------------------------------------------------------------
# Piezas
# ---------------------------------------------------------------------------


def build_seafloor(ctx, coast: Coast, mat):
    rows = ((-6.0, -1.6), (-3.2, -0.8), (-1.2, -0.28), (0.0, 0.0))
    deep = shade(PAL["sea_floor"], 0.55)
    base = (deep, PAL["sea_floor"], mix(PAL["sea_floor"], PAL["wet_sand"], 0.45), PAL["wet_sand"])

    def point(s, j):
        p = coast.at(s)
        dr, dy = rows[j]
        return pt(p, p["cr"] + dr, SEA_Y + dy)

    def color(s, j, v):
        p = coast.at(s)
        return shade(base[j], 1.0 + 0.1 * sf(p["s"] / 4.0 + 2.0, j * 0.7, 2))

    v, f, c = common.arc_grid(0.0, 1.0, coast.sw.n, len(rows), point, color)
    return common.new_mesh("terrain_fondo_marino", v, f, ctx.collection, colors=c, material=mat,
                           smooth=True, smooth_angle=None)


def build_beach(ctx, coast: Coast, mat):
    y_wall = ROAD_Y - SEAWALL_H

    def rows_of(p):
        cr, wall = p["cr"], p["r0"] - SIDEWALK_W
        w = 0.3 * sn(p["s"] / 3.5 + 2.0, 0.4)          # el límite húmedo ondula ±0.3 u a lo largo de s
        r_wet = cr + 1.3 + w
        # filas intermedias (cr+2.2, cr+3.2), acotadas cuando la playa es estrecha
        r_a = min(cr + 2.2, lerp(r_wet, wall, 0.4))
        r_b = min(cr + 3.2, lerp(r_wet, wall, 0.7))
        r_c = lerp(r_b, wall, 0.55)

        def yb(r):  # altura de la playa seca: rampa suave desde la banda húmeda hasta el muro
            f = clamp((r - r_wet) / max(0.2, wall - r_wet), 0.0, 1.0)
            return lerp(SEA_Y + 0.15, y_wall, f)

        return (
            (cr, SEA_Y),
            (cr + 1.0 + 0.8 * w, SEA_Y + 0.11),
            (r_wet, SEA_Y + 0.15),
            (r_a, yb(r_a)),
            (r_b, yb(r_b)),
            (r_c, yb(r_c)),
            (wall + 0.02, y_wall),
        )

    def point(s, j):
        p = coast.at(s)
        r, y = rows_of(p)[j]
        if 3 <= j <= 5:
            y += 0.04 * sn(p["s"] / 2.5 + 1.0, j * 1.3)
        return pt(p, r, y)

    def color(s, j, v):
        p = coast.at(s)
        sc = p["s"]
        wet = shade(PAL["wet_sand"], 1.0 + 0.1 * sf(sc / 4.0 + 2.0, 2.1, 2))
        if j == 0:
            return wet
        if j == 1:  # línea de resaca: restos oscuros discontinuos sobre la arena húmeda
            line = smoothstep(0.5, 0.7, fbm2(sc / 1.1 + 6.0, 3.3, 2))
            return mix(mix(wet, PAL["pebble"], 0.25), shade(PAL["wet_sand"], 0.9), 0.8 * line)
        n = fbm2(sc / 1.4 + 3.0, j * 2.7 + 0.5, 3)
        peb = shade(PAL["pebble"], 0.78 + 0.4 * n)
        if j == 2:
            return mix(peb, wet, 0.4)
        if j == 6:
            return shade(peb, 0.86)
        return peb

    v, f, c = common.arc_grid(0.0, 1.0, coast.sw.n, 7, point, color)
    return common.new_mesh("terrain_playa", v, f, ctx.collection, colors=c, material=mat, smooth=True, smooth_angle=None)


def build_road(ctx, coast: Coast, mat):
    def point(s, j):
        p = coast.at(s)
        return pt(p, (p["r0"], p["rm"], p["r1"])[j], ROAD_Y)

    def color(s, j, v):
        p = coast.at(s)
        k = 0.9 + 0.2 * fbm2(p["s"] / 7.0 + 1.0, j * 0.9 + 0.3, 3)
        if j == 1:
            k *= 0.94
        return shade(PAL["asphalt"], k)

    v, f, c = common.arc_grid(0.0, 1.0, coast.sw.n, 3, point, color)
    return common.new_mesh("terrain_pista", v, f, ctx.collection, colors=c, material=mat, smooth=True, smooth_angle=None)


def build_curbs(ctx, coast: Coast, mat):
    acc = Acc()
    n = coast.sw.n
    curb = PAL["curb"]

    def strip(rows_fn, cols_fn):
        def point(s, j):
            p = coast.at(s)
            r, y = rows_fn(p)[j]
            return pt(p, r, y)

        def color(s, j, v):
            p = coast.at(s)
            k = 0.95 + 0.1 * noise2(p["s"] / 2.0, j * 0.5)
            return shade(cols_fn[j], k)

        v, f, c = common.arc_grid(0.0, 1.0, n, len(cols_fn), point, color)
        acc.add(v, f, c)

    # muro de la acera (lado playa) + acera + bordillo hacia la pista
    strip(lambda p: ((p["r0"] - SIDEWALK_W, ROAD_Y - 0.5), (p["r0"] - SIDEWALK_W, ROAD_Y + SIDEWALK_H),
                     (p["r0"], ROAD_Y + SIDEWALK_H), (p["r0"] + 0.02, ROAD_Y - 0.02)),
          (shade(SEAWALL, 0.62), SIDEWALK, SIDEWALK, curb))
    # bordillo exterior (lado acantilado)
    strip(lambda p: ((p["r1"] - 0.02, ROAD_Y - 0.02), (p["r1"], ROAD_Y + 0.1), (p["r1"] + 0.2, ROAD_Y + 0.1),
                     (p["r1"] + 0.22, ROAD_Y)),
          (curb, curb, curb, shade(curb, 0.8)))
    # berma central
    strip(lambda p: ((p["rm"] - 0.35, ROAD_Y - 0.01), (p["rm"] - 0.35, ROAD_Y + 0.12), (p["rm"] + 0.35, ROAD_Y + 0.12),
                     (p["rm"] + 0.35, ROAD_Y - 0.01)),
          (shade(curb, 0.85), curb, curb, shade(curb, 0.85)))
    return common.new_mesh("terrain_bordillos", acc.v, acc.f, ctx.collection, colors=acc.c, material=mat,
                           smooth=True, smooth_angle=40.0)


def build_marks(ctx, coast_mid: Coast, coast_low: Coast, mat):
    acc = Acc()
    y = ROAD_Y + 0.01
    hw = 0.04

    def strip(coast, r_fn, color):
        def point(s, j):
            p = coast.at(s)
            return pt(p, r_fn(p) + (-hw if j == 0 else hw), y)

        v, f, c = common.arc_grid(0.0, 1.0, coast.sw.n, 2, point, lambda s, j, q: color)
        acc.add(v, f, c)

    strip(coast_mid, lambda p: p["rm"] - 0.45, PAL["lane_yellow"])
    strip(coast_mid, lambda p: p["rm"] + 0.45, PAL["lane_yellow"])
    strip(coast_low, lambda p: p["r0"] + 0.25, PAL["lane"])
    strip(coast_low, lambda p: p["r1"] - 0.25, PAL["lane"])

    # líneas discontinuas (1.2 u pintado / 1.2 u hueco) entre los carriles de cada sentido
    dash, gap = 1.2, 1.2
    for lane_r in (lambda th: common.road_r0(th) + 1.575, lambda th: common.road_r1(th) - 1.575):
        th = T_LEFT + 0.004
        while th < T_RIGHT:
            ra = lane_r(th)
            thb = th + dash / ra
            if thb > T_RIGHT:
                break
            rb = lane_r(thb)
            ca, sa, cb, sb = math.cos(th), math.sin(th), math.cos(thb), math.sin(thb)
            o = len(acc.v)
            acc.v.extend([
                ((ra - hw) * ca, y, (ra - hw) * sa), ((rb - hw) * cb, y, (rb - hw) * sb),
                ((rb + hw) * cb, y, (rb + hw) * sb), ((ra + hw) * ca, y, (ra + hw) * sa),
            ])
            acc.f.append((o, o + 1, o + 2, o + 3))
            acc.c.extend([PAL["lane"]] * 4)
            th = thb + gap / rb
    return common.new_mesh("terrain_marcas", acc.v, acc.f, ctx.collection, colors=acc.c, material=mat,
                           smooth=False, smooth_angle=None)


def cliff_rows(k_face: int):
    """Filas del perfil: bordillo, k_face filas (pie → borde, uniformes en arco) y labio."""
    curve = catmull_rom(PROFILE, 32)
    face = resample(curve[32: 9 * 32 + 1], k_face)
    return [PROFILE[0]] + face + [PROFILE[-1]]


def ridged(x: float, y: float) -> float:
    """Ruido 'ridged' en [-1, 1]: crestas afiladas (+1) y barrancos redondeados (-1)."""
    return 1.0 - 2.0 * abs(sn(x, y))


def wall_mask(th: float) -> float:
    """1 dentro del tramo del muro de contención (con margen), 0 fuera."""
    return smoothstep(WALL_T0 - 0.06, WALL_T0 - 0.02, th) * (1 - smoothstep(WALL_T1 + 0.02, WALL_T1 + 0.06, th))


def tri_wave(x: float) -> float:
    """Onda triangular de periodo 1 en [-1, 1]: crestas y barrancos afilados (flancos rectos)."""
    return 4.0 * abs(x - math.floor(x) - 0.5) - 1.0


def cusp(v: float, q: float = 1.8) -> float:
    """Reforma una onda en [-1, 1]: crestas anchas y redondeadas, barrancos estrechos en V (erosión)."""
    return 1.0 - 2.0 * ((1.0 - v) * 0.5) ** q


def morro_w(m_top: float) -> float:
    """Peso del Morro Solar (0 → acantilado normal, 1 → cerro) con transición ancha (≈ 17 u)."""
    return smoothstep(0.3, 6.0, m_top)


#: Dirección de la luz principal (KEY_LIGHT_POS normalizada) para hornear el sombreado de las costillas.
_L = common.KEY_LIGHT_POS
_LN = math.sqrt(_L[0] ** 2 + _L[1] ** 2 + _L[2] ** 2)
LIGHT_DIR = (_L[0] / _LN, _L[1] / _LN, _L[2] / _LN)


def build_cliff(ctx, coast: Coast, mat, rows, rib_scale: float):
    extras: dict = {}
    RIB_P = 2.5 * rib_scale  # periodo base de las costillas (u de arco)

    def disp(sc, t, core, keep, wm):
        """Desplazamiento radial (−: hacia el mar) y valor de costilla en (s, t); wm = peso del Morro."""
        # fase de las costillas: casi periódica, con deriva lenta (espaciado variable) y
        # ondulación con la altura (las costillas se tuercen y se juntan)
        phase = (sc / RIB_P + 0.9 * sn(sc / 23.0 + 1.0, 0.3) + 0.3 * sn(sc / 6.0 + 4.0, t * 2.0 + 1.0)
                 + 0.25 * (t - 0.5) * sn(sc / 9.0 + 2.0, 0.7))      # las costillas se inclinan y abren en abanico
        tri = cusp(tri_wave(phase)) * (1 - 0.4 * smoothstep(0.45, 0.6, t))   # la familia fina pesa menos arriba
        # segunda familia de costillas más anchas que se superpone (anchuras variadas, contrafuertes)
        tri2 = cusp(tri_wave(sc / (1.9 * RIB_P) + 0.37 + 0.6 * sn(sc / 17.0 + 5.0, 0.8) + 0.15 * sn(sc / 5.0, t * 1.7)))
        rid = ridged(sc / (0.55 * RIB_P) + 11.0, t * 2.6 + 5.0)       # subcostillas finas
        nmix = noise2(sc / 11.0 + 6.0, t * 0.9 + 2.0)
        wmix = lerp(0.25 + 0.5 * nmix, 0.45 + 0.45 * nmix, smoothstep(0.4, 0.6, t))  # arriba manda tri2
        fine = lerp(tri, tri2, wmix) * 0.78 + 0.22 * rid
        coarse = ridged(sc / (3.6 * rib_scale) + 7.7, t * 0.8 + 1.0)   # colas: sólo lo grueso
        ribs = lerp(coarse, fine, core)
        depth = 0.45 + 0.55 * noise2(sc / 8.0 + 2.0, t * 1.3)          # barrancos profundos y someros
        ribs *= depth
        amp = 0.78 * (1 - 0.42 * smoothstep(0.4, 0.9, t))               # más marcadas en la mitad inferior
        if wm > 0:  # Morro: ladera erosionada con pliegues grandes (periodo 6 u, 1.8 u), no muro con estacas
            cm = ridged(sc / (6.0 * rib_scale) + 7.7, t * 0.8 + 1.0) * (0.6 + 0.4 * noise2(sc / 14.0 + 3.0, t * 1.1))
            ribs = lerp(ribs, cm, wm)
            amp = lerp(amp, 1.8, wm)
        # contrafuertes de baja frecuencia y repisas horizontales (estratos) suaves
        butt = 1.6 * sf(sc / 10.0 + 0.5, t * 0.8 + 2.0, 2) * smoothstep(0.05, 0.4, t) * (1 - smoothstep(0.7, 0.97, t))
        strata = 0.12 * sn(t * 9.0 + 0.3, sc / 40.0) * smoothstep(0.1, 0.25, t) * (1 - smoothstep(0.6, 0.8, t))
        win = smoothstep(0.02, 0.1, t) * (1 - smoothstep(0.88, 0.985, t))
        return (-amp * ribs + butt + strata) * win * keep, ribs * win * keep, strata * win

    def point(s, j):
        p = coast.at(s)
        dr, dy = rows[j]
        t = dy / H_REF
        th, sc = p["th"], p["s"]
        H = p["h"] + p["m_top"] - ROAD_Y
        wm = morro_w(p["m_top"])
        # tramo del muro de contención: cara lisa por debajo del muro
        keep = 1 - wall_mask(th) * (1 - smoothstep(0.24, 0.36, t))
        d, ribs, strata = disp(sc, t, p["core"], keep, wm)
        # pendiente lateral (∂r/∂s) para hornear el sombreado direccional
        slope = (disp(sc + 0.2, t, p["core"], keep, wm)[0] - disp(sc - 0.2, t, p["core"], keep, wm)[0]) / 0.4
        r = p["r1"] + dr + d
        win = smoothstep(0.02, 0.1, t) * (1 - smoothstep(0.88, 0.985, t))
        y = ROAD_Y + t * H + 0.1 * sn(sc / 3.0, t * 5.0 + 0.5) * win
        # normal aproximada de la cara desplazada (vertical): n̂ hacia el mar + R'·ŝ, y su
        # iluminación por la luz principal respecto a la cara sin costillas
        sx, sz = -p["sn"], p["c"]            # ŝ: dirección +θ
        nx, nz = -p["c"], -p["sn"]           # n̂: hacia el mar
        vx, vz = nx + slope * sx, nz + slope * sz
        inv = 1.0 / math.sqrt(vx * vx + vz * vz)
        lit = (vx * LIGHT_DIR[0] + vz * LIGHT_DIR[2]) * inv - (nx * LIGHT_DIR[0] + nz * LIGHT_DIR[2])
        back = clamp(-(nx * LIGHT_DIR[0] + nz * LIGHT_DIR[2]) * 1.5, 0.0, 1.0)   # cara a contraluz
        extras[(p["i"], j)] = (t, ribs, lit, strata, (sc / CLIFF_TILE, y / CLIFF_TILE), back)
        return pt(p, r, y)

    def color(s, j, v):
        p = coast.at(s)
        t, ribs, lit, strata, _uv, back = extras[(p["i"], j)]
        sc = p["s"]
        if j <= 1:  # berma: tierra y hierba seca
            n = fbm2(sc / 2.0, 0.3, 2)
            c = mix(PAL["cliff_dark"], PAL["dry_grass"], 0.3 + 0.45 * n)
            return shade(c, TEX_GAIN * (0.9 + 0.2 * sf(sc / 1.3, 7.0, 2)))
        crest = max(0.0, ribs)
        gully = max(0.0, -ribs)
        # degradado: oscuro abajo → ocre → arena pálida arriba
        c = mix(PAL["cliff_dark"], PAL["cliff_b"], smoothstep(0.0, 0.3, t))
        c = mix(c, PAL["cliff_a"], smoothstep(0.3, 0.6, t))
        c = mix(c, CLIFF_PALE, 0.5 * smoothstep(0.55, 1.0, t))
        # crestas más claras (arena seca), barrancos oscuros (sombra/humedad)
        c = mix(c, CLIFF_PALE, 0.55 * crest * smoothstep(0.15, 0.45, t))
        c = mix(c, GULLY_DARK, 0.55 * gully)
        # en el Morro y las colas (columnas ralas) el ruido fino de color produciría una rejilla
        wm = morro_w(p["m_top"])
        fine_w = p["core"] * (1 - wm)
        k = TEX_GAIN * (0.95 + 0.10 * fine_w * fbm2(sc / 3.0 + 9.0, t * 3.0 + 1.0, 3) + 0.05 * (1 - fine_w))
        k *= 1 - 0.6 * gully                                        # oclusión en los barrancos
        # sombreado horneado: flancos hacia la luz principal claros, los opuestos en sombra
        k *= 1 + 0.95 * clamp(lit, -0.7, 0.45) * smoothstep(0.03, 0.15, t)
        # estratos: muy sutiles, y el seno sólo donde hay columnas densas (evita hiladas de mampostería)
        # (periodo ≈ 5 u, resuelto por las 16 filas: a 2.4 u se aliasaba y producía bandas por fila)
        k *= 1 + 0.025 * smoothstep(0.5, 0.7, fine_w) * math.sin(t * H_REF * 1.25 + 3.0 * noise2(sc / 5.0, 0.2)) + 0.2 * strata
        # talud: tierra oscura con matas verdes (vegetación regada al pie) y algo de hierba seca
        tal = 1 - smoothstep(0.05, 0.22, t)
        if tal > 0:
            k = lerp(k, min(k, 0.9), tal)                           # el horneado no aclara el pie
        c = shade(c, k)
        if tal > 0:
            g = smoothstep(0.5, 0.66, fbm2(sc / 1.6 + 4.0, t * 9.0, 2))
            dry = smoothstep(0.6, 0.75, fbm2(sc / 2.3 + 9.0, t * 6.0 + 3.0, 2))
            base = mix(shade(DIRT, 0.62), PAL["dry_grass"], 0.25 * dry)
            c = mix(c, mix(base, shade(PAL["cliff_veg"], 0.7), g * 0.6), tal * 0.85)
        # vegetación colgante: cobertura variable a lo largo de la costa (tramos que cuelgan hasta
        # media altura y tramos casi desnudos), lenguas que bajan por los barrancos
        u = p["u"]
        vn = fbm2(sc / 9.0 + 1.0, t * 2.0 + 0.7, 2)
        vn2 = fbm2(sc / 5.0 + 8.0, t * 2.5, 3)
        lo = 0.45 + 0.3 * fbm2(sc / 28.0 + 2.0, 0.5, 2)
        lo -= 0.12 * smoothstep(-0.6, -0.45, u) * (1 - smoothstep(-0.15, 0.0, u))   # más verde a la izquierda de Larcomar
        lo += 0.14 * smoothstep(0.15, 0.25, u) * (1 - smoothstep(0.75, 0.9, u))     # más desnudo a la derecha
        veg = smoothstep(lo, lo + 0.25, t + 0.3 * (vn - 0.5) + 0.1 * gully) * smoothstep(0.44, 0.56, vn2)
        veg *= (1 - wm) ** 2                                        # nada de lenguas verdes en el Morro
        if veg > 0:
            green = mix(PAL["cliff_veg"], PAL["tree"], 0.5 * noise2(sc / 1.1, t * 7.0))
            green = shade(green, TEX_GAIN * (1 - 0.25 * gully))
            c = mix(c, green, veg * 0.92)
        # borde superior = césped del parque (continuidad con la meseta)
        if t > 0.975:
            c = mix(c, shade(park_color(sc, 0.0), TEX_GAIN), smoothstep(0.975, 0.995, t))
        # Morro Solar: roca seca (ruido de baja frecuencia, sin rejilla)
        if wm > 0:
            # la cara del Morro mira a -X y la luz principal viene de +X: la compensamos (×1.15) y
            # la mantenemos cálida para que no la vuelva gris la luz de relleno azul
            mc = shade(morro_color(v[0], v[1], v[2], p["m_top"] * t, 0.6),
                       TEX_GAIN * 1.3 * (1 - 0.4 * gully) * (1 + 0.5 * clamp(lit, -0.5, 0.3)))
            # a contraluz sólo le llega la luz de relleno azul: rebote cálido del suelo para que siga pardo
            mc = (min(1.0, mc[0] * (1 + 0.5 * back)), min(1.0, mc[1] * (1 + 0.25 * back)), mc[2], mc[3])
            c = mix(c, mc, wm * (0.9 + 0.1 * t))
        return c

    v, f, c = common.arc_grid(0.0, 1.0, coast.sw.n, len(rows), point, color)
    nrows = len(rows)
    uv = [None] * len(v)
    for (i, j), ex in extras.items():
        uv[i * nrows + j] = ex[4]
    uvs = [uv[k] for face in f for k in face]
    return common.new_mesh("terrain_acantilado", v, f, ctx.collection, colors=c, uvs=uvs, material=mat,
                           smooth=True, smooth_angle=35.0)


def build_wall(ctx, coast: Coast, mat):
    curve = catmull_rom(PROFILE, 32)
    dr_w, dy_w = next(q for q in curve if q[1] >= WALL_DY)
    sw = coast.sw
    i0, i1 = sw.index_of_theta(WALL_T0), sw.index_of_theta(WALL_T1)

    def rows_of(p):
        H = p["h"] + p["m_top"] - ROAD_Y
        y_w = ROAD_Y + dy_w / H_REF * H
        r1 = p["r1"]
        return (
            (r1 + 1.0, ROAD_Y + 0.01),                                          # enterrado en la berma
            (r1 + lerp(1.0, dr_w - 0.3, 0.5) - 0.1, lerp(ROAD_Y, y_w, 0.5)),   # ligero abombamiento
            (r1 + dr_w - 0.3, y_w),                                             # coronación
            (r1 + dr_w + 0.25, y_w - 0.12),                                     # remate dentro de la roca
        )

    def point(s, j):
        p = coast.at(s)
        return pt(p, *rows_of(p)[j])

    def color(s, j, v):
        p = coast.at(s)
        panel = hash2(math.floor(p["s"] / 2.4), 1.0)
        stain = fbm2(p["s"] / 0.7 + 3.0, j * 0.25, 2)           # chorreras verticales
        k = 0.62 + 0.1 * panel + 0.24 * stain
        if (p["s"] % 2.4) < 0.32:                               # junta entre paneles
            k *= 0.74
        k *= (0.5, 0.8, 1.0, 0.75)[j]                           # enterrado → coronación → remate
        return shade(CONCRETE_WALL, k)

    v, f, c = common.arc_grid(i0 / sw.n, i1 / sw.n, i1 - i0, 4, point, color)
    # tapas en los extremos (cierran el hueco entre el muro y la cara)
    for s_end, sign in ((i0 / sw.n, -1.0), (i1 / sw.n, 1.0)):
        p = coast.at(s_end)
        quad = [pt(p, r, y) for r, y in rows_of(p)]
        outward = (-p["sn"] * sign, 0.0, p["c"] * sign)   # dirección +θ (o −θ)
        o = len(v)
        v.extend(quad)
        c.extend([shade(CONCRETE_WALL, 0.6)] * 4)
        f.append(facing((o, o + 1, o + 2, o + 3), v, outward))
    return common.new_mesh("terrain_muro", v, f, ctx.collection, colors=c, material=mat, smooth=True, smooth_angle=35.0)


def build_plateau(ctx, coast: Coast, mat):
    sw = coast.sw
    i_split = sw.index_of_theta(-math.pi / 2 + 1.5 * 0.5)  # coast_u = 0.5: a la derecha empieza el Morro
    extras: dict = {}

    def make(rows_d):
        def point(s, j):
            p = coast.at(s)
            r = plateau_r(p, rows_d[j])
            x, z = r * p["c"], r * p["sn"]
            m = common.morro_h(x, z)
            extras[(p["i"], j)] = (r, m)
            return (x, p["h"] + m - 0.05, z)

        def color(s, j, v):
            p = coast.at(s)
            r, m = extras[(p["i"], j)]
            if j <= 2:
                c = park_color(p["s"], r - p["top"])
            else:
                n = fbm2(v[0] * 0.05, v[2] * 0.05, 2)
                c = shade(CONCRETE, 0.92 + 0.16 * n)
                # fundido suave a la bruma (el fog de R3F a 190 u lo termina); nunca sobre el Morro
                c = mix(c, mix(CONCRETE, PAL["haze"], 0.6), 0.45 * smoothstep(135.0, 200.0, r) * (1 - smoothstep(0.0, 0.3, m)))
            w = smoothstep(0.3, 2.5, m)
            if w > 0:
                c = mix(c, morro_color(v[0], v[1], v[2], m), w)
            return c

        return point, color

    point, color = make(PLATEAU_ROWS)
    v, f, c = common.arc_grid(0.0, i_split / sw.n, i_split, len(PLATEAU_ROWS), point, color)
    meseta = common.new_mesh("terrain_meseta", v, f, ctx.collection, colors=c, material=mat, smooth=True, smooth_angle=None)
    point, color = make(MORRO_ROWS)
    v, f, c = common.arc_grid(i_split / sw.n, 1.0, sw.n - i_split, len(MORRO_ROWS), point, color)
    morro = common.new_mesh("terrain_morro", v, f, ctx.collection, colors=c, material=mat, smooth=True, smooth_angle=None)
    return meseta, morro


def boulder(center, size, seed: float, segs: int = 6):
    """Roca low-poly (2 anillos + polos, ~20 tris) deformada con ruido. Devuelve (verts, faces)."""
    cx, cy, cz = center
    sx, sy, sz = size
    verts = [(cx, cy - sy * 0.35, cz)]
    for ring, (yy, rr) in enumerate(((-0.05, 0.95), (0.55, 0.7))):
        for k in range(segs):
            a = 2 * math.pi * (k + 0.5 * ring) / segs
            d = 1 + 0.35 * (hash2(seed + k * 1.7, ring * 3.3) - 0.5)
            verts.append((cx + sx * rr * d * math.cos(a), cy + sy * yy + 0.12 * sy * (hash2(k + seed, ring) - 0.5),
                          cz + sz * rr * d * math.sin(a)))
    verts.append((cx, cy + sy, cz))
    top = len(verts) - 1
    faces = []
    for k in range(segs):
        n = (k + 1) % segs
        faces.append((0, 1 + n, 1 + k))                                   # base (hacia abajo; enterrada)
        faces.append((1 + k, 1 + n, 1 + segs + n, 1 + segs + k))          # anillo
        faces.append((1 + segs + k, 1 + segs + n, top))                   # tapa
    # orientar cada cara hacia afuera del centro
    out = []
    for face in faces:
        mx = sum(verts[i][0] for i in face) / len(face) - cx
        my = sum(verts[i][1] for i in face) / len(face) - (cy + 0.3 * sy)
        mz = sum(verts[i][2] for i in face) / len(face) - cz
        out.append(facing(face, verts, (mx, my, mz)))
    return verts, out


def build_groynes(ctx, mat):
    r = ctx.rng(31)
    acc = Acc()
    fc = []
    na, nb = ctx.detail(12, 7), ctx.detail(6, 4)
    n_rocks = ctx.detail(16, 9)
    for k in range(8):
        u = -0.7 + 0.2 * k + r.uniform(-0.03, 0.03)
        th = -math.pi / 2 + 1.5 * u
        cr = common.coast_r(th)
        L = 6.0 + r.uniform(-0.8, 0.8)
        W = 2.6 + r.uniform(-0.3, 0.3)
        hmax = 0.55 + r.uniform(-0.08, 0.08)
        c, s_ = math.cos(th), math.sin(th)
        root = cr + 1.4
        seed = r.random() * 50

        def P(ia, ib, L=L, W=W, hmax=hmax, c=c, s_=s_, root=root, seed=seed):
            a = L * ia / na
            b = W * (0.5 - ib / nb)
            rr = root - a
            x = rr * c - b * s_
            z = rr * s_ + b * c
            bump = max(0.0, 1 - (abs(b) / (W / 2)) ** 1.7)
            fade = smoothstep(0.0, 0.18, a / L) * (1 - smoothstep(0.8, 1.0, a / L))
            top = lerp(hmax, 0.18, a / L)
            y = SEA_Y - 0.6 + (top + 0.6) * bump * fade + 0.12 * sn(a * 1.9 + seed, b * 2.3)
            return (x, y, z)

        def mound_y(a, b, L=L, W=W, hmax=hmax, seed=seed):
            bump = max(0.0, 1 - (abs(b) / (W / 2)) ** 1.7)
            fade = smoothstep(0.0, 0.18, a / L) * (1 - smoothstep(0.8, 1.0, a / L))
            return SEA_Y - 0.6 + (lerp(hmax, 0.18, a / L) + 0.6) * bump * fade + 0.12 * sn(a * 1.9 + seed, b * 2.3)

        v, f, _ = common.grid(na, nb, P)
        for face in f:
            ys = sum(v[i][1] for i in face) / 4
            n = hash2(face[0] * 0.37 + seed, 2.0)
            cc = mix(PAL["rock"], PAL["rock_light"], 0.3 + 0.6 * n)
            if ys < SEA_Y + 0.1:
                cc = shade(mix(cc, PAL["sea_floor"], 0.25), 0.7)
            fc.append(cc)
        acc.add(v, f)
        # bloques de roca sobre el montículo (más grandes en la raíz, se hunden hacia la punta)
        for q in range(n_rocks):
            a = L * (0.08 + 0.78 * q / max(1, n_rocks - 1)) + r.uniform(-0.2, 0.2)
            b = r.uniform(-0.3, 0.3) * W * (1 - 0.4 * a / L)
            sz = lerp(0.62, 0.36, a / L) * r.uniform(0.8, 1.2)
            y0 = mound_y(a, b)
            if y0 < SEA_Y - 0.2:
                continue
            rr = root - a
            x = rr * c - b * s_
            z = rr * s_ + b * c
            bv, bf = boulder((x, y0 - 0.1 * sz, z), (sz, sz * r.uniform(0.6, 0.85), sz * r.uniform(0.8, 1.1)),
                             seed + q * 3.1)
            # orientar con la dirección del espigón
            bv = [((px - x) * c - (pz - z) * s_ + x, py, (px - x) * s_ + (pz - z) * c + z) for px, py, pz in bv]
            tone = 0.25 + 0.6 * hash2(q * 0.73 + seed, 5.0)
            base_c = mix(PAL["rock"], PAL["rock_light"], tone)
            for face in bf:
                ny = sum(bv[i][1] for i in face) / len(face)
                cc = shade(base_c, 0.85 + 0.3 * hash2(face[0] + q, seed))
                if ny < SEA_Y + 0.05:
                    cc = shade(mix(cc, PAL["sea_floor"], 0.3), 0.7)
                fc.append(cc)
            acc.add(bv, bf)
    return common.new_mesh("terrain_espigones", acc.v, acc.f, ctx.collection, face_colors=fc, material=mat,
                           smooth=False, smooth_angle=None)


# ---------------------------------------------------------------------------
# build
# ---------------------------------------------------------------------------


def build(ctx: common.BuildContext):
    """Crea todo el relieve dentro de ctx.collection y devuelve la lista de objetos."""
    cols_per_rad = 290.0 if not ctx.fast else 150.0  # ≈ 960 / 500 columnas en el arco de la costa
    rib_scale = 1.0 if not ctx.fast else 1.3
    sw_fine = Sweep(cols_per_rad)          # acantilado y muro
    sw_mid = Sweep(cols_per_rad / 3.0)     # fondo marino, playa, pista, amarillas, meseta
    sw_low = Sweep(cols_per_rad / 6.0)     # bordillos y líneas de borde
    fine, mid, low = Coast(sw_fine), Coast(sw_mid), Coast(sw_low)

    m_ground = common.make_material("CV_terrain_ground", vcol=True, roughness=1.0)
    m_cliff = common.make_material("CV_terrain_cliff", vcol=True, roughness=1.0, image=cliff_texture())
    m_seafloor = common.make_material("CV_terrain_seafloor", vcol=True, roughness=0.75)
    m_asphalt = common.make_material("CV_terrain_asphalt", vcol=True, roughness=0.9)
    m_concrete = common.make_material("CV_terrain_concrete", vcol=True, roughness=0.85)
    m_marks = common.make_material("CV_terrain_marks", vcol=True, roughness=0.7)

    build_seafloor(ctx, mid, m_seafloor)
    build_beach(ctx, mid, m_ground)
    build_road(ctx, mid, m_asphalt)
    build_curbs(ctx, low, m_concrete)
    build_marks(ctx, mid, low, m_marks)
    rows = cliff_rows(ctx.detail(14, 8))
    build_cliff(ctx, fine, m_cliff, rows, rib_scale)
    build_wall(ctx, fine, m_concrete)
    build_plateau(ctx, mid, m_ground)
    build_groynes(ctx, m_ground)

    ctx.stats["cols_cliff"] = sw_fine.n
    ctx.stats["cols_mid"] = sw_mid.n
    ctx.stats["rows_cliff"] = len(rows)
    return list(ctx.collection.objects)
