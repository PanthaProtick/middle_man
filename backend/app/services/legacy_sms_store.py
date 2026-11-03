"""Offline historical SMS storage for retention only; no ingestion capability."""
from app.models.sms_entities import SmsEvidenceTable, SmsImportTable

_memory_imports: dict[tuple[str, str], SmsImportTable] = {}
_memory_evidence: dict[tuple[str, str], SmsEvidenceTable] = {}


def reset_sms_store() -> None:
    _memory_imports.clear()
    _memory_evidence.clear()
