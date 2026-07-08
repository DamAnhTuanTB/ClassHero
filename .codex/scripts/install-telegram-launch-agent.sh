#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
label="com.codex.learning-path.telegram-bot"
plist_dir="$HOME/Library/LaunchAgents"
plist="$plist_dir/$label.plist"
uid="$(id -u)"

mkdir -p "$plist_dir" "$repo_root/.codex/telegram/runs"

python3 - "$repo_root" "$label" "$plist" <<'PY'
import plistlib
import sys
from pathlib import Path

repo_root = Path(sys.argv[1])
label = sys.argv[2]
plist = Path(sys.argv[3])

data = {
    "Label": label,
    "ProgramArguments": [str(repo_root / ".codex/scripts/run-telegram-bot.sh")],
    "WorkingDirectory": str(repo_root),
    "RunAtLoad": True,
    "KeepAlive": True,
    "StandardOutPath": str(repo_root / ".codex/telegram/runs/launchd.out.log"),
    "StandardErrorPath": str(repo_root / ".codex/telegram/runs/launchd.err.log"),
    "EnvironmentVariables": {
        "PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
    },
}

plist.write_bytes(plistlib.dumps(data, sort_keys=False))
PY

launchctl bootout "gui/$uid" "$plist" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$uid" "$plist"
launchctl enable "gui/$uid/$label"
launchctl kickstart -k "gui/$uid/$label"

echo "$label installed and started"
echo "Logs:"
echo "  $repo_root/.codex/telegram/runs/launchd.out.log"
echo "  $repo_root/.codex/telegram/runs/launchd.err.log"
