import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Optional

from app.core.config import settings
from app.core.database import sanitize_db_url
from app.core.migration_types import MigrationError, MigrationResult
from app.core.migrations import run_migrations


def resolve_migration_url(cli_url: Optional[str]) -> str:
    """Resolves direct migration URL prioritizing CLI arg, DIRECT_URL, then DATABASE_URL."""
    if cli_url:
        return cli_url
    if settings.DIRECT_URL:
        return settings.DIRECT_URL
    if settings.DATABASE_URL:
        return settings.DATABASE_URL
    return settings.effective_database_url


def build_parser() -> argparse.ArgumentParser:
    """Builds CLI argument parser for database migration commands."""
    parser = argparse.ArgumentParser(
        description="Auditable PostgreSQL database migration and clean-initialization runner."
    )
    parser.add_argument(
        "--url",
        help="Database connection URL. Falls back to DIRECT_URL, then DATABASE_URL.",
        default=None,
    )
    parser.add_argument(
        "--confirm-target",
        required=True,
        help="Mandatory target database name to confirm intended target before execution.",
    )
    parser.add_argument(
        "--require-clean",
        action="store_true",
        help="Require target database schema to be completely empty before initializing.",
    )
    parser.add_argument(
        "--migrations-dir",
        type=Path,
        default=None,
        help="Custom path to migrations directory containing SQL files.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        dest="json_output",
        help="Emit output in structured JSON format.",
    )
    return parser


def format_report(result: MigrationResult, as_json: bool = False) -> str:
    """Formats migration result as human-readable text or JSON string."""
    if as_json:
        return json.dumps(
            {
                "status": result.status,
                "target_database": result.target_database,
                "applied_count": result.applied_count,
                "applied_versions": list(result.applied_versions),
                "total_execution_time_ms": result.total_execution_time_ms,
            },
            indent=2,
        )

    if result.status == "up_to_date":
        return f"Database '{result.target_database}' is up to date (0 pending migrations)."

    versions_str = ", ".join(result.applied_versions)
    return (
        f"Successfully applied {result.applied_count} migrations to '{result.target_database}' "
        f"in {result.total_execution_time_ms}ms: {versions_str}"
    )


async def execute_cli(args: argparse.Namespace) -> int:
    """Executes migration workflow based on parsed CLI arguments."""
    url = resolve_migration_url(args.url)
    if not url:
        print(
            "Error: No database connection URL provided. Set DIRECT_URL, DATABASE_URL, or pass --url.",
            file=sys.stderr,
        )
        return 1

    sanitized = sanitize_db_url(url)
    if not args.json_output:
        mode = "clean initialization" if args.require_clean else "migration"
        print(f"Target: {sanitized}")
        print(f"Executing {mode} for confirmed target '{args.confirm_target}'...")

    try:
        result = await run_migrations(
            url=url,
            confirmed_target=args.confirm_target,
            migrations_dir=args.migrations_dir,
            require_clean=args.require_clean,
        )
        print(format_report(result, as_json=args.json_output))
        return 0
    except MigrationError as err:
        err_msg = sanitize_db_url(str(err))
        if args.json_output:
            print(json.dumps({"status": "error", "error": err_msg}), file=sys.stderr)
        else:
            print(f"Migration Error: {err_msg}", file=sys.stderr)
        return 1
    except Exception as exc:
        err_msg = sanitize_db_url(str(exc))
        if args.json_output:
            print(json.dumps({"status": "error", "error": err_msg}), file=sys.stderr)
        else:
            print(f"Unexpected Execution Error: {err_msg}", file=sys.stderr)
        return 1


def main() -> None:
    """Entry point for CLI execution."""
    parser = build_parser()
    args = parser.parse_args()
    exit_code = asyncio.run(execute_cli(args))
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
