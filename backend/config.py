import os
from pathlib import Path

# Paths to the plugin directories containing the CLI scripts
USER_HOME = Path(os.path.expanduser("~"))
PLUGINS_DIR = USER_HOME / ".gemini" / "config" / "plugins" / "science" / "skills"

# CLI script paths
DBSNP_CLI = PLUGINS_DIR / "dbsnp_database" / "scripts" / "dbsnp_cli.py"
CLINVAR_CLI = PLUGINS_DIR / "clinvar_database" / "scripts" / "clinvar_api.py"
CLINICAL_TRIALS_CLI = PLUGINS_DIR / "clinical_trials_database" / "scripts" / "clinical_trials_api.py"
OPENFDA_CLI = PLUGINS_DIR / "openfda_database" / "scripts" / "openfda_query.py"

# Validate paths
for name, path in [
    ("dbSNP CLI", DBSNP_CLI),
    ("ClinVar CLI", CLINVAR_CLI),
    ("Clinical Trials CLI", CLINICAL_TRIALS_CLI),
    ("OpenFDA CLI", OPENFDA_CLI)
]:
    if not path.exists():
        print(f"Warning: {name} not found at {path}")

PROJECT_ROOT = Path(__file__).parent.parent.resolve()

# Local data cache/output dir
TEMP_DIR = PROJECT_ROOT / "scratch"
TEMP_DIR.mkdir(parents=True, exist_ok=True)
