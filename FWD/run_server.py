#!/usr/bin/env python
"""Direct server runner to test the app"""
import uvicorn
import sys
from pathlib import Path

# Add FWD directory to path
fwd_dir = Path(__file__).parent
sys.path.insert(0, str(fwd_dir))

print(f"Working directory: {Path.cwd()}")
print(f"Python path: {sys.path[:3]}")

# Import app
from app.main import app

print(f"App title: {app.title}")
print(f"Routes: {[r.path for r in app.routes if hasattr(r, 'path')]}")

# Run server
uvicorn.run(
    app,
    host="0.0.0.0",
    port=8000,
    log_level="info"
)
