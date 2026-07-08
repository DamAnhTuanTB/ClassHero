#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
label="com.codex.learning-path.telegram-bot"
plist="$HOME/Library/LaunchAgents/$label.plist"
uid="$(id -u)"

launchctl bootout "gui/$uid" "$plist" >/dev/null 2>&1 || true
rm -f "$plist"

echo "$label stopped and removed"
echo "Repo logs remain under $repo_root/.codex/telegram/runs/"
