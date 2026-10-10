"""
=============================================================
  TẦNG THƯỢNG - ROOFTOP AMENITY FLOOR GENERATOR
  Kích thước: 20m x 20m (mái phẳng, ngoài trời)

  Layout:
  ┌──────────────────────────────────┐  Y=20
  │  [HVAC Zone]     [Water Tank]    │
  │  ┌──────┐  ┌─┐                  │  Y=15~20
  ├──┘      └──┘ └──────────────────┤
  │        [Pergola / Mái che]       │  Y=10~17
  ├──────────────────────────────────┤
  │  [Bể Bơi 8×4m]  [Sun Deck]      │  Y=4~10
  ├──────────────────────────────────┤
  │  [Vườn Xanh]   [Thang máy/BM]   │  Y=0~4
  └──────────────────────────────────┘
     X=0                         X=20

  CÁCH DÙNG:
    Blender → Scripting → Open file → Alt+P
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
    "floor_width":   20.0,
    "floor_depth":   20.0,

    # Tường chắn mái (Parapet)
    "parapet_h":      1.2,   # chiều cao lan can mái (m)
    "parapet_t":      0.2,   # độ dày

    # Bể bơi
    "pool_w":         8.0,
    "pool_d":         4.0,
    "pool_depth":     1.5,   # độ sâu bể
    "pool_x":         5.0,   # vị trí góc trái dưới
    "pool_y":         5.0,

    # Mái che Pergola
    "pergola_x":      1.0,   # vị trí bắt đầu
    "pergola_y":      9.5,
    "pergola_w":     18.0,   # rộng
    "pergola_d":      8.0,   # sâu
    "pergola_h":      3.5,   # chiều cao cột
    "beam_w":         0.15,  # bề rộng xà ngang
    "beam_t":         0.12,  # độ dày xà
    "beam_spacing":   0.6,   # khoảng cách xà mái
    "col_size":       0.15,  # tiết diện cột pergola

    # Khu kỹ thuật HVAC (góc NE)
    "hvac_x":        13.0,
    "hvac_y":        14.0,
    "hvac_w":         6.0,
    "hvac_d":         5.0,

    # Bể nước mái
    "tank_x":         1.0,
    "tank_y":        15.0,
    "tank_w":         3.0,
    "tank_d":         2.5,
    "tank_h":         2.0,

    # Sàn
    "slab_t":         0.2,
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

def create_material(name, color, roughness=0.8, metallic=0.0,
                    alpha=1.0, transmission=0.0, emission_strength=0.0):
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    if alpha < 1.0 or transmission > 0:
        mat.blend_method = 'BLEND'
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf  = nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value  = (*color, 1.0)
        bsdf.inputs["Roughness"].default_value   = roughness
        bsdf.inputs["Metallic"].default_value    = metallic
        bsdf.inputs["Alpha"].default_value       = alpha
        for key in ("Transmission Weight", "Transmission"):
            try:
                bsdf.inputs[key].default_value = transmission
                break
            except KeyError:
                continue
        if emission_strength > 0:
            try:
                bsdf.inputs["Emission Color"].default_value   = (*color, 1.0)
                bsdf.inputs["Emission Strength"].default_value = emission_strength
            except KeyError:
                pass
    return mat

def assign_material(obj, mat):
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)

def make_box(name, scale, location, mat, target_col, rot_z=0.0, rot_x=0.0):
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name  = name
    obj.scale = scale
    if rot_z != 0.0:
        obj.rotation_euler[2] = math.radians(rot_z)
    if rot_x != 0.0:
        obj.rotation_euler[0] = math.radians(rot_x)
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    assign_material(obj, mat)
    move_to_collection(obj, target_col)
    return obj

def make_cylinder(name, radius, depth, location, mat, target_col, rot_x=0.0):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth,
                                         vertices=16, location=location)
    obj = bpy.context.active_object
    obj.name = name
    if rot_x != 0.0:
        obj.rotation_euler[0] = math.radians(rot_x)
        bpy.ops.object.transform_apply(rotation=True)
    assign_material(obj, mat)
    move_to_collection(obj, target_col)
    return obj

# ══════════════════════════════════════════════════════════
#  KHỞI TẠO
# ══════════════════════════════════════════════════════════

clear_collection("TANG_THUONG")

root_col    = new_collection("TANG_THUONG")
col_base    = new_collection("Base",        parent=root_col)
col_parapet = new_collection("Parapet",     parent=root_col)
col_pool    = new_collection("Pool",        parent=root_col)
col_deck    = new_collection("SunDeck",     parent=root_col)
col_pergola = new_collection("Pergola",     parent=root_col)
col_hvac    = new_collection("HVAC",        parent=root_col)
col_green   = new_collection("Greenery",    parent=root_col)
col_misc    = new_collection("Misc",        parent=root_col)

C  = CONFIG
W  = C["floor_width"]
D  = C["floor_depth"]
ST = C["slab_t"]
PT = C["parapet_t"]
PH = C["parapet_h"]

# ══════════════════════════════════════════════════════════
#  MATERIALS
# ══════════════════════════════════════════════════════════

mat_roof_slab  = create_material("MAT_RoofSlab",   (0.60, 0.60, 0.60), roughness=0.95)
mat_deck_wood  = create_material("MAT_DeckWood",   (0.50, 0.33, 0.18), roughness=0.70)
mat_parapet    = create_material("MAT_Parapet",    (0.82, 0.80, 0.78), roughness=0.88)
mat_pool_water = create_material("MAT_PoolWater",  (0.12, 0.55, 0.78),
                                 roughness=0.02, alpha=0.75, transmission=0.60)
mat_pool_tile  = create_material("MAT_PoolTile",   (0.25, 0.65, 0.82), roughness=0.25)
mat_pool_wall  = create_material("MAT_PoolWall",   (0.90, 0.92, 0.95), roughness=0.30)
mat_steel_col  = create_material("MAT_SteelCol",   (0.80, 0.82, 0.85),
                                 roughness=0.15, metallic=0.95)
mat_pergola_pc = create_material("MAT_PergolaPC",  (0.88, 0.90, 0.92),
                                 roughness=0.10, metallic=0.80)
mat_pergola_gl = create_material("MAT_PergolaGlass",(0.75, 0.88, 0.92),
                                 roughness=0.02, alpha=0.35, transmission=0.90)
mat_hvac_box   = create_material("MAT_HVAC",       (0.70, 0.72, 0.74),
                                 roughness=0.30, metallic=0.60)
mat_hvac_fan   = create_material("MAT_HVACFan",    (0.30, 0.32, 0.35),
                                 roughness=0.40, metallic=0.80)
mat_tank       = create_material("MAT_WaterTank",  (0.78, 0.80, 0.82),
                                 roughness=0.20, metallic=0.70)
mat_grass      = create_material("MAT_Grass",      (0.18, 0.48, 0.18), roughness=0.95)
mat_planter    = create_material("MAT_Planter",    (0.55, 0.45, 0.38), roughness=0.80)
mat_light_warm = create_material("MAT_LightWarm",  (1.00, 0.88, 0.65),
                                 roughness=0.1, emission_strength=3.0)

# ══════════════════════════════════════════════════════════
#  1. SÀN MÁI (ROOF SLAB)
# ══════════════════════════════════════════════════════════

make_box("slab",
         (W, D, ST),
         (W/2, D/2, -ST/2),
         mat_roof_slab, col_base)

# ══════════════════════════════════════════════════════════
#  2. TƯỜNG CHẮN MÁI (PARAPET) — 4 mặt
# ══════════════════════════════════════════════════════════

parapet_defs = [
    ("Parapet_S", (W + 2*PT, PT, PH), (W/2,         -PT/2,    PH/2)),
    ("Parapet_N", (W + 2*PT, PT, PH), (W/2,      D + PT/2,    PH/2)),
    ("Parapet_W", (PT,        D, PH), (-PT/2,        D/2,     PH/2)),
    ("Parapet_E", (PT,        D, PH), (W + PT/2,     D/2,     PH/2)),
]
for name, scale, loc in parapet_defs:
    make_box(name, scale, loc, mat_parapet, col_parapet)

# ══════════════════════════════════════════════════════════
#  3. BỂ BƠI (SWIMMING POOL)
# ══════════════════════════════════════════════════════════

PX   = C["pool_x"]    # 5.0
PY   = C["pool_y"]    # 5.0
PW   = C["pool_w"]    # 8.0
PDep = C["pool_d"]    # 4.0
PWd  = C["pool_depth"] # 1.5

wt_pool = 0.2  # độ dày thành bể

# Sàn đáy bể (tile xanh)
make_box("Pool_Floor",
         (PW, PDep, 0.1),
         (PX + PW/2, PY + PDep/2, -PWd - 0.05),
         mat_pool_tile, col_pool)

# 4 thành bể
pool_walls = [
    ("Pool_W_S", (PW + 2*wt_pool, wt_pool, PWd), (PX+PW/2,       PY - wt_pool/2,  -PWd/2)),
    ("Pool_W_N", (PW + 2*wt_pool, wt_pool, PWd), (PX+PW/2,  PY+PDep+wt_pool/2,    -PWd/2)),
    ("Pool_W_W", (wt_pool,        PDep, PWd),     (PX-wt_pool/2,  PY+PDep/2,       -PWd/2)),
    ("Pool_W_E", (wt_pool,        PDep, PWd),     (PX+PW+wt_pool/2, PY+PDep/2,     -PWd/2)),
]
for name, scale, loc in pool_walls:
    make_box(name, scale, loc, mat_pool_wall, col_pool)

# Nước (transparent box nổi trên mặt)
make_box("Pool_Water",
         (PW - 0.02, PDep - 0.02, 0.05),
         (PX + PW/2, PY + PDep/2, -0.025),
         mat_pool_water, col_pool)

# Viền bể (pool coping) — đá marble
mat_coping = create_material("MAT_PoolCoping", (0.92, 0.90, 0.88), roughness=0.20)
coping_t   = 0.3   # bề rộng viền
coping_h   = 0.05
coping_defs = [
    ("Pool_Cope_S", (PW + 2*coping_t, coping_t, coping_h),
     (PX+PW/2,          PY - coping_t/2, coping_h/2)),
    ("Pool_Cope_N", (PW + 2*coping_t, coping_t, coping_h),
     (PX+PW/2,     PY+PDep+coping_t/2, coping_h/2)),
    ("Pool_Cope_W", (coping_t, PDep + 2*coping_t, coping_h),
     (PX-coping_t/2,    PY+PDep/2, coping_h/2)),
    ("Pool_Cope_E", (coping_t, PDep + 2*coping_t, coping_h),
     (PX+PW+coping_t/2, PY+PDep/2, coping_h/2)),
]
for name, scale, loc in coping_defs:
    make_box(name, scale, loc, mat_coping, col_pool)

# Đèn hồ bơi dưới nước (glowing)
for k in range(3):
    make_box(f"Pool_Light_{k:02d}",
             (0.2, 0.08, 0.05),
             (PX + 1.5 + k * 2.5, PY + 0.1, -PWd + 0.1),
             mat_light_warm, col_pool)

# ══════════════════════════════════════════════════════════
#  4. SUN DECK (Sàn gỗ khu nằm phơi nắng)
#     Phía Đông bể bơi: X: PX+PW+0.5 → W-1, Y: PY → PY+PDep
# ══════════════════════════════════════════════════════════

deck_x0 = PX + PW + 0.5
deck_x1 = W - 1.0
deck_y0 = PY - 1.0
deck_y1 = PY + PDep + 1.0

deck_w = deck_x1 - deck_x0
deck_d = deck_y1 - deck_y0

make_box("SunDeck_Floor",
         (deck_w, deck_d, 0.05),
         (deck_x0 + deck_w/2, deck_y0 + deck_d/2, 0.025),
         mat_deck_wood, col_deck)

# Thanh gỗ deck (3D strips) — Array sẽ tốt hơn nhưng đây là placeholder
strip_count = int(deck_d / 0.14)
for k in range(strip_count):
    sy = deck_y0 + k * 0.14
    make_box(f"Deck_Strip_{k:02d}",
             (deck_w - 0.02, 0.10, 0.03),
             (deck_x0 + (deck_w-0.02)/2, sy + 0.05, 0.04),
             mat_deck_wood, col_deck)

# Ghế nằm (Sun Lounger placeholder) — 2 chiếc
for i, (lx, ly) in enumerate([(deck_x0 + 1.0, deck_y0 + 1.0),
                                (deck_x0 + 1.0, deck_y0 + 2.5)]):
    make_box(f"Lounger_{i:02d}",
             (1.8, 0.65, 0.3),
             (lx, ly, 0.15),
             mat_deck_wood, col_deck)
    # Lưng ghế nghiêng
    make_box(f"Lounger_{i:02d}_Back",
             (1.8, 0.05, 0.6),
             (lx, ly - 0.3, 0.45),
             mat_deck_wood, col_deck,
             rot_x=-25.0)

# ══════════════════════════════════════════════════════════
#  5. PERGOLA / MÁI CHE CÁC ĐIỆU
#     Cấu trúc: cột thép tròn + dầm ngang + lamellas kính
#     Vị trí: Y=9.5 → 17.5, toàn bộ chiều rộng X=1~19
# ══════════════════════════════════════════════════════════

GX  = C["pergola_x"]     # 1.0
GY  = C["pergola_y"]     # 9.5
GW  = C["pergola_w"]     # 18.0
GD  = C["pergola_d"]     # 8.0
GH  = C["pergola_h"]     # 3.5
BW  = C["beam_w"]        # 0.15
BT  = C["beam_t"]        # 0.12
BSP = C["beam_spacing"]  # 0.6
CS  = C["col_size"]      # 0.15

# Cột tròn (4 góc + 2 giữa)
col_positions_x = [GX, GX + GW/2, GX + GW]
col_positions_y = [GY, GY + GD]

for ci, cx in enumerate(col_positions_x):
    for cj, cy in enumerate(col_positions_y):
        make_cylinder(
            name      = f"Pergola_Col_{ci}_{cj}",
            radius    = CS / 2,
            depth     = GH,
            location  = (cx, cy, GH/2),
            mat       = mat_pergola_pc,
            target_col = col_pergola,
        )

# Dầm chính theo Y (2 dầm dọc trên đỉnh cột)
for ci, cx in enumerate(col_positions_x):
    make_box(f"Pergola_Beam_Y_{ci}",
             (BT, GD + BW, BW),
             (cx, GY + GD/2, GH + BW/2),
             mat_pergola_pc, col_pergola)

# Dầm ngang (lamellas) theo X — phủ từ GY đến GY+GD, cách nhau BSP
n_lamellas = int(GD / BSP) + 1
for k in range(n_lamellas):
    ly = GY + k * (GD / (n_lamellas - 1))
    make_box(f"Pergola_Lamella_{k:02d}",
             (GW + BT, BW * 0.6, BT * 0.8),
             (GX + GW/2, ly, GH + BW),
             mat_pergola_pc, col_pergola)

# Tấm kính mái pergola (trong suốt, phủ giữa)
glass_panels = int(GW / 3.0)
for k in range(glass_panels):
    gx = GX + k * (GW / glass_panels) + (GW / glass_panels)/2
    make_box(f"Pergola_Glass_{k:02d}",
             (GW / glass_panels - BW, GD - BW*2, 0.012),
             (gx, GY + GD/2, GH + BW + 0.006),
             mat_pergola_gl, col_pergola)

# Đèn LED trên dầm ngang pergola
for k in range(0, n_lamellas, 2):
    ly = GY + k * (GD / (n_lamellas - 1))
    make_box(f"Pergola_LED_{k:02d}",
             (GW * 0.8, 0.04, 0.03),
             (GX + GW/2, ly, GH + 0.02),
             mat_light_warm, col_pergola)

# ══════════════════════════════════════════════════════════
#  6. KHU KỸ THUẬT HVAC (góc NE)
# ══════════════════════════════════════════════════════════

HX = C["hvac_x"]    # 13.0
HY = C["hvac_y"]    # 14.0
HW = C["hvac_w"]    # 6.0
HD = C["hvac_d"]    # 5.0

# Sàn khu kỹ thuật (nâng cao 0.1m)
make_box("HVAC_Base",
         (HW, HD, 0.10),
         (HX + HW/2, HY + HD/2, 0.05),
         mat_roof_slab, col_hvac)

# Tường bao khu kỹ thuật (thấp 1.2m, thông gió)
hvac_fence_h = 1.2
hvac_fence_t = 0.1
hvac_fences = [
    ("HVAC_F_S", (HW,       hvac_fence_t, hvac_fence_h), (HX+HW/2,  HY - hvac_fence_t/2,   hvac_fence_h/2)),
    ("HVAC_F_N", (HW,       hvac_fence_t, hvac_fence_h), (HX+HW/2,  HY+HD+hvac_fence_t/2,  hvac_fence_h/2)),
    ("HVAC_F_W", (hvac_fence_t, HD, hvac_fence_h),       (HX-hvac_fence_t/2, HY+HD/2,       hvac_fence_h/2)),
]
for name, scale, loc in hvac_fences:
    make_box(name, scale, loc, mat_parapet, col_hvac)

# Máy lạnh (Outdoor unit) — 3 cụm
for k in range(3):
    ax = HX + 0.5 + k * 1.8
    ay = HY + 0.5
    # Thân máy
    make_box(f"HVAC_Unit_{k:02d}",
             (1.2, 0.4, 0.9),
             (ax + 0.6, ay + 0.2, 0.55),
             mat_hvac_box, col_hvac)
    # Quạt (cylinder)
    make_cylinder(f"HVAC_Fan_{k:02d}",
                  radius   = 0.28,
                  depth    = 0.06,
                  location = (ax + 0.6, ay + 0.42, 0.9),
                  mat      = mat_hvac_fan,
                  target_col = col_hvac,
                  rot_x    = 90.0)

# Tủ điện (Electrical panel)
make_box("HVAC_Panel",
         (0.6, 0.25, 1.4),
         (HX + HW - 0.4, HY + HD - 0.2, 0.8),
         mat_hvac_box, col_hvac)

# Ống thoát nhiệt (condenser pipe) ra mái
for k in range(3):
    make_cylinder(f"HVAC_Pipe_{k:02d}",
                  radius   = 0.05,
                  depth    = 0.8,
                  location = (HX + 0.8 + k * 1.8, HY + 0.9, 0.4),
                  mat      = mat_steel_col,
                  target_col = col_hvac)

# ══════════════════════════════════════════════════════════
#  7. BỂ NƯỚC MÁI (góc NW)
# ══════════════════════════════════════════════════════════

TX = C["tank_x"]    # 1.0
TY = C["tank_y"]    # 15.0
TW = C["tank_w"]    # 3.0
TD = C["tank_d"]    # 2.5
TH = C["tank_h"]    # 2.0

# Chân đỡ bể (4 chân I-beam)
for ix, iy in [(TX+0.3, TY+0.3), (TX+TW-0.3, TY+0.3),
                (TX+0.3, TY+TD-0.3), (TX+TW-0.3, TY+TD-0.3)]:
    make_box(f"Tank_Leg_{ix:.0f}_{iy:.0f}",
             (0.15, 0.15, 1.2),
             (ix, iy, 0.6),
             mat_steel_col, col_misc)

# Thân bể inox
make_cylinder("WaterTank",
              radius   = min(TW, TD) / 2,
              depth    = TH,
              location = (TX + TW/2, TY + TD/2, 1.2 + TH/2),
              mat      = mat_tank,
              target_col = col_misc)

# ══════════════════════════════════════════════════════════
#  8. VƯỜN XANH (Greenery patches)
# ══════════════════════════════════════════════════════════

# Chậu cây (Planters) dọc parapet
planter_defs = [
    # (name,           scale_x, scale_y,  loc_x,  loc_y)
    ("Planter_SW1", 2.0, 0.6,   1.0,   1.0),
    ("Planter_SW2", 2.0, 0.6,   4.0,   1.0),
    ("Planter_NW1", 0.6, 2.0,   1.0,  16.0),
    ("Planter_NW2", 0.6, 2.0,   1.0,  18.5),
]
for name, sx, sy, lx, ly in planter_defs:
    # Khung chậu
    make_box(f"{name}_Box", (sx, sy, 0.5), (lx + sx/2, ly + sy/2, 0.25),
             mat_planter, col_green)
    # Đất/Cỏ
    make_box(f"{name}_Grass", (sx - 0.1, sy - 0.1, 0.15),
             (lx + sx/2, ly + sy/2, 0.55),
             mat_grass, col_green)

# Vườn cỏ nhỏ (góc SW)
make_box("GardenPatch",
         (4.0, 3.5, 0.1),
         (2.5, 2.25, 0.05),
         mat_grass, col_green)

# Cây (Cylinder + Sphere placeholder — dùng Particle System thực tế)
tree_positions = [(3.0, 3.0), (5.0, 2.5), (1.5, 4.5)]
for ti, (tx, ty) in enumerate(tree_positions):
    # Thân cây
    make_cylinder(f"Tree_{ti:02d}_Trunk",
                  radius=0.08, depth=1.5, location=(tx, ty, 0.75),
                  mat=create_material("MAT_Trunk", (0.32, 0.22, 0.12), roughness=0.90),
                  target_col=col_green)
    # Tán lá (sphere)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.7, location=(tx, ty, 2.2),
                                          segments=12, ring_count=8)
    leaf = bpy.context.active_object
    leaf.name = f"Tree_{ti:02d}_Canopy"
    assign_material(leaf, mat_grass)
    move_to_collection(leaf, col_green)

# ══════════════════════════════════════════════════════════
#  9. THANG MÁY / THANG BỘ (Lift Core placeholder)
# ══════════════════════════════════════════════════════════

# Hộp thang máy nhô lên mái
make_box("LiftCore",
         (3.5, 3.5, 3.0),
         (W/2, 1.75 + 0.5, 1.5),
         mat_parapet, col_misc)

# Cửa ra vào thang máy
make_box("LiftDoor",
         (1.2, 0.08, 2.2),
         (W/2, 0.04, 1.1),
         create_material("MAT_LiftDoor", (0.70, 0.72, 0.75),
                          roughness=0.10, metallic=0.90),
         col_misc)

# ══════════════════════════════════════════════════════════
#  HOÀN TẤT
# ══════════════════════════════════════════════════════════

print()
print("=" * 62)
print("  ✅  TẦNG THƯỢNG ĐÃ ĐƯỢC TẠO THÀNH CÔNG!")
print("=" * 62)
print(f"  Mặt bằng    : {W}m × {D}m (mái phẳng ngoài trời)")
print(f"  Bể bơi      : {PW}m × {PDep}m, sâu {PWd}m")
print(f"  Sun Deck    : {deck_w:.1f}m × {deck_d:.1f}m (sàn gỗ)")
print(f"  Pergola     : {GW}m × {GD}m, cao {GH}m")
print(f"               ({n_lamellas} lamellas cách {BSP}m)")
print(f"  HVAC Zone   : {HW}m × {HD}m (3 cụm máy lạnh)")
print(f"  Bể nước mái : Ø{min(TW,TD):.1f}m × {TH}m")
print(f"  Cây xanh    : {len(tree_positions)} cây + 4 chậu cây + vườn cỏ")
print("=" * 62)
print("  📁 Outliner → TANG_THUONG/")
print("     ├── TT_Base        (sàn mái)")
print("     ├── TT_Parapet     (tường chắn 4 mặt)")
print("     ├── TT_Pool        (bể bơi + nước + đèn)")
print("     ├── TT_SunDeck     (sàn gỗ + ghế nằm)")
print("     ├── TT_Pergola     (mái che cột + dầm + kính)")
print("     ├── TT_HVAC        (máy lạnh + tủ điện + ống)")
print("     ├── TT_Greenery    (cây + chậu + vườn)")
print("     └── TT_Misc        (thang máy + bể nước)")
print("=" * 62)
