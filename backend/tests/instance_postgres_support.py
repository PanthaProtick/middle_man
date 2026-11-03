"""Disposable databases and independently imported, real HTTP application processes."""
import asyncio
import os
import socket
import subprocess
import sys
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlparse

import asyncpg
import pytest
from cryptography.fernet import Fernet
from httpx import AsyncClient, TransportError
from sqlalchemy.engine import make_url

from app.core.migrations import run_migrations


@pytest.fixture
async def instance_database():
    url = os.environ.get("BUYER_TEST_POSTGRES_URL")
    if not url:
        pytest.skip("Set BUYER_TEST_POSTGRES_URL to disposable loopback PostgreSQL")
    assert urlparse(url).hostname in ("localhost", "127.0.0.1", "::1")
    name = "instance_test_" + uuid.uuid4().hex
    admin = await asyncpg.connect(url, ssl=False)
    target = make_url(url).set(database=name).update_query_dict({"sslmode": "disable"}).render_as_string(hide_password=False)
    try:
        await admin.execute(f'CREATE DATABASE "{name}"')
        await run_migrations(target, confirmed_target=name, require_clean=True)
        connection = await asyncpg.connect(target, ssl=False)
        try:
            yield target, connection
        finally:
            await connection.close()
    finally:
        await admin.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')
        await admin.close()


class Instances:
    def __init__(self, url, directory):
        self.url, self.directory = url, directory
        self.key = Fernet.generate_key().decode()
        self.marker = uuid.uuid4().hex + uuid.uuid4().hex

    @asynccontextmanager
    async def start(self):
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        env = dict(os.environ, DATABASE_URL=self.url, SELF_TEST_MODE="true", ENV="test",
                   PYTHONPATH=str(Path(__file__).parents[1]),
                   PUBLIC_BUYER_ACCESS_POLICY="self_test_link_possession", VERCEL_ENV="",
                   ORDER_LINK_ENCRYPTION_KEY=self.key, PAYMENT_MARKER_SECRET=self.marker,
                   DURABILITY_PORT=str(port))
        log = (self.directory / f"{port}.log").open("w", encoding="utf-8")
        try:
            process = subprocess.Popen([sys.executable, "tests/instance_worker.py"],
                                       cwd=Path(__file__).parents[1], env=env, stdout=log, stderr=log,
                                       creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
        except BaseException:
            log.close()
            raise
        try:
            async with AsyncClient(base_url=f"http://127.0.0.1:{port}", timeout=20, trust_env=False) as client:
                for _ in range(300):
                    if process.poll() is not None:
                        pytest.fail(f"Instance exited; see {log.name}")
                    try:
                        if (await client.get("/api/health")).status_code == 200:
                            break
                    except TransportError:
                        pass
                    await asyncio.sleep(0.05)
                else:
                    pytest.fail(f"Instance did not become ready; see {log.name}")
                yield client
        finally:
            try:
                if process.poll() is None:
                    process.terminate()
                try:
                    await asyncio.to_thread(process.wait, timeout=15)
                except subprocess.TimeoutExpired:
                    process.kill()
                    await asyncio.to_thread(process.wait, timeout=5)
            finally:
                log.close()


@pytest.fixture
async def instances(instance_database, tmp_path):
    url, _ = instance_database
    return Instances(url, tmp_path)
