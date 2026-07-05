# /// script
# dependencies = [
#   "fastapi",
#   "uvicorn",
#   "pillow"
# ]
# ///

import os
import sys
import uvicorn
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware

# Resolve project path and inject it into sys.path
PROJECT_ROOT = Path(__file__).parent.parent.parent.resolve()
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from viberender.backend.config import TEMP_DIR
from viberender.backend.orchestrator import VibeRenderOrchestrator

app = FastAPI(
    title="VibeRender API",
    description="Autonomous 3D Product Ad Mockup Generator API",
    version="1.0.0"
)

# CORS Policy
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Orchestrator
orchestrator = VibeRenderOrchestrator()

@app.get("/api/viberender/generate")
async def generate_scene(q: str = Query(..., description="Prompt describing the scene")):
    if not q or len(q.strip()) < 3:
        raise HTTPException(status_code=400, detail="Query prompt must be at least 3 characters long.")
    try:
        result = orchestrator.run_pipeline(q)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

@app.get("/api/viberender/eval")
async def run_evaluation():
    try:
        from viberender.eval.eval_runner import run_eval_suite
        report = run_eval_suite()
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evaluation execution failed: {str(e)}")

# Mount Frontend static files
FRONTEND_DIR = PROJECT_ROOT / "viberender" / "frontend"
FRONTEND_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

@app.get("/")
async def get_index():
    index_path = FRONTEND_DIR / "index.html"
    if not index_path.exists():
        return {"message": "VibeRender Backend is running. Frontend index.html not found."}
    return FileResponse(str(index_path))

if __name__ == "__main__":
    # Listen on port 8001 to prevent conflicts with ClinicalGenie
    uvicorn.run("main:app", host="127.0.0.1", port=8001, reload=True)
