"""A full hierarchy crawl must not authenticate separately for each list."""
import httpx
import pytest

from app.models.pathao import MerchantCredentials
from app.services import pathao_catalog as catalog
from app.services import pathao_location_access as access
from app.services import pathao_snapshot_sync as sync
from app.services.pathao_connections import Revision
from app.services.seller_service import SellerDomainException


@pytest.mark.parametrize('area_failure', [False, True])
async def test_crawl_authenticates_once_and_propagates_provider_failure(monkeypatch, area_failure):
    credentials = MerchantCredentials(client_id='id', client_secret='secret', username='user', password='pass')
    catalog.clear_cache()
    monkeypatch.setattr(access, 'unseal', lambda _: credentials)
    auth_calls = 0
    paths = []

    async def respond(request):
        nonlocal auth_calls
        path = request.url.path
        if path.endswith('issue-token'):
            auth_calls += 1
            if auth_calls > 1:
                return httpx.Response(429)
            return httpx.Response(200, json={'access_token': 'synthetic', 'token_type': 'Bearer', 'expires_in': 3600})
        assert request.headers['Authorization'] == 'Bearer synthetic'
        paths.append(path)
        if path.endswith('city-list'):
            rows = [{'city_id': 1, 'city_name': 'City'}]
        elif path.endswith('zone-list'):
            rows = [{'zone_id': 10, 'zone_name': 'Zone'}, {'zone_id': 11, 'zone_name': 'Other zone'}]
        else:
            if area_failure:
                return httpx.Response(503)
            rows = [{'area_id': 100, 'area_name': 'Area', 'home_delivery_available': True}]
        return httpx.Response(200, json={'data': {'data': rows}})

    monkeypatch.setattr(catalog.provider, 'transport', lambda: httpx.MockTransport(respond))
    if area_failure:
        with pytest.raises(SellerDomainException):
            await sync.crawl('shop', 'sandbox', Revision(1, encrypted_credentials='sealed'))
    else:
        tree = await sync.crawl('shop', 'sandbox', Revision(1, encrypted_credentials='sealed'))
        assert set(tree) == {('city', 0), ('zone', 1), ('area', 10), ('area', 11)}
        assert tree[('area', 11)][0].home_delivery_available is True
    assert auth_calls == 1
    assert len(paths) == (3 if area_failure else 4)
