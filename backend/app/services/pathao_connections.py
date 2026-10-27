"""Connection settings own their revisions independently of payment accounts/drafts."""
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import ensure_durable_storage
from app.models.entities import ShopTable
from app.models.pathao import (
    ConnectInput,
    ConnectionView,
    DefaultsInput,
    DeliveryType,
    Environment,
    MerchantCredentials,
    PathaoConnectionTable,
    PickupStore,
    StoreChoices,
)
from app.services.pathao_provider import list_stores
from app.services.pathao_secrets import seal, unseal
from app.services.seller_service import SellerDomainException, StaleVersionError


class CourierSetupError(SellerDomainException):
    """The reviewed connection can no longer be used for an external booking."""

    def __init__(self, status_code: int, code: str, message: str) -> None:
        super().__init__(status_code, code, message)
        self.code = code
        self.message = message


@dataclass(frozen=True)
class Revision:
    version: int
    encrypted_credentials: str | None = None
    store_id: int | None = None
    delivery_type: DeliveryType | None = None


_memory: dict[tuple[str, Environment], list[Revision]] = {}


async def latest(db: AsyncSession | None, shop: str, env: Environment) -> Revision:
    ensure_durable_storage(db, 'Pathao settings')
    if db is None:
        revisions = _memory.get((shop, env), [])
        return revisions[-1] if revisions else Revision(0)
    row = await db.scalar(select(PathaoConnectionTable).where(
        PathaoConnectionTable.shop_id == shop, PathaoConnectionTable.environment == env,
    ).order_by(PathaoConnectionTable.version.desc()).limit(1))
    result = Revision(row.version, row.encrypted_credentials, row.default_store_id,
                      row.default_delivery_type) if row else Revision(0)
    # Release read transactions before any provider request.
    await db.commit()
    return result


def view(env: Environment, revision: Revision) -> ConnectionView:
    if revision.version and env != 'offline':
        unseal(revision.encrypted_credentials)
    return ConnectionView(
        environment=env, version=revision.version, simulated=env == 'offline',
        status='connected' if revision.version else 'disconnected',
        merchant_hint=('Simulated merchant' if env == 'offline' else '••••') if revision.version else None,
        default_store_id=revision.store_id,
        default_delivery_type=revision.delivery_type,
    )


def check_version(revision: Revision, expected: int) -> None:
    if revision.version != expected:
        raise StaleVersionError('Pathao settings changed. Reload before saving.')


async def append(db: AsyncSession | None, shop: str, env: Environment, expected: int,
                 revision: Revision) -> ConnectionView:
    if db is None:
        check_version(await latest(db, shop, env), expected)
        _memory.setdefault((shop, env), []).append(revision)
    else:
        await db.scalar(select(ShopTable).where(ShopTable.id == shop).with_for_update())
        row = await db.scalar(select(PathaoConnectionTable.version).where(
            PathaoConnectionTable.shop_id == shop, PathaoConnectionTable.environment == env,
        ).order_by(PathaoConnectionTable.version.desc()).limit(1))
        check_version(Revision(row or 0), expected)
        db.add(PathaoConnectionTable(
            shop_id=shop, environment=env, version=revision.version,
            encrypted_credentials=revision.encrypted_credentials,
            default_store_id=revision.store_id, default_delivery_type=revision.delivery_type,
        ))
        await db.commit()
    return view(env, revision)


async def stores_for(shop: str, env: Environment, revision: Revision) -> list[PickupStore]:
    credentials = unseal(revision.encrypted_credentials) if env != 'offline' else None
    return await list_stores(shop, env, credentials)


async def submission_credentials(
    db: AsyncSession | None, shop: str, env: Environment, expected_version: int,
) -> MerchantCredentials | None:
    """Releases the read transaction before returning; no provider call is made here."""
    if env == 'offline':
        return None
    revision = await latest(db, shop, env)
    if not revision.version:
        raise CourierSetupError(422, 'COURIER_CONNECTION_REQUIRED', 'Connect Pathao before submitting.')
    if revision.version != expected_version:
        raise CourierSetupError(
            409, 'COURIER_SETUP_CHANGED', 'Pathao settings changed after review. Reload and review current details.',
        )
    try:
        return unseal(revision.encrypted_credentials)
    except SellerDomainException:
        raise CourierSetupError(
            503, 'PATHAO_KEY_UNAVAILABLE',
            'Courier credentials cannot be decrypted. Contact the operator before submitting.',
        ) from None


async def connect(db: AsyncSession | None, shop: str, env: Environment, data: ConnectInput) -> ConnectionView:
    previous = await latest(db, shop, env)
    check_version(previous, data.expected_version)
    if env == 'offline' and data.credentials is not None:
        raise SellerDomainException(422, 'PATHAO_CREDENTIALS', 'Offline setup does not accept credentials.')
    if env != 'offline' and data.credentials is None:
        raise SellerDomainException(422, 'PATHAO_CREDENTIALS_REQUIRED', 'Enter all merchant credentials.')
    encrypted = seal(data.credentials) if data.credentials is not None else None
    candidate = Revision(previous.version + 1, encrypted)
    await stores_for(shop, env, candidate)
    return await append(db, shop, env, previous.version, candidate)


async def choices(db: AsyncSession | None, shop: str, env: Environment, expected: int) -> StoreChoices:
    revision = await latest(db, shop, env)
    check_version(revision, expected)
    if not revision.version:
        raise SellerDomainException(409, 'PATHAO_DISCONNECTED', 'Connect Pathao first.')
    stores = await stores_for(shop, env, revision)
    check_version(await latest(db, shop, env), expected)
    return StoreChoices(environment=env, version=expected, simulated=env == 'offline', stores=stores)


async def defaults(db: AsyncSession | None, shop: str, env: Environment, data: DefaultsInput) -> ConnectionView:
    revision = await latest(db, shop, env)
    check_version(revision, data.expected_version)
    stores = await choices(db, shop, env, revision.version)
    if data.default_store_id not in {store.id for store in stores.stores}:
        raise SellerDomainException(422, 'PATHAO_STORE_INVALID', 'Choose an active store owned by this connection.')
    return await append(db, shop, env, revision.version, Revision(
        revision.version + 1, revision.encrypted_credentials, data.default_store_id, data.default_delivery_type,
    ))
