"""
=============================================================
  BUILDING 2 — MERGE & STACK SCRIPT
  Ghép 4 loại tầng thành 1 tòa nhà 15 tầng

  Cấu trúc tòa nhà:
    tang_B1           ← basement.glb   (tầng hầm, floorNumber = -1)
    tang_G            ← mall.glb       (TTTM,     floorNumber =  0)
    tang_F01 ~ F12    ← resident.glb   (Dân cư,   floorNumber 1~12)
    tang_R            ← rooftop.glb    (Thượng,   floorNumber = 13)

  OUTPUT: building2.glb  → copy vào frontend/public/models/

  CÁCH DÙNG:
    1. Blender 3.x / 4.x → Tab "Scripting"
    2. Sửa SOURCE_DIR bên dưới cho đúng đường dẫn
    3. Sửa OUTPUT_PATH cho đúng đường dẫn output
    4. Nhấn Alt+P để chạy
    5. File building2.glb sẽ được tạo tự động
=============================================================
"""

import bpy
import os
import math

# ══════════════════════════════════════════════════════════
#  ⚙️  CẤU HÌNH — CHỈNH 2 DÒNG NÀY
# ══════════════════════════════════════════════════════════

SOURCE_DIR   = r"D:\Yootek\DEV\DATN\model3D\floor"
OUTPUT_PATH  = r"D:\Yootek\DEV\DATN\model3D\building\3.glb"

# Số tầng dân cư (resident.glb sẽ được nhân bản N lần)
N_RESIDENT_FLOORS = 12

# Khoảng cách thêm giữa các tầng (m) — 0 = sát nhau
FLOOR_GAP = 0.0

# ══════════════════════════════════════════════════════════
#  FLOOR DEFINITIONS
#  Thứ tự = bottom to top
# ══════════════════════════════════════════════════════════

FLOOR_DEFS = (
    [{"name": "floor_B1",  "file": "basement.glb",  "floorNumber": -1}]
  + [{"name": "floor_G",   "file": "mall.glb",       "floorNumber":  0}]
  + [{"name": f"floor_F{i:02d}", "file": "resident.glb", "floorNumber": i}
     for i in range(1, N_RESIDENT_FLOORS + 1)]
  + [{"name": "floor_R",   "file": "rooftop.glb",    "floorNumber": N_RESIDENT_FLOORS + 1}]
)

# ══════════════════════════════════════════════════════════
#  HELPER FUNCTIONS
# ══════════════════════════════════════════════════════════

def clear_scene():
    """Xóa toàn bộ object trong scene hiện tại"""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    # Xóa collection rỗng
    for col in list(bpy.data.collections):
        bpy.data.collections.remove(col)
    # Xóa mesh/material orphan
    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        if block.users == 0:
            bpy.data.materials.remove(block)

def import_glb(filepath: str) -> list:
    """
    Import 1 file GLB vào scene, trả về danh sách objects mới import.
    Tương thích Blender 3.x và 4.x.
    """
    before = set(bpy.data.objects.keys())
    try:
        # Blender 4.x API
        bpy.ops.io_scene_gltf2.glb(filepath=filepath)
    except AttributeError:
        # Fallback Blender 3.x
        bpy.ops.import_scene.gltf(filepath=filepath)
    after = set(bpy.data.objects.keys())
    new_keys = after - before
    return [bpy.data.objects[k] for k in new_keys]

def get_bounding_box_y(objects: list):
    """Trả về (min_y, max_y) của tập objects"""
    min_y =  1e9
    max_y = -1e9
    for obj in objects:
        for corner in obj.bound_box:
            world_corner = obj.matrix_world @ __import__('mathutils').Vector(corner)
            min_y = min(min_y, world_corner.y)
            max_y = max(max_y, world_corner.y)
    return min_y, max_y

def get_bounding_box_z(objects: list):
    """Trả về (min_z, max_z) — Blender dùng Z-up"""
    import mathutils
    min_z =  1e9
    max_z = -1e9
    for obj in objects:
        bb = obj.bound_box
        mw = obj.matrix_world
        for corner in bb:
            wc = mw @ mathutils.Vector(corner)
            min_z = min(min_z, wc.z)
            max_z = max(max_z, wc.z)
    return min_z, max_z

def parent_to_empty(objects: list, empty_name: str) -> bpy.types.Object:
    """
    Tạo Empty object, parent tất cả objects vào đó.
    Empty này sẽ là "floor group" đại diện cho 1 tầng.
    """
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, 0, 0))
    empty = bpy.context.active_object
    empty.name = empty_name

    for obj in objects:
        if obj.parent is None:
            obj.parent = empty

    return empty

def move_objects_z(objects: list, delta_z: float):
    """Dịch chuyển tất cả root objects theo trục Z"""
    for obj in objects:
        if obj.parent is None or obj.parent.name not in {o.name for o in objects}:
            # Chỉ di chuyển root objects (không có parent hoặc parent không nằm trong nhóm)
            obj.location.z += delta_z

def select_objects(objects: list):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)

# ══════════════════════════════════════════════════════════
#  MAIN BUILD PROCESS
# ══════════════════════════════════════════════════════════

print()
print("=" * 60)
print("  🏗️  BUILDING 2 MERGE SCRIPT — STARTING")
print("=" * 60)

# Bước 1: Xóa scene cũ
clear_scene()
print("[1/5] Scene cleared ✓")

# Bước 2: Import và stack từng tầng
import mathutils

