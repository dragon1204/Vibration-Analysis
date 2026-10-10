"""
=============================================================
  TẦNG HẦM - BASEMENT FLOOR GENERATOR  (Fixed v2)
  Kích thước: 20m x 20m x 3m
  
  CÁCH DÙNG:
    1. Mở Blender → Tab "Scripting"
    2. Nhấn "Open" → chọn file này  HOẶC  copy-paste toàn bộ
    3. Nhấn Alt+P hoặc nút ▶ Run Script
    4. Xem kết quả trong Outliner (collection TANG_HAM)
=============================================================
"""

import bpy
import bmesh
import math

# ══════════════════════════════════════════════════════════
#  CẤU HÌNH CHÍNH — chỉnh tại đây nếu muốn thay đổi kích thước
# ══════════════════════════════════════════════════════════
CONFIG = {
    # Mặt bằng tầng
    "floor_width":    20.0,   # X (m)
    "floor_depth":    20.0,   # Y (m)
    "floor_height":    3.0,   # Chiều cao tầng (m)

    # Cột trụ BTCT
    "col_size_x":      0.6,   # Tiết diện cột X (m)
    "col_size_y":      0.6,   # Tiết diện cột Y (m)
    "col_spacing_x":   5.0,   # Khoảng cách cột theo X (m)
    "col_spacing_y":   5.0,   # Khoảng cách cột theo Y (m)

    # Tường bao
    "wall_thickness":  0.3,   # Độ dày tường (m)

    # Sàn / Trần
    "slab_thickness":  0.25,  # Độ dày sàn bê tông (m)
}


# ══════════════════════════════════════════════════════════
#  HÀM TIỆN ÍCH
# ══════════════════════════════════════════════════════════

def move_to_collection(obj, target_col):
    """
    Di chuyển object vào target_col.
    Tự unlink khỏi TẤT CẢ collection hiện tại trước.
    → Tránh lỗi 'Object not in collection Scene Collection'
    """
    for col in list(obj.users_collection):
        col.objects.unlink(obj)
    target_col.objects.link(obj)


def clear_collection(name):
    """Xóa collection và toàn bộ object bên trong"""
    if name in bpy.data.collections:
        col = bpy.data.collections[name]
        for obj in list(col.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.collections.remove(col)


def new_collection(name, parent=None):
    """Tạo collection mới và link vào parent (hoặc Scene gốc)"""
    col = bpy.data.collections.new(name)
    if parent is None:
        bpy.context.scene.collection.children.link(col)
    else:
        parent.children.link(col)
    return col


def create_material(name, color, roughness=0.85, metallic=0.0):
    """Tạo Principled BSDF material (không tạo lại nếu đã tồn tại)"""
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
        bsdf.inputs["Roughness"].default_value  = roughness
        bsdf.inputs["Metallic"].default_value   = metallic
    return mat


def assign_material(obj, mat):
    """Gán material vào slot đầu tiên của object"""
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)


def add_bevel(obj, width=0.02, segments=2):
    """Thêm Bevel modifier để bo cạnh bê tông"""
    mod = obj.modifiers.new(name="Bevel", type='BEVEL')
    mod.width        = width
    mod.segments     = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit  = 1.0   # ~57°


def make_box(name, scale, location, mat, target_col, bevel=False):
    """
    Tạo một Cube, scale đúng kích thước, gán material,
    rồi chuyển vào đúng collection.
    """
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name  = name
    obj.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    assign_material(obj, mat)
    if bevel:
        add_bevel(obj)
    move_to_collection(obj, target_col)
    return obj


# ══════════════════════════════════════════════════════════
#  KHỞI TẠO SCENE — xóa bản cũ rồi tạo lại
# ══════════════════════════════════════════════════════════

clear_collection("TANG_HAM")

