#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlparse

NO_CACHE_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
}

EXPORT_ROOT = Path("data/server-storage/files")


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

    def _empty_index(self) -> dict:
        return {"levels": {}, "art": {}, "music": {}, "actors": {}, "sfx": {}}

    def _safe_doc_dir(self, folder: str, name: str) -> Path:
        return EXPORT_ROOT / folder / quote(name, safe="-_.() ")

    def _read_exported_payload(self, folder: str, name: str) -> dict | None:
        doc_dir = self._safe_doc_dir(folder, name)
        document_path = doc_dir / "document.json"
        if not document_path.exists():
            return None
        try:
            data = json.loads(document_path.read_text(encoding="utf-8"))
        except Exception:
            return None
        metadata: dict = {}
        metadata_path = doc_dir / "metadata.json"
        if metadata_path.exists():
            try:
                loaded_metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
                if isinstance(loaded_metadata, dict):
                    metadata = loaded_metadata
            except Exception:
                metadata = {}
        saved_at = metadata.get("savedAt")
        if not isinstance(saved_at, (int, float)):
            saved_at = int(document_path.stat().st_mtime * 1000)
        return {
            "version": metadata.get("version", 1),
            "folder": folder,
            "name": metadata.get("name") if isinstance(metadata.get("name"), str) else name,
            "savedAt": saved_at,
            "data": data,
        }

    def _list_exported_files(self, folder_filter: str | None = None) -> dict:
        index = self._empty_index()
        if not EXPORT_ROOT.exists():
            return index
        for folder_dir in EXPORT_ROOT.iterdir():
            if not folder_dir.is_dir():
                continue
            folder = folder_dir.name
            if folder_filter and folder != folder_filter:
                continue
            if folder not in index:
                index[folder] = {}
            for doc_dir in folder_dir.iterdir():
                if not doc_dir.is_dir():
                    continue
                document_path = doc_dir / "document.json"
                if not document_path.exists():
                    continue
                metadata = {}
                metadata_path = doc_dir / "metadata.json"
                if metadata_path.exists():
                    try:
                        loaded_metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
                        if isinstance(loaded_metadata, dict):
                            metadata = loaded_metadata
                    except Exception:
                        metadata = {}
                name = metadata.get("name") if isinstance(metadata.get("name"), str) else unquote(doc_dir.name)
                if not name:
                    continue
                saved_at = metadata.get("savedAt")
                if not isinstance(saved_at, (int, float)):
                    saved_at = int(document_path.stat().st_mtime * 1000)
                index[folder][name] = {"updatedAt": saved_at, "size": document_path.stat().st_size}
        return index

    def _write_manifest(self) -> None:
        manifest: dict[str, dict[str, str]] = {"folders": {}}
        index = self._list_exported_files()
        for folder, entries in index.items():
            manifest["folders"][folder] = {}
            for name in entries.keys():
                manifest["folders"][folder][name] = f"{folder}/{quote(name, safe='-_.() ')}/document.json"
        EXPORT_ROOT.mkdir(parents=True, exist_ok=True)
        (EXPORT_ROOT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    def _write_exported_payload(self, folder: str, name: str, data: object, saved_at: int | None = None, version: int = 1) -> dict:
        saved = int(saved_at or 0) or int(__import__("time").time() * 1000)
        doc_dir = self._safe_doc_dir(folder, name)
        doc_dir.mkdir(parents=True, exist_ok=True)
        self._extract_data_urls(data, doc_dir)
        (doc_dir / "document.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        (doc_dir / "metadata.json").write_text(
            json.dumps({"name": name, "folder": folder, "savedAt": saved, "version": version}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        self._write_manifest()
        return {"version": version, "folder": folder, "name": name, "savedAt": saved, "data": data}

    def _extract_data_urls(self, value: object, doc_dir: Path, counter: list[int] | None = None) -> None:
        if counter is None:
            counter = [0]
        if isinstance(value, dict):
            for inner in value.values():
                self._extract_data_urls(inner, doc_dir, counter)
            return
        if isinstance(value, list):
            for inner in value:
                self._extract_data_urls(inner, doc_dir, counter)
            return
        if not isinstance(value, str):
            return
        if value.startswith("data:image/png;base64,") or value.startswith("data:audio/wav;base64,"):
            b64 = value.split(",", 1)[1]
            try:
                data = base64.b64decode(b64)
            except Exception:
                return
            path = doc_dir / "assets"
            path.mkdir(parents=True, exist_ok=True)
            counter[0] += 1
            suffix = "png" if value.startswith("data:image/png;base64,") else "wav"
            prefix = "image" if suffix == "png" else "audio"
            (path / f"{prefix}-{counter[0]}.{suffix}").write_bytes(data)

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/__storage/index":
            query = parse_qs(parsed.query)
            folder = (query.get("folder") or [None])[0]
            self._write_json(HTTPStatus.OK, {"ok": True, "index": self._list_exported_files(folder)})
            return
        if parsed.path == "/__storage/file":
            query = parse_qs(parsed.query)
            folder = (query.get("folder") or [""])[0]
            name = (query.get("name") or [""])[0]
            payload = self._read_exported_payload(folder, name)
            if payload is None:
                self._write_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "File not found"})
                return
            self._write_json(HTTPStatus.OK, {"ok": True, "file": payload})
            return
        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/__storage/file":
            length = int(self.headers.get("Content-Length", "0") or "0")
            raw = self.rfile.read(length)
            try:
                payload = json.loads(raw.decode("utf-8") or "{}")
            except Exception:
                self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Invalid JSON"})
                return
            folder = payload.get("folder")
            name = payload.get("name")
            if not isinstance(folder, str) or not isinstance(name, str) or not name:
                self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Missing folder or name"})
                return
            saved = self._write_exported_payload(folder, name, payload.get("data"), payload.get("savedAt"), int(payload.get("version") or 1))
            self._write_json(HTTPStatus.OK, {"ok": True, "file": saved})
            return

        if parsed.path == "/__storage/rename":
            length = int(self.headers.get("Content-Length", "0") or "0")
            raw = self.rfile.read(length)
            try:
                payload = json.loads(raw.decode("utf-8") or "{}")
            except Exception:
                self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Invalid JSON"})
                return
            folder = payload.get("folder")
            old_name = payload.get("oldName")
            new_name = payload.get("newName")
            if not all(isinstance(value, str) and value for value in (folder, old_name, new_name)):
                self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Missing folder or name"})
                return
            existing = self._read_exported_payload(folder, old_name)
            if existing is None:
                self._write_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "File not found"})
                return
            saved = self._write_exported_payload(folder, new_name, existing.get("data"), int(__import__("time").time() * 1000), int(existing.get("version") or 1))
            old_dir = self._safe_doc_dir(folder, old_name)
            if old_dir.exists() and old_dir != self._safe_doc_dir(folder, new_name):
                import shutil
                shutil.rmtree(old_dir)
            self._write_manifest()
            self._write_json(HTTPStatus.OK, {"ok": True, "file": saved})
            return

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

        if self.path == "/__storage/sync-github":
            try:
                EXPORT_ROOT.mkdir(parents=True, exist_ok=True)
                self._write_manifest()
                add_result = run_git_command(["git", "add", str(EXPORT_ROOT)])
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
                    "chore: update server project files",
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

    def do_DELETE(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/__storage/file":
            query = parse_qs(parsed.query)
            folder = (query.get("folder") or [""])[0]
            name = (query.get("name") or [""])[0]
            doc_dir = self._safe_doc_dir(folder, name)
            if doc_dir.exists():
                import shutil
                shutil.rmtree(doc_dir)
            self._write_manifest()
            self._write_json(HTTPStatus.OK, {"ok": True})
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
