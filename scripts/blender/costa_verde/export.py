"""
Exportación final del diorama a GLB optimizado para la web.

    blender --background --python scripts/blender/costa_verde/export.py -- \
        [--out public/models/costa_verde.glb] [--modules a,b] [--no-ao] [--no-draco] [--blend ruta.blend]

Pasos: construir todos los módulos (modo completo) → aplicar modificadores → hornear
oclusión ambiental en los colores de vértice (Cycles GPU) → unir mallas por
módulo+material (menos draw calls) → exportar GLB con Draco + WebP → estadísticas.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from collections import defaultdict
from pathlib import Path

import bpy
import numpy as np

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import build  # noqa: E402
import common  # noqa: E402

#: Objetos que React anima o referencia por nombre: no se unen con nada.
SPECIAL_PREFIXES = ("Auto_", "Parapente", "Faro_lamp")


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", default=str(common.PROJECT_DIR / "public" / "models" / "costa_verde.glb"))
    p.add_argument("--modules", default="")
    p.add_argument("--no-ao", action="store_true")
    p.add_argument("--ao-samples", type=int, default=48)
    p.add_argument("--ao-distance", type=float, default=5.0)
    p.add_argument("--no-draco", action="store_true")
    p.add_argument("--no-join", action="store_true")
    p.add_argument("--blend", default="")
    return p.parse_args(argv)


def diorama_objects() -> list[bpy.types.Object]:
    out = []
    for coll in bpy.data.collections:
        if coll.name.startswith("CV_") and coll.name != "CV_preview":
            out.extend(o for o in coll.objects if o.type == "MESH")
    return out


def is_special(obj: bpy.types.Object) -> bool:
    return obj.name.startswith(SPECIAL_PREFIXES)


def setup_gpu() -> str:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("OPTIX", "CUDA", "NONE"):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
            if kind == "NONE":
                return "CPU"
            ok = False
            for d in prefs.devices:
                d.use = d.type == kind
                ok = ok or d.use
            if ok:
                return kind
        except Exception:  # noqa: BLE001
            continue
    return "CPU"


def bake_ao(objs: list[bpy.types.Object], samples: int, distance: float) -> float:
    """
    Hornea AO en un color attribute temporal y lo multiplica sobre 'Col'.
    Devuelve segundos. Sólo mallas con 'Col' (las demás se dejan como están).
    """
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    dev = setup_gpu()
    scene.cycles.device = "GPU" if dev != "CPU" else "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = False
    scene.cycles.bake_type = "AO"
    scene.render.bake.target = "VERTEX_COLORS"
    scene.render.bake.use_selected_to_active = False
    if scene.world is None:
        scene.world = bpy.data.worlds.new("CV_bake_world")
    scene.world.light_settings.distance = distance

    targets = [o for o in objs if o.data.color_attributes.get("Col") is not None and len(o.data.vertices) > 0]
    common.log(f"AO: {len(targets)} mallas, dispositivo {dev}, {samples} muestras, distancia {distance}")
    t0 = time.time()
    # Preparar el atributo temporal en cada malla
    for o in targets:
        me = o.data
        if me.color_attributes.get("AO") is not None:
            me.color_attributes.remove(me.color_attributes["AO"])
        ao = me.color_attributes.new(name="AO", type="FLOAT_COLOR", domain="POINT")
        idx = me.color_attributes.find(ao.name)
        me.color_attributes.active_color_index = idx
        me.color_attributes.render_color_index = idx

    view = bpy.context.view_layer
    for o in bpy.data.objects:
        o.select_set(False)
    # hornear en lotes (bake procesa todos los seleccionados)
    batch = 12
    for i in range(0, len(targets), batch):
        group = targets[i : i + batch]
        for o in group:
            o.select_set(True)
        view.objects.active = group[0]
        try:
            bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
        except Exception as ex:  # noqa: BLE001
            common.log("AO falló en el lote", i, ":", ex)
        for o in group:
            o.select_set(False)
        common.log(f"AO lote {i // batch + 1}/{(len(targets) + batch - 1) // batch} ({time.time() - t0:.0f} s)")

    # Col *= AO (suavizado: AO^0.8, mínimo 0.35 para no ennegrecer)
    for o in targets:
        me = o.data
        col = me.color_attributes.get("Col")
        ao = me.color_attributes.get("AO")
        if col is None or ao is None:
            continue
        n = len(me.vertices) if col.domain == "POINT" else len(me.loops)
        c = np.empty(n * 4, np.float32)
        col.data.foreach_get("color", c)
        a = np.empty(len(me.vertices) * 4, np.float32)
        ao.data.foreach_get("color", a)
        occ = np.clip(a.reshape(-1, 4)[:, 0], 0.0, 1.0) ** 0.8
        occ = 0.35 + 0.65 * occ
        if col.domain == "CORNER":
            vidx = np.empty(len(me.loops), np.int32)
            me.loops.foreach_get("vertex_index", vidx)
            occ = occ[vidx]
        c = c.reshape(-1, 4)
        c[:, :3] *= occ[:, None]
        col.data.foreach_set("color", c.ravel())
        me.color_attributes.remove(ao)
        idx = me.color_attributes.find("Col")
        me.color_attributes.active_color_index = idx
        me.color_attributes.render_color_index = idx
    return time.time() - t0


def join_by_material(objs: list[bpy.types.Object]) -> list[bpy.types.Object]:
    """Une las mallas de cada módulo que comparten material (los especiales quedan sueltos)."""
    groups: dict[tuple[str, str], list[bpy.types.Object]] = defaultdict(list)
    keep: list[bpy.types.Object] = []
    for o in objs:
        if is_special(o) or len(o.data.materials) != 1 or o.data.materials[0] is None:
            keep.append(o)
            continue
        module = o.users_collection[0].name
        groups[(module, o.data.materials[0].name)].append(o)
    out = list(keep)
    for (module, mat), members in groups.items():
        if len(members) == 1:
            out.append(members[0])
            continue
        name = f"{module[3:]}_{mat.replace('CV_', '')}"
        joined = common.join(members, name)
        if joined is not None:
            out.append(joined)
    return out


def main() -> None:
    args = parse_args()
    out = Path(args.out)
    if not out.is_absolute():
        out = (common.PROJECT_DIR / out).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)

    build.reset_scene()
    modules = [m for m in args.modules.split(",") if m] or [m for m in build.MODULES if (HERE / f"{m}.py").exists()]
    t0 = time.time()
    stats = build.build(modules, fast=False)
    build_s = time.time() - t0

    objs = diorama_objects()
    for o in objs:
        common.apply_modifiers(o)

    ao_s = 0.0
    if not args.no_ao:
        ao_s = bake_ao(objs, args.ao_samples, args.ao_distance)

    if not args.no_join:
        before = len(objs)
        objs = join_by_material(diorama_objects())
        common.log(f"unión: {before} → {len(objs)} objetos")

    for o in bpy.data.objects:
        o.select_set(o in objs)

    bpy.ops.export_scene.gltf(
        filepath=str(out),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_vertex_color="ACTIVE",
        export_all_vertex_colors=False,
        export_image_format="WEBP",
        export_jpeg_quality=85,
        export_lights=False,
        export_cameras=False,
        export_animations=False,
        export_extras=False,
        export_normals=True,
        export_tangents=False,
        export_draco_mesh_compression_enable=not args.no_draco,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_draco_color_quantization=10,
    )

    if args.blend:
        bpy.ops.wm.save_as_mainfile(filepath=str(Path(args.blend).resolve()))

    result = {
        "glb": str(out),
        "kb": round(out.stat().st_size / 1024),
        "objects": len(objs),
        "tris": common.tri_count(objs),
        "materials": sorted({m.name for o in objs for m in o.data.materials if m}),
        "images": sorted(i.name for i in bpy.data.images if i.users),
        "modules": stats,
        "build_s": round(build_s, 1),
        "ao_s": round(ao_s, 1),
    }
    print("EXPORT_STATS " + json.dumps(result), flush=True)


if __name__ == "__main__":
    main()
