"""Review current facts without creating a booking or holding locks across I/O."""
import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.courier_review import (
    CourierReview,
    DeliveryMismatch,
    ReviewChoices,
    ReviewUpdate,
    SavedReviewChoices,
)
from app.models.courier_submission import CourierAttemptView
from app.models.entities import ShopTable
from app.models.pathao import ConnectionView, PathaoConnectionTable
from app.models.pathao_location import LocationResolution, LocationSelection
from app.services import courier_attempts
from app.services import pathao_connections as connections
from app.services.courier_drafts import _DraftRecord, _load, project
from app.services.pathao_catalog import InvalidLocation
from app.services.pathao_locations import resolve_choices
from app.services.seller_service import SellerDomainException, StaleVersionError, compute_payload_hash


def marker_value(record: _DraftRecord, name: str) -> str | None:
    if isinstance(record.marker, dict):
        value = record.marker.get(name)
        return str(value) if value is not None else None
    return record.marker.review_choices if name == 'review_choices' else record.marker.reviewed_token


def selected(record: _DraftRecord) -> ReviewChoices:
    saved = marker_value(record, 'review_choices')
    location = LocationResolution.model_validate_json(record.buyer_location) if record.buyer_location else None
    buyer_selection = LocationSelection.model_validate(location.model_dump(include=set(LocationSelection.model_fields))) if location else LocationSelection()
    if saved:
        previous = SavedReviewChoices.model_validate_json(saved)
        result = ReviewChoices.model_validate(previous.model_dump(exclude={'buyer_revision'}))
        if previous.buyer_revision != record.buyer_revision:
            result.location = buyer_selection
        return result
    return ReviewChoices(
        store_id=None,
        environment=location.environment if location else settings.PATHAO_LOCATION_ENVIRONMENT,
        location=buyer_selection,
    )


def fingerprint(record: _DraftRecord, choices: ReviewChoices, revision: int) -> str:
    return compute_payload_hash({
        'order': record.order_id, 'order_version': record.order_version,
        'buyer_revision': record.buyer_revision, 'draft_version': record.version,
        'cod': record.remaining_cod_minor, 'choices': choices.model_dump(), 'connection': revision,
    })


def check_delivery_mismatch(
    current: _DraftRecord, latest_attempt: CourierAttemptView | None
) -> DeliveryMismatch | None:
    if latest_attempt is None or latest_attempt.status not in ('submitting', 'success', 'unknown'):
        return None
    snapshot = latest_attempt.booking_snapshot
    if snapshot is None:
        return None

    is_cancelled = current.lifecycle == 'cancelled'
    name_changed = current.recipient_name != snapshot.recipient_name
    phone_changed = current.contact_number != snapshot.recipient_phone
    address_changed = current.address != snapshot.recipient_address

    if not (is_cancelled or name_changed or phone_changed or address_changed):
        return None

    changed_fields: list[str] = []
    messages: list[str] = []
    if is_cancelled:
        changed_fields.append('cancellation')
        messages.append('Order was cancelled locally after courier submission. Local cancellation does not cancel the Pathao booking.')

    delivery_changes: list[str] = []
    if name_changed:
        changed_fields.append('recipient_name')
        delivery_changes.append('recipient name')
    if phone_changed:
        changed_fields.append('contact_number')
        delivery_changes.append('contact number')
    if address_changed:
        changed_fields.append('address')
        delivery_changes.append('delivery address')

    if delivery_changes:
        messages.append(
            f"Delivery details were updated locally after courier submission ({', '.join(delivery_changes)}). Local changes do not update the Pathao booking."
        )

    messages.append('Resolve or update the booking directly in Pathao.')
    full_message = ' '.join(messages)

    return DeliveryMismatch(
        mismatch=True,
        cancelled=is_cancelled,
        recipient_name_changed=name_changed,
        contact_number_changed=phone_changed,
        address_changed=address_changed,
        changed_fields=changed_fields,
        booked_snapshot=snapshot,
        message=full_message,
    )


