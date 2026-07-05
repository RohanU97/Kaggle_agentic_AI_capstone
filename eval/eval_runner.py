# /// script
# dependencies = [
#   "python-dotenv"
# ]
# ///

import json
import os
import sys
import time
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).parent.parent.resolve()
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.orchestrator import ClinicalGenieOrchestrator

EVAL_DIR = PROJECT_ROOT / "eval"
# Make scorecard path configurable via environment variable or fallback to project root
SCORECARD_PATH = Path(os.environ.get("GEMINI_BRAIN_DIR", str(PROJECT_ROOT))) / "trajectory_scorecard.md"

def check_trajectory(actual: list, expected: list, rule: str) -> bool:
    if rule == "EXACT":
        return actual == expected
        
    elif rule == "ANY_ORDER":
        # Check that all expected items are present in actual
        return all(item in actual for item in expected)
        
    elif rule == "IN_ORDER":
        # Check that all expected items are present and in the correct relative order
        last_idx = -1
        for item in expected:
            if item not in actual:
                return False
            curr_idx = actual.index(item)
            if curr_idx < last_idx:
                return False
            last_idx = curr_idx
        return True
    return False

def run_eval_suite():
    cases_file = EVAL_DIR / "eval_cases.json"
    if not cases_file.exists():
        return {"status": "error", "message": "eval_cases.json not found"}
        
    with open(cases_file, "r") as f:
        cases = json.load(f)
        
    orchestrator = ClinicalGenieOrchestrator()
    results = []
    
    total_score_trigger = 0.0
    total_score_traj = 0.0
    total_score_qual = 0.0
    
    print("\n--- Starting ClinicalGenie Glass-Box Evaluation ---")
    for case in cases:
        case_id = case["id"]
        name = case["name"]
        query = case["query"]
        expected_query_type = case["expected_query_type"]
        expected_gene = case["expected_gene"]
        expected_traj = case["expected_trajectory"]
        rule = case["trajectory_rule"]
        
        print(f"Running Case: {name} (Query: '{query}')...")
        
        start_time = time.time()
        res = orchestrator.run_pipeline(query)
        duration = time.time() - start_time
        
        actual_traj = res["trajectory"]
        actual_query_type = res["query_type"]
        
        # Verify query type parsing
        qtype_match = actual_query_type == expected_query_type
        
        # Verify trajectory
        traj_pass = check_trajectory(actual_traj, expected_traj, rule)
        
        # Calculate metric scores
        # 1. Trigger Accuracy: % of expected databases that were triggered
        triggered_expected = [item for item in expected_traj if item in actual_traj]
        trigger_accuracy = len(triggered_expected) / len(expected_traj) if expected_traj else 1.0
        
        # 2. Trajectory Completeness
        traj_completeness = 1.0 if traj_pass else (0.5 if check_trajectory(actual_traj, expected_traj, "ANY_ORDER") else 0.0)
        
        # 3. Execution Quality
        exec_quality = 1.0 if res["status"] == "success" else 0.0
        
        total_score_trigger += trigger_accuracy
        total_score_traj += traj_completeness
        total_score_qual += exec_quality
        
        results.append({
            "id": case_id,
            "name": name,
            "query": query,
            "query_type_match": qtype_match,
            "expected_trajectory": expected_traj,
            "actual_trajectory": actual_traj,
            "trajectory_match": traj_pass,
            "metrics": {
                "trigger_accuracy": trigger_accuracy,
                "trajectory_completeness": traj_completeness,
                "execution_quality": exec_quality,
                "duration_seconds": round(duration, 3)
            }
        })
        print(f"  Finished. Query Type Match: {qtype_match}, Trajectory Match: {traj_pass} (Actual: {actual_traj})")
        
    num_cases = len(cases)
    avg_trigger = total_score_trigger / num_cases if num_cases else 1.0
    avg_traj = total_score_traj / num_cases if num_cases else 1.0
    avg_qual = total_score_qual / num_cases if num_cases else 1.0
    
    scorecard = {
        "status": "success",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total_tests": num_cases,
        "passed_tests": sum(1 for r in results if r["trajectory_match"] and r["query_type_match"]),
        "scorecard": {
            "trigger_accuracy": round(avg_trigger * 100, 1),
            "trajectory_completeness": round(avg_traj * 100, 1),
            "execution_quality": round(avg_qual * 100, 1)
        },
        "detailed_results": results
    }
    
    # Save markdown scorecard
    write_scorecard_markdown(scorecard)
    return scorecard

def write_scorecard_markdown(scorecard):
    # Formulate a beautiful markdown report
    md = f"""# ClinicalGenie Trajectory Evaluation Scorecard

**Execution Timestamp:** `{scorecard['timestamp']}`
**Total Test Cases:** `{scorecard['total_tests']}`
**Passed Cases (Correct Trajectory + Query Parse):** `{scorecard['passed_tests']} / {scorecard['total_tests']}`

## Aggregate Performance Metrics

| Metric | Score (%) | Threshold | Status |
| :--- | :---: | :---: | :---: |
| **Trigger Accuracy** | {scorecard['scorecard']['trigger_accuracy']}% | 90.0% | {'✅ PASS' if scorecard['scorecard']['trigger_accuracy'] >= 90.0 else '⚠️ WARNING'} |
| **Trajectory Completeness** | {scorecard['scorecard']['trajectory_completeness']}% | 80.0% | {'✅ PASS' if scorecard['scorecard']['trajectory_completeness'] >= 80.0 else '⚠️ WARNING'} |
| **Execution Quality** | {scorecard['scorecard']['execution_quality']}% | 100.0% | {'✅ PASS' if scorecard['scorecard']['execution_quality'] >= 100.0 else '❌ FAIL'} |

---

## Detailed Evaluation Run

"""
    for res in scorecard["detailed_results"]:
        status_icon = "✅" if res["trajectory_match"] and res["query_type_match"] else "❌"
        md += f"""### {status_icon} Case: {res['name']}
*   **Query Input:** `{res['query']}`
*   **Query Type Resolved Correctly:** `{'Yes' if res['query_type_match'] else 'No'}`
*   **Expected Trajectory:** `{" -> ".join(res['expected_trajectory'])}`
*   **Actual Trajectory:** `{" -> ".join(res['actual_trajectory']) if res['actual_trajectory'] else 'None'}`
*   **Trajectory Check:** `{'Matched' if res['trajectory_match'] else 'Mismatch'}`

#### Case Metrics:
*   Trigger Accuracy: `{res['metrics']['trigger_accuracy'] * 100}%`
*   Trajectory Completeness: `{res['metrics']['trajectory_completeness'] * 100}%`
*   Execution Quality: `{res['metrics']['execution_quality'] * 100}%`
*   Execution Time: `{res['metrics']['duration_seconds']}s`

---
"""
        
    try:
        SCORECARD_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(SCORECARD_PATH, "w", encoding="utf-8") as f:
            f.write(md)
        print(f"\nSaved trajectory scorecard to {SCORECARD_PATH}")
    except Exception as e:
        print(f"Error writing scorecard markdown: {e}")

if __name__ == "__main__":
    run_eval_suite()
