"""
=============================================================
  TẦNG TTTM - SHOPPING MALL FLOOR GENERATOR
  Kích thước: 20m x 20m x 5m (trần cao open space)
  Đặc trưng:
    - Curtain Wall (vách kính) 4 mặt
    - Cột thép mảnh (0.3x0.3m), lưới 5x5m
    - Sàn mezzanine (ban công trong) chu vi
    - Khung nhôm mullion ngang/dọc
    - Escalator placeholder

  CÁCH DÙNG:
    1. Blender → Tab "Scripting"
    2. Open → chọn file này  HOẶC  copy-paste
    3. Alt+P để chạy
=============================================================
"""

import bpy
import bmesh
import math

# ══════════════════════════════════════════════════════════
#  CẤU HÌNH
# ══════════════════════════════════════════════════════════
CONFIG = {
    # Mặt bằng
    "floor_width":    20.0,   # X (m)
    "floor_depth":    20.0,   # Y (m)
    "floor_height":    5.0,   # Chiều cao (m) — open space cao

    # Cột thép mảnh
    "col_size":        0.3,   # Tiết diện cột (m)
    "col_spacing":     5.0,   # Lưới 5×5m

    # Curtain Wall
    "glass_thickness": 0.02,  # Độ dày tấm kính (m)
    "mullion_w":       0.06,  # Bề rộng thanh khung nhôm (m)
    "mullion_d":       0.08,  # Độ sâu thanh khung nhôm (m)
    "panel_w":         2.5,   # Rộng 1 tấm kính (m) — phân module
    "panel_h":         2.5,   # Cao 1 tấm kính (m) — 2 hàng × 2.5m = 5m

    # Sàn
    "slab_thickness":  0.2,

    # Mezzanine (sàn lửng chu vi)
    "mezz_width":      3.0,   # Chiều rộng ban công trong (m)
    "mezz_height":     3.0,   # Độ cao sàn lửng tính từ sàn chính
    "mezz_thickness":  0.15,
}

# ══════════════════════════════════════════════════════════
#  HÀM TIỆN ÍCH (tương tự tang_ham)
# ══════════════════════════════════════════════════════════

def move_to_collection(obj, target_col):
    for col in list(obj.users_collection):
        col.objects.unlink(obj)
    target_col.objects.link(obj)

def clear_collection(name_or_col):
    col = bpy.data.collections.get(name_or_col) if isinstance(name_or_col, str) else name_or_col
    if col:
        for child_col in list(col.children):
            clear_collection(child_col)
        for obj in list(col.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.collections.remove(col)

def new_collection(name, parent=None):
    col = bpy.data.collections.new(name)
    if parent is None:
        bpy.context.scene.collection.children.link(col)
    else:
        parent.children.link(col)
    return col

def create_material(name, color, roughness=0.5, metallic=0.0,
                    alpha=1.0, transmission=0.0, ior=1.45):
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    if alpha < 1.0 or transmission > 0:
        mat.blend_method = 'BLEND'
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value  = (*color, 1.0)
        bsdf.inputs["Roughness"].default_value   = roughness
        bsdf.inputs["Metallic"].default_value    = metallic
        bsdf.inputs["Alpha"].default_value       = alpha
        # Blender 4.x: Transmission là "Transmission Weight"
        try:
            bsdf.inputs["Transmission Weight"].default_value = transmission
        except KeyError:
            try:
                bsdf.inputs["Transmission"].default_value = transmission
            except KeyError:
                pass
        try:
            bsdf.inputs["IOR"].default_value = ior
        except KeyError:
            pass
    return mat

def assign_material(obj, mat):
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)

def make_box(name, scale, location, mat, target_col):
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name  = name
    obj.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    assign_material(obj, mat)
    move_to_collection(obj, target_col)
    return obj

# ══════════════════════════════════════════════════════════
#  KHỞI TẠO COLLECTIONS
# ══════════════════════════════════════════════════════════

clear_collection("TANG_TTTM")

