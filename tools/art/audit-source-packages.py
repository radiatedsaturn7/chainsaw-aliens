#!/usr/bin/env python3
"""Audit generation-only car packages without writing production data.

Usage: python tools/art/audit-source-packages.py [car-id ...]
No IDs audits every completed package. Reports JSON to stdout.
"""
import base64
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
BASE = "40ed6400fd2de4e309b7b8216e2350922ecfa63b"
catalog = ROOT / "assets/car-catalog"
paths = ([catalog / ident / "package-status.json" for ident in sys.argv[1:]]
         if sys.argv[1:] else sorted(catalog.glob("*/package-status.json")))
seen = {}
declared_sources = {}
for marker in catalog.glob("*/package-status.json"):
    saved = json.loads(marker.read_text())
    for role in ("body", "dashboard"):
        digest = saved["sourceHashes"][role]
        assert digest not in declared_sources, (saved["id"], declared_sources.get(digest), "repeated source across packages")
        declared_sources[digest] = saved["id"]
packages = []
for path in paths:
    status = json.loads(path.read_text())
    config = json.loads((path.parent / "package-config.json").read_text())
    assert not config.get("visualHold"), (status["id"], "unresolved source hold", config.get("visualHold"))
    assert status["id"] == config["id"] == path.parent.name
    assert status["mapping"] == config["mapping"]
    assert status.get("cockpitCalibration") == config.get("cockpitCalibration")
    assert status["productionIntegrated"] is False
    assert status["status"] == "generated-native-package"
    assert sorted(status["mapping"]) == list(range(8))
    for role, expected in status["sourceHashes"].items():
        source = path.parent / config.get(role + "Png", role + ".png")
        actual = hashlib.sha256(source.read_bytes()).hexdigest()
        assert actual == expected, (status["id"], role, "source changed after packaging")
        if role in ("body", "dashboard"):
            assert actual not in seen, (status["id"], seen.get(actual), "repeated source")
            seen[actual] = status["id"]
    frame_count = 0
    native_hashes = {}
    for ref, relative in status["nativeFiles"].items():
        assert ref.startswith("catalog-" + status["id"] + "-")
        native_path = (path.parent / relative).resolve()
        assert native_path.is_relative_to(path.parent.resolve())
        raw = native_path.read_bytes()
        wrapped = json.loads(raw)
        native = json.loads(gzip.decompress(base64.b64decode(wrapped["data"])))
        assert all(len(frame) == native["width"] * native["height"] for frame in native["frames"])
        assert len({hashlib.sha256(json.dumps(frame).encode()).hexdigest()
                    for frame in native["frames"]}) == len(native["frames"])
        frame_count += len(native["frames"])
        native_hashes[ref] = hashlib.sha256(raw).hexdigest()
    assert frame_count == status["nativeFrameCount"]
    packages.append({"id": status["id"], "sourceHashes": status["sourceHashes"],
                     "nativeHashes": native_hashes, "nativeFrameCount": frame_count})
delta = subprocess.check_output(["git", "diff", BASE, "--", "data/server-storage"], cwd=ROOT)
assert not delta, "Source-only branch contains production changes"
print(json.dumps({"sourceOnly": True, "productionWrites": 0, "packageCount": len(packages),
                  "packages": packages,
                  "acceptance": "Generation integrity only; full game/visual checks deferred"}, indent=2))
