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
from urllib.parse import quote, unquote

NO_CACHE_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
}

SNAPSHOT_PATH = Path("data/server-storage/vfs-snapshot.json")
EXPORT_ROOT = Path("data/server-storage/vfs")


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
        fallback = {
            "index": {"levels": {}, "art": {}, "music": {}, "actors": {}},
            "files": {},
        }
        if not SNAPSHOT_PATH.exists():
            return self._merge_exported_documents(fallback)
        try:
            snapshot = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
        except Exception:
            snapshot = fallback
        return self._merge_exported_documents(snapshot)

    def _merge_exported_documents(self, snapshot: dict) -> dict:
        index = snapshot.get("index") if isinstance(snapshot, dict) else {}
        files = snapshot.get("files") if isinstance(snapshot, dict) else {}
        if not isinstance(index, dict):
            index = {}
        if not isinstance(files, dict):
            files = {}
        merged_index = {
            "levels": {},
            "art": {},
            "music": {},
            "actors": {},
            **{folder: dict(entries) for folder, entries in index.items() if isinstance(entries, dict)},
        }
        merged_files = dict(files)

        if not EXPORT_ROOT.exists():
            return {"index": merged_index, "files": merged_files, "generatedAt": snapshot.get("generatedAt")}

        for folder_dir in EXPORT_ROOT.iterdir():
            if not folder_dir.is_dir():
                continue
            folder = folder_dir.name
            if folder not in merged_index or not isinstance(merged_index[folder], dict):
                merged_index[folder] = {}
            for doc_dir in folder_dir.iterdir():
                if not doc_dir.is_dir():
                    continue
                document_path = doc_dir / "document.json"
                if not document_path.exists():
                    continue
                try:
                    data = json.loads(document_path.read_text(encoding="utf-8"))
                except Exception:
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
                payload = {
                    "version": metadata.get("version", 1),
                    "folder": folder,
                    "name": name,
                    "savedAt": saved_at,
                    "data": data,
                }
                raw = json.dumps(payload, ensure_ascii=False)
                key = f"robter:vfs:{folder}:{name}"
                merged_files[key] = raw
                merged_index[folder][name] = {"updatedAt": saved_at, "size": len(raw)}

        return {
            "index": merged_index,
            "files": merged_files,
            "generatedAt": snapshot.get("generatedAt"),
        }

    def _materialize_snapshot(self, snapshot: dict) -> None:
        index = snapshot.get("index") if isinstance(snapshot, dict) else {}
        files = snapshot.get("files") if isinstance(snapshot, dict) else {}
        if not isinstance(index, dict) or not isinstance(files, dict):
            return

        EXPORT_ROOT.mkdir(parents=True, exist_ok=True)

        manifest: dict[str, dict[str, str]] = {"folders": {}}
        for folder, entries in index.items():
            if not isinstance(folder, str) or not isinstance(entries, dict):
                continue
            folder_dir = EXPORT_ROOT / folder
            folder_dir.mkdir(parents=True, exist_ok=True)
            manifest["folders"][folder] = {}
            for name in entries.keys():
                if not isinstance(name, str):
                    continue
                storage_key = f"robter:vfs:{folder}:{name}"
                raw = files.get(storage_key)
                if not isinstance(raw, str):
                    continue
                try:
                    payload = json.loads(raw)
                except Exception:
                    continue
                data = payload.get("data", payload)
                safe = quote(name, safe="-_.() ")
                doc_dir = folder_dir / safe
                doc_dir.mkdir(parents=True, exist_ok=True)
                self._extract_data_urls(data, doc_dir)
                (doc_dir / "document.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
                (doc_dir / "metadata.json").write_text(
                    json.dumps({
                        "name": name,
                        "folder": folder,
                        "savedAt": payload.get("savedAt"),
                        "version": payload.get("version", 1),
                    }, ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )
                manifest["folders"][folder][name] = f"{folder}/{safe}/document.json"

        (EXPORT_ROOT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

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
        if value.startswith("data:image/png;base64,"):
            b64 = value.split(",", 1)[1]
            try:
                data = base64.b64decode(b64)
            except Exception:
                return
            path = doc_dir / "assets"
            path.mkdir(parents=True, exist_ok=True)
            counter[0] += 1
            (path / f"image-{counter[0]}.png").write_bytes(data)

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
            self._materialize_snapshot(snapshot)
            self._write_json(HTTPStatus.OK, {"ok": True})
            return

        if self.path == "/__storage/sync-github":
            try:
                SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
                if not SNAPSHOT_PATH.exists():
                    SNAPSHOT_PATH.write_text(
                        json.dumps({"index": {"levels": {}, "art": {}, "music": {}, "actors": {}}, "files": {}}),
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
