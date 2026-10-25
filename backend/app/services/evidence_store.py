from pathlib import Path
from typing import Optional

_memory_evidence_files: dict[str, bytes] = {}
_injected_fault: bool = False
_storage_dir: Optional[Path] = None


class StorageOutageError(Exception):
    def __init__(self, message: str = "Private storage service is unavailable") -> None:
        super().__init__(message)


class StoragePathEscapeError(StorageOutageError):
    def __init__(self, message: str = "Storage key escapes root directory") -> None:
        super().__init__(message)


def inject_storage_outage(fault: bool) -> None:
    global _injected_fault
    _injected_fault = fault


def set_evidence_storage_dir(path: Optional[Path]) -> None:
    global _storage_dir
    _storage_dir = path


def init_evidence_storage(target_dir: Optional[Path] = None) -> Path:
    from app.core.config import settings

    path = target_dir or settings.effective_evidence_storage_path
    path.mkdir(parents=True, exist_ok=True)
    set_evidence_storage_dir(path)
    return path


def reset_evidence_file_store() -> None:
    global _injected_fault, _storage_dir
    _injected_fault = False
    _storage_dir = None
    _memory_evidence_files.clear()


def _resolve_storage_path(storage_key: str) -> Path:
    if not storage_key or not storage_key.strip():
        raise StoragePathEscapeError("Storage key cannot be empty")
    if "\x00" in storage_key:
        raise StoragePathEscapeError("Invalid storage key: null byte detected")

    stripped = storage_key.strip()
    if stripped.startswith(("/", "\\")):
        raise StoragePathEscapeError("Storage key cannot be an absolute or root-anchored path")

    raw_path = Path(stripped)
    if raw_path.is_absolute() or raw_path.drive:
        raise StoragePathEscapeError("Storage key cannot be an absolute path or contain a drive letter")

    clean_key = stripped.strip("/\\")
    if not clean_key or clean_key in (".", ".."):
        raise StoragePathEscapeError("Storage key cannot resolve to root or current directory")

    normalized_segments = [seg for seg in clean_key.replace("\\", "/").split("/") if seg]
    if any(seg in (".", "..") for seg in normalized_segments):
        raise StoragePathEscapeError("Storage key cannot contain directory traversal elements")

    if _storage_dir is not None:
        root = _storage_dir.resolve()
        target = (root / clean_key).resolve()
        try:
            target.relative_to(root)
        except ValueError:
            raise StoragePathEscapeError("Storage key escapes intended root directory") from None
        if target == root:
            raise StoragePathEscapeError("Storage key cannot target root directory")
        return target

    # Memory fallback: check traversal even when directory is not configured
    return Path(clean_key)


def save_evidence_file(storage_key: str, data: bytes) -> None:
    if _injected_fault:
        raise StorageOutageError("Storage outage: write rejected")

    target_path = _resolve_storage_path(storage_key)
    if _storage_dir is not None:
        try:
            target_path.parent.mkdir(parents=True, exist_ok=True)
            target_path.write_bytes(data)
        except OSError as err:
            raise StorageOutageError(f"Storage write failed: {err}") from err
    else:
        _memory_evidence_files[storage_key] = data


def read_evidence_file(storage_key: str) -> Optional[bytes]:
    if _injected_fault:
        raise StorageOutageError("Storage outage: read rejected")

    target_path = _resolve_storage_path(storage_key)
    if _storage_dir is not None:
        try:
            if not target_path.is_file():
                return None
            return target_path.read_bytes()
        except OSError as err:
            raise StorageOutageError(f"Storage read failed: {err}") from err
    return _memory_evidence_files.get(storage_key)


def delete_evidence_file(storage_key: str) -> None:
    if _injected_fault:
        raise StorageOutageError("Storage outage: delete rejected")

    target_path = _resolve_storage_path(storage_key)
    if _storage_dir is not None:
        try:
            if target_path.is_file():
                target_path.unlink(missing_ok=True)
        except OSError as err:
            raise StorageOutageError(f"Storage delete failed: {err}") from err
    else:
        _memory_evidence_files.pop(storage_key, None)
