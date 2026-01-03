# Flow AI Unlocked - Development Setup Guide

เอกสารนี้อธิบายวิธีตั้งค่า development environment สำหรับพัฒนา Flow AI Unlocked บน `eddication.io-dev` repository

---

## 🎯 ภาพรวม

คุณมี 2 silo ของ repository:

```
d:\VS_Code_GitHub_DATA\eddication.io\
├── eddication.io/          # Production repository (main branch)
└── eddication.io-dev/      # Development repository (feature/multi-platform-support)
```

**eddication.io** - สำหรับ:
- ทำงานปกติ
- ทดสอบ features ที่มี
- Minor fixes

**eddication.io-dev** - สำหรับ:
- พัฒนา features ใหญ่ (Multi-platform support)
- Testing ใช้ branch ต่างๆ
- Experimentation

---

## 📂 Repository Structure

```
eddication.io-dev/
├── DEVELOPMENT_PLAN.md                    # ← คุณอยู่ที่นี่
├── SETUP_GUIDE.md                         # ← This file
├── project/
│   └── tiktokaff/
│       └── flowai/
│           ├── content/
│           │   ├── tiktok.js              # Original
│           │   └── platforms/
│           │       ├── shopee.js          # Phase 1
│           │       ├── facebook.js        # Phase 2
│           │       └── youtube.js         # Phase 2
│           │
│           └── js/
│               ├── tabs/
│               │   └── tiktokUploader.js  # Original
│               │
│               └── platforms/
│                   ├── baseUploader.js    # Phase 1
│                   ├── shopeeUploader.js  # Phase 1
│                   ├── facebookUploader.js# Phase 2
│                   └── youtubeUploader.js # Phase 2
│
├── .git/
├── .gitignore
└── [other files from main repo]
```

---

## 🚀 Quick Start

### 1. Open Development Repository

```bash
# เปิด VS Code ด้วย dev repo
code d:\VS_Code_GitHub_DATA\eddication.io\eddication.io-dev

# หรือเปิดจาก command line
cd d:\VS_Code_GitHub_DATA\eddication.io\eddication.io-dev
code .
```

### 2. Verify Branch

```bash
# ตรวจสอบว่าอยู่ branch ที่ถูกต้อง
git branch -v
# ควรเห็น: * feature/multi-platform-support

# ดู commit history
git log --oneline -5
```

### 3. Create Feature Branch

```bash
# สร้าง branch ใหม่สำหรับ feature
git checkout -b feature/shopee-integration

# หรือ
git checkout -b feature/facebook-reels
git checkout -b feature/youtube-shorts
```

---

## 📋 Typical Workflow

### Development Cycle

```
1. Start Feature
   ↓
2. Create Feature Branch
   ↓
3. Develop & Test
   ↓
4. Commit Changes
   ↓
5. Push to GitHub
   ↓
6. Create Pull Request (optional)
   ↓
7. Merge to main feature branch
   ↓
8. Deploy/Test
```

### Example: Add Shopee Support

```bash
# 1. Create feature branch
git checkout -b feature/shopee-integration

# 2. Create files
touch project/tiktokaff/flowai/content/platforms/shopee.js
touch project/tiktokaff/flowai/js/platforms/shopeeUploader.js
touch project/tiktokaff/flowai/js/platforms/shopeeConfig.js

# 3. Implement (use IDE to edit)

# 4. Commit
git add project/tiktokaff/flowai/content/platforms/shopee.js
git add project/tiktokaff/flowai/js/platforms/shopeeUploader.js
git add project/tiktokaff/flowai/js/platforms/shopeeConfig.js
git commit -m "feat(shopee): Add Shopee content script for video upload"

# 5. Push
git push origin feature/shopee-integration

# 6. Merge to main feature branch (when ready)
git checkout feature/multi-platform-support
git merge feature/shopee-integration
git push origin feature/multi-platform-support
```

---

## 🔄 Git Commands Reference

### Branching

```bash
# List all branches
git branch -a

# Create new branch
git checkout -b feature/new-feature

# Switch branch
git checkout feature/multi-platform-support

# Delete branch
git branch -d feature/completed-feature
```

