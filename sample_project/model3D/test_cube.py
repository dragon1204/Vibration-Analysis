import bpy
bpy.ops.mesh.primitive_cube_add(size=1)
obj = bpy.context.active_object
print(f'BLENDER_CUBE_BBOX: {[v[:] for v in obj.bound_box]}')
