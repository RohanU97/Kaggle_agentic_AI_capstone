import os
from pathlib import Path

# Project root path resolution (moving up 3 levels from backend/)
PROJECT_ROOT = Path(__file__).parent.parent.parent.resolve()

# Directory for simulated renders and cached outputs
TEMP_DIR = PROJECT_ROOT / "scratch"
TEMP_DIR.mkdir(parents=True, exist_ok=True)
