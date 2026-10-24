from pathlib import Path
from typing import Optional

_memory_evidence_files: dict[str, bytes] = {}
_injected_fault: bool = False
_storage_dir: Optional[Path] = None


class StorageOutageError(Exception):
    def __init__(self, message: str = "Private storage service is unavailable") -> None:
        super().__init__(message)


def inject_storage_outage(fault: bool) -> None:
    global _injected_fault
    _injected_fault = fault


def set_evidence_storage_dir(path: Optional[Path]) -> None:
    global _storage_dir
    _storage_dir = path


def reset_evidence_file_store() -> None:
    global _injected_fault, _storage_dir
    _injected_fault = False
    _storage_dir = None
    _memory_evidence_files.clear()


def save_evidence_file(storage_key: str, data: bytes) -> None:
    if _injected_fault:
        raise StorageOutageError("Storage outage: write rejected")

    if _storage_dir is not None:
        path = _storage_dir / storage_key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    else:
        _memory_evidence_files[storage_key] = data


def read_evidence_file(storage_key: str) -> Optional[bytes]:
    if _injected_fault:
        raise StorageOutageError("Storage outage: read rejected")

    if _storage_dir is not None:
        path = _storage_dir / storage_key
        if not path.is_file():
            return None
        return path.read_bytes()
    return _memory_evidence_files.get(storage_key)


def delete_evidence_file(storage_key: str) -> None:
    if _storage_dir is not None:
        path = _storage_dir / storage_key
        if path.is_file():
            path.unlink(missing_ok=True)
    else:
        _memory_evidence_files.pop(storage_key, None)
