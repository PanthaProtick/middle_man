# 02: Fail-closed production readiness

**What to build:** The operator receives an explicit production startup failure when storage, schema, authentication configuration, or required application secrets cannot support safe operation.

**Blocked by:** 01: Repeatable clean-database initialization.

**Status:** ready-for-agent

- [ ] Production requires available durable storage and compatible schema, including required columns and migration compatibility rather than table names alone.
- [ ] Validate production seller-verification configuration at startup; reject development credentials and identity overrides as production authority.
- [ ] Require independent, stable buyer-link encryption and payment-marker secrets. Require a dedicated courier credential key only when the enabled workflow needs it.
- [ ] Production database failures remain explicit failures; memory fallback or simulated responses never imply a committed write.
- [ ] Startup and request diagnostics do not expose credentials or sensitive database details. Production Pathao booking remains disabled by default and optional AI remains optional.
- [ ] Tests cover missing and invalid configuration, unavailable storage, incompatible schema, required secrets, and continued offline development operation. Use PostgreSQL for schema compatibility evidence.
- [ ] Document secret backup and rotation consequences, including continued recovery of saved buyer links and payment reuse protection across deployments.
- [ ] Run focused checks and final root `npm run check`; record exact results, the fresh result artifact, and any unrun integration gates.
