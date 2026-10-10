import bpy
import math

# Test if collection.objects is alphabetical
col = bpy.data.collections.new("TestCol")
bpy.context.scene.collection.children.link(col)

bpy.ops.mesh.primitive_cube_add(size=1)
obj1 = bpy.context.active_object
obj1.name = "B_Obj"
col.objects.link(obj1)

bpy.ops.mesh.primitive_cube_add(size=1)
obj2 = bpy.context.active_object
obj2.name = "A_Obj"
col.objects.link(obj2)

print("Objects in col:", [o.name for o in col.objects])