### Committing

```bash
# Check status
git status

# Add files
git add <file>
git add .  # Add all

# Commit
git commit -m "feat(scope): description"

# Amend last commit
git commit --amend --no-edit
```

### Pushing & Pulling

```bash
# Push to GitHub
git push origin <branch-name>

# Push all branches
git push origin --all

# Pull latest changes
git pull origin <branch-name>

# Sync from main repo (if needed)
git fetch origin
git rebase origin/main
```

### Merging

```bash
# Merge branch into current branch
git merge feature/some-feature

# Abort merge if conflicts
git merge --abort

# Merge with squash (combine commits)
git merge --squash feature/some-feature
```

---

## 🧪 Development Best Practices

### 1. Work in Feature Branches

**Do:**
```bash
git checkout -b feature/shopee-integration
# ... work ...
git push origin feature/shopee-integration
```

**Don't:**
```bash
git checkout main
# ... work directly on main ...
```

### 2. Write Meaningful Commit Messages

**Good:**
```
feat(shopee): Add product linking to Shopee videos

- Implement product search functionality
- Add product card selection
- Link to shopping cart
- Add error handling for failed links

Closes #123
```

**Bad:**
```
fix stuff
update code
work in progress
```

### 3. Keep Branches Updated

```bash
# Before merging, sync with latest
git fetch origin
git rebase origin/feature/multi-platform-support
```

### 4. Test Before Committing

```bash
# In VS Code
# 1. Load extension (chrome://extensions)
# 2. Test functionality
# 3. Check console for errors
# 4. Only commit if working
```

### 5. Use .gitignore

```bash
# Check what's ignored
cat .gitignore

# Typical entries:
# node_modules/
# .env
# .DS_Store
# dist/
# build/
```

---

## 🔀 Syncing with Main Repository

### Keep dev repo updated with main repo

```bash
# Add main repo as remote (if not already added)
git remote add upstream https://github.com/DonNigami/eddication.io.git

# Fetch latest from main repo
git fetch upstream

# Merge main into current branch
git merge upstream/main

# Or rebase (cleaner history)
git rebase upstream/main

# Push to dev repo
git push origin <branch-name>
```

### Check remotes

```bash
git remote -v
# Should show:
# origin    https://github.com/DonNigami/eddication.io.git (for dev)
# upstream  https://github.com/DonNigami/eddication.io.git (for main)
```

---

## 📊 Tracking Progress

### Check what you've done

```bash
# See commits in current branch
git log feature/shopee-integration

# Compare with main branch
git log main..feature/shopee-integration

# See diff of all changes
git diff main..feature/shopee-integration
```

### Update DEVELOPMENT_PLAN.md

After completing each commit, update the plan:

```markdown
### Commit 1: Base Uploader Architecture
- ✅ Status: COMPLETED (2024-01-03)
- 📝 Files: js/platforms/baseUploader.js, js/platforms/platformRegistry.js
```

---

## 🐛 Troubleshooting

### Problem: Merge Conflicts

```bash
# When merging fails:
git status  # See which files have conflicts

# Edit files to resolve conflicts
# Then:
git add <resolved-file>
git commit -m "Resolve merge conflicts"
```

### Problem: Committed to Wrong Branch

```bash
# Undo last commit but keep changes
git reset --soft HEAD~1

# Switch to correct branch
git checkout -b feature/correct-branch

# Commit again
git commit -m "your message"
```

### Problem: Need to Revert Changes

```bash
# Revert uncommitted changes
git checkout -- <file>

# Revert committed changes (creates new commit)
git revert <commit-hash>

# Reset to previous commit (DANGER!)
git reset --hard <commit-hash>
```

### Problem: Lost Commits

```bash
# Find lost commits
git reflog

# Restore commit
git checkout <commit-hash>
git checkout -b recovered-branch
```

---

## 📝 File Naming Convention

### Content Scripts
```
content/platforms/<platform>.js
content/platforms/<platform>Selectors.js

Examples:
- content/platforms/shopee.js
- content/platforms/shopeeSelectors.js
- content/platforms/facebook.js
- content/platforms/facebookSelectors.js
```