root_col     = new_collection("TANG_TTTM")
col_slabs    = new_collection("Slabs",      parent=root_col)
col_columns  = new_collection("Columns",    parent=root_col)
col_curtain  = new_collection("CurtainWall",parent=root_col)
col_mezz     = new_collection("Mezzanine",  parent=root_col)
col_details  = new_collection("Details",    parent=root_col)

C   = CONFIG
W   = C["floor_width"]
D   = C["floor_depth"]
H   = C["floor_height"]
ST  = C["slab_thickness"]

# ══════════════════════════════════════════════════════════
#  MATERIALS
# ══════════════════════════════════════════════════════════

mat_concrete   = create_material("MAT_Concrete",  (0.72, 0.70, 0.68), roughness=0.90)
mat_floor_tile = create_material("MAT_FloorTile", (0.92, 0.92, 0.90), roughness=0.15, metallic=0.0)
mat_ceiling    = create_material("MAT_Ceiling",   (0.95, 0.95, 0.95), roughness=0.80)
mat_steel      = create_material("MAT_Steel",     (0.80, 0.82, 0.85), roughness=0.20, metallic=0.95)
mat_aluminum   = create_material("MAT_Aluminum",  (0.75, 0.78, 0.80), roughness=0.15, metallic=0.90)

# Kính xanh nhạt, trong suốt
mat_glass      = create_material("MAT_Glass",     (0.65, 0.85, 0.90),
                                 roughness=0.02, metallic=0.0,
                                 alpha=0.25, transmission=0.95, ior=1.52)

mat_mezz_slab  = create_material("MAT_MezzSlab",  (0.60, 0.60, 0.62), roughness=0.70)

# ══════════════════════════════════════════════════════════
#  1. SÀN (POLISHED TILE)
# ══════════════════════════════════════════════════════════

make_box("slab",
         scale    = (W, D, ST),
         location = (W/2, D/2, -ST/2),
         mat      = mat_floor_tile,
         target_col = col_slabs)

# ══════════════════════════════════════════════════════════
#  2. TRẦN (CEILING)
# ══════════════════════════════════════════════════════════

make_box("ceiling",
         scale    = (W, D, ST),
         location = (W/2, D/2, H + ST/2),
         mat      = mat_ceiling,
         target_col = col_slabs)

# ══════════════════════════════════════════════════════════
#  3. CỘT THÉP MẢNH (lưới 5×5m, giữa mặt bằng)
#     Bỏ hàng ngoài cùng (vị trí đó là curtain wall)
# ══════════════════════════════════════════════════════════

cs    = C["col_size"]
sp    = C["col_spacing"]
n_col = int(W / sp) + 1   # = 5

print(f"[TTTM] Tạo cột thép: {n_col}×{n_col} = {n_col*n_col} cột")

for i in range(n_col):
    for j in range(n_col):
        x = i * sp
        y = j * sp
        make_box(
            name       = f"Col_{i:02d}_{j:02d}",
            scale      = (cs, cs, H),
            location   = (x, y, H/2),
            mat        = mat_steel,
            target_col = col_columns,
        )

# ══════════════════════════════════════════════════════════
#  4. CURTAIN WALL — VÁCH KÍNH 4 MẶT
#
#  Mỗi mặt gồm:
#    a) Tấm kính (glass panels)
#    b) Thanh đứng (vertical mullion)
#    c) Thanh ngang (horizontal transom)
# ══════════════════════════════════════════════════════════

pw   = C["panel_w"]       # 2.5m / tấm
ph   = C["panel_h"]       # 2.5m / hàng  → 2 hàng = 5m
gt   = C["glass_thickness"]
mw   = C["mullion_w"]
md   = C["mullion_d"]

