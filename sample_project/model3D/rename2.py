import os

filepath = r'D:\Yootek\DEV\DATN\model3D\blender_scripts\tang_tttm_generator.py'
prefix = 'TTTM_'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()
    
content = content.replace(f'"{prefix}FloorSlab"', '"slab"')
content = content.replace(f'"{prefix}CeilingSlab"', '"ceiling"')
content = content.replace(f'"{prefix}RoofSlab"', '"ceiling"')
content = content.replace(f'"{prefix}Wall_', '"wall_')
content = content.replace(f'"{prefix}', '"')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
    
print("Updated tang_tttm_generator.py")
