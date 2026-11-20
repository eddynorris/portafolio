"""
Módulo `city`: la ciudad sobre la meseta del diorama "Costa Verde".

- Manzanas como sectores anulares alineados a la tangente de la costa (filas de 12 u de
  fondo desde `cliff_top_r + 8`, calles de 2 u en gris oscuro, vereda por manzana).
- Edificios con fachadas texturizadas (textura de ventanas de día + versión nocturna
  emisiva: material `CV_emissive_windows`), tinte por vertex color (crema, blanco, beige,
  gris azulado), variedad por `uv_offset`, tipos (bloque, podio + torre, remate retranqueado),
  pretiles, aletas verticales, azoteas con casetas, tanques de agua y antenas, balcones
  (salientes finos) en las torres del malecón.
- Hitos: Torre curva (JW Marriott), Larcomar (3 terrazas en la mitad superior del acantilado,
  fachada crema con bandas de ventana finas, talud corto que se funde con el terreno), hotel
  con azotea roja y piscina.
- Lejos (r > 125): bloques simples sin ventanas en PAL['haze'].

Toda la geometría se acumula en "lotes" (Batch) y se vuelca en un objeto por material:
city_buildings, city_solid, city_far, city_torre_curva, city_glass, city_rail, city_larcomar_glass.

El suelo de la ciudad se toma de terrain.py: meseta plana a cliff_h + morro_h - 0.05.
"""

from __future__ import annotations

import math
import sys

import numpy as np

import common
from common import PAL, clamp, col, mix, polar, shade

# ---------------------------------------------------------------------------
# Constantes del módulo
# ---------------------------------------------------------------------------

TEX_SIZE = 512
CELLS = 16                                  # ventanas (columnas) y pisos (filas) por textura
TILE = (16.0, 12.0)                         # unidades de mundo por repetición: 16 ventanas × 16 pisos
FLOOR = TILE[1] / CELLS                     # 0.75 u por piso (≈ 3 m)
CELL_W = TILE[0] / CELLS                    # 1.0 u por ventana
WALL_UV = (0.5, 29.5 / TEX_SIZE)            # texel de pared lisa (azoteas y caras sin ventanas)
PARK_W = 6.0                                # franja del parque (módulo park)
STREET = 2.0
FIRST_ROW_D = PARK_W + STREET               # la primera manzana empieza tras la calle del malecón
FAR_R = 125.0                               # a partir de aquí: bloques simples en haze
CITY_R_MAX = 170.0
SINK = 0.6                                  # cuánto se entierran las bases (nada flota)
SIDEWALK_H = 0.22                           # vereda sobre la meseta de terrain (h - 0.05)
STREET_H = 0.14                             # asfalto sobre la meseta
CURB_W = 0.12                               # bordillo claro alrededor de cada manzana
TORRE_TH = -math.pi / 2 - 0.22
HOTEL_TH = -math.pi / 2 - 0.45
LARCO_TH = -math.pi / 2
LARCO_HALF = 0.08
# Larcomar: desplazamientos radiales respecto a cliff_top_r (negativo = hacia el mar) y
# desniveles respecto a cliff_h. Están fuera de la envolvente del acantilado de terrain.py
# (perfil + costillas), para que el terreno pase por dentro del bloque y no asome.
LARCO_FRONT = -3.1
LARCO_R = (-4.4, -5.6, -6.8)
LARCO_T = (-2.2, -4.4, -6.6)
LARCO_BOTTOM = -9.4
LARCO_PLAZA_Y = 0.05                        # plaza-techo sobre cliff_h (el parque va a -0.05 ... +0.1)

C_ROOF = col("#b8b2a6")
C_SIDEWALK = col("#cfcabf")
C_STREET = col("#4e5158")
C_TANK = col("#2b2f36")
C_TANK_BLUE = col("#2d4f7a")
C_CASETA = col("#e2dccd")
C_ANTENNA = col("#5a5d63")
C_CREMA = col("#f3eadb")
C_TERRACE = col("#d9d3c5")
C_SOFFIT = col("#9a5737")                   # cornisa terracota (techos de los restaurantes de Larcomar)
C_GOLD = PAL["yellow_band"]
C_GLASS_DARK = PAL["glass_dark"]
C_POOL = col("#56c6e8")
C_TRUNK = PAL["trunk"]
C_TREE = PAL["tree"]
C_TREE_LIGHT = PAL["tree_light"]
C_FIN = (PAL["white"], col("#b9643f"), col("#8c9aa6"))
TINTS = PAL["building"]


def _emissive_strength() -> float:
    """
    1.0 en el GLB (React la escala con nightMix). Sólo en la previsualización diurna de
    preview.py se apaga para que las ventanas no brillen de día en los renders.
    """
    argv = sys.argv
    if any(str(a).endswith("preview.py") for a in argv) and "--night" not in argv and "--export" not in argv:
        return 0.0
    return 1.0


# ---------------------------------------------------------------------------
# Terreno bajo la ciudad (la meseta de terrain.py)
# ---------------------------------------------------------------------------


def ground_y(x: float, z: float) -> float:
    """Altura de la meseta en (x, z): igual que terrain_meseta (cliff_h + morro_h - 0.05)."""
    th = math.atan2(z, x)
    return common.cliff_h(th) + common.morro_h(x, z) - 0.05


def frame(th: float):
    """Vectores unitarios (x, z): e_s a lo largo de la costa (+θ), e_t radial hacia afuera."""
    return (-math.sin(th), math.cos(th)), (math.cos(th), math.sin(th))


def pquad(th0: float, th1: float, r0: float, r1: float):
    """Esquinas (x, z) del sector anular [r0, r1] × [th0, th1]."""
    return [polar(r0, th0), polar(r0, th1), polar(r1, th1), polar(r1, th0)]


# ---------------------------------------------------------------------------
# Texturas de ventanas (día + noche)
# ---------------------------------------------------------------------------


def _window_textures(seed: int):
    """Dos estilos de ventana (columnas 0-7: ventana clásica; 8-15: ventanal con baranda)."""
    rs = np.random.RandomState(seed)
    S, C = TEX_SIZE, CELLS
    cell = S // C
    yy, xx = np.mgrid[0:S, 0:S]
    cx, cy = xx % cell, yy % cell
    ix, iy = xx // cell, yy // cell
    style_b = ix >= C // 2

    # estilo A: ventana grande 20 × 16 px con marco de 1 px; estilo B: ventanal corrido de
    # pared a pared con baranda oscura encima y montantes cada 8 px (banda horizontal)
    win_a = (cx >= 6) & (cx < 26) & (cy >= 8) & (cy < 24) & ~style_b
    win_b = (cx >= 1) & (cx < 31) & (cy >= 10) & (cy < 26) & style_b
    rail_b = (cx >= 1) & (cx < 31) & (cy >= 6) & (cy < 10) & style_b
    frame_a = (cx >= 5) & (cx < 27) & (cy >= 7) & (cy < 25) & ~style_b & ~win_a
    frame_b = (cy >= 9) & (cy < 27) & style_b & ~win_b & ~rail_b
    slab = cy < 2
    under = (cy >= 26) & (cy < 28)             # sombra bajo la losa del piso siguiente
    win = win_a | win_b
    mullion = win & ((((cx == 15) | (cx == 16)) & ~style_b) | ((((cx % 8) == 0) | ((cx % 8) == 7)) & style_b))
    t_v = np.clip((cy - 8) / 16.0, 0, 1)      # 0 abajo → 1 arriba de la ventana

    # ---- día: pared casi blanca (la tiñe el vertex color), ventanas de vidrio azulado
    day = np.ones((S, S, 4), np.float32)
    base = 0.965 + (rs.rand(S, S) - 0.5) * 0.03 + ((rs.rand(C) - 0.5) * 0.02)[ix]
    for k in range(3):
        day[..., k] = base
    day[under, :3] = 0.90
    day[slab, :3] = 0.84
    day[frame_a, :3] = 0.92
    day[frame_b, :3] = 0.80
    day[rail_b, :3] = np.array([0.40, 0.42, 0.45], np.float32)
    kind = rs.rand(C, C)[iy, ix]
    g_lo = np.array([0.40, 0.50, 0.61], np.float32)
    g_hi = np.array([0.70, 0.78, 0.86], np.float32)
    glass = g_lo[None, None, :] + (g_hi - g_lo)[None, None, :] * t_v[..., None]
    curtain = np.array([0.84, 0.80, 0.74], np.float32)[None, None, :] * (0.92 + 0.08 * t_v[..., None])
    dark = np.array([0.20, 0.26, 0.34], np.float32)[None, None, :] * (0.9 + 0.3 * t_v[..., None])
    pix = np.where((kind < 0.25)[..., None], curtain, np.where((kind > 0.94)[..., None], dark, glass))
    day[win, :3] = pix[win]
    day[mullion, :3] *= 0.78

    # ---- noche: negro salvo ventanas encendidas al azar en tonos cálidos
    night = np.zeros((S, S, 4), np.float32)
    night[..., 3] = 1.0
    lit = (rs.rand(C, C) < 0.42)[iy, ix]
    hue = rs.rand(C, C)[iy, ix]
    inten = (0.55 + 0.45 * rs.rand(C, C))[iy, ix]
    c_warm = np.array([1.00, 0.78, 0.46], np.float32)
    c_soft = np.array([1.00, 0.90, 0.68], np.float32)
    c_cool = np.array([0.93, 0.96, 0.92], np.float32)
    c_tv = np.array([0.60, 0.76, 1.00], np.float32)
    ncol = np.where((hue < 0.55)[..., None], c_warm,
                    np.where((hue < 0.80)[..., None], c_soft,
                             np.where((hue < 0.93)[..., None], c_cool, c_tv)))
    ncol = ncol * inten[..., None] * (0.85 + 0.15 * t_v[..., None])
    mask = win & lit & ~mullion
    night[mask, :3] = ncol[mask]
    return day, night


