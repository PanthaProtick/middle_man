"""Strict synthetic bKash fixture grammar, not a claim of provider support."""
import datetime
import re
from decimal import Decimal

from pydantic import ValidationError

from app.models.sms import ImportState
from app.models.transaction import ManualReceipt

FORMAT = re.compile(
    r'bKash: You have received Tk (?P<amount>(?:[0-9]+(?:\.[0-9]{2})?|\?)) '
    r'from (?P<sender>[^.\n]+)\. TrxID (?P<trx>[^\s]+) at (?P<time>[^\s]+)'
)


def parse_sms(text: str, account_id: str, provider: str) -> tuple[ImportState, list[str], ManualReceipt | None]:
    match = FORMAT.fullmatch(text.strip())
    if match is None:
        return 'unsupported', ['format'], None
    if provider != 'bkash':
        return 'provider_mismatch', ['provider'], None
    values = match.groupdict()
    if any(values[key] == '?' for key in ('amount', 'sender', 'trx', 'time')):
        return 'missing', ['required_fields'], None
    if '*' in values['sender'] or 'x' in values['sender'].lower():
        return 'masked', ['sender_number'], None
    try:
        occurred_at = datetime.datetime.fromisoformat(values['time'])
        if occurred_at.tzinfo is None or occurred_at.utcoffset() is None:
            return 'ambiguous', ['occurred_at'], None
        receipt = ManualReceipt(
            payment_account_id=account_id, provider='bkash', trx_id=values['trx'],
            amount_minor=int(Decimal(values['amount']) * 100),
            sender_number=values['sender'], occurred_at=occurred_at,
        )
    except (ValueError, ValidationError):
        return 'ambiguous', ['invalid_fields'], None
    return 'imported', [], receipt
