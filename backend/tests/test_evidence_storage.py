from pathlib import Path

import pytest

from app.services.evidence_store import (
    StorageOutageError,
    StoragePathEscapeError,
    delete_evidence_file,
    get_orphan_evidence_keys,
    read_evidence_file,
    record_orphan_evidence,
    recover_orphan_evidence,
    reset_evidence_file_store,
    save_evidence_file,
    set_evidence_storage_dir,
)


@pytest.fixture(autouse=True)
def clean_store(tmp_path: Path):
    reset_evidence_file_store()
    storage_root = tmp_path / "evidence_root"
    storage_root.mkdir()
    set_evidence_storage_dir(storage_root)
    yield storage_root
    reset_evidence_file_store()


def test_save_and_read_evidence_file_persists_to_disk(clean_store: Path):
    key = "shop-1/order-1/ev-123.png"
    content = b"\x89PNG\r\n\x1a\nvalid-image-bytes"

    save_evidence_file(key, content)

    # File exists on real filesystem under clean_store
    disk_path = clean_store / key
    assert disk_path.is_file()
    assert disk_path.read_bytes() == content

    # Read evidence returns bytes
    read_back = read_evidence_file(key)
    assert read_back == content

    # Delete evidence removes file from disk
    delete_evidence_file(key)
    assert not disk_path.is_file()
    assert read_evidence_file(key) is None


@pytest.mark.parametrize(
    "malicious_key",
    [
        "../escaped.png",
        "shop/../../escaped.png",
        "/etc/passwd",
        "/root/secret.jpg",
        "C:\\Windows\\System32\\cmd.exe",
        "shop/order/ev\x00.png",
        "",
        "   ",
        ".",
        "./",
        "../",
    ],
)
def test_storage_key_cannot_escape_root(clean_store: Path, malicious_key: str):
    content = b"malicious content"

    with pytest.raises(StoragePathEscapeError):
        save_evidence_file(malicious_key, content)

    with pytest.raises(StoragePathEscapeError):
        read_evidence_file(malicious_key)

    with pytest.raises(StoragePathEscapeError):
        delete_evidence_file(malicious_key)


@pytest.mark.parametrize("bad_key", ["../traversal.png", ".", "./", ".\\", "a/../../b"])
def test_memory_mode_rejects_path_traversal(bad_key: str):
    reset_evidence_file_store()
    # No directory set -> memory mode
    with pytest.raises(StoragePathEscapeError):
        save_evidence_file(bad_key, b"bytes")
    with pytest.raises(StoragePathEscapeError):
        read_evidence_file(bad_key)
    with pytest.raises(StoragePathEscapeError):
        delete_evidence_file(bad_key)


def test_filesystem_io_errors_normalize_to_storage_outage(clean_store: Path, monkeypatch: pytest.MonkeyPatch):
    def failing_write(*args, **kwargs):
        raise OSError("Disk quota exceeded")

    monkeypatch.setattr(Path, "write_bytes", failing_write)
    with pytest.raises(StorageOutageError) as excinfo:
        save_evidence_file("valid/path/file.png", b"data")
    assert "Storage write failed" in str(excinfo.value)


def test_filesystem_io_errors_do_not_disclose_private_paths(clean_store: Path, monkeypatch: pytest.MonkeyPatch):
    secret_path = str(clean_store / "valid" / "path" / "file.png")

    def failing_write(*args, **kwargs):
        raise OSError(f"Permission denied: '{secret_path}'")

    monkeypatch.setattr(Path, "write_bytes", failing_write)
    with pytest.raises(StorageOutageError) as excinfo:
        save_evidence_file("valid/path/file.png", b"data")

    # Private filesystem path must not be disclosed
    assert secret_path not in str(excinfo.value)
    assert str(clean_store) not in str(excinfo.value)


def test_save_evidence_file_cleans_up_partial_file_on_error(clean_store: Path, monkeypatch: pytest.MonkeyPatch):
    key = "shop-1/order-1/partial.png"
    target_path = clean_store / key
    data = b"full data payload"

    def failing_replace(*args, **kwargs):
        raise OSError("Simulated atomic replace failure")

    monkeypatch.setattr(Path, "replace", failing_replace)

    with pytest.raises(StorageOutageError):
        save_evidence_file(key, data)

    # Neither the target file nor any .tmp files should exist
    assert not target_path.exists()
    parent_dir = target_path.parent
    if parent_dir.exists():
        tmp_files = list(parent_dir.glob("*.tmp"))
        assert len(tmp_files) == 0


def test_record_and_recover_orphan_evidence(clean_store: Path):
    key1 = "shop-1/order-1/orphan-1.png"
    key2 = "shop-1/order-1/orphan-2.png"
    save_evidence_file(key1, b"orphan 1 data")
    save_evidence_file(key2, b"orphan 2 data")

    record_orphan_evidence(key1)
    record_orphan_evidence(key2)

    assert key1 in get_orphan_evidence_keys()
    assert key2 in get_orphan_evidence_keys()

    recovered_count = recover_orphan_evidence()
    assert recovered_count == 2
    assert read_evidence_file(key1) is None
    assert read_evidence_file(key2) is None
    assert len(get_orphan_evidence_keys()) == 0


def test_orphan_evidence_persists_in_manifest(clean_store: Path):
    key = "shop-1/order-1/persistent-orphan.png"
    save_evidence_file(key, b"orphan data")
    record_orphan_evidence(key)

    # Reset store memory state, but re-point to existing directory
    reset_evidence_file_store()
    set_evidence_storage_dir(clean_store)

    assert key in get_orphan_evidence_keys()
    recovered = recover_orphan_evidence()
    assert recovered == 1
    assert read_evidence_file(key) is None

