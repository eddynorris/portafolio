"""
Módulo de humo: versión mínima del litoral para validar la tubería
(helpers, render, exportación). No forma parte del diorama final.
"""

from __future__ import annotations

import math

import common
from common import PAL, SEA_Y


def build(ctx: common.BuildContext):
    n = ctx.detail(240, 80)

    # Perfil: toe submarino → línea de agua → playa → muro → pista → pie → cara → borde → meseta
    def profile(th):
        cr = common.coast_r(th)
        bw = common.beach_w(th)
        h = common.cliff_h(th)
        r0 = common.road_r0(th)
        r1 = common.road_r1(th)
        foot = common.cliff_foot_r(th)
        top = common.cliff_top_r(th)
        return [
            (cr - 4.0, SEA_Y - 0.9, PAL["sea_floor"]),
            (cr, SEA_Y, PAL["wet_sand"]),
            (cr + bw * 0.5, SEA_Y + 0.3, PAL["pebble"]),
            (r0, common.ROAD_Y - common.SEAWALL_H, PAL["pebble"]),
            (r0, common.ROAD_Y, PAL["curb"]),
            (r1, common.ROAD_Y, PAL["asphalt"]),
            (foot, common.ROAD_Y + 0.2, PAL["cliff_dark"]),
            (foot + 2.5, h * 0.45, PAL["cliff_b"]),
            (top - 1.0, h - 0.6, PAL["cliff_a"]),
            (top, h, PAL["top_grass"]),
            (top + 40, h + 0.3, PAL["top_grass"]),
            (top + 120, h + 0.5, PAL["haze"]),
        ]

    rows = len(profile(0))

    def point(th, j):
        d, y, _ = profile(th)[j]
        x, z = common.polar(d, th)
        return (x, y + common.morro_h(x, z), z)

    def color(th, j, p):
        return profile(th)[j][2]

    verts, faces, cols = common.arc_grid(common.COAST_T0, common.COAST_T1, n, rows, point, color)
    mat = common.make_material("CV_smoke_terrain", vcol=True, roughness=1.0)
    common.new_mesh("smoke_terrain", verts, faces, ctx.collection, colors=cols, material=mat, smooth=True, smooth_angle=35)

    # unos bloques en la meseta para ver la escala de la ciudad
    r = ctx.rng(5)
    bmat = common.make_material("CV_smoke_building", vcol=True, roughness=0.8)
    for i in range(ctx.detail(40, 12)):
        th = common.lerp(common.COAST_T0 + 0.25, common.COAST_T1 - 0.25, r.random())
        d = common.cliff_top_r(th) + 3 + r.random() * 25
        x, z = common.polar(d, th)
        h = 3 + r.random() ** 2 * 12
        common.box(f"smoke_b{i}", ctx.collection, (x, common.cliff_h(th) + common.morro_h(x, z), z), (2 + r.random() * 2, h, 2 + r.random() * 2),
                   yaw=-th, color=PAL["building"][i % len(PAL["building"])], material=bmat)

    ctx.stats["note"] = "smoke"
    return list(ctx.collection.objects)


def build_island_stub(ctx: common.BuildContext):
    """Isla mínima (misma orilla que shore.ts); úsala sólo si no existe island.py."""
    m = ctx.detail(64, 24)

    def ipoint(i, j):
        R = 9.5
        x = -R + 2 * R * i / m
        z = -R + 2 * R * j / m
        return (x, common.sand_height(x, z), z)

    def icolor(i, j, p):
        t = math.hypot(p[0], p[2]) / common.shore_r(math.atan2(p[2], p[0]))
        return common.mix(PAL["sand"], PAL["wet_sand"], common.smoothstep(0.85, 1.0, t))

    v, f, c = common.grid(m, m, ipoint, icolor)
    imat = common.make_material("CV_smoke_sand", vcol=True, roughness=1.0)
    return common.new_mesh("smoke_island", v, f, ctx.collection, colors=c, material=imat, smooth=True, smooth_angle=None)
