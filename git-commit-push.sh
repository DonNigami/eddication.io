#!/bin/bash
# Git Commit and Push Helper Script
# Skips files that fail to push

echo "========================================"
echo "  Git Commit and Push Script"
echo "========================================"
echo ""

cd /d/VS_Code_GitHub_DATA/eddication.io/eddication.io

echo "Current Directory: $(pwd)"
echo ""

echo "----------------------------------------"
echo "  Git Status"
echo "----------------------------------------"
git status
echo ""

echo "----------------------------------------"
echo "  Adding Changes"
echo "----------------------------------------"

# Add only PTGLG directory (where we made changes)
git add PTGLG/driverconnect/driverapp/

echo ""
echo "Files staged for commit:"
git diff --cached --name-only
echo ""

read -p "Enter commit message (or press Enter for default): " COMMIT_MSG
if [ -z "$COMMIT_MSG" ]; then
    COMMIT_MSG="fix: Supabase errors and add documentation"
fi

echo ""
echo "----------------------------------------"
echo "  Committing Changes"
echo "----------------------------------------"
git commit -m "$COMMIT_MSG"

if [ $? -eq 0 ]; then
    echo ""
    echo "[SUCCESS] Commit successful!"
    echo ""
    
    echo "----------------------------------------"
    echo "  Pushing to Remote"
    echo "----------------------------------------"
    git push origin main
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "[SUCCESS] Push successful!"
    else
        echo ""
        echo "[ERROR] Push failed. Try:"
        echo "  1. git push origin master (if main branch is named master)"
        echo "  2. git push (if upstream is set)"
        echo "  3. Check network connection"
    fi
else
    echo ""
    echo "[ERROR] Commit failed or nothing to commit"
fi

echo ""
echo "========================================"
echo "  Done!"
echo "========================================"
