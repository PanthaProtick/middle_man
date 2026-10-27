import pytest
from starlette.requests import Request

from app.core.clerk_verifier import AuthenticationError
from app.main import http_exception_handler


@pytest.mark.asyncio
@pytest.mark.parametrize(('message', 'reason'), [
    ('Token has expired', 'expired'),
    ('Token is not yet valid', 'not_yet_valid'),
    ('Token issuer mismatch', 'issuer_mismatch'),
    ('Token audience mismatch', 'audience_mismatch'),
    ('Token authorized party mismatch', 'origin_mismatch'),
    ('Invalid token signature', 'invalid_signature'),
    ('Unexpected private diagnostic', 'rejected'),
])
async def test_unauthorized_response_has_only_allowlisted_diagnostic_header(message, reason):
    request = Request({'type': 'http', 'headers': []})
    response = await http_exception_handler(request, AuthenticationError(message))
    assert response.status_code == 401
    assert response.headers['X-Seller-Auth-Reason'] == reason
    assert message not in response.headers.values()
