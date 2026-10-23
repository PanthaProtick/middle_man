"""Imports commit structured results and receipts in one transaction, without raw audit copies."""
import hashlib
import uuid
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tokens import get_utc_now
from app.models.entities import ShopTable
from app.models.sms import ImportList, ImportResult, SmsImportInput, SmsItemResult
from app.models.sms_entities import SmsEvidenceTable, SmsImportTable
from app.services.reconciliation import reconcile_receipt
from app.services.reconciliation_queries import receipt_order_ids
from app.services.seller_service import IdempotencyConflictError, NotFoundError, SellerService, compute_payload_hash
from app.services.sms_parser import parse_sms
from app.services.transaction_service import TransactionService

_memory_imports: dict[tuple[str, str], SmsImportTable] = {}
_memory_evidence: dict[tuple[str, str], SmsEvidenceTable] = {}


def reset_sms_store() -> None:
    _memory_imports.clear()
    _memory_evidence.clear()


class SmsImportService:
    def __init__(self, db: AsyncSession | None) -> None:
        self.db = db

    async def ingest(self, shop_id: str, owner_id: str, payload: SmsImportInput, key: str) -> ImportResult:
        db = self.db
        if db is not None:
            # Serialize same-shop imports, including absent receipt identities and raw hashes.
            await db.execute(select(ShopTable).where(ShopTable.id == shop_id).with_for_update())
        account = await SellerService(db).get_payment_account(shop_id, payload.payment_account_id)
        if account is None:
            raise NotFoundError('Payment account not found')
        payload_hash = compute_payload_hash(payload.model_dump())
        if db is not None:
            cached = (await db.execute(select(SmsImportTable).where(
                SmsImportTable.shop_id == shop_id, SmsImportTable.mutation_key == key,
            ))).scalar_one_or_none()
        else:
            cached = _memory_imports.get((shop_id, key))
        if cached is not None:
            if cached.payload_hash != payload_hash:
                raise IdempotencyConflictError()
            return ImportResult.model_validate_json(cached.result_json)
        result = ImportResult(id=str(uuid.uuid4()), payment_account_id=account.id, created_at=get_utc_now(), items=[])
        for index, text in enumerate(payload.messages):
            digest = hashlib.sha256(text.encode('utf-8')).hexdigest()
            if db is not None:
                evidence = (await db.execute(select(SmsEvidenceTable).where(
                    SmsEvidenceTable.shop_id == shop_id, SmsEvidenceTable.text_digest == digest,
                ))).scalar_one_or_none()
            else:
                evidence = _memory_evidence.get((shop_id, digest))
            if evidence is None:
                now = get_utc_now()
                evidence = SmsEvidenceTable(
                    id=str(uuid.uuid4()), shop_id=shop_id, owner_id=owner_id, text_digest=digest,
                    raw_text=text, collected_at=now, delete_after=now + timedelta(days=30),
                )
                if db is not None:
                    db.add(evidence)
                    await db.flush()
                else:
                    _memory_evidence[(shop_id, digest)] = evidence
            state, issues, fields = parse_sms(text, account.id, account.provider)
            item = SmsItemResult(
                index=index, state=state, issues=issues, fields=fields,
                evidence_id=evidence.id, collected_at=evidence.collected_at, delete_after=evidence.delete_after,
            )
            if fields is not None:
                receipt, _ = await TransactionService(db).record_observation(
                    shop_id, owner_id, fields, source='sms', commit=False, reconcile=False,
                )
                item.receipt_id = receipt.id
                conflict = receipt.observations[-1].conflict_state
                item.state = 'conflicting' if receipt.has_conflict else ('duplicate' if conflict == 'identical' else 'imported')
                if receipt.has_conflict:
                    item.issues = ['receipt_observations']
            result.items.append(item)
        # Evaluate the complete batch snapshot before any payment may be allocated.
        receipt_ids = {item.receipt_id for item in result.items if item.receipt_id is not None}
        conflicted = {item.receipt_id for item in result.items if item.state == 'conflicting'}
        for receipt_id in sorted(receipt_ids):
            await reconcile_receipt(db, receipt_id)
        if db is not None:
            await db.flush()
        for item in result.items:
            if item.receipt_id is not None:
                if item.receipt_id in conflicted:
                    item.state = 'conflicting'
                    item.issues = ['receipt_observations']
                item.order_ids = await receipt_order_ids(db, shop_id, item.receipt_id)
        row = SmsImportTable(
            id=result.id, shop_id=shop_id, mutation_key=key, payload_hash=payload_hash,
            result_json=result.model_dump_json(), created_at=result.created_at,
        )
        if db is not None:
            db.add(row)
            await db.commit()
        else:
            _memory_imports[(shop_id, key)] = row
        return result

    async def list_imports(self, shop_id: str, cursor: str | None, limit: int) -> ImportList:
        if self.db is not None:
            query = select(SmsImportTable).where(SmsImportTable.shop_id == shop_id)
            if cursor:
                anchor = (await self.db.execute(query.where(SmsImportTable.id == cursor))).scalar_one_or_none()
                if anchor is None:
                    raise NotFoundError('Import cursor not found')
                from sqlalchemy import tuple_
                query = query.where(tuple_(SmsImportTable.created_at, SmsImportTable.id) < (anchor.created_at, anchor.id))
            rows = list((await self.db.execute(query.order_by(
                SmsImportTable.created_at.desc(), SmsImportTable.id.desc(),
            ).limit(limit + 1))).scalars().all())
        else:
            rows = sorted([r for (shop, _), r in _memory_imports.items() if shop == shop_id],
                          key=lambda r: (r.created_at, r.id), reverse=True)
            if cursor:
                positions = [i for i, row in enumerate(rows) if row.id == cursor]
                if not positions:
                    raise NotFoundError('Import cursor not found')
                rows = rows[positions[0] + 1:]
        return ImportList(items=[ImportResult.model_validate_json(r.result_json) for r in rows[:limit]],
                          next_cursor=rows[limit - 1].id if len(rows) > limit else None)
