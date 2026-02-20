#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import subprocess
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

NO_CACHE_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
}


class DevHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        for key, value in NO_CACHE_HEADERS.items():
            self.send_header(key, value)
        super().end_headers()

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/__debug/restart":
            self.send_error(HTTPStatus.NOT_FOUND, "Not Found")
            return

        try:
            result = subprocess.run(
                ["git", "pull", "--ff-only"],
                check=False,
                text=True,
                capture_output=True,
                cwd=os.getcwd(),
            )
            if result.returncode != 0 and "no tracking information" in (result.stderr or "").lower():
                branch_result = subprocess.run(
                    ["git", "rev-parse", "--abbrev-ref", "HEAD"],
                    check=False,
                    text=True,
                    capture_output=True,
                    cwd=os.getcwd(),
                )
                branch = (branch_result.stdout or "").strip()
                if branch:
                    for remote in ("origin", "upstream"):
                        retry = subprocess.run(
                            ["git", "pull", "--ff-only", remote, branch],
                            check=False,
                            text=True,
                            capture_output=True,
                            cwd=os.getcwd(),
                        )
                        if retry.returncode == 0:
                            result = retry
                            break
            payload = {
                "ok": result.returncode == 0,
                "returncode": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr,
            }
            body = json.dumps(payload).encode("utf-8")
            self.send_response(HTTPStatus.OK if payload["ok"] else HTTPStatus.BAD_REQUEST)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as exc:  # pragma: no cover - defensive
            body = json.dumps({"ok": False, "error": str(exc)}).encode("utf-8")
            self.send_response(HTTPStatus.INTERNAL_SERVER_ERROR)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)


def main() -> None:
    parser = argparse.ArgumentParser(description="Dev server with no-cache headers and debug git pull endpoint")
    parser.add_argument("port", nargs="?", type=int, default=8000)
    args = parser.parse_args()

    server = ThreadingHTTPServer(("0.0.0.0", args.port), DevHandler)
    print(f"Serving on http://0.0.0.0:{args.port} (no-cache enabled)")
    server.serve_forever()


if __name__ == "__main__":
    main()