root_col    = new_collection("TANG_HAM")
col_slabs   = new_collection("Slabs",     parent=root_col)
col_columns = new_collection("Columns",   parent=root_col)
col_walls   = new_collection("Walls",     parent=root_col)
col_lines   = new_collection("ParkLines", parent=root_col)

C  = CONFIG
W  = C["floor_width"]
D  = C["floor_depth"]
H  = C["floor_height"]
ST = C["slab_thickness"]


# ══════════════════════════════════════════════════════════
#  MATERIALS
# ══════════════════════════════════════════════════════════

mat_concrete  = create_material("MAT_Concrete",  (0.72, 0.70, 0.68), roughness=0.90)
mat_floor     = create_material("MAT_Floor",     (0.50, 0.50, 0.50), roughness=0.95)
mat_ceiling   = create_material("MAT_Ceiling",   (0.82, 0.82, 0.82), roughness=0.85)
mat_wall      = create_material("MAT_Wall",      (0.65, 0.63, 0.60), roughness=0.90)
mat_paintline = create_material("MAT_PaintLine", (0.95, 0.85, 0.10), roughness=0.60)


# ══════════════════════════════════════════════════════════
#  1. SÀN BÊ TÔNG (FLOOR SLAB)
# ══════════════════════════════════════════════════════════

make_box(
    name       = "slab",
    scale      = (W, D, ST),
    location   = (W/2, D/2, -ST/2),
    mat        = mat_floor,
    target_col = col_slabs,
)

# ══════════════════════════════════════════════════════════
#  2. TRẦN BÊ TÔNG (CEILING SLAB)
# ══════════════════════════════════════════════════════════

make_box(
    name       = "ceiling",
    scale      = (W, D, ST),
    location   = (W/2, D/2, H + ST/2),
    mat        = mat_ceiling,
    target_col = col_slabs,
)

# ══════════════════════════════════════════════════════════
#  3. LƯỚI CỘT CHỊU LỰC (25 CỘT, LƯỚI 5×5m)
# ══════════════════════════════════════════════════════════

cx = C["col_size_x"]
cy = C["col_size_y"]
sx = C["col_spacing_x"]
sy = C["col_spacing_y"]

cols_x = int(W / sx) + 1   # = 5
cols_y = int(D / sy) + 1   # = 5

print(f"[TANG HAM] Đang tạo {cols_x}×{cols_y} = {cols_x*cols_y} cột BTCT...")

for i in range(cols_x):
    for j in range(cols_y):
        make_box(
            name       = f"Column_{i:02d}_{j:02d}",
            scale      = (cx, cy, H),
            location   = (i * sx, j * sy, H / 2),
            mat        = mat_concrete,
            target_col = col_columns,
            bevel      = True,          # bo cạnh bê tông
        )

# ══════════════════════════════════════════════════════════
#  4. TƯỜNG BAO 4 MẶT
# ══════════════════════════════════════════════════════════

wt = C["wall_thickness"]

wall_defs = [
    # ( tên,             scale_x, scale_y, scale_z,  loc_x,      loc_y,      loc_z )
    ("wall_South",   W,       wt,      H,         W/2,        -wt/2,      H/2),
    ("wall_North",   W,       wt,      H,         W/2,         D+wt/2,    H/2),
    ("wall_West",    wt,       D,      H,         -wt/2,       D/2,       H/2),
    ("wall_East",    wt,       D,      H,          W+wt/2,     D/2,       H/2),
]

for name, sx_w, sy_w, sz_w, lx, ly, lz in wall_defs:
    make_box(
        name       = name,
        scale      = (sx_w, sy_w, sz_w),
        location   = (lx, ly, lz),
        mat        = mat_wall,
        target_col = col_walls,
    )

# ══════════════════════════════════════════════════════════
#  5. VẠCH KẺ Ô ĐẬU XE
#     Bố cục: 2 dãy (Nam & Bắc), mỗi dãy 8 ô (2.5×5m)
# ══════════════════════════════════════════════════════════

