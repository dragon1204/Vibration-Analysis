import os
import re

DIR = r'D:\Yootek\DEV\DATN\model3D\blender_scripts'
FILES = [
    ('tang_ham_generator.py', 'HAM_'),
    ('tang_tttm_generator.py', 'TM_'),
    ('tang_dancuu_generator.py', 'DC_'),
    ('tang_thuong_generator.py', 'TT_')
]

for fname, prefix in FILES:
    filepath = os.path.join(DIR, fname)
    if not os.path.exists(filepath):
        continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    content = content.replace(f'"{prefix}FloorSlab"', '"slab"')
    content = content.replace(f'"{prefix}CeilingSlab"', '"ceiling"')
    content = content.replace(f'"{prefix}RoofSlab"', '"ceiling"')
    content = content.replace(f'"{prefix}Wall_', '"wall_')
    content = content.replace(f'"{prefix}', '"')
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print(f"Updated {fname}")
