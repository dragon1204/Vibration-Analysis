"""
=============================================================
  TẦNG DÂN CƯ - RESIDENTIAL FLOOR GENERATOR
  Kích thước: 20m x 20m x 3.3m
  
  Layout: 4 căn hộ + hành lang trung tâm
  ┌──────────┬──┬──────────┐  Y=20
  │  Unit B  │  │  Unit D  │  ← Bắc (ban công)
  │  9×8.5m  │  │  9×8.5m  │
  ├──────────┤  ├──────────┤  Y=11.5 (hành lang Y=10~11)
  │  Hành lang (2m × 20m)  │
  ├──────────┤  ├──────────┤  Y=8.5
  │  Unit A  │  │  Unit C  │
  │  9×8.5m  │  │  9×8.5m  │  ← Nam (ban công)
  └──────────┴──┴──────────┘  Y=0
  X=0       X=9 X=11      X=20

  CÁCH DÙNG:
    Blender → Scripting → Open file này → Alt+P
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
    "floor_height":    3.3,   # Chiều cao trần (m)

    # Hành lang trung tâm (chạy dọc X, giữa Y)
    "corridor_width":  2.0,   # Rộng hành lang (m) — Y: 9~11

    # Vách ngăn
    "wall_t":          0.2,   # Độ dày tường nội thất (m)
    "ext_wall_t":      0.25,  # Độ dày tường ngoại thất (m)

    # Sàn / Trần
    "slab_t":          0.2,

    # Ban công (Balcony)
    "balcony_depth":   1.5,   # Độ sâu ban công (m)
    "balcony_h":       1.1,   # Chiều cao lan can (m)
    "balcony_glass_t": 0.012, # Độ dày kính lan can (m)

    # Lam chắn nắng (Sun Louver)
    "louver_w":        0.15,  # Bề rộng 1 lam (m)
    "louver_t":        0.03,  # Độ dày lam (m)
    "louver_spacing":  0.25,  # Khoảng cách giữa các lam (m)
    "louver_angle":    30.0,  # Góc nghiêng (độ)

    # Cửa / Cửa sổ
    "door_w":          0.9,
    "door_h":          2.1,
    "window_w":        1.5,
    "window_h":        1.2,
    "window_sill":     0.8,   # Chiều cao bậu cửa sổ từ sàn
}

# ══════════════════════════════════════════════════════════
#  HÀM TIỆN ÍCH
# ══════════════════════════════════════════════════════════

def move_to_collection(obj, target_col):
    for col in list(obj.users_collection):
        col.objects.unlink(obj)
    target_col.objects.link(obj)

def clear_collection(name_or_col):
    col = bpy.data.collections.get(name_or_col) if isinstance(name_or_col, str) else name_or_col
    if col:
        # Xóa đệ quy các collection con
        for child_col in list(col.children):
            clear_collection(child_col)
        # Xóa các object trong collection này
        for obj in list(col.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        # Xóa chính collection này
        bpy.data.collections.remove(col)

def new_collection(name, parent=None):
    col = bpy.data.collections.new(name)
    if parent is None:
        bpy.context.scene.collection.children.link(col)
    else:
        parent.children.link(col)
    return col

def create_material(name, color, roughness=0.8, metallic=0.0,
                    alpha=1.0, transmission=0.0):
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    if alpha < 1.0 or transmission > 0:
        mat.blend_method = 'BLEND'
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
        bsdf.inputs["Roughness"].default_value  = roughness
        bsdf.inputs["Metallic"].default_value   = metallic
        bsdf.inputs["Alpha"].default_value      = alpha
        for key in ("Transmission Weight", "Transmission"):
            try:
                bsdf.inputs[key].default_value = transmission
                break
            except KeyError:
                continue
    return mat

def assign_material(obj, mat):
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)

def make_box(name, scale, location, mat, target_col, rot_z=0.0):
    """Tạo Cube với scale/vị trí/rotation, gán material, chuyển collection"""
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name  = name
    obj.scale = scale
    if rot_z != 0.0:
        obj.rotation_euler[2] = math.radians(rot_z)
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    assign_material(obj, mat)
    move_to_collection(obj, target_col)
    return obj

# ══════════════════════════════════════════════════════════
#  KHỞI TẠO
# ══════════════════════════════════════════════════════════

clear_collection("TANG_DANCUU")

root_col     = new_collection("TANG_DANCUU")
col_slabs    = new_collection("Slabs",       parent=root_col)
col_extwall  = new_collection("ExtWalls",    parent=root_col)
col_intwall  = new_collection("IntWalls",    parent=root_col)
col_balcony  = new_collection("Balcony",     parent=root_col)
col_louver   = new_collection("Louvers",     parent=root_col)
col_openings = new_collection("Windows_Doors", parent=root_col)
col_corridor = new_collection("Corridor",    parent=root_col)

C  = CONFIG
W  = C["floor_width"]       # 20m
D  = C["floor_depth"]       # 20m
H  = C["floor_height"]      # 3.3m
ST = C["slab_t"]
WT = C["wall_t"]
EW = C["ext_wall_t"]
CW = C["corridor_width"]    # 2m

# Tọa độ hành lang (trung tâm theo Y)
CORR_Y0 = D/2 - CW/2       # = 9.0
CORR_Y1 = D/2 + CW/2       # = 11.0

# ══════════════════════════════════════════════════════════
#  MATERIALS
# ══════════════════════════════════════════════════════════

mat_floor_wood = create_material("MAT_FloorWood",  (0.55, 0.38, 0.22), roughness=0.70)
mat_floor_tile = create_material("MAT_Corridor",   (0.75, 0.74, 0.72), roughness=0.30)
mat_ceiling    = create_material("MAT_DaCeiling",  (0.96, 0.96, 0.95), roughness=0.85)
mat_ext_wall   = create_material("MAT_ExtWall",    (0.88, 0.87, 0.84), roughness=0.90)
mat_int_wall   = create_material("MAT_IntWall",    (0.95, 0.93, 0.90), roughness=0.85)
mat_glass      = create_material("MAT_DaGlass",    (0.75, 0.88, 0.92),
                                 roughness=0.02, alpha=0.25, transmission=0.92)
mat_rail_steel = create_material("MAT_RailSteel",  (0.82, 0.84, 0.86),
                                 roughness=0.15, metallic=0.95)
mat_louver     = create_material("MAT_Louver",     (0.60, 0.62, 0.65),
                                 roughness=0.20, metallic=0.80)
mat_balcony    = create_material("MAT_Balcony",    (0.70, 0.70, 0.70), roughness=0.80)
mat_door_frame = create_material("MAT_DoorFrame",  (0.30, 0.28, 0.25), roughness=0.60)
mat_window_fr  = create_material("MAT_WindowFr",   (0.70, 0.72, 0.75),
                                 roughness=0.15, metallic=0.85)

# ══════════════════════════════════════════════════════════
#  1. SÀN GỖ & TRẦN
# ══════════════════════════════════════════════════════════

# Sàn khu căn hộ (gỗ)
make_box("slab", (W, D, ST), (W/2, D/2, -ST/2), mat_floor_wood, col_slabs)

# Sàn hành lang (gạch tile)
make_box("CorridorFloor",
         (W, CW, ST * 0.5),
         (W/2, D/2, -ST*0.25),
         mat_floor_tile, col_corridor)

# Trần
make_box("ceiling", (W, D, ST), (W/2, D/2, H + ST/2), mat_ceiling, col_slabs)

# ══════════════════════════════════════════════════════════
#  2. TƯỜNG NGOẠI THẤT 4 MẶT
#     (chừa lỗ ban công ở South & North bằng cách chia nhỏ)
# ══════════════════════════════════════════════════════════

BD = C["balcony_depth"]   # 1.5m — độ sâu ban công

# --- Mặt South (Y = 0) — chia 2 đoạn tránh ban công ---
# Tường ngoài ban công (mỏng hơn, chỉ là lan can dưới)
# Thay vào đó: đặt tường South thụt vào 1.5m (để lộ ban công)
make_box("wall_South",
         (W, EW, H),
         (W/2, BD - EW/2, H/2),
         mat_ext_wall, col_extwall)

# --- Mặt North (Y = D) ---
make_box("wall_North",
         (W, EW, H),
         (W/2, D - BD + EW/2, H/2),
         mat_ext_wall, col_extwall)

# --- Mặt West (X = 0) ---
make_box("wall_West",
         (EW, D, H),
         (-EW/2, D/2, H/2),
         mat_ext_wall, col_extwall)

# --- Mặt East (X = W) ---
make_box("wall_East",
         (EW, D, H),
         (W + EW/2, D/2, H/2),
         mat_ext_wall, col_extwall)

# ══════════════════════════════════════════════════════════
#  3. VÁCH NGĂN NỘI THẤT
#
#  Layout:
#  ┌─────────┬──┬─────────┐
#  │ Unit B  │  │ Unit D  │  Y: 11 ~ 20
#  ├─────────┤HC│─────────┤  Hành lang Y: 9 ~ 11
#  │ Unit A  │  │ Unit C  │  Y: 0 ~ 9  (thực tế 0 ~ CORR_Y0)
#  └─────────┴──┴─────────┘
#              X: 9  11
# ══════════════════════════════════════════════════════════

# Vách dọc trung tâm — trái hành lang (X = 9)
make_box("wall_CorrLeft",
         (WT, D, H),
         (W/2 - CW/2 - WT/2, D/2, H/2),
         mat_int_wall, col_corridor)

# Vách dọc trung tâm — phải hành lang (X = 11)
make_box("wall_CorrRight",
         (WT, D, H),
         (W/2 + CW/2 + WT/2, D/2, H/2),
         mat_int_wall, col_corridor)

# Vách ngang phân chia Unit A/B (trái hành lang, Y = CORR_Y0)
make_box("wall_AB_South",
         (W/2 - CW/2 - WT, WT, H),
         ((W/2 - CW/2 - WT) / 2, CORR_Y0 - WT/2, H/2),
         mat_int_wall, col_intwall)

# Vách ngang phân chia Unit C/D (phải hành lang, Y = CORR_Y0)
x_right_start = W/2 + CW/2 + WT
x_right_width  = W - x_right_start
make_box("wall_CD_South",
         (x_right_width, WT, H),
         (x_right_start + x_right_width/2, CORR_Y0 - WT/2, H/2),
         mat_int_wall, col_intwall)

# Vách ngang phân chia Unit A/B phía Bắc (Y = CORR_Y1)
make_box("wall_AB_North",
         (W/2 - CW/2 - WT, WT, H),
         ((W/2 - CW/2 - WT) / 2, CORR_Y1 + WT/2, H/2),
         mat_int_wall, col_intwall)

# Vách ngang phân chia Unit C/D phía Bắc (Y = CORR_Y1)
make_box("wall_CD_North",
         (x_right_width, WT, H),
         (x_right_start + x_right_width/2, CORR_Y1 + WT/2, H/2),
         mat_int_wall, col_intwall)

# ── Vách nội thất trong từng căn hộ ───────────────────────
# Mỗi căn: phân chia phòng ngủ / phòng khách / WC đơn giản

unit_left_w  = W/2 - CW/2 - WT    # ~8.8m
unit_right_w = x_right_width       # ~8.8m

# Unit A & B (phía Tây): vách chia phòng ngủ | phòng khách tại X = 4.5
inner_wall_x_L = 4.5
make_box("wall_A_Inner",
         (WT, CORR_Y0 - BD - EW - WT, H),
         (inner_wall_x_L, (CORR_Y0 - BD - EW - WT)/2 + BD + EW, H/2),
         mat_int_wall, col_intwall)
make_box("wall_B_Inner",
         (WT, D - CORR_Y1 - BD - EW - WT, H),
         (inner_wall_x_L, CORR_Y1 + WT + (D - CORR_Y1 - BD - EW - WT)/2, H/2),
         mat_int_wall, col_intwall)
# Unit C & D (phía Đông): vách chia phòng tại X = W - 4.5
inner_wall_x_R = W - 4.5
make_box("wall_C_Inner",
         (WT, CORR_Y0 - BD - EW - WT, H),
         (inner_wall_x_R, (CORR_Y0 - BD - EW - WT)/2 + BD + EW, H/2),
         mat_int_wall, col_intwall)
make_box("wall_D_Inner",
         (WT, D - CORR_Y1 - BD - EW - WT, H),
         (inner_wall_x_R, CORR_Y1 + WT + (D - CORR_Y1 - BD - EW - WT)/2, H/2),
         mat_int_wall, col_intwall)

# ══════════════════════════════════════════════════════════
#  5. LAM CHẮN NẮNG (SUN LOUVER)
#     Gắn phía trước ban công South & North
#     Mỗi lam: ngang 0.15m, nghiêng 30°, cách nhau 0.25m
# ══════════════════════════════════════════════════════════

LW  = C["louver_w"]        # 0.15m — bề rộng lam (theo Y)
LT  = C["louver_t"]        # 0.03m — dày
LSP = C["louver_spacing"]  # 0.25m — khoảng cách mép-mép
LAN = C["louver_angle"]    # 30°   — nghiêng

n_louvers = int(H / (LW + LSP))   # số lam theo chiều cao

print(f"[DC] Tạo {n_louvers} lam chắn nắng mỗi mặt...")

for k in range(n_louvers):
    lz = (k + 0.5) * (LW + LSP) + 0.1   # vị trí cao
    if lz > H - LW:
        break
        
    # Mặt South — lam gắn ở mép ngoài ban công (Y = LW/2)
    l_s = make_box(
        name       = f"Louver_S_{k:02d}",
        scale      = (W, LW, LT),
        location   = (W/2, LW/2, lz),
        mat        = mat_louver,
        target_col = col_louver,
        rot_z      = 0.0,
    )
    l_s.rotation_euler[0] = math.radians(LAN)
    
    # Mặt North — lam gắn ở mép ngoài ban công (Y = D - LW/2)
    l_n = make_box(
        name       = f"Louver_N_{k:02d}",
        scale      = (W, LW, LT),
        location   = (W/2, D - LW/2, lz),
        mat        = mat_louver,
        target_col = col_louver,
        rot_z      = 0.0,
    )
    l_n.rotation_euler[0] = math.radians(-LAN)

# ══════════════════════════════════════════════════════════
#  4. BAN CÔNG (BALCONY) — South & North
# ══════════════════════════════════════════════════════════

BH = C["balcony_h"]        # 1.1m — chiều cao lan can
BT = C["balcony_glass_t"]  # 0.012m — kính lan can

# Sàn ban công South (Y: 0 ~ BD)
make_box("Balcony_South_Floor",
         (W, BD, 0.15),
         (W/2, BD/2, -0.075),
         mat_balcony, col_balcony)

# Sàn ban công North (Y: D-BD ~ D)
make_box("Balcony_North_Floor",
         (W, BD, 0.15),
         (W/2, D - BD/2, -0.075),
         mat_balcony, col_balcony)

# Lan can kính South (mặt ngoài)
make_box("Rail_South_Glass",
         (W, BT, BH),
         (W/2, 0.05, BH/2),
         mat_glass, col_balcony)

# Lan can kính North
make_box("Rail_North_Glass",
         (W, BT, BH),
         (W/2, D - 0.05, BH/2),
         mat_glass, col_balcony)

# Thanh đỡ lan can (vertical posts) — mỗi 1.25m
post_interval = 1.25
n_posts = int(W / post_interval)

for k in range(n_posts + 1):
    px = k * post_interval
    for side, py in [("S", 0.05), ("N", D - 0.05)]:
        make_box(
            name       = f"RailPost_{side}_{k:02d}",
            scale      = (0.05, 0.05, BH),
            location   = (px, py, BH/2),
            mat        = mat_rail_steel,
            target_col = col_balcony,
        )

# ══════════════════════════════════════════════════════════
#  6. CỬA SỔ PHÒNG KHÁCH (Glass panel lớn, nhìn ra ban công)
#     4 vị trí: 1 mỗi căn hộ, trên tường South/North nội thất
# ══════════════════════════════════════════════════════════

WW = C["window_w"]   # 1.5m
WH = C["window_h"]   # 1.2m
WS = C["window_sill"]  # 0.8m

# Đại diện mỗi căn: cửa sổ lớn về phía ban công
window_defs = [
    # (name,            scale_x, scale_y,  scale_z,   loc_x,    loc_y,           loc_z)
    # Unit A — South
    ("Win_A", WW, 0.05, WH, W/4,        BD + EW, WS + WH/2),
    # Unit B — North
    ("Win_B", WW, 0.05, WH, W/4,    D - BD - EW, WS + WH/2),
    # Unit C — South
    ("Win_C", WW, 0.05, WH, 3*W/4,      BD + EW, WS + WH/2),
    # Unit D — North
    ("Win_D", WW, 0.05, WH, 3*W/4, D - BD - EW, WS + WH/2),
]

for name, sx, sy, sz, lx, ly, lz in window_defs:
    make_box(name, (sx, sy, sz), (lx, ly, lz), mat_glass, col_openings)

# Khung cửa sổ nhôm
for name, sx, sy, sz, lx, ly, lz in window_defs:
    # Khung trên/dưới
    for dz in [-sz/2, sz/2]:
        make_box(f"{name}_FrameH",
                 (sx + 0.06, 0.06, 0.04),
                 (lx, ly, lz + dz),
                 mat_window_fr, col_openings)
    # Khung trái/phải
    for dx in [-sx/2, sx/2]:
        make_box(f"{name}_FrameV",
                 (0.04, 0.06, sz + 0.06),
                 (lx + dx, ly, lz),
                 mat_window_fr, col_openings)

# ══════════════════════════════════════════════════════════
#  7. CỬA CĂN HỘ ra HÀNH LANG (Door placeholder)
# ══════════════════════════════════════════════════════════

DW = C["door_w"]   # 0.9m
DH = C["door_h"]   # 2.1m

door_defs = [
    # (name,    loc_x,  loc_y,              rot_z)
    ("Door_A", W/4,    CORR_Y0 - WT/2,   0),
    ("Door_B", W/4,    CORR_Y1 + WT/2,   0),
    ("Door_C", 3*W/4,  CORR_Y0 - WT/2,   0),
    ("Door_D", 3*W/4,  CORR_Y1 + WT/2,   0),
]

for dname, dlx, dly, drz in door_defs:
    # Cánh cửa (hình hộp mỏng)
    make_box(f"{dname}_Panel",
             (DW, 0.05, DH),
             (dlx, dly, DH/2),
             mat_door_frame, col_openings)
    # Khung cửa
    for dx in [-DW/2, DW/2]:
        make_box(f"{dname}_FrameV",
                 (0.08, 0.10, DH + 0.06),
                 (dlx + dx, dly, DH/2),
                 mat_door_frame, col_openings)
    make_box(f"{dname}_FrameH",
             (DW + 0.16, 0.10, 0.08),
             (dlx, dly, DH + 0.04),
             mat_door_frame, col_openings)

# ══════════════════════════════════════════════════════════
#  8. ĐÈN HÀNH LANG (Light strip placeholder)
# ══════════════════════════════════════════════════════════

# Dải đèn LED trần hành lang, cách nhau 2m
n_lights = int(W / 2)
for k in range(n_lights):
    lx = (k + 0.5) * (W / n_lights)
    make_box(
        name       = f"CorridorLight_{k:02d}",
        scale      = (0.6, 0.1, 0.04),
        location   = (lx, D/2, H - 0.02),
        mat        = create_material("MAT_LEDStrip", (1.0, 0.97, 0.85),
                                     roughness=0.1),
        target_col = col_corridor,
    )

# ══════════════════════════════════════════════════════════
#  HOÀN TẤT
# ══════════════════════════════════════════════════════════

unit_area = (W/2 - CW/2) * ((D - CW)/2 - BD)

print()
print("=" * 60)
print("  ✅  TẦNG DÂN CƯ ĐÃ ĐƯỢC TẠO THÀNH CÔNG!")
print("=" * 60)
print(f"  Mặt bằng      : {W}m × {D}m × {H}m")
print(f"  Số căn hộ     : 4 căn (Unit A, B, C, D)")
print(f"  Diện tích/căn : ~{unit_area:.1f} m² (không kể ban công)")
print(f"  Ban công       : rộng {W}m, sâu {BD}m (Nam & Bắc)")
print(f"  Lam chắn nắng : {n_louvers} lam/mặt, nghiêng {LAN}°")
print(f"  Hành lang      : {CW}m × {W}m (trung tâm)")
print("=" * 60)
print("  📁 Outliner → TANG_DANCUU/")
print("     ├── DC_Slabs         (sàn gỗ + trần)")
print("     ├── DC_ExtWalls      (tường ngoại thất)")
print("     ├── DC_IntWalls      (vách ngăn căn hộ)")
print("     ├── DC_Balcony       (ban công + lan can kính)")
print("     ├── DC_Louvers       (lam chắn nắng)")
print("     ├── DC_Windows_Doors (cửa sổ + cửa vào)")
print("     └── DC_Corridor      (sàn + đèn hành lang)")
print("=" * 60)
print()
print("  📐 Sơ đồ mặt bằng:")
print("  ┌──────────┬──┬──────────┐  Y=20")
print("  │  Unit B  │  │  Unit D  │  ← ban công Bắc")
print("  ├──────────┤HC│─────────┤   Y=11")
print("  │  Hành lang (2m)        │   Y=9~11")
print("  ├──────────┤  ├─────────┤   Y=9")
print("  │  Unit A  │  │  Unit C  │  ← ban công Nam")
print("  └──────────┴──┴─────────┘  Y=0")
print("  X=0      X=9  X=11     X=20")