SLOT_W  = 2.5    # rộng 1 ô đậu (m)
SLOT_D  = 5.0    # sâu 1 ô đậu (m)
LINE_T  = 0.08   # bề dày vạch kẻ (m)
LINE_H  = 0.005  # chiều cao nổi trên sàn (m)


def create_parking_row(start_x, start_y, n_slots, prefix):
    """Tạo vạch kẻ cho một dãy ô đậu xe"""
    # Vạch dọc — phân chia các ô theo chiều ngang
    for k in range(n_slots + 1):
        make_box(
            name       = f"{prefix}_LV_{k:02d}",
            scale      = (LINE_T, SLOT_D, LINE_H),
            location   = (start_x + k * SLOT_W, start_y + SLOT_D/2, LINE_H/2),
            mat        = mat_paintline,
            target_col = col_lines,
        )
    # Vạch ngang — đầu và cuối mỗi dãy
    for ey in [start_y, start_y + SLOT_D]:
        make_box(
            name       = f"{prefix}_LH_y{ey:.0f}",
            scale      = (SLOT_W * n_slots, LINE_T, LINE_H),
            location   = (start_x + SLOT_W * n_slots / 2, ey, LINE_H/2),
            mat        = mat_paintline,
            target_col = col_lines,
        )


n_slots = int(W / SLOT_W)          # = 8 ô mỗi dãy

create_parking_row(0, 0.0,          n_slots, "Park_South")
create_parking_row(0, D - SLOT_D,   n_slots, "Park_North")

# ══════════════════════════════════════════════════════════
#  6. ĐƯỜNG DỐC XUỐNG HẦM (RAMP)
#     Đặt ở cạnh East, giữa Y, dài 8m, nghiêng 15°
# ══════════════════════════════════════════════════════════

RAMP_L   = 8.0
RAMP_W   = 4.0
RAMP_DEG = 15.0
ramp_dz  = math.tan(math.radians(RAMP_DEG)) * RAMP_L  # chênh cao ~2.14m

bpy.ops.mesh.primitive_plane_add(
    size     = 1,
    location = (W - RAMP_W / 2, D / 2, 0)
)
ramp = bpy.context.active_object
ramp.name = "Ramp"

bpy.ops.object.mode_set(mode='EDIT')
bm = bmesh.from_edit_mesh(ramp.data)
for v in bm.verts:
    v.co.x *= RAMP_W
    v.co.y *= RAMP_L
    # Đầu phía ngoài (y > 0) nâng lên = mặt đường, đầu trong (y < 0) = sàn hầm
    v.co.z = ramp_dz if v.co.y > 0 else 0.0
bmesh.update_edit_mesh(ramp.data)
bpy.ops.object.mode_set(mode='OBJECT')

assign_material(ramp, mat_floor)
move_to_collection(ramp, col_slabs)


# ══════════════════════════════════════════════════════════
#  HOÀN TẤT — In kết quả ra Console
# ══════════════════════════════════════════════════════════

print()
print("=" * 55)
print("  ✅  TẦNG HẦM ĐÃ ĐƯỢC TẠO THÀNH CÔNG!")
print("=" * 55)
print(f"  Mặt bằng  : {W}m × {D}m × {H}m")
print(f"  Cột BTCT  : {cols_x*cols_y} cột (lưới {sx}×{sy}m, tiết diện {cx}×{cy}m)")
print(f"  Ô đậu xe  : {n_slots*2} ô (2 dãy × {n_slots} ô)")
print(f"  Đường dốc : dài {RAMP_L}m, nghiêng {RAMP_DEG}°")
print("=" * 55)
print("  📁 Outliner → TANG_HAM/")
print("     ├── HAM_Slabs      (sàn + trần + ramp)")
print("     ├── HAM_Columns    (25 cột BTCT)")
print("     ├── HAM_Walls      (4 tường bao)")
print("     └── HAM_ParkLines  (vạch kẻ đậu xe)")
print("=" * 55)
