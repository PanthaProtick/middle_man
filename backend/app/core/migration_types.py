from dataclasses import dataclass
from enum import Enum
from pathlib import Path


class MigrationError(Exception):
    """Base exception for database migration errors."""


class TargetConfirmationError(MigrationError):
    """Target database name does not match confirmed target."""


class DirtyTargetError(MigrationError):
    """Target database contains existing tables when clean target required."""


class AmbiguousSchemaError(MigrationError):
    """Target contains existing tables without a schema_migrations ledger."""


class ChecksumMismatchError(MigrationError):
    """Recorded migration checksum differs from disk migration file."""


class MigrationExecutionError(MigrationError):
    """Migration script execution failed."""


class SchemaState(str, Enum):
    CLEAN = "clean"
    TRACKED = "tracked"
    AMBIGUOUS = "ambiguous"


@dataclass(frozen=True)
class MigrationFile:
    version: str
    filename: str
    path: Path
    checksum: str
    sql: str
    transactional: bool = True


@dataclass(frozen=True)
class MigrationRecord:
    version: str
    checksum: str
    applied_at: str
    execution_time_ms: int


@dataclass(frozen=True)
class MigrationResult:
    status: str
    target_database: str
    applied_count: int
    applied_versions: tuple[str, ...]
    total_execution_time_ms: int
