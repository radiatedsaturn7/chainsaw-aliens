#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import subprocess
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

NO_CACHE_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
}

SNAPSHOT_PATH = Path("data/server-storage/vfs-snapshot.json")


def run_git_command(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        check=False,
        text=True,
        capture_output=True,
        cwd=os.getcwd(),
    )


class DevHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        for key, value in NO_CACHE_HEADERS.items():
            self.send_header(key, value)
        super().end_headers()

    def _write_json(self, status: HTTPStatus, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _load_snapshot(self) -> dict:
        if not SNAPSHOT_PATH.exists():
            return {
                "index": {"levels": {}, "art": {}, "music": {}},
                "files": {},
            }
        try:
            return json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
        except Exception:
            return {
                "index": {"levels": {}, "art": {}, "music": {}},
                "files": {},
            }

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/__storage/snapshot":
            snapshot = self._load_snapshot()
            self._write_json(HTTPStatus.OK, {"ok": True, "snapshot": snapshot})
            return
        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        if self.path == "/__debug/restart":
            try:
                result = run_git_command(["git", "pull", "--ff-only"])
                if result.returncode != 0 and "no tracking information" in (result.stderr or "").lower():
                    branch_result = run_git_command(["git", "rev-parse", "--abbrev-ref", "HEAD"])
                    branch = (branch_result.stdout or "").strip()
                    if branch:
                        for remote in ("origin", "upstream"):
                            retry = run_git_command(["git", "pull", "--ff-only", remote, branch])
                            if retry.returncode == 0:
                                result = retry
                                break
                payload = {
                    "ok": result.returncode == 0,
                    "returncode": result.returncode,
                    "stdout": result.stdout,
                    "stderr": result.stderr,
                }
                self._write_json(HTTPStatus.OK if payload["ok"] else HTTPStatus.BAD_REQUEST, payload)
            except Exception as exc:  # pragma: no cover - defensive
                self._write_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"ok": False, "error": str(exc)})
            return

        if self.path == "/__storage/snapshot":
            length = int(self.headers.get("Content-Length", "0") or "0")
            raw = self.rfile.read(length)
            try:
                payload = json.loads(raw.decode("utf-8") or "{}")
            except Exception:
                self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Invalid JSON"})
                return
            snapshot = payload.get("snapshot")
            if not isinstance(snapshot, dict):
                self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Missing snapshot"})
                return
            SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
            SNAPSHOT_PATH.write_text(json.dumps(snapshot, ensure_ascii=False), encoding="utf-8")
            self._write_json(HTTPStatus.OK, {"ok": True})
            return

        if self.path == "/__storage/sync-github":
            try:
                SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
                if not SNAPSHOT_PATH.exists():
                    SNAPSHOT_PATH.write_text(
                        json.dumps({"index": {"levels": {}, "art": {}, "music": {}}, "files": {}}),
                        encoding="utf-8",
                    )
                add_result = run_git_command(["git", "add", str(SNAPSHOT_PATH)])
                if add_result.returncode != 0:
                    self._write_json(
                        HTTPStatus.BAD_REQUEST,
                        {"ok": False, "stderr": add_result.stderr, "stdout": add_result.stdout},
                    )
                    return
                commit_result = run_git_command([
                    "git",
                    "commit",
                    "-m",
                    "chore: update server VFS snapshot",
                ])
                # no-op commit is acceptable.
                if commit_result.returncode != 0 and "nothing to commit" not in (commit_result.stdout + commit_result.stderr).lower():
                    self._write_json(
                        HTTPStatus.BAD_REQUEST,
                        {"ok": False, "stderr": commit_result.stderr, "stdout": commit_result.stdout},
                    )
                    return
                push_result = run_git_command(["git", "push"])
                self._write_json(
                    HTTPStatus.OK if push_result.returncode == 0 else HTTPStatus.BAD_REQUEST,
                    {
                        "ok": push_result.returncode == 0,
                        "stdout": (commit_result.stdout or "") + (push_result.stdout or ""),
                        "stderr": (commit_result.stderr or "") + (push_result.stderr or ""),
                    },
                )
            except Exception as exc:  # pragma: no cover - defensive
                self._write_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"ok": False, "error": str(exc)})
            return

        self.send_error(HTTPStatus.NOT_FOUND, "Not Found")


def main() -> None:
    parser = argparse.ArgumentParser(description="Dev server with no-cache headers and debug git pull endpoint")
    parser.add_argument("port", nargs="?", type=int, default=8000)
    args = parser.parse_args()

    server = ThreadingHTTPServer(("0.0.0.0", args.port), DevHandler)
    print(f"Serving on http://0.0.0.0:{args.port} (no-cache enabled)")
    server.serve_forever()


if __name__ == "__main__":
    main()
