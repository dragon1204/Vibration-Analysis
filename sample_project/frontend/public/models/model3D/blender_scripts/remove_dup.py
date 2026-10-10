with open('tang_dancuu_generator.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the second occurrence of "#  5. LAM CHẮN NẮNG (SUN LOUVER)"
str_to_find = "#  5. LAM CHẮN NẮNG (SUN LOUVER)"
first = content.find(str_to_find)
if first != -1:
    second = content.find(str_to_find, first + 1)
    if second != -1:
        # Find where section 6 starts after the second one
        sec6 = content.find("#  6. CỬA SỔ PHÒNG KHÁCH", second)
        if sec6 != -1:
            # Look backwards for the separator line before sec6
            end_delete = content.rfind("# ══════════════════════════════════════════════════════════", second, sec6)
            if end_delete == -1:
                end_delete = sec6
                
            # Look backwards for the separator line before second
            start_delete = content.rfind("# ══════════════════════════════════════════════════════════", first, second)
            if start_delete == -1:
                start_delete = second
                
            new_content = content[:start_delete] + content[end_delete:]
            with open('tang_dancuu_generator.py', 'w', encoding='utf-8') as f:
                f.write(new_content)
            print("Successfully deleted the second duplicate section.")
        else:
            print("Could not find section 6 after second.")
    else:
        print("Could not find second occurrence.")
else:
    print("Could not find first occurrence.")