floor_empties   = []   # danh sách Empty (floor group) đã tạo
current_top_z   = 0.0  # Vị trí đỉnh của tầng vừa xếp (Z_up)
file_cache      = {}   # Cache: filepath → list of root objects (để tránh import lại)

print(f"[2/5] Stacking {len(FLOOR_DEFS)} floors...")

for floor_def in FLOOR_DEFS:
    floor_name   = floor_def["name"]
    glb_file     = floor_def["file"]
    floor_number = floor_def["floorNumber"]
    glb_path     = os.path.join(SOURCE_DIR, glb_file)

    if not os.path.exists(glb_path):
        print(f"  ⚠️  File not found: {glb_path} — SKIPPING")
        continue

    print(f"  → [{floor_name}] import {glb_file} ...")

    # Import GLB
    new_objs = import_glb(glb_path)
    if not new_objs:
        print(f"     ⚠️  No objects imported — skipping")
        continue

    # Tính bounding box để xác định chiều cao tầng
    min_z, max_z = get_bounding_box_z(new_objs)
    floor_height  = max_z - min_z

    # Đưa đáy tầng về Z=0 (chuẩn hóa)
    for obj in new_objs:
        if obj.parent is None:
            obj.location.z -= min_z

    # Đặt tầng lên trên tầng trước (stack)
    for obj in new_objs:
        if obj.parent is None:
            obj.location.z += current_top_z

    # Cập nhật vị trí đỉnh cho tầng tiếp theo
    current_top_z += floor_height + FLOOR_GAP

    # Đổi tên các object bên trong theo chuẩn
    suffix = floor_name.replace("floor_", "")
    for obj in new_objs:
        base_name = obj.name.split('.')[0]
        # Xóa các tiền tố cũ như DC_, HAM_, TM_, TT_
        for prefix in ["DC_", "HAM_", "TM_", "TT_"]:
            if base_name.startswith(prefix):
                base_name = base_name[len(prefix):]
                break
                
        base_name_lower = base_name.lower()
        if base_name_lower == "slab" or "floorslab" in base_name_lower or ("floor" in base_name_lower and "slab" in base_name_lower):
            obj.name = f"slab_{suffix}"
        elif "ceiling" in base_name_lower or "roofslab" in base_name_lower:
            obj.name = f"ceiling_{suffix}"
        elif "wall" in base_name_lower:
            parts = base_name.split("_")
            rest = "_".join(parts[1:]) if len(parts) > 1 else base_name
            obj.name = f"wall_{suffix}_{rest}"
        else:
            # Mặc định thêm suffix tầng vào cuối (vd: Door_A_F02)
            obj.name = f"{base_name}_{suffix}"

    # Gom tất cả objects vào 1 Empty (floor group)
    empty = parent_to_empty(new_objs, floor_name)
    floor_empties.append(empty)

    print(f"     ✓ height={floor_height:.2f}m → stacked at Z={current_top_z - floor_height:.2f}")

print(f"[2/5] All floors stacked. Total height: {current_top_z:.2f}m ✓")

# Bước 3: Đặt toàn bộ tòa nhà về gốc (center X/Y)
print("[3/5] Centering building on X/Y axes...")

all_root_objs = floor_empties  # empties là root

# Tính center X, Y
all_x = []
all_y = []
for empty in floor_empties:
    for child in empty.children_recursive:
        if hasattr(child, 'bound_box'):
            mw = child.matrix_world
            for corner in child.bound_box:
                wc = mw @ mathutils.Vector(corner)
                all_x.append(wc.x)
                all_y.append(wc.y)

if all_x and all_y:
    cx = (min(all_x) + max(all_x)) / 2
    cy = (min(all_y) + max(all_y)) / 2
    for empty in floor_empties:
        empty.location.x -= cx
        empty.location.y -= cy
    print(f"     ✓ Centered (offset X={cx:.2f}, Y={cy:.2f})")

# Bước 4: Chọn tất cả và export GLB
print(f"[4/5] Exporting to: {OUTPUT_PATH}")

# Tạo thư mục output nếu chưa có
os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

# Chọn tất cả objects để export
bpy.ops.object.select_all(action='SELECT')

try:
    bpy.ops.export_scene.gltf(
        filepath          = OUTPUT_PATH,
        export_format     = 'GLB',
        use_selection     = False,        # Export toàn bộ scene
        export_apply      = True,         # Apply modifiers
        export_animations = False,        # Không cần animation
        export_cameras    = False,
        export_lights     = False,
        export_materials  = 'EXPORT',
        export_draco_mesh_compression_enable = False,
    )
    print(f"[4/5] Export SUCCESS ✓")
except Exception as e:
    print(f"[4/5] Export ERROR: {e}")

# Bước 5: In tóm tắt
print()
print("=" * 60)
print("  ✅  BUILDING 2 COMPLETED!")
print("=" * 60)
print(f"  Output: {OUTPUT_PATH}")
print(f"  Total floors  : {len(floor_empties)}")
print(f"  Total height  : {current_top_z:.1f}m")
print()
print("  📐 Floor Stack (bottom → top):")
for fd in FLOOR_DEFS:
    print(f"     {fd['floorNumber']:+3d}  {fd['name']:12s}  ← {fd['file']}")
print()
print("  📋 Next steps:")
print("  1. Copy building2.glb to frontend/public/models/ (đã tự copy nếu đường dẫn đúng)")
print("  2. Chạy seed script để tạo Building record trong DB")
print("  3. Vào BMS → chọn Building 2 → xem 3D viewer")
print("=" * 60)