# ---------------------------------------------------------------------------
# Lote de geometría: acumula caras y crea un solo objeto por material
# ---------------------------------------------------------------------------


def _orient(poly):
    """Polígono (x, z) ordenado para que su tapa mire a +Y (sentido horario visto desde arriba)."""
    n = len(poly)
    area = sum(poly[i][0] * poly[(i + 1) % n][1] - poly[(i + 1) % n][0] * poly[i][1] for i in range(n))
    return list(poly) if area < 0 else list(poly)[::-1]


def _ccw_section(sec):
    """Sección (r, y) en sentido antihorario (normales hacia afuera al barrerla en +θ)."""
    n = len(sec)
    area = sum(sec[i][0] * sec[(i + 1) % n][1] - sec[(i + 1) % n][0] * sec[i][1] for i in range(n))
    return list(sec) if area > 0 else list(sec)[::-1]


class Batch:
    def __init__(self, name: str, material, textured: bool = False, smooth: bool = False, smooth_angle=None):
        self.name = name
        self.material = material
        self.textured = textured
        self.smooth = smooth
        self.smooth_angle = smooth_angle
        self.verts: list = []
        self.faces: list = []
        self.colors: list = []
        self.uvs: list = []

    # -- primitivas
    def face(self, idx, color, uv=None) -> None:
        self.faces.append(tuple(idx))
        self.colors.append(color)
        if self.textured:
            self.uvs.extend(uv if uv is not None else [WALL_UV] * len(idx))

    def prism(self, poly, y0, y1, c_side, c_top=None, uv=None, bottom: bool = False, side_colors=None) -> None:
        """
        Prisma vertical: poly = [(x, z)...], base y0, tapa y1 (número o lista por vértice de poly).
        uv = (ou, ov, y_ref, span): fachada texturizada; cada cara empieza en una columna de
        ventanas y cabe un número entero de ventanas (se estiran ±25 %). span = celdas libres
        a la derecha de ou dentro del estilo (para no cruzar al otro estilo).
        side_colors: color por cara lateral (lista) en el orden del polígono orientado.
        """
        pts = _orient(poly)
        n = len(pts)
        if isinstance(y1, (list, tuple)):
            lookup = {p: h for p, h in zip(poly, y1)}
            tops = [lookup[p] for p in pts]
        else:
            tops = [y1] * n
        base = len(self.verts)
        for (x, z) in pts:
            self.verts.append((x, y0, z))
        for (x, z), h in zip(pts, tops):
            self.verts.append((x, h, z))
        c_top = c_top if c_top is not None else c_side
        for i in range(n):
            j = (i + 1) % n
            idx = (base + i, base + j, base + n + j, base + n + i)
            uvq = None
            if uv is not None and self.textured:
                ou, ov, y_ref, span = uv
                seg = math.dist(pts[i], pts[j])
                cells = max(1, round(seg / CELL_W))
                u0 = ou + min(span, max(0, CELLS // 2 - cells)) / CELLS
                u1 = u0 + cells / CELLS
                vb = ov + (y0 - y_ref) / TILE[1]
                uvq = [(u0, vb), (u1, vb), (u1, ov + (tops[j] - y_ref) / TILE[1]), (u0, ov + (tops[i] - y_ref) / TILE[1])]
            c = side_colors[i % len(side_colors)] if side_colors else c_side
            self.face(idx, c, uvq)
        self.face(tuple(base + n + i for i in range(n)), c_top)
        if bottom:
            self.face(tuple(base + i for i in range(n))[::-1], c_side)

    def box(self, cx, cz, w, d, y0, y1, yaw, c_side, c_top=None, uv=None, bottom=False) -> None:
        """Caja: centro (cx, cz), w a lo largo de la costa (e_s), d radial (e_t), yaw = θ."""
        e_s, e_t = frame(yaw)
        poly = [(cx + s * e_s[0] + t * e_t[0], cz + s * e_s[1] + t * e_t[1])
                for s, t in ((-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2))]
        self.prism(poly, y0, y1, c_side, c_top, uv=uv, bottom=bottom)

    def quad(self, pts, color) -> None:
        """Cara horizontal suelta: pts = [(x, y, z)] × 4 en (x, z) cualquiera; mira a +Y."""
        order = _orient([(p[0], p[2]) for p in pts])
        lookup = {(p[0], p[2]): p for p in pts}
        base = len(self.verts)
        for q in order:
            self.verts.append(lookup[q])
        self.face(tuple(base + i for i in range(4)), color)

    def cylinder(self, cx, cy, cz, r, h, segs, c_side, c_top=None) -> None:
        ring = [(cx + r * math.cos(2 * math.pi * k / segs), cz + r * math.sin(2 * math.pi * k / segs)) for k in range(segs)]
        self.prism(ring, cy, cy + h, c_side, c_top)

    def cone(self, cx, cy, cz, r, h, segs, color, bottom: bool = True) -> None:
        ring = _orient([(cx + r * math.cos(2 * math.pi * k / segs), cz + r * math.sin(2 * math.pi * k / segs)) for k in range(segs)])
        base = len(self.verts)
        for (x, z) in ring:
            self.verts.append((x, cy, z))
        apex = len(self.verts)
        self.verts.append((cx, cy + h, cz))
        for i in range(segs):
            self.face((base + i, base + (i + 1) % segs, apex), color)
        if bottom:
            self.face(tuple(base + i for i in range(segs))[::-1], color)

    def blob(self, cx, cy, cz, r, segs, c_lo, c_hi, squash: float = 1.0) -> None:
        """Esfera low-poly (copa de árbol) centrada en (cx, cy, cz)."""
        rings = []
        for ang in (math.radians(55), math.radians(115)):
            rr, y = r * math.sin(ang), cy + r * squash * math.cos(ang)
            pts = _orient([(cx + rr * math.cos(2 * math.pi * k / segs + 0.3), cz + rr * math.sin(2 * math.pi * k / segs + 0.3)) for k in range(segs)])
            base = len(self.verts)
            for (x, z) in pts:
                self.verts.append((x, y, z))
            rings.append(base)
        top = len(self.verts)
        self.verts.append((cx, cy + r * squash, cz))
        bot = len(self.verts)
        self.verts.append((cx, cy - r * squash, cz))
        up, lo = rings
        for i in range(segs):
            j = (i + 1) % segs
            self.face((up + i, up + j, top), c_hi)
            self.face((lo + i, lo + j, up + j, up + i), mix(c_lo, c_hi, 0.5))
            self.face((lo + j, lo + i, bot), c_lo)

    def stack(self, ring, levels, c_top, tops=None, cap: bool = True) -> int:
        """
        Tubo apilado: `ring` = [(x, z)...], levels = [(y, color)] ascendentes (el color es el de la
        banda que SUBE desde ese nivel; el último color no se usa). `tops`: alturas por vértice
        del último anillo (remate curvo). Devuelve el índice del primer vértice del último anillo.
        """
        pts = _orient(ring)
        n = len(pts)
        base = len(self.verts)
        m = len(levels)
        for li, (y, _) in enumerate(levels):
            if li == m - 1 and tops is not None:
                lookup = {p: h for p, h in zip(ring, tops)}
                for (x, z) in pts:
                    self.verts.append((x, lookup[(x, z)], z))
            else:
                for (x, z) in pts:
                    self.verts.append((x, y, z))
        for li in range(m - 1):
            a, b = base + li * n, base + (li + 1) * n
            c = levels[li][1]
            for i in range(n):
                j = (i + 1) % n
                self.face((a + i, a + j, b + j, b + i), c)
        last = base + (m - 1) * n
        if cap:
            self.face(tuple(last + i for i in range(n)), c_top)
        return last

    def loft(self, rings, edge_colors, cap_color=None, caps: bool = True, color_fn=None) -> None:
        """
        Une anillos consecutivos (listas de (x, y, z) three del mismo tamaño) con quads.
        Cada anillo es una sección CCW en el plano (r, y) barrida en +θ (normales hacia afuera).
        edge_colors[k] colorea la cara barrida por la arista k→k+1 (o color_fn(k, i) por
        arista k y tramo i); caps = tapas en los extremos.
        """
        m = len(rings[0])
        base = len(self.verts)
        for ring in rings:
            self.verts.extend(ring)
        for i in range(len(rings) - 1):
            a, b = base + i * m, base + (i + 1) * m
            for k in range(m):
                k2 = (k + 1) % m
                c = color_fn(k, i) if color_fn is not None else edge_colors[k % len(edge_colors)]
                self.face((a + k, a + k2, b + k2, b + k), c)
        if caps:
            cc = cap_color if cap_color is not None else edge_colors[0]
            self.face(tuple(base + k for k in range(m))[::-1], cc)
            self.face(tuple(base + (len(rings) - 1) * m + k for k in range(m)), cc)

    # -- volcado
    def build(self, ctx: common.BuildContext):
        if not self.faces:
            return None
        return common.new_mesh(
            self.name, self.verts, self.faces, ctx.collection,
            face_colors=self.colors, uvs=(self.uvs if self.textured else None),
            material=self.material, smooth=self.smooth, smooth_angle=self.smooth_angle,
        )

    @property
    def tris(self) -> int:
        return sum(len(f) - 2 for f in self.faces)


# ---------------------------------------------------------------------------
# Piezas repetidas
# ---------------------------------------------------------------------------


def add_tree(B: Batch, x: float, y: float, z: float, r: float, trunk_h: float, segs: int, k: float = 1.0) -> None:
    B.box(x, z, 0.16, 0.16, y - 0.3, y + trunk_h, 0.0, C_TRUNK, C_TRUNK)
    B.blob(x, y + trunk_h + r * 0.75, z, r, segs, shade(C_TREE, k), shade(C_TREE_LIGHT, k), squash=0.85)


def add_umbrella(B: Batch, x: float, y: float, z: float, color, segs: int, r: float = 0.55, pole: float = 0.95) -> None:
    B.box(x, z, 0.05, 0.05, y, y + pole, 0.0, PAL["white"], PAL["white"])
    B.cone(x, y + pole - 0.05, z, r, 0.32, segs, color)


def add_parapet(B: Batch, cx, cz, w, d, yaw, y_top, color, h: float = 0.3, t: float = 0.16) -> None:
    """Pretil fino alrededor de una azotea de w × d (centro cx, cz)."""
    e_s, e_t = frame(yaw)
    for s, tt, ww, dd in ((0, -d / 2 + t / 2, w, t), (0, d / 2 - t / 2, w, t), (-w / 2 + t / 2, 0, t, d - 2 * t), (w / 2 - t / 2, 0, t, d - 2 * t)):
        px, pz = cx + s * e_s[0] + tt * e_t[0], cz + s * e_s[1] + tt * e_t[1]
        B.box(px, pz, ww, dd, y_top - 0.05, y_top + h, yaw, color, color)


def add_roof_details(B: Batch, r: "random.Random", cx, cz, w, d, yaw, y_top, tint, detail: int) -> None:
    """Caseta de escalera, tanques de agua y antenas sobre una azotea de w × d (centro cx, cz)."""
    e_s, e_t = frame(yaw)

    def at(s, t):
        return cx + s * e_s[0] + t * e_t[0], cz + s * e_s[1] + t * e_t[1]

    if w < 2.6 or d < 2.6:
        return
    # caseta (sala de máquinas / escalera)
    if r.random() < 0.65:
        cw, cd = min(w * 0.4, 1.4 + r.random() * 1.2), min(d * 0.4, 1.4 + r.random() * 1.0)
        s = (r.random() - 0.5) * (w - cw - 0.7)
        t = (r.random() - 0.5) * (d - cd - 0.7)
        px, pz = at(s, t)
        B.box(px, pz, cw, cd, y_top - 0.05, y_top + 0.7 + r.random() * 0.5, yaw, mix(tint, C_CASETA, 0.5), C_ROOF)
    if detail <= 0:
        return
    # tanques de agua (negros o azules) cerca de un borde
    if r.random() < 0.7:
        n_t = 1 + (r.random() < 0.5) + (r.random() < 0.25)
        side = 1 if r.random() < 0.5 else -1
        for i in range(n_t):
            s = (-(n_t - 1) / 2 + i) * 0.9 + (r.random() - 0.5) * 0.3
            t = side * (d / 2 - 0.7)
            if abs(s) > w / 2 - 0.6:
                continue
            px, pz = at(s, t)
            rad = 0.3 + r.random() * 0.12
            ctank = C_TANK if r.random() < 0.7 else C_TANK_BLUE
            B.cylinder(px, y_top - 0.02, pz, rad, 0.55 + r.random() * 0.3, 7, ctank, shade(ctank, 1.25))
    # antena / mástil
    if r.random() < 0.45:
        s = (r.random() - 0.5) * (w - 1.2)
        t = (r.random() - 0.5) * (d - 1.2)
        px, pz = at(s, t)
        h = 1.6 + r.random() * 1.6
        B.box(px, pz, 0.08, 0.08, y_top - 0.02, y_top + h, yaw, C_ANTENNA, C_ANTENNA)
        if r.random() < 0.5:
            B.box(px, pz, 0.6, 0.08, y_top + h * 0.8, y_top + h * 0.8 + 0.06, yaw, C_ANTENNA, C_ANTENNA)


# ---------------------------------------------------------------------------
# Edificios regulares
# ---------------------------------------------------------------------------


def building(B_tex: Batch, B_solid: Batch, r: "random.Random", th0, th1, r0, r1, floors: int, tint, detail: int,
             balconies: bool = False) -> None:
    corners = pquad(th0, th1, r0, r1)
    gys = [ground_y(x, z) for (x, z) in corners]
    g_ref = max(gys)
    y0 = min(gys) - SINK
    top = g_ref + floors * FLOOR
    style = 0 if r.random() < 0.55 else 1
    ou = (style * (CELLS // 2)) / CELLS
    span = r.randrange(CELLS // 2)
    ov = r.randrange(CELLS) / CELLS
    uv = (ou, ov, g_ref, span)
    roof = mix(tint, C_ROOF, 0.65)

    thc = (th0 + th1) / 2
    rc = (r0 + r1) / 2
    cx, cz = polar(rc, thc)
    w = (th1 - th0) * rc
    d = r1 - r0

    kind = "plain"
    if floors >= 9 and w >= 5.0 and d >= 4.5:
        k = r.random()
        if k < 0.28:
            kind = "podium"          # base de 2 pisos a todo el lote + torre retranqueada
        elif k < 0.52:
            kind = "crown"           # últimos 3 pisos retranqueados
    roof_w, roof_d, roof_y = w, d, top
    if kind == "podium":
        base_top = g_ref + 2 * FLOOR
        B_tex.prism(corners, y0, base_top, tint, roof, uv=uv)
        ins = 0.7
        inner = pquad(th0 + ins / rc, th1 - ins / rc, r0 + ins, r1 - ins)
        B_tex.prism(inner, base_top - 0.3, top, tint, roof, uv=uv)
        if detail > 0:
            add_parapet(B_solid, cx, cz, w, d, thc, base_top, mix(tint, PAL["white"], 0.4), h=0.25, t=0.14)
        roof_w, roof_d = w - 2 * ins, d - 2 * ins
    elif kind == "crown":
        main_top = g_ref + (floors - 3) * FLOOR
        B_tex.prism(corners, y0, main_top, tint, roof, uv=uv)
        ins = 0.8
        inner = pquad(th0 + ins / rc, th1 - ins / rc, r0 + ins, r1 - ins)
        B_tex.prism(inner, main_top - 0.3, top, tint, roof, uv=uv)
        if detail > 0:
            add_parapet(B_solid, cx, cz, w, d, thc, main_top, mix(tint, PAL["white"], 0.4))
        roof_w, roof_d = w - 2 * ins, d - 2 * ins
    else:
        B_tex.prism(corners, y0, top, tint, roof, uv=uv)

    if detail > 0:
        add_parapet(B_solid, cx, cz, roof_w, roof_d, thc, roof_y, mix(tint, PAL["white"], 0.4))
    add_roof_details(B_solid, r, cx, cz, roof_w, roof_d, thc, roof_y, tint, detail)

    # aleta vertical de color (caja de escaleras / acento) en la cara del mar
    if detail > 0 and kind == "plain" and floors >= 8 and r.random() < 0.22:
        e_s, e_t = frame(thc)
        s = (r.random() - 0.5) * (w - 1.6)
        px, pz = cx + s * e_s[0] - (d / 2 + 0.1) * e_t[0], cz + s * e_s[1] - (d / 2 + 0.1) * e_t[1]
        cf = C_FIN[r.randrange(len(C_FIN))]
        B_solid.box(px, pz, 0.55, 0.26, y0, top + 0.35, thc, cf, cf)

    if balconies and detail > 0:
        # salientes finos hacia el mar (cara r0), uno por piso, en el 60 % central del ancho
        dth = (th1 - th0)
        a0, a1 = th0 + dth * 0.2, th1 - dth * 0.2
        slab_c = mix(tint, C_ROOF, 0.3)
        rail_c = PAL["white"]
        n_f = floors if kind != "crown" else floors - 3
        for f in range(1, n_f):
            y = g_ref + f * FLOOR
            B_solid.prism(pquad(a0, a1, r0 - 0.45, r0 + 0.04), y, y + 0.1, slab_c, slab_c, bottom=True)
            B_solid.prism(pquad(a0, a1, r0 - 0.45, r0 - 0.39), y + 0.1, y + 0.42, rail_c, rail_c)


def far_block(B_far: Batch, r: "random.Random", th0, th1, r0, r1, floors: int) -> None:
    corners = pquad(th0, th1, r0, r1)
    gys = [ground_y(x, z) for (x, z) in corners]
    y0 = min(gys) - SINK
    top = max(gys) + floors * FLOOR
    # degradado con la distancia: de crema apagado (junto a la ciudad texturizada) a bruma
    rr = math.hypot(*polar((r0 + r1) / 2, (th0 + th1) / 2))
    fade = common.smoothstep(FAR_R, CITY_R_MAX, rr)
    c = mix(mix(TINTS[1], PAL["haze"], 0.7), PAL["haze"], fade)
    B_far.prism(corners, y0, top, c, shade(c, 0.88))


# ---------------------------------------------------------------------------
# Hitos
# ---------------------------------------------------------------------------


def torre_curva(ctx: common.BuildContext, B_tower: Batch, B_solid: Batch, reserved: list) -> None:
    """Torre curva estilo JW Marriott: planta elíptica 7 × 4.5, 26 u, vidrio azul con bandas doradas."""
    th = TORRE_TH
    rr = common.cliff_top_r(th) + 12.0
    cx, cz = polar(rr, th)
    gy = ground_y(cx, cz)
    segs = ctx.detail(32, 16)
    a, b = 3.5, 2.25
    e_s, e_t = frame(th)
    ring, along = [], []
    for k in range(segs):
        ang = 2 * math.pi * k / segs
        s, t = a * math.cos(ang), b * math.sin(ang)
        ring.append((cx + s * e_s[0] + t * e_t[0], cz + s * e_s[1] + t * e_t[1]))
        along.append(s)
    H = 26.0
    y = gy - SINK
    levels = [(y, C_GLASS_DARK)]
    glass_h, band_h = 1.38, 0.22
    while y + glass_h + band_h <= gy + H - 1.0 + 1e-6:
        y += glass_h
        levels.append((y, C_GOLD))
        y += band_h
        levels.append((y, C_GLASS_DARK))
    # remate curvo: el pretil sube en arco hacia el centro de la fachada larga
    tops = [gy + H + 1.1 * (1 - (s / a) ** 2) for s in along]
    levels.append((gy + H, C_GLASS_DARK))
    last = B_tower.stack(ring, levels, C_GLASS_DARK, tops=tops, cap=False)
    # pretil con espesor: anillo interior y coronación
    inner = [(cx + (p[0] - cx) * 0.9, cz + (p[1] - cz) * 0.9) for p in ring]
    pts_o = _orient(ring)
    pts_i = _orient(inner)
    n = len(pts_o)
    base_i = len(B_tower.verts)
    lookup = {p: h for p, h in zip(ring, tops)}
    for p_o, p_i in zip(pts_o, pts_i):
        B_tower.verts.append((p_i[0], lookup[p_o], p_i[1]))
    for p_i in pts_i:
        B_tower.verts.append((p_i[0], gy + H - 0.35, p_i[1]))
    for i in range(n):
        j = (i + 1) % n
        B_tower.face((last + i, last + j, base_i + j, base_i + i), C_GOLD)             # coronación
        B_tower.face((base_i + i, base_i + j, base_i + n + j, base_i + n + i), C_GLASS_DARK)  # cara interior (mira al centro)
    B_tower.face(tuple(base_i + n + i for i in range(n)), C_ROOF)                   # azotea
    # podio bajo (recepción) con marquesina y caseta de ascensores
    B_solid.box(cx, cz, 10.5, 7.5, gy - SINK, gy + 1.5, th, C_CREMA, C_ROOF)
    B_solid.box(cx, cz, 2.0, 5.5, gy + H + 0.0, gy + H + 0.6, th, C_CASETA, C_ROOF)
    mx, mz = cx - 4.2 * e_t[0], cz - 4.2 * e_t[1]
    B_solid.box(mx, mz, 4.0, 1.6, gy + 1.5, gy + 1.62, th, PAL["white"], PAL["white"], bottom=True)
    for s in (-1.6, 1.6):
        B_solid.box(mx + s * e_s[0], mz + s * e_s[1], 0.12, 0.12, gy - 0.1, gy + 1.5, th, PAL["white"], PAL["white"])
    reserved.append((th - 6.5 / rr, th + 6.5 / rr, rr - 5.5, rr + 5.5))


def hotel(ctx: common.BuildContext, B_tex: Batch, B_solid: Batch, B_glass: Batch, r: "random.Random", reserved: list) -> None:
    """Hotel del malecón izquierdo: fachada crema, azotea roja con piscina y sombrillas rojas."""
    th = HOTEL_TH
    rc = common.cliff_top_r(th) + 12.5
    w, d = 11.0, 8.0
    th0, th1 = th - w / 2 / rc, th + w / 2 / rc
    r0, r1 = rc - d / 2, rc + d / 2
    corners = pquad(th0, th1, r0, r1)
    gys = [ground_y(x, z) for (x, z) in corners]
    g_ref, y0 = max(gys), min(gys) - SINK
    floors = 9
    top = g_ref + floors * FLOOR
    tint = TINTS[0]
    B_tex.prism(corners, y0, top, tint, shade(PAL["red"], 0.9), uv=(0.0, 0.25, g_ref, 2))
    cx, cz = polar(rc, th)
    e_s, e_t = frame(th)

    def at(s, t):
        return cx + s * e_s[0] + t * e_t[0], cz + s * e_s[1] + t * e_t[1]

    # pretil rojo alrededor
    for s, t, ww, dd in ((0, -d / 2 + 0.1, w, 0.2), (0, d / 2 - 0.1, w, 0.2), (-w / 2 + 0.1, 0, 0.2, d), (w / 2 - 0.1, 0, 0.2, d)):
        px, pz = at(s, t)
        B_solid.box(px, pz, ww, dd, top - 0.05, top + 0.45, th, shade(PAL["red"], 0.9), PAL["red"])
    # piscina: borde blanco + agua
    px, pz = at(-1.2, -0.8)
    B_solid.box(px, pz, 4.8, 3.2, top - 0.02, top + 0.22, th, PAL["white"], PAL["white"])
    B_glass.box(px, pz, 4.3, 2.7, top + 0.12, top + 0.24, th, C_POOL, C_POOL)
    # caseta, sombrillas rojas y tumbonas
    px, pz = at(w / 2 - 1.6, d / 2 - 1.3)
    B_solid.box(px, pz, 2.2, 1.8, top - 0.05, top + 1.0, th, C_CREMA, C_ROOF)
    segs = ctx.detail(8, 6)
    for s, t in ((-3.6, 1.6), (-1.2, 1.6), (1.4, -1.6), (-3.8, -1.8), (1.6, 0.9)):
        px, pz = at(s, t)
        add_umbrella(B_solid, px, top + 0.15, pz, PAL["red"], segs, r=0.5, pole=0.85)
    # marquesina de entrada (lado mar) y letrero
    mx, mz = at(0.0, -d / 2 - 0.9)
    B_solid.box(mx, mz, 4.5, 1.8, g_ref + 1.4, g_ref + 1.55, th, shade(PAL["red"], 0.9), PAL["red"], bottom=True)
    for s in (-1.9, 1.9):
        qx, qz = at(s, -d / 2 - 1.6)
        B_solid.box(qx, qz, 0.12, 0.12, g_ref - 0.1, g_ref + 1.4, th, PAL["white"], PAL["white"])
    reserved.append((th0 - 1.2 / rc, th1 + 1.2 / rc, r0 - 1.2, r1 + 1.2))


def larcomar(ctx: common.BuildContext, B_solid: Batch, B_rail: Batch, B_lit: Batch, r: "random.Random") -> None:
    """
    Centro comercial en terrazas incrustado en la MITAD SUPERIOR del acantilado (θ = -π/2 ± 0.08).
    Bloque sólido cerrado: la sección (r_off, y_off) relativa a (cliff_top_r(θ), cliff_h(θ))
    envuelve la cara del acantilado (el terreno de terrain.py pasa por dentro). Bajo la última
    terraza un talud corto (~3.4 u, color del acantilado) se mete dentro del terreno; debajo lo
    pone terrain.py. En los extremos los niveles se recogen hacia el cerro (planta redondeada),
    con tope en la cresta de las costillas del terreno para que nada asome por la fachada.
    """
    th0, th1 = LARCO_TH - LARCO_HALF, LARCO_TH + LARCO_HALF
    n = ctx.detail(32, 16)
    F = LARCO_FRONT
    R0, R1, R2 = LARCO_R
    T0, T1, T2 = LARCO_T
    BOT = LARCO_BOTTOM
    PZ = LARCO_PLAZA_Y
    CAP_DT = 0.003                       # muro de cierre: las tapas van 0.25 u más afuera en θ

    def bulge(th):
        u = (th - LARCO_TH) / LARCO_HALF
        return -1.1 * max(0.0, 1 - u * u)        # fachada convexa hacia el mar

    def base_r(th):
        return common.cliff_top_r(th) + bulge(th)

    def base_h(th):
        return common.cliff_h(th)

    def taper(th):
        """0 en el centro → 1 en los extremos: los niveles bajos se recogen hacia el acantilado."""
        return common.smoothstep(0.45, 1.0, abs((th - LARCO_TH) / LARCO_HALF))

    # niveles (fachada superior, terrazas 1-3): (ro en el centro, recogida máxima en los extremos,
    # tope de recogida = cresta de las costillas del terreno a esa altura menos margen)
    LEVELS = ((F, 0.2, -2.9), (R0, 0.7, -3.85), (R1, 2.4, -5.05), (R2, 3.6, -5.05))

    def lvl_r(th, k):
        ro, tap, cap = LEVELS[k]
        return min(ro + tap * taper(th), cap)

    def L(k, dro: float = 0.0, cap=None):
        def f(th):
            v = lvl_r(th, k) + dro
            return v if cap is None else min(v, cap)
        return f

    def A(ro: float):
        return lambda th: ro

    # talud bajo la última terraza: se recoge a ~45° y en los extremos se mete antes dentro del
    # terreno (ro mayor = más adentro), así el talud es un "mentón" corto y redondeado, no un pedestal
    def TAL1(th):
        return min(lvl_r(th, 3) + 1.2, -4.55) + 0.45 * taper(th)      # -5.6 centro → -4.1 extremos

    def TAL2(th):
        return -4.9 + 0.7 * taper(th)                                   # -4.9 centro → -4.2 extremos

    def ring_at(th, pts):
        """Sección [(fn_ro, y_rel, ...)] → anillo (x, y, z) three en θ."""
        rr, hh = base_r(th), base_h(th)
        out = []
        for p in pts:
            x, z = polar(rr + p[0](th), th)
            out.append((x, hh + p[1], z))
        return out

    def area_of(pts, th):
        absv = [(p[0](th), p[1]) for p in pts]
        m = len(absv)
        return sum(absv[i][0] * absv[(i + 1) % m][1] - absv[(i + 1) % m][0] * absv[i][1] for i in range(m))

    def ccw(pts, th=LARCO_TH):
        """Sección en sentido antihorario en el plano (ro, y) → normales hacia afuera al barrer en +θ."""
        return list(pts) if area_of(pts, th) > 0 else list(pts)[::-1]

    # (ro(θ), y relativa a cliff_h, etiqueta de la arista que SALE de este punto)
    section = [
        (A(0.3), PZ, "plaza"),
        (L(0), PZ, "facade"),
        (L(0), T0, "floor"),
        (L(1), T0, "facade"),
        (L(1), T1, "floor"),
        (L(2), T1, "facade"),
        (L(2), T2, "floor"),
        (L(3), T2, "facade"),
        (L(3), BOT, "talus"),                       # talud ~45° que se funde con el acantilado
        (TAL1, BOT - 1.6, "talus"),
        (TAL2, -12.8, "talus"),                     # ya dentro de la envolvente del terreno
        (A(-4.5), -14.6, "inner"),
        (A(-3.0), -13.0, "inner"),
        (A(-2.1), -9.6, "inner"),
        (A(-1.5), -6.0, "inner"),
        (A(-1.2), -2.9, "inner"),
        (A(-0.6), -0.8, "inner"),
        (A(0.3), -0.8, "curb"),
    ]
    m = len(section)
    if area_of(section, LARCO_TH) > 0:
        sec, tags = list(section), [p[2] for p in section]
    else:
        sec, tags = section[::-1], [section[(m - 2 - k) % m][2] for k in range(m)]

    ths_in = [th0 + (th1 - th0) * i / n for i in range(n + 1)]
    ths = [th0 - CAP_DT] + ths_in + [th1 + CAP_DT]

    def u_of(th):
        return abs((th - LARCO_TH) / LARCO_HALF)

    c_in = mix(PAL["cliff_b"], PAL["cliff_dark"], 0.3)
    fixed = {"plaza": PAL["path"], "facade": C_CREMA, "floor": C_TERRACE, "inner": c_in, "curb": C_TERRACE}

    def talus_color(i, k):
        """
        Misma receta de color que la cara del acantilado de terrain.py a media altura (t ≈ 0.3-0.5):
        cliff_b → cliff_a, crestas de arena pálida y barrancos oscuros con el periodo de las
        costillas (2.5 u de arco), más ganancia porque estas caras cuelgan hacia abajo y la luz
        principal no las alcanza. Manchas de vegetación sólo donde el ruido es alto.
        """
        th = ths[min(i, len(ths) - 1)]
        y = BOT - 0.8 - 1.7 * k                             # centro de la arista k
        t = 1.0 + y / 18.0
        s = th * common.cliff_top_r(LARCO_TH)               # arco en u
        drift = 0.35 * common.noise2(s / 9.0 + 2.0, k * 0.7 + 1.0)
        rb = 1 - abs((((s + 0.35) / 2.5 + drift) % 1.0) * 2 - 1)   # onda triangular: 1 en la cresta
        rb = 0.6 * rb + 0.4 * common.noise2(s / 1.4 + 11.0, k * 2.6 + 5.0)
        crest = common.smoothstep(0.55, 0.95, rb)
        gully = 1 - common.smoothstep(0.1, 0.5, rb)
        c = mix(PAL["cliff_b"], PAL["cliff_a"], common.smoothstep(0.3, 0.6, t))
        c = mix(c, col("#d8bd92"), 0.55 * crest * common.smoothstep(0.15, 0.45, t))
        c = mix(c, col("#6b4a30"), 0.55 * gully)
        gain = 1.16 * 1.3 * (1 - 0.45 * gully) * (1 + 0.35 * crest)
        c = shade(c, gain)
        nz2 = common.noise2(s / 2.2 + 7.0, k * 1.1 + 3.0)
        if nz2 > 0.68:
            c = mix(c, PAL["cliff_veg"], 0.45 * (nz2 - 0.68) / 0.32)
        return c

    def wall_color(k, i):
        tag = tags[k]
        if tag in fixed:
            return fixed[tag]
        return talus_color(i, k)

    B_solid.loft([ring_at(t, sec) for t in ths], [C_CREMA], C_CREMA, color_fn=wall_color, caps=False)

    # tapas de los extremos: franja exterior (crema) entre la fachada y la línea del perfil del
    # acantilado, y una escalera de cuadriláteros color acantilado (con ruido) hacia dentro
    env = [(-0.8, -0.3), (-1.7, -1.1), (-2.6, -3.1), (-3.4, -6.1), (-4.1, -9.5), (-4.8, -12.5)]
    outer_pts = [p for p in section if p[2] in ("plaza", "facade", "floor", "talus")]
    inner_pts = [p for p in section if p[2] in ("inner", "curb")]
    talus_pts = [p for p in section if p[2] == "talus"]
    bottom_pt = outer_pts[-1]
    # tapa crema sólo hasta la última terraza (BOT); el tramo del talud lleva tapa color acantilado
    poly_out = outer_pts[: -len(talus_pts) + 1] + [(A(-4.1), BOT)] + [(A(ro), y) for (ro, y) in env[:4][::-1]]
    poly_talus = [talus_pts[0], talus_pts[1], talus_pts[2], (A(-4.8), -12.5), (A(-4.1), BOT)]
    O = [(A(ro), y) for (ro, y) in env] + [bottom_pt]
    I = inner_pts
    ladder = [
        (O[0], O[1], I[5], I[6], (A(0.3), PZ)),
        (O[1], O[2], I[4], I[5]),
        (O[2], O[3], I[3], I[4]),
        (O[3], O[4], I[2], I[3]),
        (O[4], O[5], I[1], I[2]),
        (O[5], O[6], I[0], I[1]),
    ]

    def add_cap(th, pts, color, facing_plus: bool):
        ring = ring_at(th, pts)
        if (area_of(pts, th) > 0) != facing_plus:
            ring = ring[::-1]
        b0 = len(B_solid.verts)
        B_solid.verts.extend(ring)
        B_solid.face(tuple(b0 + i for i in range(len(ring))), color)

    for th_cap, plus in ((th0 - CAP_DT, False), (th1 + CAP_DT, True)):
        add_cap(th_cap, poly_out, C_CREMA, plus)
        add_cap(th_cap, poly_talus, shade(mix(PAL["cliff_b"], PAL["cliff_a"], 0.4), 1.25), plus)

    # matas de vegetación (enredadera del acantilado) a lo largo de la base de Larcomar y sobre el
    # talud: rompen la arista recta entre la fachada crema y la tierra
    bushes = ((-0.78, 0, 0.42), (-0.52, 0, 0.3), (-0.24, 0, 0.46), (0.06, 0, 0.34), (0.36, 0, 0.44),
              (0.66, 0, 0.36), (-0.3, 1, 0.46), (0.44, 1, 0.42))
    c_bush = mix(PAL["cliff_veg"], PAL["cliff_b"], 0.3)               # verde apagado de enredadera
    for (uu, lvl, rad) in bushes:
        t = LARCO_TH + uu * LARCO_HALF
        if lvl == 0:
            ro, yy = lvl_r(t, 3) + 0.15, BOT + 0.02
        else:
            ro, yy = TAL1(t) + 0.08, BOT - 1.45
        x, z = polar(base_r(t) + ro, t)
        kk = 0.85 + 0.25 * common.noise2(uu * 7.0 + 3.0, lvl + 1.0)
        B_solid.blob(x, base_h(t) + yy, z, rad, 5, shade(c_bush, 0.7 * kk), shade(c_bush, 1.0 * kk), squash=0.65)
        for k, quad in enumerate(ladder):
            nz = common.noise2(k * 1.3 + (1.0 if plus else 5.0), 2.0 + k * 0.7)
            c = mix(PAL["cliff_b"], PAL["cliff_a"], 0.25 + 0.5 * nz)
            c = mix(c, PAL["cliff_dark"], 0.35 * common.smoothstep(2, 5, k))
            add_cap(th_cap, list(quad), c, plus)

    # franjas de ventana (0.8 u) en las tres fachadas altas, ventanas de 0.6 u en el nivel bajo;
    # montantes blancos en cada segmento para que lean como bahías
    c_strip = mix(PAL["glass"], PAL["white"], 0.35)
    strips = ((0, T0 + 1.0, -0.5), (1, T1 + 1.0, T0 - 0.5), (2, T2 + 1.0, T1 - 0.5), (3, BOT + 1.2, BOT + 1.8))
    step = max(1, round(n / 14))                  # bahías de ~1 u (con un montante por segmento leía como empalizada)
    for k, y_lo, y_hi in strips:
        s = ccw([(L(k, -0.08), y_lo), (L(k, -0.01), y_lo), (L(k, -0.01), y_hi), (L(k, -0.08), y_hi)])
        B_lit.loft([ring_at(t, s) for t in ths], [c_strip], c_strip)
        for i in range(step, n, step):
            t = ths_in[i]
            x, z = polar(base_r(t) + lvl_r(t, k) - 0.06, t)
            B_solid.box(x, z, 0.14, 0.1, base_h(t) + y_lo, base_h(t) + y_hi, t, PAL["white"], PAL["white"])

    # cornisa terracota (techos de los restaurantes) bajo la terraza 3
    s = ccw([(L(3, -0.35), BOT + 2.4), (L(3, 0.02), BOT + 2.4), (L(3, 0.02), BOT + 2.65), (L(3, -0.35), BOT + 2.65)])
    B_solid.loft([ring_at(t, s) for t in ths], [C_SOFFIT], C_SOFFIT)

    # barandas de vidrio lechoso (0.5 u) con pasamanos blanco en el borde de cada terraza y de la plaza
    ths3 = [t for t in ths_in if u_of(t) <= 0.72]
    for k, yo, tl in ((0, PZ, ths), (1, T0, ths), (2, T1, ths), (3, T2, ths3)):
        s = ccw([(L(k, 0.09), yo), (L(k, 0.15), yo), (L(k, 0.15), yo + 0.5), (L(k, 0.09), yo + 0.5)])
        B_rail.loft([ring_at(t, s) for t in tl], [PAL["white"]], PAL["white"])
        s2 = ccw([(L(k, 0.08), yo + 0.46), (L(k, 0.16), yo + 0.46), (L(k, 0.16), yo + 0.54), (L(k, 0.08), yo + 0.54)])
        B_solid.loft([ring_at(t, s2) for t in tl], [PAL["white"]], PAL["white"])

    # plaza superior a ras del parque: césped central y arbolitos
    s_lawn = ccw([(A(-2.3), PZ), (A(-0.2), PZ), (A(-0.2), PZ + 0.04), (A(-2.3), PZ + 0.04)])
    tl = [th0 + 0.018 + (th1 - th0 - 0.036) * i / n for i in range(n + 1)]
    B_solid.loft([ring_at(t, s_lawn) for t in tl], [PAL["lawn"]], PAL["lawn"])
    tree_segs = ctx.detail(7, 5)
    for i in range(ctx.detail(7, 4)):
        t = th0 + 0.016 + (th1 - th0 - 0.032) * i / max(1, ctx.detail(7, 4) - 1)
        x, z = polar(base_r(t) - 1.3, t)
        add_tree(B_solid, x, base_h(t) + PZ + 0.04, z, 0.55 + 0.1 * (i % 2), 0.6, tree_segs, 1.0 + 0.1 * (i % 3))

    # techos curvos (bóvedas blancas) sobre las terrazas 1 y 2, con columnas finas
    def canopy(t_a, t_b, f_in, f_out, y_floor, rise=0.55, clear=2.0, thick=0.1):
        mm = 7
        arc = []
        for i in range(mm):
            u = i / (mm - 1)
            arc.append(((lambda uu: (lambda th: f_out(th) + (f_in(th) - f_out(th)) * uu))(u),
                        y_floor + clear + rise * math.sin(math.pi * u)))
        s = ccw(arc + [(fr, y - thick) for (fr, y) in arc[::-1]])
        k = max(4, round((t_b - t_a) / (th1 - th0) * n))
        tt = [t_a + (t_b - t_a) * i / k for i in range(k + 1)]
        B_solid.loft([ring_at(t, s) for t in tt], [PAL["white"]], PAL["white"])
        for t in (t_a + 0.004, t_b - 0.004):
            for fr in (lambda th: f_in(th) + 0.15, lambda th: f_out(th) - 0.15):
                x, z = polar(base_r(t) + fr(t), t)
                B_solid.box(x, z, 0.12, 0.12, base_h(t) + y_floor, base_h(t) + y_floor + clear - thick, t, PAL["white"], PAL["white"])

    canopy(th0 + 0.012, LARCO_TH - 0.018, L(0, -0.25), L(1, 0.25), T0)
    canopy(LARCO_TH + 0.018, th1 - 0.012, L(0, -0.25), L(1, 0.25), T0)
    canopy(LARCO_TH - 0.03, LARCO_TH + 0.03, L(1, -0.25), L(2, 0.25), T1)

    # sombrillas azules en las terrazas (fuera de las bóvedas)
    segs = ctx.detail(8, 6)
    spots = []
    k1 = ctx.detail(5, 3)
    for i in range(k1):                                   # terraza 1, centro (entre las dos bóvedas)
        t = LARCO_TH - 0.012 + 0.024 * (i + 0.5) / k1
        spots.append((t, (lvl_r(t, 0) + lvl_r(t, 1)) / 2 + (r.random() - 0.5) * 0.3, T0))
    k2 = ctx.detail(4, 2)
    for side in (-1, 1):                                  # terraza 2, extremos (0.4 ≤ |u| ≤ 0.62)
        for i in range(k2):
            t = LARCO_TH + side * (0.032 + 0.018 * (i + 0.5) / k2)
            spots.append((t, (lvl_r(t, 1) + lvl_r(t, 2)) / 2 + (r.random() - 0.5) * 0.2, T1))
    k3 = ctx.detail(12, 6)
    for i in range(k3):                                   # terraza 3, |u| ≤ 0.65
        t = LARCO_TH + (-0.65 + 1.3 * (i + 0.5) / k3) * LARCO_HALF
        spots.append((t, (lvl_r(t, 2) + lvl_r(t, 3)) / 2 + (r.random() - 0.5) * 0.2, T2))
    for (t, ro, yo) in spots:
        x, z = polar(base_r(t) + ro, t)
        add_umbrella(B_solid, x, base_h(t) + yo, z, PAL["umbrella_blue"], segs, r=0.45)
    # jardineras/arbolitos en la terraza 3 (|u| ≤ 0.7), pegados al muro interior
    kj = ctx.detail(5, 2)
    for i in range(kj):
        t = LARCO_TH + (-0.7 + 1.4 * i / max(1, kj - 1)) * LARCO_HALF
        x, z = polar(base_r(t) + lvl_r(t, 2) - 0.45, t)
        add_tree(B_solid, x, base_h(t) + T2, z, 0.4, 0.45, 6, 1.05)


# ---------------------------------------------------------------------------
# Manzanas
# ---------------------------------------------------------------------------


def overlaps(lot, reserved) -> bool:
    th0, th1, r0, r1 = lot
    for (a0, a1, b0, b1) in reserved:
        if th0 < a1 and th1 > a0 and r0 < b1 and r1 > b0:
            return True
    return False


def street_ring(B: Batch, th_a, th_b, d0, d1, n_seg: int) -> None:
    """Franja de asfalto [cliff_top_r + d0, + d1] entre th_a y th_b, siguiendo la meseta."""
    for i in range(n_seg):
        ta = th_a + (th_b - th_a) * i / n_seg
        tb = th_a + (th_b - th_a) * (i + 1) / n_seg
        pts = []
        ok = True
        for (t, dd) in ((ta, d0), (tb, d0), (tb, d1), (ta, d1)):
            x, z = polar(common.cliff_top_r(t) + dd, t)
            if common.morro_h(x, z) > 1.0:
                ok = False
            pts.append((x, ground_y(x, z) + STREET_H, z))
        if ok:
            B.quad(pts, C_STREET)


def city_blocks(ctx: common.BuildContext, B_tex: Batch, B_solid: Batch, B_far: Batch, reserved: list) -> dict:
    r = ctx.rng(11)
    fast = ctx.fast
    detail = 0 if fast else 1
    T0, T1 = common.COAST_T0 + 0.03, common.COAST_T1 - 0.03
    stats = {"blocks": 0, "buildings": 0, "far_blocks": 0, "trees": 0}
    tree_segs = ctx.detail(7, 5)
    tree_spots = []
    seg_per_rad = ctx.detail(40, 20)

    d0 = FIRST_ROW_D
    row = 0
    while True:
        depth = 12.0 if row < 2 else 11.0 + (row % 2)
        d1 = d0 + depth
        r_ref = common.cliff_top_r(-math.pi / 2) + (d0 + d1) / 2
        if r_ref - depth / 2 > CITY_R_MAX:
            break
        if r_ref < FAR_R + 15:
            # calle anular delante de la fila (entre el parque y la fila 0, y entre filas)
            street_ring(B_solid, T0, T1, d0 - STREET, d0, round((T1 - T0) * seg_per_rad))
        th = T0 + r.random() * 0.02
        prev_end = None
        while th < T1 - 0.02:
            r_mid = common.cliff_top_r(th) + (d0 + d1) / 2
            far = r_mid > FAR_R
            w = (12.0 + r.random() * 6.0) if far else (10.0 + r.random() * 5.0)
            if fast:
                w *= 1.4
            dth = w / r_mid
            if th + dth > T1:
                break
            thc = th + dth / 2
            rb0 = common.cliff_top_r(thc) + d0
            rb1 = rb0 + depth
            u = abs(common.coast_u(thc))
            if rb1 < CITY_R_MAX + 2:
                stats["blocks"] += 1
                if far:
                    stats["far_blocks"] += 1
                    far_row(ctx, B_far, r, th, th + dth, rb0, rb1, u)
                else:
                    cx, cz = polar((rb0 + rb1) / 2, thc)
                    corners = pquad(th, th + dth, rb0, rb1)
                    tops = [ground_y(x, z) + SIDEWALK_H for (x, z) in corners]
                    if common.morro_h(cx, cz) < 1.0 and max(tops) - min(tops) < 1.0:
                        # vereda de la manzana (sigue el terreno en cada esquina) sobre un bordillo
                        # claro 0.12 u más ancho; nada en el Morro ni en pendiente (la vereda
                        # inclinada parecería una losa tumbada)
                        curb = pquad(th - CURB_W / rb0, th + dth + CURB_W / rb0, rb0 - CURB_W, rb1 + CURB_W)
                        B_solid.prism(curb, min(tops) - 0.9, [ground_y(x, z) + SIDEWALK_H - 0.05 for (x, z) in curb], PAL["curb"], PAL["curb"])
                        B_solid.prism(corners, min(tops) - 0.3, tops, C_SIDEWALK, C_SIDEWALK)
                        # calle radial entre esta manzana y la anterior
                        if prev_end is not None and not fast:
                            street_ring(B_solid, prev_end, th, d0, d1, 1)
                        n_b = lots(ctx, B_tex, B_solid, r, th, th + dth, rb0, rb1, row, u, detail, reserved)
                        stats["buildings"] += n_b
                        if not fast and u < 0.9 and row <= 1:
                            k = max(1, int(w / (5.0 if row == 0 else 8.0)))
                            for i in range(k):
                                t = th + dth * (i + 0.5) / k
                                tree_spots.append((t, rb0 + 0.55))
                prev_end = th + dth
            th += dth + STREET / r_mid
        d0 = d1 + STREET
        row += 1

    for (t, rr) in tree_spots:
        x, z = polar(rr, t)
        if overlaps((t - 0.004, t + 0.004, rr - 0.4, rr + 0.4), reserved):
            continue
        add_tree(B_solid, x, ground_y(x, z) + SIDEWALK_H, z, 0.7 + r.random() * 0.4, 0.9 + r.random() * 0.5, tree_segs, 0.9 + r.random() * 0.25)
        stats["trees"] += 1
    return stats


def far_row(ctx, B_far: Batch, r, th0, th1, rb0, rb1, u) -> None:
    """Manzana lejana: 3-4 bloques bajos y apretados en haze (ninguno sobre el Morro ni en pendiente)."""
    n = 2 if ctx.fast else (3 if r.random() < 0.5 else 4)
    for i in range(n):
        a0 = th0 + (th1 - th0) * (i / n) + (0.3 / rb0 if i > 0 else 0)
        a1 = th0 + (th1 - th0) * ((i + 1) / n) - (0.3 / rb0 if i < n - 1 else 0)
        floors = 3 + int(r.random() ** 1.6 * 6)
        inset = 0.5
        lot = (a0, a1, rb0 + inset, rb1 - inset)
        cx, cz = polar((rb0 + rb1) / 2, (a0 + a1) / 2)
        gys = [ground_y(x, z) for (x, z) in pquad(*lot)]
        if common.morro_h(cx, cz) > 0.4 or max(gys) - min(gys) > 0.5:
            continue
        far_block(B_far, r, *lot, floors)


def lots(ctx, B_tex: Batch, B_solid: Batch, r, th0, th1, rb0, rb1, row, u, detail, reserved) -> int:
    """Divide la manzana en lotes y levanta un edificio en cada uno. Devuelve cuántos."""
    rc = (rb0 + rb1) / 2
    w = (th1 - th0) * rc
    depth = rb1 - rb0
    lot_w = 4.5 + r.random() * 2.5
    if ctx.fast:
        lot_w *= 1.6
    n_s = max(1, round(w / lot_w))
    two_strips = depth >= 10.0 and r.random() > 0.2
    inset = 0.4
    gap = 0.5
    count = 0
    i = 0
    while i < n_s:
        span_lots = 1
        if i + 1 < n_s and r.random() < 0.18:
            span_lots = 2                      # un edificio ancho ocupa dos lotes
        a0 = th0 + (th1 - th0) * i / n_s + inset / rc
        a1 = th0 + (th1 - th0) * (i + span_lots) / n_s - inset / rc
        i += span_lots
        if two_strips:
            strips = ((rb0 + inset, rb0 + depth / 2 - gap / 2), (rb0 + depth / 2 + gap / 2, rb1 - inset))
        else:
            strips = ((rb0 + inset, rb1 - inset),)
        for si, (s0, s1) in enumerate(strips):
            lot = (a0, a1, s0, s1)
            if overlaps(lot, reserved):
                continue
            cx, cz = polar((s0 + s1) / 2, (a0 + a1) / 2)
            corners = pquad(*lot)
            gys = [ground_y(x, z) for (x, z) in corners]
            if max(gys) - min(gys) > 1.3 or common.morro_h(cx, cz) > 2.0:
                continue
            front = row == 0 and si == 0
            if row == 0:
                floors = r.randint(8, 19)
                if r.random() < (0.16 if u < 0.8 else 0.06):
                    floors = r.randint(21, 29)
            else:
                floors = r.randint(4, 13)
                if u < 0.35 and r.random() < 0.3:
                    floors += r.randint(2, 5)
            if span_lots == 2:
                floors = max(4, floors - 3)
            tint = TINTS[r.randrange(len(TINTS))]
            if r.random() < 0.08:
                tint = mix(tint, col("#c9a27a"), 0.5)        # ladrillo visto ocasional
            balc = front and floors >= 10 and r.random() < 0.55
            building(B_tex, B_solid, r, a0, a1, s0, s1, floors, tint, detail, balconies=balc)
            count += 1
    return count


# ---------------------------------------------------------------------------
# Entrada del módulo
# ---------------------------------------------------------------------------


def build(ctx: common.BuildContext):
    day, night = _window_textures(ctx.seed * 7 + 3)
    img_day = common.image_from_array("tex_city_windows_day", day)
    img_night = common.image_from_array("tex_city_windows_night", night)

    m_win = common.make_material("CV_emissive_windows", vcol=True, image=img_day, emissive_image=img_night,
                                 emissive_strength=_emissive_strength(), roughness=0.72)
    m_solid = common.make_material("CV_city_solid", vcol=True, roughness=0.85)
    m_far = common.make_material("CV_city_far", vcol=True, roughness=1.0)
    m_tower = common.make_material("CV_city_glass_dark", vcol=True, roughness=0.18, metallic=0.05)
    m_glass = common.make_material("CV_city_glass", base=col("#9fd3ea"), roughness=0.08, alpha=0.45)
    # barandas de Larcomar: vidrio lechoso (mezclado con blanco) para que domine la crema de la fachada
    m_rail = common.make_material("CV_city_rail", base=mix(col("#9fd3ea"), PAL["white"], 0.62), roughness=0.2, alpha=0.32)
    # ventanales de Larcomar: vidrio azulado mate de día (en sombra bajo la terraza; brillante
    # reflejaba el cielo y teñía toda la fachada de azul), cálido encendido de noche
    m_lit = common.make_material("CV_emissive_larcomar", vcol=True, roughness=0.5, emissive=col("#ffd08a"),
                                 emissive_strength=0.9 * _emissive_strength())

    B_tex = Batch("city_buildings", m_win, textured=True)
    B_solid = Batch("city_solid", m_solid, smooth=True, smooth_angle=50.0)
    B_far = Batch("city_far", m_far)
    B_tower = Batch("city_torre_curva", m_tower, smooth=True, smooth_angle=40.0)
    B_glass = Batch("city_glass", m_glass)
    B_rail = Batch("city_rail", m_rail)
    B_lit = Batch("city_larcomar_glass", m_lit, smooth=True, smooth_angle=50.0)

    reserved: list = []
    r = ctx.rng(3)
    torre_curva(ctx, B_tower, B_solid, reserved)
    hotel(ctx, B_tex, B_solid, B_glass, r, reserved)
    larcomar(ctx, B_solid, B_rail, B_lit, ctx.rng(5))
    stats = city_blocks(ctx, B_tex, B_solid, B_far, reserved)

    objs = []
    for b in (B_tex, B_solid, B_far, B_tower, B_glass, B_rail, B_lit):
        o = b.build(ctx)
        if o is not None:
            objs.append(o)
        stats[f"tris_{b.name}"] = b.tris
    ctx.stats.update(stats)
    return objs
