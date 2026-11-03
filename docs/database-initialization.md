# Database Initialization and Migrations

This guide covers operational commands, safety guarantees, connection architecture, and failure recovery for initializing and migrating the PostgreSQL database.

## 1. Operational Commands

Database initialization and migrations are executed using workspace npm scripts or direct Python module invocation.

### Initial Clean Database Initialization

When setting up a fresh database environment (e.g., initial production deployment or fresh staging branch):

```bash
npm run db:init -- --confirm-target <database_name>
```

Or with an explicit direct connection URL:

```bash
npm run db:init -- --url "$DIRECT_URL" --confirm-target <database_name>
```

`db:init` enforces `--require-clean`: it verifies that the target database schema is completely empty before applying any migrations. If tables already exist, it aborts immediately.

### Incremental Migrations and Safe Reruns

To apply pending migrations or safely verify an already-migrated database:

```bash
npm run db:migrate -- --confirm-target <database_name>
```

Or with an explicit direct connection URL:

```bash
npm run db:migrate -- --url "$DIRECT_URL" --confirm-target <database_name>
```

When all migrations are already applied, the runner reports `Database '<database_name>' is up to date (0 pending migrations)` and exits cleanly with code `0`.

---

## 2. Safety and Target Integrity

### Explicit Target Confirmation
Every migration run requires `--confirm-target <name>`. The runner parses the target database name from the connection URL and compares it with the confirmed target:
- If the URL target differs from `--confirm-target`, execution halts immediately with `TargetConfirmationError`.
- This prevents accidental execution against the wrong environment (e.g., production vs staging vs local).

### Credential Protection
Connection strings and error messages are sanitized using `sanitize_db_url`. Passwords and credentials are never printed to console logs, terminal output, or JSON reports.

### Ambiguous Schema Rejection
If a database target contains existing user tables but lacks a `schema_migrations` ledger, the runner halts immediately with `AmbiguousSchemaError`. Silent adoption of untracked schemas is strictly prohibited.

### Serialization and Concurrency
Concurrent runners are serialized using a PostgreSQL session advisory lock (`pg_advisory_lock` with key `5570020120194849345`). Once acquired, double-checked ledger inspection ensures subsequent runners detect migrations applied by preceding runners and cleanly report up-to-date without collisions.

### Checksum Ledger Integrity
The `schema_migrations` table records `version`, `checksum` (SHA-256), `applied_at`, and `execution_time_ms`. On every run, applied migrations are verified against files on disk. Altered migration files trigger a `ChecksumMismatchError`.

---

## 3. Direct vs Pooled Connection Architecture

| Attribute | Direct Connection (`DIRECT_URL`) | Pooled Connection (`DATABASE_URL`) |
| :--- | :--- | :--- |
| **Role** | DDL migrations & initialization | Serverless application runtime |
| **Endpoint** | Direct PostgreSQL / Neon compute | PgBouncer connection pooler |
| **Advisory Locks** | Supported (session-level) | Not supported in transaction pooling mode |
| **Decoupling** | Run by explicit operator or CI step | Used for HTTP request processing |

> [!IMPORTANT]
> Migration execution is strictly decoupled from application startup and frontend builds. Application startup does not execute DDL migrations.

---

## 4. Failure Recovery

### Transactional Rollbacks
Each migration file executes inside an isolated database transaction (`BEGIN ... COMMIT`). If any statement fails:
1. PostgreSQL automatically rolls back all changes within that migration file.
2. The failed version is **not** recorded in `schema_migrations`.
3. The runner terminates immediately with `MigrationExecutionError` and exit code `1`.

### Recovery Procedure
1. Inspect the sanitized error log to identify the failing migration and error cause.
2. Resolve the underlying conflict or correct the migration script.
3. Re-run `npm run db:migrate -- --confirm-target <database_name>`. The runner automatically resumes from the unapplied migration.

### Non-Transactional Operations
Standard migrations use transactional DDL. If a hypothetical future operation uses non-transactional statements (such as `CREATE INDEX CONCURRENTLY`):
1. In the event of a failure, check for partially created artifacts (`SELECT * FROM pg_class WHERE relname = ...`).
2. Drop any invalid artifact (e.g., `DROP INDEX IF EXISTS <index_name>;`).
3. Re-run `npm run db:migrate -- --confirm-target <database_name>`.
