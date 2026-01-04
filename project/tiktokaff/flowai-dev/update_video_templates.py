# -*- coding: utf-8 -*-
"""
Script to update videoPromptTemplates.js to support dynamic video length
"""

import re
import sys

def update_templates(file_path):
    # Read file with UTF-8 encoding
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Pattern 1: Replace "8 วินาที" with "{{videoLength}} วินาที" in systemPrompt
    content = re.sub(
        r'(systemPrompt:.*?)(\d+) วินาที',
        lambda m: m.group(1) + '{{videoLength}} วินาที' if m.group(2) == '8' else m.group(0),
        content,
        flags=re.DOTALL
    )
    
    # Pattern 2: Update dialogue timing instructions
    content = re.sub(
        r'ในช่วงวินาทีที่ 2-6 ของวิดีโอ',
        '(สำหรับ 8 วิ: ในช่วง 2-6 วินาที, สำหรับ 16 วิ: ในช่วง 3-13 วินาที)',
        content
    )
    
    # Pattern 3: Update userMessageTemplate - "วิดีโอ 8 วินาที"
    content = re.sub(
        r'- วิดีโอ \d+ วินาที',
        '- วิดีโอ {{videoLength}} วินาที',
        content
    )
    
    # Pattern 4: Update userMessageTemplate - timing ranges
    content = re.sub(
        r'- บทพูดภาษาไทยในช่วง 2-6 วินาที',
        '- บทพูดภาษาไทย (8วิ: ช่วง 2-6 วิ / 16วิ: ช่วง 3-13 วิ)',
        content
    )
    
    # Pattern 5: Handle voiceover timing
    content = re.sub(
        r'บทพูดภาษาไทยในช่วง 2-6 วินาที \(เสียงพากย์\)',
        'บทพูดภาษาไทย (8วิ: ช่วง 2-6 วิ / 16วิ: ช่วง 3-13 วิ) (เสียงพากย์)',
        content
    )
    
    # Write back to file
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("Updated " + file_path)
    return True

if __name__ == '__main__':
    file_path = r'd:\VS_Code_GitHub_DATA\eddication.io\eddication.io\project\tiktokaff\flowai-dev\js\data\videoPromptTemplates.js'
    try:
        update_templates(file_path)
        print("\nAll templates updated successfully!")
    except Exception as e:
        print("Error: " + str(e), file=sys.stderr)
        sys.exit(1)
