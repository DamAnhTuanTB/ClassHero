#!/usr/bin/env bash
set -u

status="${1:-done}"
task="${2:-Codex task}"
message="${3:-Task finished.}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
telegram_env_file="${CODEX_TELEGRAM_ENV_FILE:-$repo_root/.codex/telegram/.env.local}"

case "$status" in
  done)
    title="CODEX: TASK HOÀN THÀNH"
    sound="Glass"
    ;;
  blocked)
    title="CODEX: CẦN BẠN XEM"
    sound="Ping"
    ;;
  failed)
    title="CODEX: TASL GẶP LỖI"
    sound="Basso"
    ;;
  *)
    title="CODEX: CẬP NHẬT TASK"
    sound="Glass"
    ;;
esac

fallback() {
  printf '[Codex notify] %s - %s: %s\n' "$title" "$task" "$message"
}

if [[ -f "$telegram_env_file" ]]; then
  set -a
  # shellcheck source=/dev/null
  . "$telegram_env_file"
  set +a
fi

send_macos_notification() {
  if [[ "$(uname -s)" != "Darwin" ]] || ! command -v osascript >/dev/null 2>&1; then
    fallback
    return 0
  fi

  osascript - "$title" "$task" "$message" "$sound" <<'APPLESCRIPT' || fallback
on run argv
  set notificationTitle to item 1 of argv
  set notificationSubtitle to item 2 of argv
  set notificationMessage to item 3 of argv
  set notificationSound to item 4 of argv

  if notificationSound is "" then
    display notification notificationMessage with title notificationTitle subtitle notificationSubtitle
  else
    display notification notificationMessage with title notificationTitle subtitle notificationSubtitle sound name notificationSound
  end if
end run
APPLESCRIPT
}

send_telegram_notification() {
  if [[ "${CODEX_TELEGRAM_SUPPRESS_NOTIFY:-0}" == "1" ]]; then
    return 0
  fi
  if [[ -z "${TELEGRAM_BOT_TOKEN:-}" ]] || ! command -v python3 >/dev/null 2>&1; then
    return 0
  fi

  local chat_ids="${TELEGRAM_NOTIFY_CHAT_IDS:-${TELEGRAM_NOTIFY_CHAT_ID:-${TELEGRAM_ALLOWED_CHAT_IDS:-${TELEGRAM_CHAT_ID:-}}}}"
  if [[ -z "$chat_ids" ]]; then
    return 0
  fi

  local telegram_text
  telegram_text="${title}"$'\n'"Task: ${task}"$'\n'"${message}"

  TELEGRAM_BOT_TOKEN="$TELEGRAM_BOT_TOKEN" \
    TELEGRAM_CHAT_IDS="$chat_ids" \
    TELEGRAM_TEXT="$telegram_text" \
    python3 - <<'PY' >/dev/null 2>&1 || true
import os
import urllib.parse
import urllib.request

token = os.environ["TELEGRAM_BOT_TOKEN"]
text = os.environ["TELEGRAM_TEXT"]
chat_ids = [item.strip() for item in os.environ["TELEGRAM_CHAT_IDS"].split(",") if item.strip()]

for chat_id in chat_ids:
    data = urllib.parse.urlencode(
        {
            "chat_id": chat_id,
            "text": text,
            "disable_web_page_preview": "true",
        }
    ).encode("utf-8")
    urllib.request.urlopen(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=data,
        timeout=10,
    ).read()
PY
}

send_macos_notification
send_telegram_notification
