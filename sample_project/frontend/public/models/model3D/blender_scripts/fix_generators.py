import os
import glob

def fix_generator(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    changed = False

    # 1. Fix clear_collection
    old_clear = '''def clear_collection(name):
    if name in bpy.data.collections:
        col = bpy.data.collections[name]
        for obj in list(col.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.collections.remove(col)'''
        
    new_clear = '''def clear_collection(name_or_col):
    col = bpy.data.collections.get(name_or_col) if isinstance(name_or_col, str) else name_or_col
    if col:
        for child_col in list(col.children):
            clear_collection(child_col)
        for obj in list(col.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.collections.remove(col)'''
        
    if old_clear in content:
        content = content.replace(old_clear, new_clear)
        changed = True
        
    # 2. Fix make_box deselect
    if "def make_box(" in content and "bpy.ops.object.select_all(action='DESELECT')" not in content:
        content = content.replace("bpy.ops.mesh.primitive_cube_add(size=1, location=location)", 
                                  "bpy.ops.object.select_all(action='DESELECT')\n    bpy.ops.mesh.primitive_cube_add(size=1, location=location)")
        changed = True
        
    # 3. Fix make_cylinder deselect
    if "def make_cylinder(" in content and "bpy.ops.object.select_all(action='DESELECT')" not in content:
        content = content.replace("bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth,", 
                                  "bpy.ops.object.select_all(action='DESELECT')\n    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth,")
        changed = True

    if changed:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {os.path.basename(file_path)}")
    else:
        print(f"No changes needed for {os.path.basename(file_path)}")

scripts_dir = 'D:/Yootek/DEV/DATN/model3D/blender_scripts'
for f in glob.glob(os.path.join(scripts_dir, 'tang_*_generator.py')):
    fix_generator(f)

