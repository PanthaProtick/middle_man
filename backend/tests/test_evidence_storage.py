from pathlib import Path

import pytest

from app.services.evidence_store import (
    StorageOutageError,
    StoragePathEscapeError,
    delete_evidence_file,
    read_evidence_file,
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
    assert "Disk quota exceeded" in str(excinfo.value)
