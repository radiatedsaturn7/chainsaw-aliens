#!/usr/bin/env python3
"""Account for every committed 3D roster slot, without checking out art blobs."""

import argparse
import base64
from collections import Counter
import gzip
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
CARS = "data/server-storage/files/cars"
WRX = ("3d-field-forgetmenot-2004-3d-3687a560a6a6",
       "Field-Forgetmenot", "Field-Forgetmenot-Wheel")
ENV = {**os.environ, "GIT_NO_LAZY_FETCH": "1"}


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT, env=ENV)


def car_paths(revision):
    pattern = re.compile(CARS + r"/([^/]+)/document\.json$")
    for entry in git("ls-tree", "-rz", revision, CARS).split(b"\0"):
        if not entry:
            continue
        metadata, path = entry.split(b"\t", 1)
        match = pattern.fullmatch(path.decode())
        if match:
            yield match[1], metadata.split()[2]


def read_cars(paths):
    with subprocess.Popen(["git", "cat-file", "--batch"], cwd=ROOT, env=ENV,
                          stdin=subprocess.PIPE, stdout=subprocess.PIPE) as conn:
        try:
            for name, sha in paths:
                conn.stdin.write(sha + b"\n")
                conn.stdin.flush()
                header = conn.stdout.readline().split()
                if not header or header[-1] == b"missing":
                    raise ValueError(f"Missing local car document: {name}")
                data = json.loads(conn.stdout.read(int(header[-1])))
                if conn.stdout.read(1) != b"\n":
                    raise ValueError(f"Truncated car document: {name}")
                if data.get("__chainsawStorage") == "compact-v1":
                    data = json.loads(gzip.decompress(base64.b64decode(data["data"])))
                yield name, data.get("car", data)
        finally:
            conn.stdin.close()


def reference(car):
    provenance = car.get("catalogProvenance") or {}
    return provenance.get("referenceVehicle") or provenance.get("inspiration")


def collect(revision, approved):
    paths = dict(car_paths(revision))
    slots = sorted(name for name in paths if name.endswith(" 3D"))
    if len(slots) != 660:
        raise ValueError(f"Expected 660 exact 3D slots, found {len(slots)}")
    siblings = [name.removesuffix(" 3D") for name in slots]
    cars = dict(read_cars((name, paths[name]) for name in slots + siblings if name in paths))
    rows = []
    for name in slots:
        car = cars[name]
        art = car.get("art") or {}
        body = (art.get("bodyModel") or {}).get("ref")
        wheel = (art.get("wheelModel") or {}).get("ref")
        if not car["id"].startswith("3d-") or not body or not wheel or not car["tuning"]["wheelRadiusM"] > 0:
            raise ValueError(f"Invalid original 3D binding: {name}")
        base_name = name.removesuffix(" 3D")
        direct_ref = reference(car)
        base_ref = reference(cars.get(base_name, {}))
        rows.append({
            "id": car["id"], "label": name, "bodyRef": body, "wheelRef": wheel,
            "reference": direct_ref or base_ref,
            "referenceSource": "3D car" if direct_ref else ("2D counterpart" if base_ref else None),
            "status": "editable" if car["id"] in approved else "queued",
        })
    ids = {row["id"] for row in rows}
    refs = {row[key] for row in rows for key in ("bodyRef", "wheelRef")}
    if len(ids) != len(rows) or len(refs) != len(rows) * 2:
        raise ValueError("Duplicate car IDs or asset references: cannot safely substitute by reference")
    found = {r["id"]: (r["bodyRef"], r["wheelRef"]) for r in rows}
    for car_id, pair in approved.items():
        if found.get(car_id) != pair:
            raise ValueError(f"Studio study has the wrong stock bindings: {car_id}")
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--revision", default="HEAD", help="Git revision that supplies both stock cars and enrolled studies")
    parser.add_argument("--queue", type=Path, help="Optional machine-readable authoring queue output")
    args = parser.parse_args()
    studies = json.loads(git("show", f"{args.revision}:tools/vehicle-validation/studio-roster-hardpoints.json"))
    approved = {WRX[0]: WRX[1:]}
    for row in studies:
        if row["carId"] in approved:
            raise ValueError(f"Duplicate study for {row['carId']}")
        approved[row["carId"]] = (row["bodyRef"], row["wheelRef"])
    rows = collect(args.revision, approved)
    if args.queue:
        args.queue.write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({
        "revision": git("rev-parse", args.revision).decode().strip(),
        "roster": len(rows),
        **Counter(row["status"] for row in rows),
        "queuedWithoutDocumentedReference": sum(
            row["status"] == "queued" and not row["reference"] for row in rows
        ),
    }, indent=2))


if __name__ == "__main__":
    main()
