import datetime
import json
from unittest.mock import AsyncMock, patch

import pytest

from app.models.cleanup import CleanupFailureItem, RetentionCleanupResponse
from app.services.raw_evidence_cli import main, run_cleanup_cli


@pytest.mark.asyncio
async def test_cli_runs_cleanup_with_arguments(capsys):
    fixed_now = datetime.datetime(2026, 10, 25, 12, 0, 0, tzinfo=datetime.timezone.utc)
    mock_resp = RetentionCleanupResponse(
        shop_id="test-shop-1",
        ran_at=fixed_now,
        items_purged=3,
        items_failed=0,
        overdue_remaining=0,
        status="clean",
        failures=[],
    )

    with patch("app.services.raw_evidence_cli.purge_raw_evidence", new_callable=AsyncMock) as mock_purge:
        mock_purge.return_value = mock_resp
        exit_code = await run_cleanup_cli(
            ["--allow-standby", "--shop-id", "test-shop-1", "--as-of", "2026-10-25T12:00:00+00:00"]
        )

        assert exit_code == 0
        mock_purge.assert_called_once()
        _, kwargs = mock_purge.call_args
        assert kwargs["now"] == fixed_now
        assert kwargs["shop_id"] == "test-shop-1"

    captured = capsys.readouterr()
    payload = json.loads(captured.out)
    assert payload["items_purged"] == 3
    assert payload["items_failed"] == 0
    assert payload["status"] == "clean"


@pytest.mark.asyncio
async def test_cli_returns_nonzero_exit_code_on_partial_failure(capsys):
    fixed_now = datetime.datetime(2026, 10, 25, 12, 0, 0, tzinfo=datetime.timezone.utc)
    mock_resp = RetentionCleanupResponse(
        shop_id="test-shop-1",
        ran_at=fixed_now,
        items_purged=1,
        items_failed=1,
        overdue_remaining=1,
        status="partial_failure",
        failures=[
            CleanupFailureItem(
                evidence_type="screenshot",
                evidence_id="ev-123",
                order_id="ord-1",
                delete_after=fixed_now,
                error="Storage service unavailable: failed to remove file",
            )
        ],
    )

    with patch("app.services.raw_evidence_cli.purge_raw_evidence", new_callable=AsyncMock) as mock_purge:
        mock_purge.return_value = mock_resp
        exit_code = await run_cleanup_cli(["--allow-standby", "--shop-id", "test-shop-1"])

        assert exit_code == 1

    captured = capsys.readouterr()
    payload = json.loads(captured.out)
    assert payload["items_failed"] == 1
    assert payload["status"] == "partial_failure"
    assert len(payload["failures"]) == 1


@pytest.mark.asyncio
async def test_cli_handles_database_error_gracefully(capsys):
    class FailingContextManager:
        async def __aenter__(self):
            raise ConnectionError("connection to postgres://secret_user:secret_pass@127.0.0.1:5432 failed")

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    with patch("app.services.raw_evidence_cli.AsyncSessionLocal", return_value=FailingContextManager()):
        exit_code = await run_cleanup_cli(["--shop-id", "test-shop-1"])
        assert exit_code == 1

    captured = capsys.readouterr()
    payload = json.loads(captured.out)
    assert payload["status"] == "failed"
    assert "Database unavailable" in payload["failures"][0]["error"]
    assert "secret_pass" not in payload["failures"][0]["error"]


@pytest.mark.asyncio
async def test_cli_requires_allow_standby_when_database_unconfigured(capsys):
    with patch("app.services.raw_evidence_cli.AsyncSessionLocal", None):
        exit_code = await run_cleanup_cli(["--shop-id", "test-shop-1"])
        assert exit_code == 1

    captured = capsys.readouterr()
    payload = json.loads(captured.out)
    assert payload["status"] == "failed"
    assert "Set DATABASE_URL to run durable cleanup, or pass --allow-standby" in payload["failures"][0]["error"]


@pytest.mark.asyncio
async def test_cli_end_to_end_standby_cleanup(tmp_path, capsys):
    from app.services.evidence_service import _memory_order_evidence
    from app.services.evidence_store import init_evidence_storage, reset_evidence_file_store, save_evidence_file
    from app.services.raw_evidence_cleanup import reset_cleanup_memory

    init_evidence_storage(tmp_path)
    reset_cleanup_memory()
    _memory_order_evidence.clear()

    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        past = now - datetime.timedelta(days=31)
        ev_id = "ev-cli-standby-1"
        storage_key = f"shop-cli/orders/{ev_id}.png"
        save_evidence_file(storage_key, b"disk-png-bytes")
        disk_file = tmp_path / storage_key
        assert disk_file.is_file()

        _memory_order_evidence[ev_id] = {
            "id": ev_id,
            "shop_id": "shop-cli",
            "order_id": "ord-cli",
            "storage_key": storage_key,
            "media_type": "image/png",
            "byte_size": 14,
            "width": 10,
            "height": 10,
            "sha256_digest": "hash",
            "status": "attached",
            "collected_at": past,
            "delete_after": past + datetime.timedelta(days=30),
            "deleted_at": None,
        }

        with patch("app.services.raw_evidence_cli.AsyncSessionLocal", None):
            exit_code = await run_cleanup_cli(["--allow-standby", "--shop-id", "shop-cli"])
            assert exit_code == 0

        captured = capsys.readouterr()
        payload = json.loads(captured.out)
        assert payload["status"] == "clean"
        assert payload["items_purged"] == 1
        assert not disk_file.is_file()
        assert _memory_order_evidence[ev_id]["status"] == "deleted"
    finally:
        reset_evidence_file_store()
        reset_cleanup_memory()
        _memory_order_evidence.clear()


def test_main_entrypoint_delegates_to_run_cleanup():
    with patch("app.services.raw_evidence_cli.run_cleanup_cli", new_callable=AsyncMock) as mock_run:
        mock_run.return_value = 0
        code = main(["--shop-id", "test-shop-2"])
        assert code == 0
        mock_run.assert_called_once_with(["--shop-id", "test-shop-2"])