### Uploader Modules
```
js/platforms/<platform>Uploader.js
js/platforms/<platform>Config.js

Examples:
- js/platforms/shopeeUploader.js
- js/platforms/shopeeConfig.js
- js/platforms/facebookUploader.js
- js/platforms/facebookConfig.js
```

### Tests
```
tests/<platform>.test.js
tests/integration/<feature>.test.js

Examples:
- tests/shopee.test.js
- tests/facebook.test.js
- tests/integration/multiPlatformUpload.test.js
```

### Documentation
```
docs/PLATFORM_<PLATFORM>_GUIDE.md
docs/FEATURE_<FEATURE>.md

Examples:
- docs/PLATFORM_SHOPEE_GUIDE.md
- docs/PLATFORM_FACEBOOK_GUIDE.md
- docs/FEATURE_MULTI_PLATFORM.md
```

---

## ✅ Pre-Commit Checklist

ก่อนที่จะ commit ให้ตรวจสอบ:

- [ ] Code follows project style
- [ ] No console.log() ในส่วนที่ไม่ต้องการ
- [ ] No TODO comments ที่ไม่ชัดเจน
- [ ] All imports/requires ถูกต้อง
- [ ] Selectors tested on actual platform
- [ ] Error handling implemented
- [ ] Comments เพียงพอ
- [ ] No breaking changes
- [ ] Git commit message is clear
- [ ] Branch name is descriptive

---

## 🔗 Useful Links

### Git Documentation
- [Git Cheat Sheet](https://github.github.com/training-kit/downloads/github-git-cheat-sheet.pdf)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/)

### VS Code Git Integration
- [Git in VS Code](https://code.visualstudio.com/docs/sourcecontrol/overview)
- [Branches View](https://code.visualstudio.com/docs/sourcecontrol/overview#_branches)

### Chrome Extension Development
- [Chrome Extension API](https://developer.chrome.com/docs/extensions/)
- [Content Scripts](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)
- [Message Passing](https://developer.chrome.com/docs/extensions/mv3/messaging/)

---

## 📞 Quick Tips

### Faster Git Commands

```bash
# Add aliases to .gitconfig
git config --global alias.st status
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.lg "log --oneline -10"

# Then use:
git st     # instead of git status
git co     # instead of git checkout
git br     # instead of git branch
```

### View Git History Beautifully

```bash
# Install git alias
git config --global alias.hist "log --graph --oneline --decorate --all"

# Use:
git hist
```

### Open GitHub Web UI from Command Line

```bash
# Open PR page
git remote -v | grep push | awk '{print $2}' | sed 's/\.git$//' | xargs open

# Or use gh CLI
gh repo view --web
```

---

## 🎓 Learning Resources

### If you're new to Git
1. Start with [GitHub's Git Handbook](https://guides.github.com/)
2. Practice with [Learn Git Branching](https://learngitbranching.js.org/)
3. Reference [Git Documentation](https://git-scm.com/doc)

### If you're new to Chrome Extensions
1. Read [Extension Overview](https://developer.chrome.com/docs/extensions/)
2. Follow [Getting Started Guide](https://developer.chrome.com/docs/extensions/mv3/getstarted/)
3. Study [Message Passing](https://developer.chrome.com/docs/extensions/mv3/messaging/)

---

## 📊 Status Dashboard

### Development Repositories

| Repository | Branch | Purpose | Status |
|------------|--------|---------|--------|
| eddication.io | main | Production | ✅ Stable |
| eddication.io | develop | Staging | ⏳ Development |
| eddication.io-dev | feature/multi-platform-support | Multi-platform | 🚀 In Progress |
| eddication.io-dev | feature/shopee-integration | Shopee | ⏳ Pending |
| eddication.io-dev | feature/facebook-reels | Facebook | ⏳ Pending |
| eddication.io-dev | feature/youtube-shorts | YouTube | ⏳ Pending |

---

**Setup Date:** 3 มกราคม 2026  
**Version:** 1.0  
**Status:** ✅ Ready for Development

Happy Coding! 🚀
