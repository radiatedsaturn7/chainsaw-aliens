#!/usr/bin/env bash
set -euo pipefail
SNAPSHOT_FILE="${1:-data/server-storage/vfs-snapshot.json}"
if [[ ! -f "$SNAPSHOT_FILE" ]]; then
  echo "Snapshot not found: $SNAPSHOT_FILE" >&2
  exit 1
fi
python3 - "$SNAPSHOT_FILE" <<'PY2'
import json,sys
from pathlib import Path
p=Path(sys.argv[1])
data=json.loads(p.read_text(encoding="utf-8"))
index=data.get("index",{}) if isinstance(data,dict) else {}
print(f"server-snapshot: {p}")
for folder in sorted(index.keys()):
    print(folder+"/")
    names=sorted((index.get(folder) or {}).keys())
    for i,name in enumerate(names):
        branch="└── " if i==len(names)-1 else "├── "
        print(f"{branch}{name}")
PY2