# Helper: tạo Curtain Wall cho 1 mặt
def make_curtain_wall(face_name, length, offset_x, offset_y,
                      rot_z_deg, col):
    """
    face_name  : tên prefix (VD: "South")
    length     : chiều dài mặt tiền (m)
    offset_x/y : vị trí gốc (góc trái mặt tiền)
    rot_z_deg  : góc xoay để căn hướng mặt tiền
    col        : collection đích
    """
    n_panels_w = int(length / pw)    # số tấm theo chiều ngang
    n_panels_h = int(H     / ph)     # số tấm theo chiều cao

    import math as _math
    rad = _math.radians(rot_z_deg)

    def local_to_world(lx, ly, lz):
        """Chuyển tọa độ cục bộ theo mặt tiền sang world"""
        wx = offset_x + lx * _math.cos(rad) - 0 * _math.sin(rad)
        wy = offset_y + lx * _math.sin(rad) + 0 * _math.cos(rad)
        return (wx, wy, lz)

    # ── 4a. Tấm kính ──────────────────────────────────────
    for pi in range(n_panels_w):
        for pj in range(n_panels_h):
            cx_local = pi * pw + pw/2
            cz       = pj * ph + ph/2
            pos = local_to_world(cx_local, 0, cz)

            bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
            gobj = bpy.context.active_object
            gobj.name = f"CW_{face_name}_Glass_{pi:02d}_{pj:02d}"

            # Scale: chiều dọc theo mặt tiền = pw, chiều sâu = gt, cao = ph
            gobj.scale = (pw - mw, gt, ph - mw)
            gobj.rotation_euler[2] = rad
            bpy.ops.object.transform_apply(scale=True, rotation=True)
            assign_material(gobj, mat_glass)
            move_to_collection(gobj, col)

    # ── 4b. Mullion đứng (vertical) ───────────────────────
    for mi in range(n_panels_w + 1):
        cx_local = mi * pw
        cz       = H / 2
        pos = local_to_world(cx_local, 0, cz)

        bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
        mobj = bpy.context.active_object
        mobj.name = f"CW_{face_name}_MullV_{mi:02d}"
        mobj.scale = (mw, md, H)
        mobj.rotation_euler[2] = rad
        bpy.ops.object.transform_apply(scale=True, rotation=True)
        assign_material(mobj, mat_aluminum)
        move_to_collection(mobj, col)

    # ── 4c. Transom ngang (horizontal) ────────────────────
    for ti in range(n_panels_h + 1):
        cx_local = length / 2
        cz       = ti * ph
        pos = local_to_world(cx_local, 0, cz)

        bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
        tobj = bpy.context.active_object
        tobj.name = f"CW_{face_name}_TransomH_{ti:02d}"
        tobj.scale = (length, md, mw)
        tobj.rotation_euler[2] = rad
        bpy.ops.object.transform_apply(scale=True, rotation=True)
        assign_material(tobj, mat_aluminum)
        move_to_collection(tobj, col)

# 4 mặt tiền: South (Y=0), North (Y=D), West (X=0), East (X=W)
#   offset = vị trí góc trái mặt, rot_z = hướng xoay mặt

make_curtain_wall("South", W, 0,  0,   0,   col_curtain)
make_curtain_wall("North", W, W,  D,   180, col_curtain)
make_curtain_wall("West",  D, 0,  D,   270, col_curtain)
make_curtain_wall("East",  D, W,  0,   90,  col_curtain)

# ══════════════════════════════════════════════════════════
#  5. SÀN MEZZANINE (Sàn lửng chu vi — ban công trong)
#     Chu vi tòa nhà, rộng 3m, ở độ cao 3m
# ══════════════════════════════════════════════════════════

mz_w = C["mezz_width"]      # 3m
mz_h = C["mezz_height"]     # cao 3m từ sàn chính
mz_t = C["mezz_thickness"]  # dày 0.15m

