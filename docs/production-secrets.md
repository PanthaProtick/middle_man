# Production Secrets and Key Management

This guide documents the application secret inventory, cryptographic isolation guarantees, backup procedures, and key rotation consequences for production deployments.

---

## 1. Secret Inventory

| Secret Variable | Required In Production | Purpose & Algorithm |
| :--- | :--- | :--- |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string (masked in logs/diagnostics). |
| `ORDER_LINK_ENCRYPTION_KEY` | **Yes** | 32-byte secret for AES-GCM encryption of public buyer portal tokens. |
| `PAYMENT_MARKER_SECRET` | **Yes** | HMAC secret used to derive unique transaction fingerprints and prevent payment marker reuse across shops. |
| `CLERK_ISSUER` | **Yes** | Production Clerk issuer URL (must start with `https://` and reject `*.clerk.accounts.dev`). |
| `CLERK_SECRET_KEY` | Optional | Live Clerk secret key (`sk_live_*`; `sk_test_*` rejected at startup). |
| `CLERK_PUBLISHABLE_KEY` | Optional | Live Clerk publishable key (`pk_live_*`; `pk_test_*` rejected at startup). |
| `CLERK_JWT_KEY` | Optional | PEM-encoded RSA public key for offline JWT verification without network calls. |
| `PATHAO_CREDENTIAL_ENCRYPTION_KEY` | **Conditional** | Fernet key for encrypting merchant Pathao API credentials. Required only when `PATHAO_PRODUCTION_BOOKING_ENABLED=true` or `PATHAO_LOCATION_ENVIRONMENT != "offline"`. |
| `GEMINI_API_KEY` | No (Optional) | API key for optional Gemini review assistant. System operates safely when unset (`REVIEW_GEMINI_ENABLED=false`). |

---

## 2. Cryptographic Isolation Rationale

Each application secret serves a distinct cryptographic purpose and boundary:
1. **Link Encryption (`ORDER_LINK_ENCRYPTION_KEY`):** Protects buyer access URLs. Compromise allows decrypting buyer portal links, but does NOT grant access to merchant courier credentials or forged payment markers.
2. **Payment Marker Protection (`PAYMENT_MARKER_SECRET`):** Ensures payment claim deduplication and marker uniqueness. It must remain distinct from link keys to prevent chosen-ciphertext attacks between link tokens and payment hashes.
3. **Courier Credentials (`PATHAO_CREDENTIAL_ENCRYPTION_KEY`):** Protects third-party merchant API tokens at rest. Independent from authentication and payment keys to prevent courier API access if app secrets leak.

Startup validation fails closed (`ProductionReadinessError`) if `ORDER_LINK_ENCRYPTION_KEY`, `PAYMENT_MARKER_SECRET`, or `PATHAO_CREDENTIAL_ENCRYPTION_KEY` share identical secret material.

---

## 3. Secret Backup & Operational Safeguards

- **Ciphertext Loss Prevention:** Stored records in `orders.encrypted_portal_token` and `pathao_connection_revisions.encrypted_credentials` are encrypted with symmetric keys. If a key is lost, affected records cannot be decrypted.
- **Secrets Management:** Store all production secrets in a dedicated secrets manager (e.g. AWS Secrets Manager, Doppler, HashiCorp Vault, or Vercel Encrypted Environment Variables).
- **Diagnostics Masking:** Database URLs, passwords, and authorization tokens are automatically sanitized in startup diagnostics, exceptions, and error payloads via `sanitize_db_url`.

---

## 4. Key Rotation Procedures & Consequences

### Rotating `ORDER_LINK_ENCRYPTION_KEY`
- **Impact:** Existing order links encrypted under the previous key will fail decryption unless re-encrypted.
- **Procedure:**
  1. Deploy a dual-read migration script that attempts decryption with the new key, falls back to the old key, and writes back ciphertext under the new key for all unexpired orders.
  2. Complete cutover to the new key once all unexpired orders are re-encrypted.

### Rotating `PAYMENT_MARKER_SECRET`
- **Impact:** Historical marker digests in `used_payment_markers` depend on the HMAC key.
- **Procedure:**
  1. Retain historical markers during active accounting windows.
  2. Coordinate rotation with marker migration or dual-verification during transaction matching windows.

### Rotating `PATHAO_CREDENTIAL_ENCRYPTION_KEY`
- **Impact:** Unsealing `pathao_connection_revisions.encrypted_credentials` will fail if the key changes without re-encrypting existing revisions.
- **Procedure:**
  1. Decrypt current credentials with the existing Fernet key.
  2. Re-encrypt credentials under the new Fernet key and insert new connection revisions.
  3. Deploy the new key to production environment variables.

### Rotating Clerk Credentials (`CLERK_SECRET_KEY` / `CLERK_JWT_KEY`)
- **Impact:** Zero impact on database persistence or encrypted records.
- **Procedure:**
  1. Generate new keys in Clerk Dashboard.
  2. Update environment variables and restart backend processes.
