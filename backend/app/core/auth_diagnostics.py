"""Bounded authentication categories that never include token or claim values."""


def rejection_reason(message: str) -> str:
    return {
        'Token has expired': 'expired',
        'Token is not yet valid': 'not_yet_valid',
        'Token issuer mismatch': 'issuer_mismatch',
        'Token audience mismatch': 'audience_mismatch',
        'Token authorized party mismatch': 'origin_mismatch',
        'Invalid token signature': 'invalid_signature',
    }.get(message, 'rejected')
