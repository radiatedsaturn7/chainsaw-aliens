#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from urllib.parse import quote


def count_png_data_urls(value: object) -> int:
    if isinstance(value, dict):
        return sum(count_png_data_urls(v) for v in value.values())
    if isinstance(value, list):
        return sum(count_png_data_urls(v) for v in value)
    if isinstance(value, str) and value.startswith("data:image/png;base64,"):
        return 1
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify VFS snapshot-to-files migration output")
    parser.add_argument("--snapshot", default="data/server-storage/vfs-snapshot.json")
    parser.add_argument("--export-root", default="data/server-storage/vfs")
    args = parser.parse_args()

    snapshot_path = Path(args.snapshot)
    export_root = Path(args.export_root)
    manifest_path = export_root / "manifest.json"

    if not snapshot_path.exists():
        print(f"ERROR: snapshot not found: {snapshot_path}")
        return 2
    if not export_root.exists():
        print(f"ERROR: export root not found: {export_root}")
        return 2

    snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
    index = snapshot.get("index", {}) if isinstance(snapshot, dict) else {}
    files = snapshot.get("files", {}) if isinstance(snapshot, dict) else {}

    if not isinstance(index, dict) or not isinstance(files, dict):
        print("ERROR: invalid snapshot shape (need index/files objects)")
        return 2

    manifest = {}
    if manifest_path.exists():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except Exception as exc:
            print(f"ERROR: failed to read manifest: {exc}")
            return 2

    problems: list[str] = []
    checked = 0
    expected_png = 0
    found_png = 0

    for folder, entries in index.items():
        if not isinstance(folder, str) or not isinstance(entries, dict):
            continue
        for name in entries.keys():
            if not isinstance(name, str):
                continue
            checked += 1
            storage_key = f"robter:vfs:{folder}:{name}"
            raw = files.get(storage_key)
            if not isinstance(raw, str):
                problems.append(f"missing snapshot file payload: {storage_key}")
                continue
            try:
                payload = json.loads(raw)
            except Exception:
                problems.append(f"invalid JSON payload in snapshot: {storage_key}")
                continue

            data = payload.get("data", payload)
            safe = quote(name, safe="-_.() ")
            doc_dir = export_root / folder / safe
            doc_json = doc_dir / "document.json"
            meta_json = doc_dir / "metadata.json"

            if not doc_json.exists():
                problems.append(f"missing document.json: {doc_json}")
            if not meta_json.exists():
                problems.append(f"missing metadata.json: {meta_json}")

            if doc_json.exists():
                try:
                    exported = json.loads(doc_json.read_text(encoding="utf-8"))
                    if exported != data:
                        problems.append(f"document mismatch: {doc_json}")
                except Exception as exc:
                    problems.append(f"failed to parse {doc_json}: {exc}")

            if meta_json.exists():
                try:
                    meta = json.loads(meta_json.read_text(encoding="utf-8"))
                    if meta.get("name") != name or meta.get("folder") != folder:
                        problems.append(f"metadata mismatch (name/folder): {meta_json}")
                except Exception as exc:
                    problems.append(f"failed to parse {meta_json}: {exc}")

            png_count = count_png_data_urls(data)
            expected_png += png_count
            assets_dir = doc_dir / "assets"
            exported_png = len(list(assets_dir.glob("image-*.png"))) if assets_dir.exists() else 0
            found_png += exported_png
            if exported_png < png_count:
                problems.append(
                    f"missing extracted png assets for {folder}/{name}: expected>={png_count}, found={exported_png}"
                )

            manifest_doc = (((manifest.get("folders") or {}).get(folder) or {}).get(name)) if isinstance(manifest, dict) else None
            expected_manifest = f"{folder}/{safe}/document.json"
            if manifest_doc is not None and manifest_doc != expected_manifest:
                problems.append(f"manifest mismatch for {folder}/{name}: {manifest_doc} != {expected_manifest}")

    print(f"Checked documents: {checked}")
    print(f"PNG data URLs in snapshot docs: {expected_png}")
    print(f"PNG files exported: {found_png}")

    if problems:
        print("\nVerification FAILED:\n")
        for p in problems:
            print(f"- {p}")
        return 1

    print("\nVerification PASSED: migration output matches snapshot.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
