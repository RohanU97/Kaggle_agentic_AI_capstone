# /// script
# dependencies = [
#   "pillow"
# ]
# ///

import os
import sys
import json
import time
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).parent.parent.parent.resolve()
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from viberender.backend.orchestrator import VibeRenderOrchestrator

EVAL_DIR = PROJECT_ROOT / "viberender" / "eval"
SCORECARD_PATH = Path(os.environ.get("GEMINI_BRAIN_DIR", str(PROJECT_ROOT))) / "viberender_trajectory_scorecard.md"

def check_trajectory(actual: list, expected: list, rule: str) -> bool:
    if rule == "EXACT":
        return actual == expected
    elif rule == "ANY_ORDER":
        return all(item in actual for item in expected)
    return False

def run_eval_suite() -> dict:
    cases_path = EVAL_DIR / "eval_cases.json"
    if not cases_path.exists():
        raise FileNotFoundError(f"Evaluation cases not found at {cases_path}")
        
    with open(cases_path, "r", encoding="utf-8") as f:
        cases = json.load(f)

    orchestrator = VibeRenderOrchestrator()
    results = []
    
    total_trigger_acc = 0.0
    total_trajectory_comp = 0.0
    total_exec_quality = 0.0
    
    for case in cases:
        case_id = case["id"]
        name = case["name"]
        query = case["query"]
        expected_traj = case["expected_trajectory"]
        rule = case["trajectory_rule"]
        
        start_time = time.time()
        error_msg = None
        status = "PASSED"
        
        try:
            # Execute orchestrator pipeline
            res = orchestrator.run_pipeline(query)
            actual_traj = res["trajectory"]
            
            # Check trajectory rules
            passed_trajectory = check_trajectory(actual_traj, expected_traj, rule)
            
            if passed_trajectory:
                trigger_acc = 1.0
                trajectory_comp = 1.0
            else:
                trigger_acc = 0.5 if any(t in expected_traj for t in actual_traj) else 0.0
                trajectory_comp = len([t for t in expected_traj if t in actual_traj]) / len(expected_traj)
                status = "FAILED"
            
            exec_quality = 1.0
            
        except Exception as e:
            actual_traj = []
            trigger_acc = 0.0
            trajectory_comp = 0.0
            exec_quality = 0.0
            status = "ERROR"
            error_msg = str(e)
            
        latency = (time.time() - start_time) * 1000
        
        total_trigger_acc += trigger_acc
        total_trajectory_comp += trajectory_comp
        total_exec_quality += exec_quality
        
        results.append({
            "id": case_id,
            "name": name,
            "query": query,
            "status": status,
            "latency_ms": round(latency, 2),
            "expected_trajectory": expected_traj,
            "actual_trajectory": actual_traj,
            "metrics": {
                "trigger_accuracy": trigger_acc,
                "trajectory_completeness": trajectory_comp,
                "execution_quality": exec_quality
            },
            "error": error_msg
        })
        
    num_cases = len(cases)
    avg_trigger_acc = (total_trigger_acc / num_cases) * 100
    avg_trajectory_comp = (total_trajectory_comp / num_cases) * 100
    avg_exec_quality = (total_exec_quality / num_cases) * 100
    
    passed_count = sum(1 for r in results if r["status"] == "PASSED")
    
    report = {
        "status": "success",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_tests": num_cases,
        "passed_tests": passed_count,
        "scorecard": {
            "trigger_accuracy": round(avg_trigger_acc, 1),
            "trajectory_completeness": round(avg_trajectory_comp, 1),
            "execution_quality": round(avg_exec_quality, 1)
        },
        "results": results
    }
    
    # Write Markdown Scorecard Report
    write_scorecard_markdown(report)
    
    return report

def write_scorecard_markdown(report: dict):
    md = f"""# VibeRender Glass-Box Trajectory Evaluation Scorecard

**Generated:** {report["timestamp"]}  
**Test Status:** `{report["passed_tests"]} / {report["total_tests"]} Passed`

---

## 📊 Summary Metrics

| Metric | Target | Actual Score | Status |
| :--- | :---: | :---: | :---: |
| **Trigger Accuracy** | 100% | {report["scorecard"]["trigger_accuracy"]}% | {"✅ PASS" if report["scorecard"]["trigger_accuracy"] == 100.0 else "❌ FAIL"} |
| **Trajectory Completeness** | 100% | {report["scorecard"]["trajectory_completeness"]}% | {"✅ PASS" if report["scorecard"]["trajectory_completeness"] == 100.0 else "❌ FAIL"} |
| **Execution Quality** | 100% | {report["scorecard"]["execution_quality"]}% | {"✅ PASS" if report["scorecard"]["execution_quality"] == 100.0 else "❌ FAIL"} |

---

## 🔍 Detailed Test Cases

"""
    for res in report["results"]:
        status_badge = "🟢 PASSED" if res["status"] == "PASSED" else "🔴 FAILED" if res["status"] == "FAILED" else "🟡 ERROR"
        md += f"""### {res["name"]} ({status_badge})
*   **Query:** `{res["query"]}`
*   **Latency:** `{res["latency_ms"]} ms`
*   **Trajectory Rule:** `EXACT`
*   **Expected Pipeline Trajectory:**
    `{" -> ".join(res["expected_trajectory"])}`
*   **Actual Executed Trajectory:**
    `{" -> ".join(res["actual_trajectory"]) if res["actual_trajectory"] else "[None]"}`
"""
        if res["error"]:
            md += f"*   **Error Detail:** `{res['error']}`\n"
        md += "\n"
        
    with open(SCORECARD_PATH, "w", encoding="utf-8") as f:
        f.write(md)
    print(f"Scorecard successfully written to {SCORECARD_PATH}")

if __name__ == "__main__":
    run_eval_suite()
