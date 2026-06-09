#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import json
import os
import shutil
import subprocess
import tempfile
import time
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
TERMUX_LIB_DIR = Path("/data/data/com.termux/files/usr/lib")


def build_ffmpeg_env() -> dict[str, str]:
    env = os.environ.copy()
    preload_parts = [
        str(TERMUX_LIB_DIR / "libc++_shared.so"),
        str(TERMUX_LIB_DIR / "libtermux-exec.so"),
    ]
    existing_preload = env.get("LD_PRELOAD", "")
    for item in existing_preload.split(":"):
        if item and item not in preload_parts:
            preload_parts.append(item)
    env["LD_PRELOAD"] = ":".join(preload_parts)
    return env


def run_git_command(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        check=False,
        text=True,
        capture_output=True,
        cwd=os.getcwd(),
    )


class DevHandler(SimpleHTTPRequestHandler):
    debug_logs = False

    def log_message(self, format: str, *args: object) -> None:
        if self.debug_logs:
            super().log_message(format, *args)

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
        return {"levels": {}, "art": {}, "music": {}, "actors": {}, "sfx": {}, "cutscenes": {}}

    def _safe_doc_dir(self, folder: str, name: str) -> Path:
        return EXPORT_ROOT / folder / quote(name, safe="-_.() ")

    def _safe_version_dir(self, folder: str, name: str, version_id: str) -> Path:
        clean_id = quote(str(version_id or ""), safe="-_.() ")
        return self._safe_doc_dir(folder, name) / "versions" / clean_id

    def _read_exported_metadata(self, folder: str, name: str) -> dict | None:
        doc_dir = self._safe_doc_dir(folder, name)
        document_path = doc_dir / "document.json"
        if not document_path.exists():
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
        }

    def _stream_exported_payload(self, folder: str, name: str) -> bool:
        metadata = self._read_exported_metadata(folder, name)
        if metadata is None:
            return False
        document_path = self._safe_doc_dir(folder, name) / "document.json"
        file_json = json.dumps(metadata, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(b'{"ok":true,"file":')
        self.wfile.write(file_json[:-1])
        self.wfile.write(b',"data":')
        with document_path.open("rb") as handle:
            shutil.copyfileobj(handle, self.wfile, length=1024 * 256)
        self.wfile.write(b"}}")
        return True

    def _read_version_metadata(self, version_dir: Path, folder: str, name: str) -> dict:
        version_path = version_dir / "version.json"
        metadata: dict = {}
        if version_path.exists():
            try:
                loaded = json.loads(version_path.read_text(encoding="utf-8"))
                if isinstance(loaded, dict):
                    metadata = loaded
            except Exception:
                metadata = {}
        document_path = version_dir / "document.json"
        assets_path = version_dir / "assets"
        saved_at = metadata.get("savedAt")
        if not isinstance(saved_at, (int, float)):
            saved_at = int(document_path.stat().st_mtime * 1000) if document_path.exists() else 0
        size = document_path.stat().st_size if document_path.exists() else 0
        if assets_path.exists():
            size += self._directory_size(assets_path)
        return {
            "id": metadata.get("id") if isinstance(metadata.get("id"), str) else version_dir.name,
            "folder": folder,
            "name": name,
            "savedAt": saved_at,
            "reason": metadata.get("reason") if isinstance(metadata.get("reason"), str) else "",
            "size": size,
        }

    def _list_exported_versions(self, folder: str, name: str) -> list[dict]:
        versions_dir = self._safe_doc_dir(folder, name) / "versions"
        if not versions_dir.exists():
            return []
        versions = []
        for version_dir in versions_dir.iterdir():
            if not version_dir.is_dir() or not (version_dir / "document.json").exists():
                continue
            versions.append(self._read_version_metadata(version_dir, folder, name))
        versions.sort(key=lambda entry: entry.get("savedAt") or 0, reverse=True)
        return versions

    def _stream_exported_version(self, folder: str, name: str, version_id: str) -> bool:
        version_dir = self._safe_version_dir(folder, name, version_id)
        document_path = version_dir / "document.json"
        if not document_path.exists():
            return False
        metadata = self._read_version_metadata(version_dir, folder, name)
        file_json = json.dumps({
            "version": 1,
            "folder": folder,
            "name": name,
            "savedAt": metadata.get("savedAt") or int(document_path.stat().st_mtime * 1000),
            "versionId": metadata.get("id") or version_id,
        }, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(b'{"ok":true,"file":')
        self.wfile.write(file_json[:-1])
        self.wfile.write(b',"data":')
        with document_path.open("rb") as handle:
            shutil.copyfileobj(handle, self.wfile, length=1024 * 256)
        self.wfile.write(b"}}")
        return True

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
                versions_dir = doc_dir / "versions"
                if not document_path.exists() and not versions_dir.exists():
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
                if not isinstance(saved_at, (int, float)) and document_path.exists():
                    saved_at = int(document_path.stat().st_mtime * 1000)
                elif not isinstance(saved_at, (int, float)):
                    versions = self._list_exported_versions(folder, name)
                    saved_at = versions[0]["savedAt"] if versions else int(doc_dir.stat().st_mtime * 1000)
                index[folder][name] = {
                    "updatedAt": saved_at,
                    "size": document_path.stat().st_size if document_path.exists() else 0,
                    "deleted": not document_path.exists(),
                    "versionCount": len(self._list_exported_versions(folder, name)),
                }
        return index

    def _write_manifest(self) -> None:
        manifest: dict[str, dict[str, str]] = {"folders": {}}
        index = self._list_exported_files()
        for folder, entries in index.items():
            manifest["folders"][folder] = {}
            for name, meta in entries.items():
                if meta.get("deleted"):
                    continue
                manifest["folders"][folder][name] = f"{folder}/{quote(name, safe='-_.() ')}/document.json"
        EXPORT_ROOT.mkdir(parents=True, exist_ok=True)
        (EXPORT_ROOT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    def _write_exported_payload(self, folder: str, name: str, data: object, saved_at: int | None = None, version: int = 1) -> dict:
        saved = int(saved_at or 0) or int(time.time() * 1000)
        doc_dir = self._safe_doc_dir(folder, name)
        doc_dir.mkdir(parents=True, exist_ok=True)
        self._snapshot_exported_payload(folder, name, "before-save")
        self._extract_data_urls(data, doc_dir)
        with (doc_dir / "document.json").open("w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)
        with (doc_dir / "metadata.json").open("w", encoding="utf-8") as handle:
            json.dump({"name": name, "folder": folder, "savedAt": saved, "version": version}, handle, ensure_ascii=False, indent=2)
        self._write_manifest()
        return {"version": version, "folder": folder, "name": name, "savedAt": saved, "dataOmitted": True}

    def _snapshot_exported_payload(self, folder: str, name: str, reason: str = "before-save") -> dict | None:
        doc_dir = self._safe_doc_dir(folder, name)
        document_path = doc_dir / "document.json"
        if not document_path.exists():
            return None
        metadata = self._read_exported_metadata(folder, name) or {}
        source_saved = int(metadata.get("savedAt") or document_path.stat().st_mtime * 1000)
        version_id = f"{int(time.time() * 1000)}-{source_saved}"
        version_dir = doc_dir / "versions" / quote(version_id, safe="-_.() ")
        suffix = 1
        while version_dir.exists():
            suffix += 1
            version_dir = doc_dir / "versions" / quote(f"{version_id}-{suffix}", safe="-_.() ")
        version_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(document_path, version_dir / "document.json")
        metadata_path = doc_dir / "metadata.json"
        if metadata_path.exists():
            shutil.copy2(metadata_path, version_dir / "metadata.json")
        assets_path = doc_dir / "assets"
        if assets_path.exists():
            shutil.copytree(assets_path, version_dir / "assets")
        version_metadata = {
            "id": version_dir.name,
            "folder": folder,
            "name": name,
            "savedAt": source_saved,
            "createdAt": int(time.time() * 1000),
            "reason": reason,
        }
        (version_dir / "version.json").write_text(json.dumps(version_metadata, ensure_ascii=False, indent=2), encoding="utf-8")
        return self._read_version_metadata(version_dir, folder, name)

    def _restore_exported_version(self, folder: str, name: str, version_id: str) -> dict | None:
        version_dir = self._safe_version_dir(folder, name, version_id)
        document_path = version_dir / "document.json"
        if not document_path.exists():
            return None
        self._snapshot_exported_payload(folder, name, "before-version-restore")
        doc_dir = self._safe_doc_dir(folder, name)
        doc_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(document_path, doc_dir / "document.json")
        current_assets = doc_dir / "assets"
        if current_assets.exists():
            shutil.rmtree(current_assets)
        version_assets = version_dir / "assets"
        if version_assets.exists():
            shutil.copytree(version_assets, current_assets)
        saved = int(time.time() * 1000)
        with (doc_dir / "metadata.json").open("w", encoding="utf-8") as handle:
            json.dump({"name": name, "folder": folder, "savedAt": saved, "version": 1}, handle, ensure_ascii=False, indent=2)
        self._write_manifest()
        return {"version": 1, "folder": folder, "name": name, "savedAt": saved, "dataOmitted": True}

    def _rename_exported_payload(self, folder: str, old_name: str, new_name: str) -> dict | None:
        old_dir = self._safe_doc_dir(folder, old_name)
        new_dir = self._safe_doc_dir(folder, new_name)
        old_metadata = self._read_exported_metadata(folder, old_name)
        if old_metadata is None:
            return None
        if old_dir != new_dir:
            if new_dir.exists():
                shutil.rmtree(new_dir)
            new_dir.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(old_dir), str(new_dir))
        saved = int(time.time() * 1000)
        version = int(old_metadata.get("version") or 1)
        with (new_dir / "metadata.json").open("w", encoding="utf-8") as handle:
            json.dump({"name": new_name, "folder": folder, "savedAt": saved, "version": version}, handle, ensure_ascii=False, indent=2)
        self._write_manifest()
        return {"version": version, "folder": folder, "name": new_name, "savedAt": saved, "dataOmitted": True}

    def _read_self_rss_kb(self) -> int | None:
        try:
            with Path("/proc/self/status").open("r", encoding="utf-8") as handle:
                for line in handle:
                    if line.startswith("VmRSS:"):
                        parts = line.split()
                        return int(parts[1]) if len(parts) > 1 else None
        except Exception:
            return None
        return None

    def _directory_size(self, root: Path) -> int:
        total = 0
        if not root.exists():
            return total
        for dirpath, _, filenames in os.walk(root):
            for filename in filenames:
                try:
                    total += (Path(dirpath) / filename).stat().st_size
                except OSError:
                    pass
        return total

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
            if not self._stream_exported_payload(folder, name):
                self._write_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "File not found"})
            return
        if parsed.path == "/__storage/versions":
            query = parse_qs(parsed.query)
            folder = (query.get("folder") or [""])[0]
            name = (query.get("name") or [""])[0]
            self._write_json(HTTPStatus.OK, {"ok": True, "versions": self._list_exported_versions(folder, name)})
            return
        if parsed.path == "/__storage/version":
            query = parse_qs(parsed.query)
            folder = (query.get("folder") or [""])[0]
            name = (query.get("name") or [""])[0]
            version_id = (query.get("versionId") or [""])[0]
            if not self._stream_exported_version(folder, name, version_id):
                self._write_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "Version not found"})
            return
        if parsed.path == "/__debug/health":
            disk = shutil.disk_usage(Path.cwd())
            self._write_json(
                HTTPStatus.OK,
                {
                    "ok": True,
                    "pid": os.getpid(),
                    "rssKb": self._read_self_rss_kb(),
                    "disk": {"total": disk.total, "used": disk.used, "free": disk.free},
                    "storageBytes": self._directory_size(EXPORT_ROOT),
                },
            )
            return
        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/__export/mp4":
            length = int(self.headers.get("Content-Length", "0") or "0")
            if length <= 0:
                self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Missing movie data"})
                return
            raw = self.rfile.read(length)
            try:
                with tempfile.TemporaryDirectory(prefix="chainsaw-mp4-") as tmp:
                    input_path = Path(tmp) / "input.webm"
                    output_path = Path(tmp) / "output.mp4"
                    input_path.write_bytes(raw)
                    result = subprocess.run(
                        [
                            "ffmpeg",
                            "-y",
                            "-hide_banner",
                            "-loglevel",
                            "error",
                            "-i",
                            str(input_path),
                            "-c:v",
                            "libx264",
                            "-pix_fmt",
                            "yuv420p",
                            "-preset",
                            "veryfast",
                            "-movflags",
                            "+faststart",
                            "-c:a",
                            "aac",
                            "-b:a",
                            "192k",
                            str(output_path),
                        ],
                        check=False,
                        text=True,
                        capture_output=True,
                        env=build_ffmpeg_env(),
                    )
                    if result.returncode != 0 or not output_path.exists():
                        self._write_json(
                            HTTPStatus.BAD_REQUEST,
                            {"ok": False, "error": f"FFmpeg MP4 encode failed: {result.stderr or result.stdout}"},
                        )
                        return
                    data = output_path.read_bytes()
                    self.send_response(HTTPStatus.OK)
                    self.send_header("Content-Type", "video/mp4")
                    self.send_header("Content-Length", str(len(data)))
                    self.end_headers()
                    self.wfile.write(data)
            except FileNotFoundError:
                self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "FFmpeg is not installed on this server"})
            except Exception as exc:  # pragma: no cover - defensive
                self._write_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"ok": False, "error": str(exc)})
            return

        if parsed.path == "/__debug/cutscene":
            length = int(self.headers.get("Content-Length", "0") or "0")
            raw = self.rfile.read(length)
            try:
                payload = json.loads(raw.decode("utf-8") or "{}")
            except Exception:
                payload = {"raw": raw.decode("utf-8", errors="replace")}
            print(f"[cutscene-debug] {json.dumps(payload, ensure_ascii=False)}", flush=True)
            self._write_json(HTTPStatus.OK, {"ok": True})
            return

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
            saved = self._rename_exported_payload(folder, old_name, new_name)
            if saved is None:
                self._write_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "File not found"})
                return
            self._write_json(HTTPStatus.OK, {"ok": True, "file": saved})
            return

        if parsed.path == "/__storage/restore-version":
            length = int(self.headers.get("Content-Length", "0") or "0")
            raw = self.rfile.read(length)
            try:
                payload = json.loads(raw.decode("utf-8") or "{}")
            except Exception:
                self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Invalid JSON"})
                return
            folder = payload.get("folder")
            name = payload.get("name")
            version_id = payload.get("versionId")
            if not all(isinstance(value, str) and value for value in (folder, name, version_id)):
                self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Missing folder, name, or version"})
                return
            restored = self._restore_exported_version(folder, name, version_id)
            if restored is None:
                self._write_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "Version not found"})
                return
            self._write_json(HTTPStatus.OK, {"ok": True, "file": restored})
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
                self._snapshot_exported_payload(folder, name, "before-delete")
                for child in doc_dir.iterdir():
                    if child.name == "versions":
                        continue
                    if child.is_dir():
                        shutil.rmtree(child)
                    else:
                        child.unlink()
            self._write_manifest()
            self._write_json(HTTPStatus.OK, {"ok": True})
            return
        if parsed.path == "/__storage/version":
            query = parse_qs(parsed.query)
            folder = (query.get("folder") or [""])[0]
            name = (query.get("name") or [""])[0]
            version_id = (query.get("versionId") or [""])[0]
            version_dir = self._safe_version_dir(folder, name, version_id)
            if version_dir.exists():
                shutil.rmtree(version_dir)
            self._write_json(HTTPStatus.OK, {"ok": True})
            return
        self.send_error(HTTPStatus.NOT_FOUND, "Not Found")


def main() -> None:
    parser = argparse.ArgumentParser(description="Dev server with no-cache headers and debug git pull endpoint")
    parser.add_argument("port", nargs="?", type=int, default=8000)
    parser.add_argument("--debug", action="store_true", help="Enable per-request access logs")
    args = parser.parse_args()

    DevHandler.debug_logs = bool(args.debug)
    server = ThreadingHTTPServer(("0.0.0.0", args.port), DevHandler)
    log_mode = "debug logs enabled" if args.debug else "access logs suppressed"
    print(f"Serving on http://0.0.0.0:{args.port} (no-cache enabled, {log_mode})")
    server.serve_forever()


if __name__ == "__main__":
    main()