async def read(db: AsyncSession | None, shop: str, order: str) -> CourierReview:
    record = await _load(db, shop, order)
    choices = selected(record)
    if db is not None:
        await db.commit()
    revision = await connections.latest(db, shop, choices.environment)
    # Defaults are suggestions only; they are part of the token the seller reviews.
    if marker_value(record, 'review_choices') is None:
        choices.store_id, choices.delivery_type = revision.store_id, revision.delivery_type
    blockers: list[str] = [code for code in project(record).blockers
                if code not in ('COURIER_CONNECTION_REQUIRED', 'LOCATION_METADATA_REQUIRED')]
    location = LocationResolution(environment=choices.environment, condition='disconnected')
    stores = []
    connection = ConnectionView(environment=choices.environment, version=revision.version,
                                status='connected' if revision.version else 'disconnected',
                                simulated=choices.environment == 'offline',
                                default_store_id=revision.store_id, default_delivery_type=revision.delivery_type)
    if not revision.version:
        blockers.append('COURIER_CONNECTION_REQUIRED')
    else:
        try:
            async with asyncio.timeout(12):
                connection = connections.view(choices.environment, revision)
                stores = await connections.stores_for(shop, choices.environment, revision)
                location = await resolve_choices(shop, choices.environment, revision, choices.location)
                if choices.location.unsupported:
                    location.condition = 'unsupported'
        except InvalidLocation:
            location.condition = 'missing_choices'
            blockers.append('LOCATION_CHOICES_INVALID')
        except (SellerDomainException, TimeoutError):
            blockers.append('METADATA_UNAVAILABLE')
    if choices.store_id not in {store.id for store in stores}:
        blockers.append('PICKUP_STORE_REQUIRED')
    if choices.delivery_type not in (48, 12):
        blockers.append('SERVICE_REQUIRED')
    if location.condition != 'resolved':
        blockers.append('LOCATION_METADATA_REQUIRED')
    # Check settings first: latest releases transactions; acquire the order only afterwards.
    connections.check_version(await connections.latest(db, shop, choices.environment), revision.version)
    current = await _load(db, shop, order)
    if fingerprint(current, choices, revision.version) != fingerprint(record, choices, revision.version):
        raise StaleVersionError('Order changed while loading review. Refresh current details.')
    token = fingerprint(current, choices, revision.version)
    latest_attempt = await courier_attempts.get_latest_attempt(db, order)
    is_reviewed = not blockers and marker_value(current, 'reviewed_token') == token
    has_active_attempt = latest_attempt is not None and latest_attempt.status in ('submitting', 'success', 'unknown')
    submission_enabled = (
        is_reviewed
        and not blockers
        and choices.environment in ('offline', 'sandbox')
        and not has_active_attempt
        and current.lifecycle == 'confirmed'
    )
    delivery_mismatch = check_delivery_mismatch(current, latest_attempt)
    result = CourierReview(
        draft=project(current),
        choices=choices,
        connection=connection,
        stores=stores,
        location=location,
        blockers=blockers,
        token=token,
        reviewed=is_reviewed,
        submission_enabled=submission_enabled,
        latest_attempt=latest_attempt,
        delivery_mismatch=delivery_mismatch,
    )
    if db is not None:
        await db.commit()
    return result


async def locked_current(db: AsyncSession | None, shop: str, order: str,
                         review: CourierReview, expected: str) -> _DraftRecord:
    if db is not None:
        # Same shop lock as settings writes; no connection changes between check and commit.
        await db.scalar(select(ShopTable).where(ShopTable.id == shop).with_for_update())
        version = await db.scalar(select(PathaoConnectionTable.version).where(
            PathaoConnectionTable.shop_id == shop,
            PathaoConnectionTable.environment == review.choices.environment,
        ).order_by(PathaoConnectionTable.version.desc()).limit(1))
    else:
        version = (await connections.latest(db, shop, review.choices.environment)).version
    record = await _load(db, shop, order, lock_draft=True)
    await courier_attempts.assert_order_allows_edits(db, order, 'Review')
    if expected != review.token or fingerprint(record, review.choices, version or 0) != expected:
        raise StaleVersionError('Review changed. Reload and review current details.')
    if record.lifecycle != 'confirmed':
        raise SellerDomainException(409, 'INVALID_LIFECYCLE', 'Only confirmed orders can be reviewed.')
    return record


def set_marker(record: _DraftRecord, name: str, value: str | int | None) -> None:
    if isinstance(record.marker, dict):
        record.marker[name] = value
    else:
        setattr(record.marker, name, value)


async def update(db: AsyncSession | None, shop: str, order: str, data: ReviewUpdate) -> CourierReview:
    previous = await read(db, shop, order)
    record = await locked_current(db, shop, order, previous, data.expected_token)
    choices = ReviewChoices.model_validate(data.model_dump(exclude={'expected_token'}))
    saved = SavedReviewChoices(**choices.model_dump(), buyer_revision=record.buyer_revision)
    set_marker(record, 'review_choices', saved.model_dump_json())
    set_marker(record, 'reviewed_token', None)
    set_marker(record, 'version', record.version + 1)
    if db is not None:
        await db.commit()
    return await read(db, shop, order)


async def approve(db: AsyncSession | None, shop: str, order: str, expected: str) -> CourierReview:
    review = await read(db, shop, order)
    record = await locked_current(db, shop, order, review, expected)
    if review.blockers:
        raise SellerDomainException(409, 'COURIER_NOT_READY', 'Resolve all readiness blockers before review.')
    set_marker(record, 'reviewed_token', expected)
    if db is not None:
        await db.commit()
    return await read(db, shop, order)
