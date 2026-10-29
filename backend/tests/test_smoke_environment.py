"""The smoke child must remain offline even with local durable-mode settings."""
import json
import os
import subprocess
import sys
from pathlib import Path


def test_smoke_overrides_inherited_and_dotenv_self_test_mode(tmp_path):
    dotenv = tmp_path / '.env'
    dotenv.write_text('SELF_TEST_MODE=true\nENV=production\n', encoding='utf-8')
    script = Path(__file__).parents[2] / 'scripts/smoke.py'
    probe = """
import json, os, runpy, sys
runner = runpy.run_path(sys.argv[1])
os.environ.update(runner['standby_environment']())
from app.core.config import Settings
settings = Settings(_env_file=sys.argv[2])
print(json.dumps({'durable': settings.is_durable_mode, 'database': settings.is_database_configured,
                  'ai': settings.ai_enabled, 'gemini_key': bool(settings.GEMINI_API_KEY),
                  'clerk': settings.is_clerk_configured}))
"""
    result = subprocess.run([sys.executable, '-c', probe, str(script), str(dotenv)],
        cwd=Path(__file__).parents[1], env={**os.environ, 'SELF_TEST_MODE': 'true',
            'ENV': 'production', 'DATABASE_URL': 'postgresql://synthetic:synthetic@example.invalid/test',
            'GEMINI_API_KEY': 'synthetic-key', 'CLERK_SECRET_KEY': 'synthetic-key'},
        capture_output=True, text=True, timeout=15, check=True)
    assert json.loads(result.stdout) == {
        'durable': False, 'database': False, 'ai': True, 'gemini_key': False, 'clerk': False,
    }
