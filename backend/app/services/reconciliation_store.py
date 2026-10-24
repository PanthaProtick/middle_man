from typing import Any, Dict, List, Set

# In-memory stores for standby / credential-free operation
# Keyed by order_id or transaction_id
_memory_allocations: Dict[str, Dict[str, Any]] = {}  # allocation_id -> allocation record
_memory_order_allocations: Dict[str, str] = {}  # order_id -> allocation_id
_memory_transaction_allocations: Dict[str, str] = {}  # transaction_id -> allocation_id
_memory_used_payment_markers: Set[tuple[str, str, str]] = set()  # (shop_id, provider, digest)
_memory_audit_events: List[Dict[str, Any]] = []
_memory_order_review_reasons: Dict[str, List[str]] = {}  # order_id -> list of reason strings


def reset_reconciliation_memory_store() -> None:
    from app.services.payment_history import _memory_payment_metrics
    _memory_payment_metrics.clear()
    _memory_allocations.clear()
    _memory_order_allocations.clear()
    _memory_transaction_allocations.clear()
    _memory_used_payment_markers.clear()
    _memory_audit_events.clear()
    _memory_order_review_reasons.clear()
