#!/usr/bin/env python3
"""
Reorganize Supabase Edge Functions Structure
This script recreates the batch file functionality in Python
"""

import os
import shutil
from pathlib import Path

# Base directory
base_dir = r"D:\VS_Code_GitHub_DATA\eddication.io\eddication.io\supabase\functions"
os.chdir(base_dir)

print("=" * 50)
print("Reorganizing Edge Functions")
print("=" * 50)
print()

# Step 1: Create directories
print("[1/3] Creating directories...")
directories = ["_shared", "search-job", "update-stop", "upload-alcohol", "close-job", "end-trip"]
for dir_name in directories:
    os.makedirs(dir_name, exist_ok=True)
    print(f"Created: {dir_name}")

print("Done!")
print()

# Step 2: Move files
print("[2/3] Moving files to correct locations...")

files_to_move = {
    "types.ts": "_shared/types.ts",
    "utils.ts": "_shared/utils.ts",
    "search-job.ts": "search-job/index.ts",
    "update-stop.ts": "update-stop/index.ts",
    "upload-alcohol.ts": "upload-alcohol/index.ts",
    "close-job.ts": "close-job/index.ts",
    "end-trip.ts": "end-trip/index.ts",
}

for src, dst in files_to_move.items():
    if os.path.exists(src):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.move(src, dst)
        print(f"Moved: {src} -> {dst}")

print()

# Step 3: Fix import paths
print("[3/3] Fixing import paths...")

files_to_fix = [
    "search-job/index.ts",
    "update-stop/index.ts",
    "upload-alcohol/index.ts",
    "close-job/index.ts",
    "end-trip/index.ts",
]

for file_path in files_to_fix:
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace imports
        content = content.replace("from './types.ts'", "from '../_shared/types.ts'")
        content = content.replace("from './utils.ts'", "from '../_shared/utils.ts'")
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed imports in: {file_path}")

print("Done!")
print()

print("=" * 50)
print("Reorganization Complete!")
print("=" * 50)
print()
print("New structure:")
print("  functions/")
print("    _shared/")
print("      types.ts")
print("      utils.ts")
print("    search-job/")
print("      index.ts")
print("    update-stop/")
print("      index.ts")
print("    upload-alcohol/")
print("      index.ts")
print("    close-job/")
print("      index.ts")
print("    end-trip/")
print("      index.ts")
print()
print("Ready to deploy with: supabase functions deploy")
print()

# List final directory structure
print("Verifying directory structure:")
for root, dirs, files in os.walk("."):
    level = root.replace(".", "").count(os.sep)
    indent = " " * 2 * level
    print(f"{indent}{os.path.basename(root)}/")
    subindent = " " * 2 * (level + 1)
    for file in files:
        if not file.endswith(('.pyc', '.bat', '.py')):
            print(f"{subindent}{file}")
