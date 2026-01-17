# Git Commands - Manual Reference

## Quick Commands (Run in Terminal)

### 1. Check Status
```bash
cd D:\VS_Code_GitHub_DATA\eddication.io\eddication.io
git status
```

### 2. Add Only PTGLG Directory
```bash
git add PTGLG/driverconnect/driverapp/
```

### 3. Check What Will Be Committed
```bash
git diff --cached --name-only
```

### 4. Commit Changes
```bash
git commit -m "fix: Supabase connection errors and add documentation"
```

### 5. Push to Remote
```bash
# Try main branch first
git push origin main

# If fails, try master
git push origin master

# Or just
git push
```

---

## Files Changed Summary

### Modified Files:
- `PTGLG/driverconnect/driverapp/index-supabase.html`
  - Fixed duplicate Supabase declaration
  - Added SweetAlert2 CDN
  - Added inline favicon
  - Fixed missing function errors (toggleTheme, checkGpsStatus)
  - Changed inline onclick to addEventListener

### New Files Created:
- `PTGLG/driverconnect/driverapp/progress-project.md`
- `PTGLG/driverconnect/driverapp/SUPABASE_SYNC_STATUS.md`
- `PTGLG/driverconnect/driverapp/SUPABASE_CONNECTION_STATUS.md`
- `PTGLG/driverconnect/driverapp/ERROR_FIX_SUPABASE_DUPLICATE.md`
- `PTGLG/driverconnect/driverapp/ERROR_FIX_MISSING_FUNCTIONS.md`
- `PTGLG/driverconnect/driverapp/HOW_TO_CHECK_MIGRATIONS.md`
- `PTGLG/driverconnect/driverapp/HOW_TO_CHECK_STATUS.md`
- `PTGLG/driverconnect/driverapp/check-migrations.bat`
- `PTGLG/driverconnect/driverapp/check-supabase-status.bat`
- `PTGLG/driverconnect/driverapp/supabase/config.toml`

---

## If Large Files Cause Issues

### Check File Sizes
```bash
find PTGLG/driverconnect/driverapp/ -type f -size +50M
```

### Remove Large Files from Staging
```bash
git reset HEAD path/to/large/file.ext
```

### Use Git LFS for Large Files (if needed)
```bash
git lfs install
git lfs track "*.psd"
git lfs track "*.mp4"
git add .gitattributes
```

---

## If Push Fails

### Reason 1: Remote has changes you don't have
```bash
git pull --rebase origin main
git push origin main
```

### Reason 2: Branch name mismatch
```bash
# Check current branch
git branch

# Push to correct branch
git push origin <branch-name>
```

### Reason 3: File too large (>100MB)
```bash
# Remove from history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch path/to/large/file" \
  --prune-empty --tag-name-filter cat -- --all

# Or use BFG Repo-Cleaner
```

### Reason 4: No remote set
```bash
# Set remote
git remote add origin https://github.com/username/repo.git

# Or check existing remote
git remote -v
```

---

## Recommended Commit Message

```
fix: Supabase connection errors and add comprehensive documentation

- Fixed duplicate Supabase client declaration error
- Added SweetAlert2 CDN that was missing
- Added inline SVG favicon to prevent 404
- Fixed ReferenceError for toggleTheme and checkGpsStatus
- Changed inline onclick to addEventListener (modern approach)
- Created progress-project.md for project tracking
- Added Supabase connection verification documentation
- Added error fix documentation files
- Created helper scripts (check-migrations.bat, check-supabase-status.bat)
- Added Supabase config.toml for local development

Files changed: 10 files modified, 10 files created
```

---

## Alternative: Selective Commit

If you want to commit only specific files:

```bash
# Add specific files
git add PTGLG/driverconnect/driverapp/index-supabase.html
git add PTGLG/driverconnect/driverapp/progress-project.md
git add PTGLG/driverconnect/driverapp/ERROR_FIX_*.md

# Commit
git commit -m "fix: Supabase errors"

# Push
git push origin main
```

---

## Check Before Pushing

```bash
# See what will be committed
git diff --cached

# See file names only
git diff --cached --name-only

# See stats
git diff --cached --stat

# Undo last add (if needed)
git reset HEAD <file>

# Undo all adds
git reset HEAD
```

---

## After Successful Push

```bash
# Verify push
git log --oneline -5

# Check remote status
git remote show origin

# Clean up
git gc
```

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `git status` | Check changes |
| `git add <file>` | Stage file |
| `git add .` | Stage all |
| `git commit -m "msg"` | Commit |
| `git push` | Push to remote |
| `git pull` | Pull from remote |
| `git log` | Show history |
| `git diff` | Show changes |
| `git reset HEAD` | Unstage all |

