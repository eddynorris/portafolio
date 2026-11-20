"""
Orquestador del diorama: construye los módulos pedidos dentro de la colección `CostaVerde`.

Uso dentro de Blender (headless o por el socket MCP):

    import sys; sys.path.insert(0, 'scripts/blender/costa_verde')
    import build; build.build(['terrain', 'city'], fast=True)

Cada módulo expone `build(ctx: common.BuildContext) -> list[bpy.types.Object]`
y enlaza sus objetos en `ctx.collection` (colección `CV_<módulo>`).
"""

from __future__ import annotations

import importlib
import sys
import time
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import common  # noqa: E402

#: Orden de construcción por defecto.
MODULES = ["terrain", "city", "park", "island", "extras"]


def build(modules=None, fast: bool = False, seed: int = 1) -> dict:
    """Construye los módulos (todos por defecto) y devuelve estadísticas por módulo."""
    modules = list(modules or MODULES)
    stats: dict = {}
    for name in modules:
        t0 = time.time()
        common.clear_collection(f"CV_{name}")
        coll = common.get_collection(f"CV_{name}")
        ctx = common.BuildContext(collection=coll, fast=fast, seed=seed)
        mod = importlib.import_module(name)
        importlib.reload(mod)
        objs = mod.build(ctx) or list(coll.objects)
        tris = common.tri_count(list(coll.objects))
        stats[name] = {
            "objects": len(coll.objects),
            "tris": tris,
            "seconds": round(time.time() - t0, 2),
            **ctx.stats,
        }
        common.log(f"{name}: {len(coll.objects)} objetos, {tris} tris, {stats[name]['seconds']} s")
    stats["total_tris"] = sum(v["tris"] for k, v in stats.items() if isinstance(v, dict))
    common.log(f"total: {stats['total_tris']} tris")
    return stats


def reset_scene() -> None:
    """Deja la escena vacía (sin cubo/luz/cámara por defecto)."""
    bpy.ops.wm.read_homefile(use_empty=True)
    bpy.context.scene.unit_settings.system = "METRIC"
