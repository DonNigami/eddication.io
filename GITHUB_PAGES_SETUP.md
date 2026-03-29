# GitHub Pages Setup Instructions

## Quick Start for userdata.html

### Option 1: Direct File Access
Use GitHub's built-in HTML viewer:
https://github.com/DonNigami/eddication.io/blob/main/boonyang/Inventory/userdata.html

Click the "Raw" button, then copy the URL and use it directly in your browser.

### Option 2: Enable GitHub Pages

1. Go to repository Settings
2. Navigate to "Pages" (left sidebar)
3. Source: Deploy from a branch
   - Branch: `main` 
   - Folder: `/ (root)` or `/docs`
4. Click "Save"

Your site will be available at:
https://donnigami.github.io/eddication.io/

Then access userdata.html at:
https://donnigami.github.io/eddication.io/boonyang/Inventory/userdata.html

### Option 3: Use GitHub Pages Action (Fastest)

Create `.github/workflows/static.yml`:
```yaml
name: Deploy static content to Pages

on:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Pages
        uses: actions/configure-pages@v5
      
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### Option 4: Quick Local Server

Run a simple local server:
```bash
# Python 3
cd boonyang/Inventory
python -m http.server 8000

# Node.js
npx serve boonyang/Inventory
```

Then access: http://localhost:8000/userdata.html

### Option 5: VS Code Live Server

1. Install "Live Server" extension in VS Code
2. Right-click on userdata.html
3. Select "Open with Live Server"
