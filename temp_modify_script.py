#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script to copy and modify index-test-20260115.html to index-supabase-v3.html
"""
import sys
import os

# Read the source file
source_path = r'D:\VS_Code_GitHub_DATA\eddication.io\eddication.io\PTGLG\driverconnect\driverapp\index-test-20260115.html'
dest_path = r'D:\VS_Code_GitHub_DATA\eddication.io\eddication.io\PTGLG\driverconnect\driverapp\index-supabase-v3.html'

print("="*60)
print("File Copy and Modification Script")
print("="*60)

try:
    # Check if source exists
    if not os.path.exists(source_path):
        print(f"ERROR: Source file not found: {source_path}")
        sys.exit(1)
    
    print(f"Reading source file...")
    with open(source_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    print(f"✓ Read {len(lines)} lines from source file")
    
    # Modification 1: Add Supabase SDK after line 14 (index 14 in 0-based)
    print("\n[Modification 1] Adding Supabase SDK after line 14...")
    supabase_script = '  <!-- Supabase SDK -->\n  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>\n\n'
    lines.insert(14, supabase_script)
    print("✓ Added Supabase SDK script tag after line 14")
    
    # Find the constants section
    print("\n[Modification 2] Finding and replacing constants section...")
    const_line_idx = None
    for i, line in enumerate(lines):
        if 'const LIFF_ID' in line and '2007705394' in line:
            const_line_idx = i
            break
    
    if const_line_idx is None:
        print("ERROR: Could not find LIFF_ID constant line")
        sys.exit(1)
    
    print(f"✓ Found LIFF_ID at line {const_line_idx + 1}")
    
    # Show what we're replacing
    print(f"  Replacing lines {const_line_idx + 1}-{const_line_idx + 3}:")
    for i in range(const_line_idx, min(const_line_idx + 3, len(lines))):
        print(f"    OLD: {lines[i].rstrip()}")
    
    # Modification 2: Replace the constants section (3 lines)
    new_constants = '''    const LIFF_ID = '2007705394-Fgx9wdHu';
    const SUPABASE_URL = 'https://myplpshpcordggbbtblg.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15cGxwc2hwY29yZGdnYmJ0YmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MDI2ODgsImV4cCI6MjA4Mzk3ODY4OH0.UC42xLgqSdqgaogHmyRpES_NMy5t1j7YhdEZVwWUsJ8';
    
    // Initialize Supabase
    const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
'''
    
    # Remove the old 3 lines and insert new ones
    del lines[const_line_idx:const_line_idx + 3]
    lines.insert(const_line_idx, new_constants + '\n')
    print("✓ Replaced constants section with Supabase configuration")
    
    # Modification 3: Add ensureLineLogin function after Supabase initialization
    print("\n[Modification 3] Adding ensureLineLogin function...")
    ensure_login_func = '''    // Enforce LINE login
    async function ensureLineLogin() {
      if (!liff.isLoggedIn()) {
        liff.login();
        return false;
      }
      return true;
    }
'''
    lines.insert(const_line_idx + 1, ensure_login_func + '\n')
    print("✓ Added ensureLineLogin function after Supabase initialization")
    
    # Write to destination
    print(f"\nWriting to destination file...")
    with open(dest_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    
    print("="*60)
    print("✅ SUCCESS!")
    print("="*60)
    print(f"Created: {dest_path}")
    print(f"Total lines in new file: {len(lines)}")
    print("\nModifications completed:")
    print("  1. Added Supabase SDK script tag after line 14")
    print("  2. Replaced LIFF_ID and added Supabase configuration")
    print("  3. Added ensureLineLogin function")
    print("="*60)
    
except Exception as e:
    print("="*60)
    print("❌ ERROR!")
    print("="*60)
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
