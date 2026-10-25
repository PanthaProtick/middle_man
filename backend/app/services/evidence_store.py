import uuid
from pathlib import Path
from typing import Optional

_memory_evidence_files: dict[str, bytes] = {}
_memory_orphans: set[str] = set()
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
    if path is not None:
        _sync_orphans_from_disk()


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
    _memory_orphans.clear()


def _get_orphan_manifest_path() -> Optional[Path]:
    if _storage_dir is not None:
        return _storage_dir / ".orphans.txt"
    return None


def _sync_orphans_from_disk() -> None:
    manifest = _get_orphan_manifest_path()
    if manifest and manifest.is_file():
        try:
            lines = manifest.read_text(encoding="utf-8").splitlines()
            for line in lines:
                cleaned = line.strip()
                if cleaned:
                    _memory_orphans.add(cleaned)
        except OSError:
            pass


def _sync_orphans_to_disk() -> None:
    manifest = _get_orphan_manifest_path()
    if manifest is not None:
        try:
            if _memory_orphans:
                manifest.parent.mkdir(parents=True, exist_ok=True)
                manifest.write_text("\n".join(sorted(_memory_orphans)) + "\n", encoding="utf-8")
            elif manifest.exists():
                manifest.unlink(missing_ok=True)
        except OSError:
            pass


def record_orphan_evidence(storage_key: str) -> None:
    _memory_orphans.add(storage_key)
    _sync_orphans_to_disk()


def get_orphan_evidence_keys() -> set[str]:
    _sync_orphans_from_disk()
    return set(_memory_orphans)


def recover_orphan_evidence() -> int:
    _sync_orphans_from_disk()
    keys_to_recover = set(_memory_orphans)
    recovered = 0
    for key in keys_to_recover:
        try:
            target_path = _resolve_storage_path(key)
            file_existed = False
            if _storage_dir is not None:
                file_existed = target_path.is_file()
            else:
                file_existed = key in _memory_evidence_files

            delete_evidence_file(key)
            _memory_orphans.discard(key)
            if file_existed:
                recovered += 1
        except StorageOutageError:
            pass
    _sync_orphans_to_disk()
    return recovered


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
        temp_path: Optional[Path] = None
        try:
            target_path.parent.mkdir(parents=True, exist_ok=True)
            temp_path = target_path.parent / f".{target_path.name}.{uuid.uuid4().hex}.tmp"
            temp_path.write_bytes(data)
            temp_path.replace(target_path)
        except OSError as err:
            if temp_path is not None and temp_path.exists():
                try:
                    temp_path.unlink(missing_ok=True)
                except OSError:
                    pass
            raise StorageOutageError("Storage write failed") from err
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
            raise StorageOutageError("Storage read failed") from err
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
            raise StorageOutageError("Storage delete failed") from err
    else:
        _memory_evidence_files.pop(storage_key, None)
