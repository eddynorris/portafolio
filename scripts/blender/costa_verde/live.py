"""
Construye el diorama dentro del Blender ABIERTO (vía la extensión MCP, puerto 9876)
para verlo en el visor. Se envía con scratchpad/bl.mjs:  node bl.mjs @live.py

Limpia los objetos por defecto (Cube, Light, Camera), construye todos los módulos,
añade un sol y una cámara con el encuadre del hero y pone el visor en Material Preview.
"""

import importlib
import math
import sys
import time

import bpy

PKG = r"C:\Users\Usuario\Documents\Default Project\scripts\blender\costa_verde"
if PKG not in sys.path:
    sys.path.insert(0, PKG)

for name in ("common", "build", "preview"):
    if name in sys.modules:
        importlib.reload(sys.modules[name])

import build  # noqa: E402
import common  # noqa: E402
import preview  # noqa: E402

t0 = time.time()

# objetos por defecto del archivo nuevo (no es trabajo del usuario)
for nm in ("Cube", "Light", "Camera"):
    o = bpy.data.objects.get(nm)
    if o is not None:
        bpy.data.objects.remove(o, do_unlink=True)

# limpiar una construcción anterior
for coll in list(bpy.data.collections):
    if coll.name.startswith("CV_") or coll.name == common.ROOT_COLLECTION:
        for o in list(coll.objects):
            bpy.data.objects.remove(o, do_unlink=True)
for coll in list(bpy.data.collections):
    if coll.name.startswith("CV_") or coll.name == common.ROOT_COLLECTION:
        bpy.data.collections.remove(coll)
for me in list(bpy.data.meshes):
    if me.users == 0:
        bpy.data.meshes.remove(me)

modules = globals().get("MODULES") or None
stats = build.build(modules, fast=False)

preview.setup_world(night=False)
preview.add_water(night=False)
try:
    preview.add_cart()
except Exception as ex:  # noqa: BLE001
    print("sin carrito:", ex)

W, H = 1280, 720
cams = {}
for name in ("hero", "photo", "contacto"):
    pos, target, fx, fy = preview.CAMS[name]
    cams[name] = preview.add_camera(name, pos, target, fx, fy, W, H)
scene = bpy.context.scene
scene.camera = cams["hero"]
scene.render.resolution_x, scene.render.resolution_y = W, H

# visor: Material Preview y vista desde la cámara del hero
for window in bpy.context.window_manager.windows:
    for area in window.screen.areas:
        if area.type == "VIEW_3D":
            for space in area.spaces:
                if space.type == "VIEW_3D":
                    space.shading.type = "MATERIAL"
                    space.clip_end = 2000
                    region = next((r for r in area.regions if r.type == "WINDOW"), None)
                    if region is not None:
                        with bpy.context.temp_override(window=window, area=area, region=region):
                            bpy.ops.view3d.view_camera()

result = {"stats": stats, "seconds": round(time.time() - t0, 1)}
