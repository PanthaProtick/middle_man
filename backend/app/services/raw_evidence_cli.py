"""Command-line runner for repeatable local raw-evidence cleanup."""
import argparse
import asyncio
import datetime
import sys
from typing import Optional, Sequence

from app.core.database import AsyncSessionLocal, sanitize_db_url
from app.models.cleanup import CleanupFailureItem, RetentionCleanupResponse
from app.services.raw_evidence_cleanup import purge_raw_evidence


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run repeatable local raw evidence cleanup for 30-day retention."
    )
    parser.add_argument(
        "--shop-id",
        type=str,
        default=None,
        help="Optional shop ID to restrict cleanup to a single shop.",
    )
    parser.add_argument(
        "--as-of",
        type=str,
        default=None,
        help="Optional ISO 8601 UTC timestamp to evaluate 30-day deadlines against.",
    )
    parser.add_argument(
        "--allow-standby",
        action="store_true",
        default=False,
        help="Allow running cleanup against in-memory standby store when database is not configured.",
    )
    return parser.parse_args(argv)


async def run_cleanup_cli(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)

    if args.as_of:
        now = datetime.datetime.fromisoformat(args.as_of)
        if now.tzinfo is None:
            now = now.replace(tzinfo=datetime.timezone.utc)
    else:
        now = datetime.datetime.now(datetime.timezone.utc)

    if AsyncSessionLocal is not None:
        try:
            async with AsyncSessionLocal() as db:
                result = await purge_raw_evidence(db=db, now=now, shop_id=args.shop_id)
        except Exception as err:
            err_msg = sanitize_db_url(str(err))
            result = RetentionCleanupResponse(
                shop_id=args.shop_id or "all",
                ran_at=now,
                items_purged=0,
                items_failed=1,
                overdue_remaining=0,
                status="failed",
                failures=[
                    CleanupFailureItem(
                        evidence_type="system",
                        evidence_id="database",
                        delete_after=now,
                        error=f"Database unavailable: {err_msg}",
                    )
                ],
            )
    elif args.allow_standby:
        result = await purge_raw_evidence(db=None, now=now, shop_id=args.shop_id)
    else:
        result = RetentionCleanupResponse(
            shop_id=args.shop_id or "all",
            ran_at=now,
            items_purged=0,
            items_failed=1,
            overdue_remaining=0,
            status="failed",
            failures=[
                CleanupFailureItem(
                    evidence_type="system",
                    evidence_id="database",
                    delete_after=now,
                    error="Durable database is not initialized. Set DATABASE_URL to run durable cleanup, or pass --allow-standby.",
                )
            ],
        )

    print(result.model_dump_json(indent=2))
    return 0 if result.status == "clean" else 1


def main(argv: Optional[Sequence[str]] = None) -> int:
    return asyncio.run(run_cleanup_cli(argv))


if __name__ == "__main__":
    sys.exit(main())
