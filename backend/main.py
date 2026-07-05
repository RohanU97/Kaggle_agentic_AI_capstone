# /// script
# dependencies = [
#   "fastapi",
#   "uvicorn",
#   "google-generativeai",
#   "python-dotenv"
# ]
# ///

import os
from fastapi import FastAPI, Query, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).parent.parent.resolve()
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Load any local .env file
load_dotenv()

from backend.orchestrator import ClinicalGenieOrchestrator

app = FastAPI(title="ClinicalGenie API", version="1.0.0")

# Enable CORS for local testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

orchestrator = ClinicalGenieOrchestrator()

# Serve API Search
@app.get("/api/search")
async def api_search(q: str = Query(..., description="Query terms")):
    if not q:
        raise HTTPException(status_code=400, detail="Query parameter 'q' is required")
    try:
        result = orchestrator.run_pipeline(q)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Serve API Eval
@app.get("/api/eval")
async def api_eval():
    try:
        from eval.eval_runner import run_eval_suite
        report = run_eval_suite()
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Setup Static files routing
FRONTEND_DIR = PROJECT_ROOT / "frontend"
FRONTEND_DIR.mkdir(parents=True, exist_ok=True)

# Mount the static files (app.css, app.js, etc.)
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

@app.get("/")
async def get_index():
    index_path = FRONTEND_DIR / "index.html"
    if not index_path.exists():
        # Auto-create basic index placeholder if not created yet
        return {"message": "ClinicalGenie Backend Running. Frontend index.html not found yet."}
    return FileResponse(index_path)

if __name__ == "__main__":
    import uvicorn
    # Load port from env or default to 8000
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
