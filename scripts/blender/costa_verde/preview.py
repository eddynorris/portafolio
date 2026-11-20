"""
Previsualización headless del diorama: construye módulos, pone luces y cámaras
equivalentes a las estaciones de CameraRig.tsx y renderiza PNGs.

    blender --background --python scripts/blender/costa_verde/preview.py -- \
        --modules terrain,city --cams hero,photo --fast --out scripts/blender/costa_verde/shots

Opciones:
  --modules a,b,c   módulos a construir (por defecto todos los que existan)
  --cams a,b        cámaras: hero, proyectos, educador, skills, contacto, photo, top, left, right
  --fast            menos detalle (para iterar)
  --samples N       muestras EEVEE (16 por defecto)
  --size WxH        resolución (1280x720 por defecto)
  --no-cart         no importar el carrito GLB de referencia
  --no-water        sin plano de agua
  --night           iluminación nocturna aproximada
  --export ruta.glb exporta el GLB tras construir (sin optimizar; usa export.py para el final)
  --blend ruta.blend guarda el .blend resultante
  --out carpeta     carpeta de salida (por defecto shots/)
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import build  # noqa: E402
import common  # noqa: E402
from common import SEA_Y, bl  # noqa: E402

#: Estaciones de cámara (three.js): posición, objetivo, fracción de pantalla del objetivo (fx, fy).
CAMS = {
    "hero": ((1.6, 2.0, 6.6), (0.05, 1.2, 0.0), 0.68, 0.48),
    "proyectos": ((3.5, 1.85, 4.0), (0.7, 1.35, -0.4), 0.7, 0.5),
    "educador": ((14.0, 5.2, 5.5), (7.0, 0.3, -10.0), 0.68, 0.5),
    "skills": ((-1.7, 1.75, 3.0), (0.0, 1.4, 0.25), 0.7, 0.5),
    "contacto": ((-10.0, 8.5, 12.5), (1.0, 0.2, -3.0), 0.64, 0.5),
    # extra: encuadre parecido a la foto de referencia (vista aérea a lo largo de la costa)
    "photo": ((-62.0, 34.0, 26.0), (18.0, 7.0, -62.0), 0.5, 0.5),
    # extra: cenital para comprobar la distribución
    "top": ((0.0, 170.0, -20.0), (0.0, 0.0, -45.0), 0.5, 0.5),
    # extra: desde el mar mirando al malecón centro
    "front": ((0.0, 6.0, 30.0), (0.0, 12.0, -75.0), 0.5, 0.5),
    "left": ((-30.0, 10.0, 20.0), (-45.0, 10.0, -55.0), 0.5, 0.5),
    "right": ((30.0, 10.0, 20.0), (45.0, 10.0, -45.0), 0.5, 0.5),
}


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--modules", default="")
    p.add_argument("--cams", default="hero,photo")
    p.add_argument("--fast", action="store_true")
    p.add_argument("--samples", type=int, default=16)
    p.add_argument("--size", default="1280x720")
    p.add_argument("--no-cart", action="store_true")
    p.add_argument("--no-water", action="store_true")
    p.add_argument("--night", action="store_true")
    p.add_argument("--export", default="")
    p.add_argument("--blend", default="")
    p.add_argument("--out", default=str(common.SHOTS_DIR))
    return p.parse_args(argv)


def setup_world(night: bool) -> None:
    scene = bpy.context.scene
    world = bpy.data.worlds.get("CV_World") or bpy.data.worlds.new("CV_World")
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out_node = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    nt.links.new(bg.outputs["Background"], out_node.inputs["Surface"])
    if night:
        bg.inputs[0].default_value = common.col("#0d1b33")
        bg.inputs[1].default_value = 0.35
    else:
        bg.inputs[0].default_value = common.col("#a9dcff")
        bg.inputs[1].default_value = 0.9
    scene.world = world
    # la misma mezcla de luces que Lights.tsx (sin tone mapping, como el canvas `flat`)
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    coll = common.get_collection("CV_preview")
    for name, pos, color, energy in (
        ("CV_key", common.KEY_LIGHT_POS, "#fff6e2" if not night else "#b8c8ff", 3.2 if not night else 0.9),
        ("CV_fill", common.FILL_LIGHT_POS, "#9adcff" if not night else "#4a6ea0", 1.0 if not night else 0.4),
    ):
        light = bpy.data.lights.new(name, "SUN")
        light.color = common.col(color)[:3]
        light.energy = energy
        light.angle = math.radians(2.5)
        light.use_shadow = name == "CV_key"
        obj = bpy.data.objects.new(name, light)
        v = bl(*pos)
        obj.rotation_euler = v.to_track_quat("Z", "Y").to_euler()
        coll.objects.link(obj)


def add_water(night: bool) -> None:
    coll = common.get_collection("CV_preview")
    segs = 96
    verts = [(0.0, SEA_Y, 0.0)] + [(170 * math.cos(2 * math.pi * k / segs), SEA_Y, 170 * math.sin(2 * math.pi * k / segs)) for k in range(segs)]
    faces = [(0, 1 + (k + 1) % segs, 1 + k) for k in range(segs)]
    mat = common.make_material("CV_water_preview", base="#26b2e6" if not night else "#113d62", roughness=0.12)
    common.new_mesh("CV_water", verts, faces, coll, material=mat, smooth=True, smooth_angle=None, fix_up=True)


def add_cart() -> None:
    if not common.CART_GLB.exists():
        common.log("no se encontró el GLB del carrito:", common.CART_GLB)
        return
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(common.CART_GLB))
    new = [o for o in bpy.data.objects if o not in before]
    coll = common.get_collection("CV_preview")
    roots = [o for o in new if o.parent is None]
    # apoyar el modelo en y = 0 (como ModelHost)
    zs = []
    for o in new:
        if o.type == "MESH":
            for c in o.bound_box:
                zs.append((o.matrix_world @ Vector(c)).z)
    dz = -min(zs) if zs else 0.0
    for r in roots:
        r.location.z += dz
        r.name = "CV_cart"
    for o in new:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        coll.objects.link(o)


def add_camera(name: str, pos, target, fx: float, fy: float, width: int, height: int) -> bpy.types.Object:
    cam = bpy.data.cameras.new(f"CV_cam_{name}")
    cam.sensor_fit = "VERTICAL"
    cam.angle_y = math.radians(36.0)
    cam.clip_start = 0.1
    cam.clip_end = 1500.0
    # el objetivo cae en la fracción (fx, fy) de la pantalla (desde la izquierda / desde abajo,
    # como en CameraRig.tsx); con sensor_fit VERTICAL el shift se mide en alturas de imagen
    cam.shift_x = -(fx - 0.5) * (width / height)
    cam.shift_y = 0.5 - fy
    obj = bpy.data.objects.new(f"CV_cam_{name}", cam)
    p = bl(*pos)
    t = bl(*target)
    obj.location = p
    obj.rotation_euler = (t - p).to_track_quat("-Z", "Y").to_euler()
    common.get_collection("CV_preview").objects.link(obj)
    return obj


def render(cam_obj: bpy.types.Object, path: Path, samples: int, width: int, height: int) -> float:
    scene = bpy.context.scene
    scene.camera = cam_obj
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.taa_render_samples = samples
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.film_transparent = False
    scene.render.filepath = str(path)
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    return time.time() - t0


def main() -> None:
    args = parse_args()
    width, height = (int(v) for v in args.size.lower().split("x"))
    out = Path(args.out)
    if not out.is_absolute():
        out = (common.PROJECT_DIR / out).resolve()
    out.mkdir(parents=True, exist_ok=True)

    build.reset_scene()
    modules = [m for m in args.modules.split(",") if m] or [m for m in build.MODULES if (HERE / f"{m}.py").exists()]
    t0 = time.time()
    stats = build.build(modules, fast=args.fast)
    common.log(f"construcción: {time.time() - t0:.1f} s")

    setup_world(args.night)
    if not args.no_water:
        add_water(args.night)
    if not args.no_cart:
        add_cart()

    times = {}
    for name in [c for c in args.cams.split(",") if c]:
        if name not in CAMS:
            common.log("cámara desconocida:", name)
            continue
        pos, target, fx, fy = CAMS[name]
        cam = add_camera(name, pos, target, fx, fy, width, height)
        path = out / f"{name}.png"
        times[name] = round(render(cam, path, args.samples, width, height), 1)
        common.log(f"render {name}: {path} ({times[name]} s)")

    if args.export:
        path = Path(args.export)
        path.parent.mkdir(parents=True, exist_ok=True)
        # sólo las colecciones del diorama (sin cámaras, luces, agua ni carrito)
        for o in bpy.data.objects:
            o.select_set(o.users_collection[0].name.startswith("CV_") and o.users_collection[0].name != "CV_preview")
        bpy.ops.export_scene.gltf(
            filepath=str(path), export_format="GLB", use_selection=True, export_apply=True,
            export_yup=True, export_vertex_color="ACTIVE", export_all_vertex_colors=False,
            export_image_format="WEBP", export_jpeg_quality=85, export_lights=False, export_cameras=False,
            export_animations=False, export_extras=False, export_normals=True, export_tangents=False,
        )
        common.log(f"GLB: {path} ({path.stat().st_size / 1024:.0f} KB)")

    if args.blend:
        bpy.ops.wm.save_as_mainfile(filepath=str(Path(args.blend).resolve()))

    print("PREVIEW_STATS " + json.dumps({"modules": stats, "render_s": times}), flush=True)


if __name__ == "__main__":
    main()
