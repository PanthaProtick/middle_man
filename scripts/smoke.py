"""Exercise real HTTP in standby mode using disposable local processes and ports."""

import functools
import json
import os
import re
import socket
import subprocess
import sys
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import ProxyHandler, Request, build_opener

ROOT = Path(__file__).resolve().parent.parent
HTTP = build_opener(ProxyHandler({}))


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def request(url: str, payload: dict[str, object] | None = None) -> tuple[int, bytes]:
    data = json.dumps(payload).encode() if payload is not None else None
    operation = Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with HTTP.open(operation, timeout=2) as response:
            return response.status, response.read()
    except HTTPError as error:
        return error.code, error.read()


def smoke() -> None:
    distribution = ROOT / "frontend" / "dist"
    if not (distribution / "index.html").exists():
        raise RuntimeError("Build the frontend first: npm run build")
    environment = os.environ.copy()
    for name in (
        "DATABASE_URL", "DIRECT_URL", "PGHOST", "PGDATABASE", "PGUSER", "PGPASSWORD",
        "GEMINI_API_KEY", "CLERK_SECRET_KEY", "CLERK_PUBLISHABLE_KEY", "CLERK_WEBHOOK_SECRET",
        "CLERK_ISSUER", "CLERK_JWT_KEY", "CLERK_AUTHORIZED_PARTY", "CLERK_AUDIENCE",
    ):
        environment[name] = ""
    environment.update(
        ENV="test", DEBUG="false", API_PREFIX="/api", PGPORT="5432", PGSSLMODE="require",
        CORS_ORIGINS='["http://localhost:5173"]', GEMINI_MODEL="gemini-2.5-flash",
    )
    with socket.socket() as reservation:
        reservation.bind(("127.0.0.1", 0))
        api_port = reservation.getsockname()[1]
    api = f"http://127.0.0.1:{api_port}/api"
    log_path = Path(os.environ.get("SMOKE_LOG_DIRECTORY", ROOT / ".cache")) / "smoke-api.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    # Direct Python avoids orphaning a server behind a shell or uv wrapper.
    with log_path.open("w+", encoding="utf-8") as log, subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(api_port), "--no-access-log"],
        cwd=ROOT / "backend", env=environment, stdout=log, stderr=log,
    ) as server:
        try:
            deadline = time.monotonic() + 20
            while True:
                if server.poll() is not None:
                    raise RuntimeError(f"API server exited early: {server.returncode}")
                try:
                    status, body = request(f"{api}/health")
                    break
                except (URLError, TimeoutError):
                    if time.monotonic() >= deadline:
                        raise RuntimeError("API server did not become ready within 20 seconds") from None
                    time.sleep(0.1)
            health = json.loads(body)
            require(status == 200 and health["environment"] == "test", "Unexpected health response")
            require(
                not any(health[key] for key in ("database_configured", "gemini_configured", "clerk_configured")),
                "Smoke must run in standby mode",
            )
            status, body = request(f"{api}/chat", {"message": "Smoke", "conversation_id": "smoke"})
            chat = json.loads(body)
            require(status == 200 and chat["is_mock"] and chat["conversation_id"] == "smoke", "Chat contract failed")
            status, body = request(f"{api}/items", {"title": "Disposable smoke item", "tags": ["smoke"]})
            created = json.loads(body)
            require(status == 200 and bool(created["id"]), "Create contract failed")
            status, body = request(f"{api}/items")
            require(status == 200 and any(item["id"] == created["id"] for item in json.loads(body)), "Created item missing")
            status, _ = request(f"{api}/chat", {"message": ""})
            require(status == 422, "Invalid chat was accepted")
            handler = functools.partial(SimpleHTTPRequestHandler, directory=str(distribution))
            with ThreadingHTTPServer(("127.0.0.1", 0), handler) as static:
                thread = threading.Thread(target=static.serve_forever, daemon=True)
                thread.start()
                try:
                    origin = f"http://127.0.0.1:{static.server_port}"
                    status, html = request(origin)
                    require(status == 200 and b'id="root"' in html, "Built page unavailable")
                    assets = re.findall(r'(?:src|href)="(/assets/[^\"]+)"', html.decode())
                    require(bool(assets), "Built page contains no asset references")
                    for asset in assets:
                        status, body = request(f"{origin}{asset}")
                        require(status == 200 and bool(body), f"Missing built asset: {asset}")
                finally:
                    static.shutdown()
                    thread.join(timeout=5)
            print("PASS: real HTTP health, mock chat, item create/list, invalid request, built page and assets.")
            print("Browser interaction and live provider acceptance remain separate gates.")
        except Exception:
            log.flush()
            log.seek(0)
            print(f"Smoke API diagnostics ({log_path}):\n{log.read()[-4000:]}", file=sys.stderr)
            raise
        finally:
            server.terminate()
            try:
                server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait(timeout=5)


if __name__ == "__main__":
    smoke()
