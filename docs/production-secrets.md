# Production Secrets and Key Management

This guide documents the application secret inventory, cryptographic isolation guarantees, backup procedures, and key rotation consequences for production deployments.

---

## 1. Secret Inventory

| Secret Variable | Required In Production | Purpose & Algorithm |
| :--- | :--- | :--- |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string (masked in logs/diagnostics). |
| `ORDER_LINK_ENCRYPTION_KEY` | **Yes** | Secret key for Fernet authenticated encryption (AES-128-CBC + HMAC-SHA256) of public buyer portal tokens. |
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

Secrets must remain stable across deployments; never generate fresh keys on deployment. If an administrative rotation is necessary:

### Rotating `ORDER_LINK_ENCRYPTION_KEY`
- **Consequences:** Existing buyer links encrypted under the previous key fail decryption immediately with HTTP 503 (`LINK_ENCRYPTION_KEY_INCOMPATIBLE`).
- **Operational Recovery:** Rotation invalidates unresolved buyer links. Sellers must reissue buyer links via `POST /seller/orders/{order_id}/reissue-link`, which encrypts a fresh token using the newly active key and invalidates the previous token lookup digest.

### Rotating `PAYMENT_MARKER_SECRET`
- **Consequences:** Derived HMAC digests for incoming transaction identifiers change. Previously recorded digests in `used_payment_markers` will no longer match new submissions of the same transaction ID under the new key, temporarily opening a window where transaction IDs could be re-claimed.
- **Operational Recovery:** Schedule marker secret rotations during quiet maintenance periods after pending order verification windows close, or verify transactions manually during the transition period.

### Rotating `PATHAO_CREDENTIAL_ENCRYPTION_KEY`
- **Consequences:** Stored merchant API credentials in `pathao_connection_revisions.encrypted_credentials` cannot be decrypted. Courier booking and address lookup fail.
- **Operational Recovery:** After rotating the key in environment variables, merchants reconnect their courier accounts by submitting fresh credentials through the seller courier settings interface.

### Rotating Clerk Credentials (`CLERK_SECRET_KEY` / `CLERK_JWT_KEY`)
- **Consequences:** Zero impact on database persistence or encrypted domain entities. Active seller sessions verified via the rotated key will be rejected upon next token expiration.
- **Operational Recovery:** Sellers re-authenticate via the Clerk sign-in flow to obtain new session tokens.
