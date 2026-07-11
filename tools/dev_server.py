#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
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
EXPORT_SESSION_ROOT = Path("data/server-storage/export-sessions")
TERMUX_LIB_DIR = Path("/data/data/com.termux/files/usr/lib")
MAX_MP4_UPLOAD_BYTES = 1024 * 1024 * 1024
MAX_EXPORT_CHUNK_BYTES = 256 * 1024 * 1024
EXPORT_SESSION_TTL_SECONDS = 24 * 60 * 60
MIN_EXPORT_FREE_BYTES = 512 * 1024 * 1024
SLOW_STORAGE_LOG_SECONDS = 0.25
COMPACT_STORAGE_MARKER = "__chainsawStorage"
COMPACT_STORAGE_VERSION = "compact-v1"
COMPACT_STORAGE_ENCODING = "json-gzip-base64"
COMPACT_STORAGE_MIN_BYTES = 1024 * 1024
ASSET_REF_MARKER = "__chainsawAssetRef"


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

    def _log_slow_storage(self, label: str, started_at: float, detail: str = "") -> None:
        elapsed = time.perf_counter() - started_at
        if elapsed >= SLOW_STORAGE_LOG_SECONDS:
            suffix = f" {detail}" if detail else ""
            print(f"[storage-perf] {label} {elapsed:.3f}s{suffix}", flush=True)

    def _read_json_body(self, max_bytes: int = 1024 * 1024) -> dict:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0:
            return {}
        if length > max_bytes:
            raise ValueError("Request body is too large")
        raw = self.rfile.read(length)
        payload = json.loads(raw.decode("utf-8") or "{}")
        if not isinstance(payload, dict):
            raise ValueError("Expected a JSON object")
        return payload

    def _sanitize_export_session_id(self, session_id: str) -> str:
        safe = "".join(ch for ch in str(session_id or "") if ch.isalnum() or ch in "-_")
        if not safe:
            raise ValueError("Missing export session id")
        return safe[:96]

    def _session_dir(self, session_id: str) -> Path:
        return EXPORT_SESSION_ROOT / self._sanitize_export_session_id(session_id)

    def _session_manifest_path(self, session_id: str) -> Path:
        return self._session_dir(session_id) / "manifest.json"

    def _read_session_manifest(self, session_id: str) -> dict | None:
        path = self._session_manifest_path(session_id)
        if not path.exists():
            return None
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            return payload if isinstance(payload, dict) else None
        except Exception:
            return None

    def _write_session_manifest(self, session_id: str, manifest: dict) -> None:
        session_dir = self._session_dir(session_id)
        session_dir.mkdir(parents=True, exist_ok=True)
        manifest["updatedAt"] = int(time.time() * 1000)
        (session_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    def _frame_path(self, session_id: str, index: int) -> Path:
        return self._session_dir(session_id) / "frames" / f"frame-{index:06d}.png"

    def _segment_dir(self, session_id: str, segment_index: int) -> Path:
        return self._session_dir(session_id) / "segments" / f"segment-{segment_index:05d}"

    def _segment_frame_path(self, session_id: str, segment_index: int, frame_index: int) -> Path:
        return self._segment_dir(session_id, segment_index) / "frames" / f"frame-{frame_index:06d}.png"

    def _segment_path(self, session_id: str, segment_index: int) -> Path:
        return self._session_dir(session_id) / "segments" / f"segment-{segment_index:05d}.mp4"

    def _audio_path_from_manifest(self, session_id: str, manifest: dict | None = None) -> Path | None:
        session_dir = self._session_dir(session_id)
        audio_file = str((manifest or {}).get("audioFile") or "").strip()
        if audio_file:
            path = session_dir / Path(audio_file).name
            if path.exists() and path.stat().st_size > 0:
                return path
        for name in ("audio.wav", "audio.webm"):
            path = session_dir / name
            if path.exists() and path.stat().st_size > 0:
                return path
        return None

    def _audio_upload_path(self, session_id: str) -> tuple[Path, str]:
        content_type = (self.headers.get("Content-Type", "") or "").split(";", 1)[0].strip().lower()
        if content_type in ("audio/wav", "audio/wave", "audio/x-wav"):
            return self._session_dir(session_id) / "audio.wav", "audio/wav"
        return self._session_dir(session_id) / "audio.webm", content_type or "audio/webm"

    def _stream_request_body_to_file(self, path: Path, max_bytes: int = MAX_EXPORT_CHUNK_BYTES) -> int:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0:
            raise ValueError("Missing upload body")
        if length > max_bytes:
            raise ValueError("Upload chunk is too large")
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = path.with_suffix(path.suffix + ".part")
        remaining = length
        written = 0
        with tmp_path.open("wb") as handle:
            while remaining > 0:
                chunk = self.rfile.read(min(1024 * 1024, remaining))
                if not chunk:
                    break
                handle.write(chunk)
                written += len(chunk)
                remaining -= len(chunk)
        if remaining > 0:
            try:
                tmp_path.unlink()
            except FileNotFoundError:
                pass
            raise ValueError("Upload ended early")
        tmp_path.replace(path)
        return written

    def _cleanup_old_export_sessions(self) -> None:
        if not EXPORT_SESSION_ROOT.exists():
            return
        cutoff = time.time() - EXPORT_SESSION_TTL_SECONDS
        for child in EXPORT_SESSION_ROOT.iterdir():
            try:
                if child.is_dir() and child.stat().st_mtime < cutoff:
                    shutil.rmtree(child)
            except Exception:
                pass

    def _run_ffmpeg(self, command: list[str]) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            command,
            check=False,
            text=True,
            capture_output=True,
            env=build_ffmpeg_env(),
        )

    def _get_ffmpeg_status(self) -> dict:
        try:
            result = self._run_ffmpeg(["ffmpeg", "-hide_banner", "-version"])
            output = (result.stdout or result.stderr or "").strip()
            return {
                "ok": result.returncode == 0,
                "returncode": result.returncode,
                "message": output.splitlines()[0] if output else "",
            }
        except FileNotFoundError:
            return {"ok": False, "returncode": None, "message": "FFmpeg is not installed on this server"}
        except Exception as exc:
            return {"ok": False, "returncode": None, "message": str(exc)}

    def _get_export_disk_status(self) -> dict:
        disk = shutil.disk_usage(Path.cwd())
        return {
            "total": disk.total,
            "used": disk.used,
            "free": disk.free,
            "ok": disk.free >= MIN_EXPORT_FREE_BYTES,
            "minFree": MIN_EXPORT_FREE_BYTES,
        }

    def _sync_segment_manifest(self, session_id: str, manifest: dict) -> dict:
        session_dir = self._session_dir(session_id)
        segment_count = max(1, int(manifest.get("segmentCount") or 1))
        encoded = []
        for index in range(segment_count):
            if self._segment_path(session_id, index).exists():
                encoded.append(index)
            segment_dir = self._segment_dir(session_id, index)
            if segment_dir.exists() and index in encoded:
                shutil.rmtree(segment_dir, ignore_errors=True)
        manifest["segments"] = encoded
        manifest["audioReady"] = self._audio_path_from_manifest(session_id, manifest) is not None
        manifest["outputReady"] = bool((session_dir / "output.mp4").exists())
        return manifest

    def _empty_index(self) -> dict:
        return {"levels": {}, "art": {}, "music": {}, "actors": {}, "sfx": {}, "cutscenes": {}, "races": {}}

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
        doc_dir = document_path.parent
        try:
            data = self._read_stored_document(document_path, doc_dir)
        except Exception:
            return False
        file_json = json.dumps(metadata, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        data_json = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(b'{"ok":true,"file":')
        self.wfile.write(file_json[:-1])
        self.wfile.write(b',"data":')
        self.wfile.write(data_json)
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
        result = {
            "id": metadata.get("id") if isinstance(metadata.get("id"), str) else version_dir.name,
            "folder": folder,
            "name": name,
            "savedAt": saved_at,
            "reason": metadata.get("reason") if isinstance(metadata.get("reason"), str) else "",
            "size": size,
        }
        summary = self._summarize_project_document(folder, document_path)
        if summary:
            result["summary"] = summary
        return result

    def _summarize_project_document(self, folder: str, document_path: Path) -> dict | None:
        if folder != "music" or not document_path.exists():
            return None
        try:
            document = json.loads(document_path.read_text(encoding="utf-8"))
        except Exception:
            return None
        if not isinstance(document, dict):
            return None
        tracks = document.get("tracks")
        if not isinstance(tracks, list):
            return None
        time_signature = document.get("timeSignature") if isinstance(document.get("timeSignature"), dict) else {}
        ticks_per_beat = document.get("ticksPerBeat")
        if not isinstance(ticks_per_beat, (int, float)) or ticks_per_beat <= 0:
            ticks_per_beat = 64
        beats_per_bar = time_signature.get("beats") if isinstance(time_signature.get("beats"), (int, float)) else 4
        ticks_per_bar = max(1, int(ticks_per_beat * beats_per_bar))
        note_count = 0
        max_tick = 0
        last_by_track: dict[str, dict] = {}
        for track in tracks:
            if not isinstance(track, dict):
                continue
            track_name = track.get("name") if isinstance(track.get("name"), str) else track.get("id") or "Track"
            track_last = None
            patterns = track.get("patterns") if isinstance(track.get("patterns"), list) else []
            for pattern in patterns:
                notes = pattern.get("notes") if isinstance(pattern, dict) and isinstance(pattern.get("notes"), list) else []
                for note in notes:
                    if not isinstance(note, dict):
                        continue
                    start = note.get("startTick") if isinstance(note.get("startTick"), (int, float)) else 0
                    duration = note.get("durationTicks") if isinstance(note.get("durationTicks"), (int, float)) else 0
                    pitch = note.get("pitch") if isinstance(note.get("pitch"), (int, float)) else None
                    note_count += 1
                    max_tick = max(max_tick, int(start + duration))
                    if track_last is None or start >= track_last["startTick"]:
                        track_last = {"track": track_name, "startTick": int(start), "pitch": pitch}
            if track_last:
                last_by_track[str(track_name)] = track_last
        summary = {
            "title": document.get("name") if isinstance(document.get("name"), str) else "",
            "tempo": document.get("tempo") if isinstance(document.get("tempo"), (int, float)) else None,
            "tracks": len(tracks),
            "notes": note_count,
            "maxMeasure": round((max_tick / ticks_per_bar) + 1, 2),
        }
        for label in ("ContraBass", "Cello"):
            if label in last_by_track:
                summary[f"last{label}Pitch"] = last_by_track[label].get("pitch")
                summary[f"last{label}Measure"] = round((last_by_track[label].get("startTick", 0) / ticks_per_bar) + 1, 2)
        return summary

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
        try:
            data = self._read_stored_document(document_path, version_dir)
        except Exception:
            return False
        file_json = json.dumps({
            "version": 1,
            "folder": folder,
            "name": name,
            "savedAt": metadata.get("savedAt") or int(document_path.stat().st_mtime * 1000),
            "versionId": metadata.get("id") or version_id,
        }, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        data_json = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(b'{"ok":true,"file":')
        self.wfile.write(file_json[:-1])
        self.wfile.write(b',"data":')
        self.wfile.write(data_json)
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
                    saved_at = int(doc_dir.stat().st_mtime * 1000)
                index[folder][name] = {
                    "updatedAt": saved_at,
                    "size": (document_path.stat().st_size if document_path.exists() else 0)
                        + self._directory_size(doc_dir / "assets"),
                    "deleted": not document_path.exists(),
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

    def _update_manifest_entry(self, folder: str, name: str, deleted: bool = False) -> None:
        manifest_path = EXPORT_ROOT / "manifest.json"
        manifest: dict = {"folders": {}}
        if manifest_path.exists():
            try:
                loaded = json.loads(manifest_path.read_text(encoding="utf-8"))
                if isinstance(loaded, dict):
                    manifest = loaded
            except Exception:
                self._write_manifest()
                return
        folders = manifest.setdefault("folders", {})
        if not isinstance(folders, dict):
            self._write_manifest()
            return
        entries = folders.setdefault(folder, {})
        if not isinstance(entries, dict):
            folders[folder] = entries = {}
        if deleted:
            entries.pop(name, None)
        else:
            entries[name] = f"{folder}/{quote(name, safe='-_.() ')}/document.json"
        EXPORT_ROOT.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    def _write_exported_payload(self, folder: str, name: str, data: object, saved_at: int | None = None, version: int = 1, create_version: bool = True) -> dict:
        saved = int(saved_at or 0) or int(time.time() * 1000)
        doc_dir = self._safe_doc_dir(folder, name)
        doc_dir.mkdir(parents=True, exist_ok=True)
        if create_version:
            self._snapshot_exported_payload(folder, name, "before-save")
        assets_path = doc_dir / "assets"
        if assets_path.exists():
            shutil.rmtree(assets_path)
        stored_data = self._encode_stored_document(data, doc_dir)
        with (doc_dir / "document.json").open("w", encoding="utf-8") as handle:
            json.dump(stored_data, handle, ensure_ascii=False, indent=2)
        with (doc_dir / "metadata.json").open("w", encoding="utf-8") as handle:
            json.dump({"name": name, "folder": folder, "savedAt": saved, "version": version}, handle, ensure_ascii=False, indent=2)
        self._update_manifest_entry(folder, name)
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

    def _is_compact_document(self, value: object) -> bool:
        return isinstance(value, dict) and value.get(COMPACT_STORAGE_MARKER) == COMPACT_STORAGE_VERSION

    def _encode_stored_document(self, value: object, doc_dir: Path) -> object:
        externalized = self._externalize_data_urls(value, doc_dir)
        raw = json.dumps(externalized, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        if len(raw) < COMPACT_STORAGE_MIN_BYTES:
            return externalized
        compressed = gzip.compress(raw, compresslevel=9)
        return {
            COMPACT_STORAGE_MARKER: COMPACT_STORAGE_VERSION,
            "encoding": COMPACT_STORAGE_ENCODING,
            "data": base64.b64encode(compressed).decode("ascii"),
        }

    def _decode_stored_document(self, value: object) -> object:
        if not self._is_compact_document(value):
            return value
        if value.get("encoding") != COMPACT_STORAGE_ENCODING or not isinstance(value.get("data"), str):
            raise ValueError("Unsupported compact document encoding")
        compressed = base64.b64decode(value["data"])
        return json.loads(gzip.decompress(compressed).decode("utf-8"))

    def _read_stored_document(self, document_path: Path, doc_dir: Path) -> object:
        data = json.loads(document_path.read_text(encoding="utf-8"))
        decoded = self._decode_stored_document(data)
        return self._hydrate_asset_refs(decoded, doc_dir)

    def _externalize_data_urls(self, value: object, doc_dir: Path, counter: list[int] | None = None) -> object:
        if counter is None:
            counter = [0]
        if isinstance(value, dict):
            return {key: self._externalize_data_urls(inner, doc_dir, counter) for key, inner in value.items()}
        if isinstance(value, list):
            return [self._externalize_data_urls(inner, doc_dir, counter) for inner in value]
        if not isinstance(value, str):
            return value
        if value.startswith("data:image/png;base64,") or value.startswith("data:audio/wav;base64,"):
            mime = "image/png" if value.startswith("data:image/png;base64,") else "audio/wav"
            b64 = value.split(",", 1)[1]
            try:
                data = base64.b64decode(b64)
            except Exception:
                return value
            path = doc_dir / "assets"
            path.mkdir(parents=True, exist_ok=True)
            counter[0] += 1
            suffix = "png" if mime == "image/png" else "wav"
            prefix = "image" if suffix == "png" else "audio"
            filename = f"{prefix}-{counter[0]}.{suffix}"
            (path / filename).write_bytes(data)
            return {
                ASSET_REF_MARKER: f"assets/{filename}",
                "mime": mime,
            }
        return value

    def _hydrate_asset_refs(self, value: object, doc_dir: Path) -> object:
        if isinstance(value, dict):
            ref = value.get(ASSET_REF_MARKER)
            mime = value.get("mime")
            if isinstance(ref, str) and isinstance(mime, str):
                asset_path = doc_dir / ref
                try:
                    data = asset_path.read_bytes()
                    return f"data:{mime};base64,{base64.b64encode(data).decode('ascii')}"
                except Exception:
                    return ""
            return {key: self._hydrate_asset_refs(inner, doc_dir) for key, inner in value.items()}
        if isinstance(value, list):
            return [self._hydrate_asset_refs(inner, doc_dir) for inner in value]
        return value

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/__storage/index":
            started_at = time.perf_counter()
            query = parse_qs(parsed.query)
            folder = (query.get("folder") or [None])[0]
            index = self._list_exported_files(folder)
            self._write_json(HTTPStatus.OK, {"ok": True, "index": index})
            self._log_slow_storage("GET /__storage/index", started_at, f"folder={folder or '*'}")
            return
        if parsed.path == "/__storage/file":
            started_at = time.perf_counter()
            query = parse_qs(parsed.query)
            folder = (query.get("folder") or [""])[0]
            name = (query.get("name") or [""])[0]
            if not self._stream_exported_payload(folder, name):
                self._write_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "File not found"})
            self._log_slow_storage("GET /__storage/file", started_at, f"folder={folder} name={name}")
            return
        if parsed.path == "/__storage/versions":
            started_at = time.perf_counter()
            query = parse_qs(parsed.query)
            folder = (query.get("folder") or [""])[0]
            name = (query.get("name") or [""])[0]
            versions = self._list_exported_versions(folder, name)
            self._write_json(HTTPStatus.OK, {"ok": True, "versions": versions})
            self._log_slow_storage("GET /__storage/versions", started_at, f"folder={folder} name={name} count={len(versions)}")
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
                    "exportSessionBytes": self._directory_size(EXPORT_SESSION_ROOT),
                    "ffmpeg": self._get_ffmpeg_status(),
                },
            )
            return
        if parsed.path.startswith("/__export/session/") and parsed.path.endswith("/result"):
            parts = [unquote(part) for part in parsed.path.strip("/").split("/")]
            if len(parts) == 4:
                self._handle_export_session_result(parts[2])
                return
        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/__export/session":
            self._handle_create_export_session()
            return
        if parsed.path.startswith("/__export/session/") and "/segment/" in parsed.path and parsed.path.endswith("/encode"):
            parts = [unquote(part) for part in parsed.path.strip("/").split("/")]
            if len(parts) == 6 and parts[:2] == ["__export", "session"] and parts[3] == "segment" and parts[5] == "encode":
                self._handle_encode_export_session_segment(parts[2], int(parts[4]))
                return
        if parsed.path.startswith("/__export/session/") and parsed.path.endswith("/finalize"):
            parts = [unquote(part) for part in parsed.path.strip("/").split("/")]
            if len(parts) == 4:
                self._handle_finalize_export_session(parts[2])
                return
        if parsed.path.startswith("/__export/session/") and parsed.path.endswith("/encode"):
            parts = [unquote(part) for part in parsed.path.strip("/").split("/")]
            if len(parts) == 4:
                self._handle_encode_export_session(parts[2])
                return
        if parsed.path == "/__export/mp4-frames":
            self._handle_frame_mp4_export()
            return
        if parsed.path == "/__export/mp4-recording":
            self._handle_recording_mp4_export()
            return
        if parsed.path == "/__export/mp4":
            query = parse_qs(parsed.query)
            try:
                output_width = max(1, min(4096, int((query.get("outputWidth") or [0])[0] or 0)))
                output_height = max(1, min(4096, int((query.get("outputHeight") or [0])[0] or 0)))
            except (TypeError, ValueError):
                output_width = 0
                output_height = 0
            length = int(self.headers.get("Content-Length", "0") or "0")
            if length <= 0:
                self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Missing movie data"})
                return
            if length > MAX_MP4_UPLOAD_BYTES:
                self._write_json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"ok": False, "error": "Movie data is too large"})
                return
            try:
                with tempfile.TemporaryDirectory(prefix="chainsaw-mp4-") as tmp:
                    input_path = Path(tmp) / "input.webm"
                    output_path = Path(tmp) / "output.mp4"
                    remaining = length
                    with input_path.open("wb") as handle:
                        while remaining > 0:
                            chunk = self.rfile.read(min(1024 * 1024, remaining))
                            if not chunk:
                                break
                            handle.write(chunk)
                            remaining -= len(chunk)
                    if remaining > 0:
                        self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Movie upload ended early"})
                        return
                    command = [
                        "ffmpeg",
                        "-y",
                        "-hide_banner",
                        "-loglevel",
                        "error",
                        "-i",
                        str(input_path),
                    ]
                    if output_width and output_height:
                        command.extend([
                            "-vf",
                            (
                                f"scale={output_width}:{output_height}:"
                                "force_original_aspect_ratio=decrease:flags=neighbor,"
                                f"pad={output_width}:{output_height}:"
                                "(ow-iw)/2:(oh-ih)/2:black,setsar=1"
                            ),
                        ])
                    command.extend([
                        "-c:v",
                        "libx264",
                        "-pix_fmt",
                        "yuv420p",
                        "-preset",
                        "veryfast",
                        "-crf",
                        "16",
                        "-tune",
                        "animation",
                        "-movflags",
                        "+faststart",
                        "-c:a",
                        "aac",
                        "-b:a",
                        "192k",
                        str(output_path),
                    ])
                    result = subprocess.run(
                        command,
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
                    self.send_response(HTTPStatus.OK)
                    self.send_header("Content-Type", "video/mp4")
                    self.send_header("Content-Length", str(output_path.stat().st_size))
                    self.end_headers()
                    with output_path.open("rb") as handle:
                        shutil.copyfileobj(handle, self.wfile, length=1024 * 1024)
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
            started_at = time.perf_counter()
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
            create_version = payload.get("createVersion") is not False
            try:
                saved = self._write_exported_payload(
                    folder,
                    name,
                    payload.get("data"),
                    payload.get("savedAt"),
                    int(payload.get("version") or 1),
                    create_version,
                )
            except Exception as exc:  # pragma: no cover - defensive
                self._write_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"ok": False, "error": str(exc)})
                self._log_slow_storage("POST /__storage/file failed", started_at, f"folder={folder} name={name} createVersion={create_version} bytes={length}")
                return
            self._write_json(HTTPStatus.OK, {"ok": True, "file": saved})
            self._log_slow_storage("POST /__storage/file", started_at, f"folder={folder} name={name} createVersion={create_version} bytes={length}")
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

    def do_PUT(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        parts = [unquote(part) for part in parsed.path.strip("/").split("/")]
        if len(parts) == 7 and parts[:2] == ["__export", "session"] and parts[3] == "segment" and parts[5] == "frame":
            try:
                self._handle_export_session_segment_frame_upload(parts[2], int(parts[4]), int(parts[6]))
            except ValueError as exc:
                self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": str(exc)})
            return
        if len(parts) == 5 and parts[:2] == ["__export", "session"] and parts[3] == "frame":
            try:
                self._handle_export_session_frame_upload(parts[2], int(parts[4]))
            except ValueError as exc:
                self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": str(exc)})
            return
        if len(parts) == 4 and parts[:2] == ["__export", "session"] and parts[3] == "audio":
            self._handle_export_session_audio_upload(parts[2])
            return
        self.send_error(HTTPStatus.NOT_FOUND, "Not Found")

    def _handle_create_export_session(self) -> None:
        try:
            self._cleanup_old_export_sessions()
            payload = self._read_json_body()
            content_key = str(payload.get("contentKey") or json.dumps(payload, sort_keys=True))
            session_id = payload.get("sessionId") or ("mp4-" + hashlib.sha256(content_key.encode("utf-8")).hexdigest()[:24])
            session_id = self._sanitize_export_session_id(session_id)
            frame_count = max(1, min(20000, int(payload.get("frameCount") or 1)))
            fps = max(1, min(60, int(payload.get("fps") or 30)))
            source_width = max(1, min(4096, int(payload.get("sourceWidth") or payload.get("frameWidth") or payload.get("outputWidth") or 1920)))
            source_height = max(1, min(4096, int(payload.get("sourceHeight") or payload.get("frameHeight") or payload.get("outputHeight") or 1080)))
            output_width = max(1, min(4096, int(payload.get("outputWidth") or 1920)))
            output_height = max(1, min(4096, int(payload.get("outputHeight") or 1080)))
            segment_ms = max(250, min(10000, int(payload.get("segmentMs") or 1500)))
            segment_count = max(1, min(20000, int(payload.get("segmentCount") or 1)))
            ffmpeg = self._get_ffmpeg_status()
            if not ffmpeg.get("ok"):
                self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": f"FFmpeg is not usable: {ffmpeg.get('message') or 'unknown error'}", "ffmpeg": ffmpeg})
                return
            disk = self._get_export_disk_status()
            if not disk.get("ok"):
                self._write_json(HTTPStatus.INSUFFICIENT_STORAGE, {"ok": False, "error": f"Not enough free disk for MP4 export. Free {disk['free']} bytes; need at least {disk['minFree']} bytes.", "disk": disk})
                return
            session_dir = self._session_dir(session_id)
            session_dir.mkdir(parents=True, exist_ok=True)
            previous = self._read_session_manifest(session_id)
            if previous and previous.get("contentKey") != content_key:
                shutil.rmtree(session_dir, ignore_errors=True)
                session_dir.mkdir(parents=True, exist_ok=True)
                previous = None
            manifest = previous or {
                "id": session_id,
                "contentKey": content_key,
                "name": str(payload.get("name") or "cutscene"),
                "durationMs": int(payload.get("durationMs") or 0),
                "fps": fps,
                "sourceWidth": source_width,
                "sourceHeight": source_height,
                "outputWidth": output_width,
                "outputHeight": output_height,
                "frameCount": frame_count,
                "segmentMs": segment_ms,
                "segmentCount": segment_count,
                "segments": [],
                "audioReady": False,
                "createdAt": int(time.time() * 1000),
            }
            manifest.update({
                "fps": fps,
                "sourceWidth": source_width,
                "sourceHeight": source_height,
                "outputWidth": output_width,
                "outputHeight": output_height,
                "frameCount": frame_count,
                "segmentMs": segment_ms,
                "segmentCount": segment_count,
            })
            manifest.setdefault("frames", [])
            manifest = self._sync_segment_manifest(session_id, manifest)
            manifest["disk"] = disk
            manifest["ffmpeg"] = ffmpeg
            self._write_session_manifest(session_id, manifest)
            self._write_json(HTTPStatus.OK, {"ok": True, "session": manifest})
        except Exception as exc:
            self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": str(exc)})

    def _handle_export_session_segment_frame_upload(self, session_id: str, segment_index: int, frame_index: int) -> None:
        manifest = self._read_session_manifest(session_id)
        if not manifest:
            self._write_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "Export session not found"})
            return
        segment_count = int(manifest.get("segmentCount") or 0)
        if segment_index < 0 or segment_index >= segment_count:
            self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Segment index out of range"})
            return
        if frame_index < 0 or frame_index > 1000:
            self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Segment frame index out of range"})
            return
        try:
            written = self._stream_request_body_to_file(self._segment_frame_path(session_id, segment_index, frame_index), MAX_EXPORT_CHUNK_BYTES)
            self._write_json(HTTPStatus.OK, {"ok": True, "segment": segment_index, "frame": frame_index, "bytes": written})
        except Exception as exc:
            self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": str(exc)})

    def _handle_encode_export_session_segment(self, session_id: str, segment_index: int) -> None:
        manifest = self._read_session_manifest(session_id)
        if not manifest:
            self._write_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "Export session not found"})
            return
        segment_count = int(manifest.get("segmentCount") or 0)
        if segment_index < 0 or segment_index >= segment_count:
            self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Segment index out of range"})
            return
        output_path = self._segment_path(session_id, segment_index)
        if output_path.exists() and output_path.stat().st_size > 0:
            shutil.rmtree(self._segment_dir(session_id, segment_index), ignore_errors=True)
            manifest = self._sync_segment_manifest(session_id, manifest)
            self._write_session_manifest(session_id, manifest)
            self._write_json(HTTPStatus.OK, {"ok": True, "segment": segment_index, "cached": True, "bytes": output_path.stat().st_size})
            return
        segment_dir = self._segment_dir(session_id, segment_index)
        frames_dir = segment_dir / "frames"
        frame_files = sorted(frames_dir.glob("frame-*.png")) if frames_dir.exists() else []
        if not frame_files:
            self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "No segment frames uploaded"})
            return
        missing = []
        for index in range(len(frame_files)):
            if not (frames_dir / f"frame-{index:06d}.png").exists():
                missing.append(index)
        if missing:
            self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": f"Missing {len(missing)} segment frames", "missing": missing[:20]})
            return
        disk = self._get_export_disk_status()
        if not disk.get("ok"):
            self._write_json(HTTPStatus.INSUFFICIENT_STORAGE, {"ok": False, "error": f"Not enough free disk to encode segment. Free {disk['free']} bytes.", "disk": disk})
            return
        output_path.parent.mkdir(parents=True, exist_ok=True)
        tmp_output = output_path.with_name(output_path.stem + ".part.mp4")
        command = [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-framerate",
            str(max(1, min(60, int(manifest.get("fps") or 30)))),
            "-i",
            str(frames_dir / "frame-%06d.png"),
            "-vf",
            (
                f"scale={max(1, min(4096, int(manifest.get('outputWidth') or 1920)))}:"
                f"{max(1, min(4096, int(manifest.get('outputHeight') or 1080)))}:"
                "force_original_aspect_ratio=decrease:flags=neighbor,"
                f"pad={max(1, min(4096, int(manifest.get('outputWidth') or 1920)))}:"
                f"{max(1, min(4096, int(manifest.get('outputHeight') or 1080)))}:"
                "(ow-iw)/2:(oh-ih)/2:black,setsar=1"
            ),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-preset",
            "veryfast",
            "-threads",
            "2",
            "-an",
            "-movflags",
            "+faststart",
            str(tmp_output),
        ]
        try:
            result = self._run_ffmpeg(command)
            if result.returncode != 0 or not tmp_output.exists():
                self._write_json(
                    HTTPStatus.BAD_REQUEST,
                    {"ok": False, "error": f"FFmpeg segment encode failed: {result.stderr or result.stdout}"},
                )
                return
            tmp_output.replace(output_path)
            shutil.rmtree(segment_dir, ignore_errors=True)
            manifest = self._sync_segment_manifest(session_id, manifest)
            manifest["outputReady"] = False
            self._write_session_manifest(session_id, manifest)
            self._write_json(HTTPStatus.OK, {"ok": True, "segment": segment_index, "bytes": output_path.stat().st_size, "encoded": len(manifest.get("segments", [])), "segmentCount": segment_count})
        except FileNotFoundError:
            self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "FFmpeg is not installed on this server"})
        except Exception as exc:
            self._write_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"ok": False, "error": str(exc)})

    def _handle_finalize_export_session(self, session_id: str) -> None:
        manifest = self._read_session_manifest(session_id)
        if not manifest:
            self._write_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "Export session not found"})
            return
        session_dir = self._session_dir(session_id)
        output_path = session_dir / "output.mp4"
        if output_path.exists() and output_path.stat().st_size > 0:
            manifest["outputReady"] = True
            manifest["outputBytes"] = output_path.stat().st_size
            self._write_session_manifest(session_id, manifest)
            self._write_json(HTTPStatus.OK, {"ok": True, "resultUrl": f"/__export/session/{session_id}/result", "bytes": manifest["outputBytes"]})
            return
        segment_count = int(manifest.get("segmentCount") or 0)
        missing = [index for index in range(segment_count) if not self._segment_path(session_id, index).exists()]
        if missing:
            self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": f"Missing {len(missing)} encoded segments", "missing": missing[:20]})
            return
        concat_path = session_dir / "segments.txt"
        with concat_path.open("w", encoding="utf-8") as handle:
            for index in range(segment_count):
                segment_path = self._segment_path(session_id, index).resolve()
                handle.write(f"file '{str(segment_path).replace(chr(39), chr(39) + chr(92) + chr(39) + chr(39))}'\n")
        audio_path = self._audio_path_from_manifest(session_id, manifest)
        fps = max(1, min(60, int(manifest.get("fps") or 30)))
        tmp_output = output_path.with_name(output_path.stem + ".part.mp4")
        command = [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-fflags",
            "+genpts",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_path),
        ]
        has_audio = audio_path is not None
        if has_audio:
            command.extend(["-i", str(audio_path)])
        command.extend([
            "-map",
            "0:v:0",
        ])
        if has_audio:
            command.extend(["-map", "1:a:0"])
        command.extend([
            "-vf",
            f"fps={fps},setsar=1",
            "-r",
            str(fps),
            "-fps_mode",
            "cfr",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-preset",
            "veryfast",
            "-threads",
            "2",
        ])
        if has_audio:
            command.extend(["-c:a", "aac", "-b:a", "192k", "-shortest"])
        else:
            command.extend(["-an"])
        command.extend(["-movflags", "+faststart", str(tmp_output)])
        try:
            result = self._run_ffmpeg(command)
            if result.returncode != 0 or not tmp_output.exists():
                self._write_json(
                    HTTPStatus.BAD_REQUEST,
                    {"ok": False, "error": f"FFmpeg finalize failed: {result.stderr or result.stdout}"},
                )
                return
            tmp_output.replace(output_path)
            manifest = self._sync_segment_manifest(session_id, manifest)
            manifest["outputReady"] = True
            manifest["outputBytes"] = output_path.stat().st_size
            self._write_session_manifest(session_id, manifest)
            self._write_json(HTTPStatus.OK, {"ok": True, "resultUrl": f"/__export/session/{session_id}/result", "bytes": manifest["outputBytes"]})
        except FileNotFoundError:
            self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "FFmpeg is not installed on this server"})
        except Exception as exc:
            self._write_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"ok": False, "error": str(exc)})

    def _handle_export_session_frame_upload(self, session_id: str, index: int) -> None:
        manifest = self._read_session_manifest(session_id)
        if not manifest:
            self._write_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "Export session not found"})
            return
        frame_count = int(manifest.get("frameCount") or 0)
        if index < 0 or index >= frame_count:
            self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Frame index out of range"})
            return
        try:
            written = self._stream_request_body_to_file(self._frame_path(session_id, index), MAX_EXPORT_CHUNK_BYTES)
            frames = set(int(value) for value in manifest.get("frames", []) if isinstance(value, int))
            frames.add(index)
            manifest["frames"] = sorted(frames)
            manifest["outputReady"] = False
            self._write_session_manifest(session_id, manifest)
            self._write_json(HTTPStatus.OK, {"ok": True, "index": index, "bytes": written, "uploaded": len(frames), "frameCount": frame_count})
        except Exception as exc:
            self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": str(exc)})

    def _handle_export_session_audio_upload(self, session_id: str) -> None:
        manifest = self._read_session_manifest(session_id)
        if not manifest:
            self._write_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "Export session not found"})
            return
        try:
            audio_path, audio_type = self._audio_upload_path(session_id)
            for stale_name in ("audio.webm", "audio.wav"):
                stale_path = self._session_dir(session_id) / stale_name
                if stale_path != audio_path and stale_path.exists():
                    stale_path.unlink()
            written = self._stream_request_body_to_file(audio_path, MAX_EXPORT_CHUNK_BYTES)
            manifest["audioReady"] = written > 0
            manifest["audioFile"] = audio_path.name if written > 0 else None
            manifest["audioType"] = audio_type if written > 0 else None
            manifest["outputReady"] = False
            self._write_session_manifest(session_id, manifest)
            self._write_json(HTTPStatus.OK, {"ok": True, "bytes": written, "audioFile": manifest["audioFile"], "audioType": manifest["audioType"]})
        except Exception as exc:
            self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": str(exc)})

    def _handle_encode_export_session(self, session_id: str) -> None:
        manifest = self._read_session_manifest(session_id)
        if not manifest:
            self._write_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "Export session not found"})
            return
        session_dir = self._session_dir(session_id)
        output_path = session_dir / "output.mp4"
        frame_count = int(manifest.get("frameCount") or 0)
        missing = [index for index in range(frame_count) if not self._frame_path(session_id, index).exists()]
        if missing:
            self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": f"Missing {len(missing)} frames", "missing": missing[:20]})
            return
        if output_path.exists():
            manifest["outputReady"] = True
            self._write_session_manifest(session_id, manifest)
            self._write_json(HTTPStatus.OK, {"ok": True, "resultUrl": f"/__export/session/{session_id}/result"})
            return
        frames_dir = session_dir / "frames"
        audio_path = self._audio_path_from_manifest(session_id, manifest)
        command = [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-framerate",
            str(max(1, min(60, int(manifest.get("fps") or 30)))),
            "-i",
            str(frames_dir / "frame-%06d.png"),
        ]
        if audio_path is not None:
            command.extend(["-i", str(audio_path)])
        command.extend([
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-preset",
            "veryfast",
            "-threads",
            "2",
        ])
        if audio_path is not None:
            command.extend(["-c:a", "aac", "-b:a", "192k", "-shortest"])
        command.extend(["-movflags", "+faststart", str(output_path)])
        try:
            result = subprocess.run(
                command,
                check=False,
                text=True,
                capture_output=True,
                env=build_ffmpeg_env(),
            )
            if result.returncode != 0 or not output_path.exists():
                self._write_json(
                    HTTPStatus.BAD_REQUEST,
                    {"ok": False, "error": f"FFmpeg session MP4 encode failed: {result.stderr or result.stdout}"},
                )
                return
            manifest["outputReady"] = True
            manifest["outputBytes"] = output_path.stat().st_size
            self._write_session_manifest(session_id, manifest)
            self._write_json(HTTPStatus.OK, {"ok": True, "resultUrl": f"/__export/session/{session_id}/result", "bytes": manifest["outputBytes"]})
        except FileNotFoundError:
            self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "FFmpeg is not installed on this server"})
        except Exception as exc:
            self._write_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"ok": False, "error": str(exc)})

    def _handle_export_session_result(self, session_id: str) -> None:
        output_path = self._session_dir(session_id) / "output.mp4"
        if not output_path.exists():
            self._write_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "Export result not found"})
            return
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "video/mp4")
        self.send_header("Content-Length", str(output_path.stat().st_size))
        self.end_headers()
        with output_path.open("rb") as handle:
            shutil.copyfileobj(handle, self.wfile, length=1024 * 1024)

    def _handle_frame_mp4_export(self) -> None:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0:
            self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Missing movie data"})
            return
        if length > MAX_MP4_UPLOAD_BYTES:
            self._write_json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"ok": False, "error": "Movie data is too large"})
            return
        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Expected multipart movie data"})
            return
        try:
            with tempfile.TemporaryDirectory(prefix="chainsaw-frames-") as tmp:
                tmp_path = Path(tmp)
                form = self._read_multipart_form(content_type, length)
                fps = max(1, min(60, int(float((form.get("fps") or [b"30"])[0].decode("utf-8", "ignore") or 30))))
                frame_fields = form.get("frame") or []
                if not frame_fields:
                    self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "No movie frames uploaded"})
                    return
                frames_dir = tmp_path / "frames"
                frames_dir.mkdir()
                for index, frame_bytes in enumerate(frame_fields):
                    frame_path = frames_dir / f"frame-{index:06d}.png"
                    with frame_path.open("wb") as handle:
                        handle.write(frame_bytes)
                audio_path = None
                if form.get("audio"):
                    audio_path = tmp_path / "audio.webm"
                    with audio_path.open("wb") as handle:
                        handle.write(form["audio"][0])
                output_path = tmp_path / "output.mp4"
                command = [
                    "ffmpeg",
                    "-y",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-framerate",
                    str(fps),
                    "-i",
                    str(frames_dir / "frame-%06d.png"),
                ]
                if audio_path and audio_path.stat().st_size > 0:
                    command.extend(["-i", str(audio_path)])
                command.extend([
                    "-c:v",
                    "libx264",
                    "-pix_fmt",
                    "yuv420p",
                    "-preset",
                    "veryfast",
                ])
                if audio_path and audio_path.stat().st_size > 0:
                    command.extend(["-c:a", "aac", "-b:a", "192k", "-shortest"])
                command.extend(["-movflags", "+faststart", str(output_path)])
                result = subprocess.run(
                    command,
                    check=False,
                    text=True,
                    capture_output=True,
                    env=build_ffmpeg_env(),
                )
                if result.returncode != 0 or not output_path.exists():
                    self._write_json(
                        HTTPStatus.BAD_REQUEST,
                        {"ok": False, "error": f"FFmpeg frame MP4 encode failed: {result.stderr or result.stdout}"},
                    )
                    return
                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Type", "video/mp4")
                self.send_header("Content-Length", str(output_path.stat().st_size))
                self.end_headers()
                with output_path.open("rb") as handle:
                    shutil.copyfileobj(handle, self.wfile, length=1024 * 1024)
        except FileNotFoundError:
            self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "FFmpeg is not installed on this server"})
        except Exception as exc:  # pragma: no cover - defensive
            self._write_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"ok": False, "error": str(exc)})

    def _handle_recording_mp4_export(self) -> None:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0:
            self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Missing movie data"})
            return
        if length > MAX_MP4_UPLOAD_BYTES:
            self._write_json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"ok": False, "error": "Movie data is too large"})
            return
        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Expected multipart movie data"})
            return
        try:
            with tempfile.TemporaryDirectory(prefix="chainsaw-recording-") as tmp:
                tmp_path = Path(tmp)
                form = self._read_multipart_form(content_type, length)
                video_parts = form.get("video") or []
                if not video_parts:
                    self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "No movie video uploaded"})
                    return
                video_path = tmp_path / "video.webm"
                video_path.write_bytes(video_parts[0])
                audio_path = None
                if form.get("audio"):
                    audio_path = tmp_path / "audio.webm"
                    audio_path.write_bytes(form["audio"][0])
                output_path = tmp_path / "output.mp4"
                command = [
                    "ffmpeg",
                    "-y",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-fflags",
                    "+genpts",
                    "-i",
                    str(video_path),
                ]
                has_audio = audio_path is not None and audio_path.stat().st_size > 0
                if has_audio:
                    command.extend(["-fflags", "+genpts", "-i", str(audio_path)])
                command.extend([
                    "-map",
                    "0:v:0",
                ])
                if has_audio:
                    command.extend(["-map", "1:a:0"])
                command.extend([
                    "-vf",
                    "setsar=1",
                    "-c:v",
                    "libx264",
                    "-pix_fmt",
                    "yuv420p",
                    "-preset",
                    "veryfast",
                    "-crf",
                    "16",
                    "-tune",
                    "animation",
                    "-avoid_negative_ts",
                    "make_zero",
                ])
                if has_audio:
                    command.extend(["-c:a", "aac", "-b:a", "192k", "-shortest"])
                else:
                    command.extend(["-an"])
                command.extend(["-movflags", "+faststart", str(output_path)])
                result = self._run_ffmpeg(command)
                if result.returncode != 0 or not output_path.exists():
                    self._write_json(
                        HTTPStatus.BAD_REQUEST,
                        {"ok": False, "error": f"FFmpeg recording MP4 encode failed: {result.stderr or result.stdout}"},
                    )
                    return
                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Type", "video/mp4")
                self.send_header("Content-Length", str(output_path.stat().st_size))
                self.end_headers()
                with output_path.open("rb") as handle:
                    shutil.copyfileobj(handle, self.wfile, length=1024 * 1024)
        except FileNotFoundError:
            self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "FFmpeg is not installed on this server"})
        except Exception as exc:  # pragma: no cover - defensive
            self._write_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"ok": False, "error": str(exc)})

    def _read_multipart_form(self, content_type: str, length: int) -> dict[str, list[bytes]]:
        marker = "boundary="
        if marker not in content_type:
            raise ValueError("Missing multipart boundary")
        boundary = content_type.split(marker, 1)[1].split(";", 1)[0].strip().strip('"')
        if not boundary:
            raise ValueError("Missing multipart boundary")
        body = self.rfile.read(length)
        delimiter = ("--" + boundary).encode("utf-8")
        result: dict[str, list[bytes]] = {}
        for raw_part in body.split(delimiter):
            part = raw_part.strip(b"\r\n")
            if not part or part == b"--":
                continue
            if part.endswith(b"--"):
                part = part[:-2].rstrip(b"\r\n")
            if b"\r\n\r\n" not in part:
                continue
            header_blob, data = part.split(b"\r\n\r\n", 1)
            name = ""
            for header_line in header_blob.decode("utf-8", "ignore").split("\r\n"):
                lower = header_line.lower()
                if not lower.startswith("content-disposition:"):
                    continue
                for token in header_line.split(";"):
                    token = token.strip()
                    if token.startswith("name="):
                        name = token.split("=", 1)[1].strip().strip('"')
                        break
            if name:
                result.setdefault(name, []).append(data)
        return result

    def do_DELETE(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        parts = [unquote(part) for part in parsed.path.strip("/").split("/")]
        if len(parts) == 3 and parts[:2] == ["__export", "session"]:
            try:
                shutil.rmtree(self._session_dir(parts[2]), ignore_errors=True)
                self._write_json(HTTPStatus.OK, {"ok": True})
            except Exception as exc:
                self._write_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"ok": False, "error": str(exc)})
            return
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