# 4 dải sàn lửng dọc theo chu vi (trừ phần giao nhau ở góc)
mezz_defs = [
    # (name,            scale_x,        scale_y,    loc_x,          loc_y,     loc_z)
    ("Mezz_South", W,              mz_w,       W/2,            mz_w/2,    mz_h + mz_t/2),
    ("Mezz_North", W,              mz_w,       W/2,        D - mz_w/2,   mz_h + mz_t/2),
    ("Mezz_West",  mz_w,       D - 2*mz_w,    mz_w/2,         D/2,       mz_h + mz_t/2),
    ("Mezz_East",  mz_w,       D - 2*mz_w, W - mz_w/2,        D/2,       mz_h + mz_t/2),
]

for name, sx, sy, lx, ly, lz in mezz_defs:
    make_box(name, (sx, sy, mz_t), (lx, ly, lz), mat_mezz_slab, col_mezz)

# Lan can mezzanine (tường thấp 0.9m, dày 0.1m, cạnh trong)
rail_h = 0.9
rail_t = 0.1

rail_defs = [
    ("Rail_South", W,          rail_t, rail_h, W/2,         mz_w - rail_t/2, mz_h + mz_t + rail_h/2),
    ("Rail_North", W,          rail_t, rail_h, W/2,     D - mz_w + rail_t/2, mz_h + mz_t + rail_h/2),
    ("Rail_West",  rail_t, D - 2*mz_w, rail_h, mz_w - rail_t/2, D/2,        mz_h + mz_t + rail_h/2),
    ("Rail_East",  rail_t, D - 2*mz_w, rail_h, W - mz_w + rail_t/2, D/2,   mz_h + mz_t + rail_h/2),
]

for name, sx, sy, sz, lx, ly, lz in rail_defs:
    make_box(name, (sx, sy, sz), (lx, ly, lz), mat_concrete, col_mezz)

# ══════════════════════════════════════════════════════════
#  6. ESCALATOR PLACEHOLDER
#     2 thang cuốn song song, khu vực trung tâm
# ══════════════════════════════════════════════════════════

ESC_L = 6.0   # dài (m)
ESC_W = 1.2   # rộng 1 thang (m)
ESC_H = mz_h  # cao từ sàn đến mezzanine

import math as _math

esc_angle = _math.atan2(ESC_H, ESC_L)   # góc nghiêng
esc_diag  = _math.sqrt(ESC_L**2 + ESC_H**2)

for idx, ey in enumerate([D/2 - ESC_W * 0.7, D/2 + ESC_W * 0.7]):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(W/2, ey, ESC_H/2))
    esc = bpy.context.active_object
    esc.name = f"Escalator_{idx:02d}"
    esc.scale = (esc_diag, ESC_W, 0.15)
    esc.rotation_euler[1] = -esc_angle   # nghiêng theo trục Y
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    assign_material(esc, mat_steel)
    move_to_collection(esc, col_details)

# ══════════════════════════════════════════════════════════
#  HOÀN TẤT
# ══════════════════════════════════════════════════════════

n_panels_total = 4 * (int(W/pw) * int(H/ph))

print()
print("=" * 58)
print("  ✅  TẦNG TTTM ĐÃ ĐƯỢC TẠO THÀNH CÔNG!")
print("=" * 58)
print(f"  Mặt bằng    : {W}m × {D}m × {H}m (open space)")
print(f"  Cột thép    : {n_col*n_col} cột (lưới {sp}×{sp}m, {cs}×{cs}m)")
print(f"  Curtain Wall: {n_panels_total} tấm kính ({pw}×{ph}m mỗi tấm)")
print(f"  Mezzanine   : rộng {mz_w}m, cao {mz_h}m")
print(f"  Escalator   : 2 thang cuốn (placeholder)")
print("=" * 58)
print("  📁 Outliner → TANG_TTTM/")
print("     ├── TTTM_Slabs        (sàn + trần)")
print("     ├── TTTM_Columns      (cột thép)")
print("     ├── TTTM_CurtainWall  (kính + mullion 4 mặt)")
print("     ├── TTTM_Mezzanine    (sàn lửng + lan can)")
print("     └── TTTM_Details      (escalator)")
print("=" * 58)
