#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime
import json
import os
import pathlib
import re
import subprocess
import sys
import textwrap
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
TELEGRAM_DIR = REPO_ROOT / ".codex" / "telegram"
DEFAULT_ENV_FILE = TELEGRAM_DIR / ".env.local"
STATE_FILE = TELEGRAM_DIR / "state.json"
RUNS_DIR = TELEGRAM_DIR / "runs"
DEFAULT_TRANSCRIPT_FILE = TELEGRAM_DIR / "transcript.md"

SENSITIVE_ENV_KEYS = {
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_ALLOWED_CHAT_IDS",
    "TELEGRAM_NOTIFY_CHAT_IDS",
    "TELEGRAM_NOTIFY_CHAT_ID",
    "TELEGRAM_CHAT_ID",
}


class TelegramError(RuntimeError):
    pass


def load_env_file(path: pathlib.Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key or key in os.environ:
            continue
        if (
            len(value) >= 2
            and value[0] == value[-1]
            and value[0] in {"'", '"'}
        ):
            value = value[1:-1]
        os.environ[key] = value


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if not value:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def split_ids(value: str | None) -> set[str]:
    if not value:
        return set()
    return {item.strip() for item in value.split(",") if item.strip()}


def resolve_repo_path(value: str | None, default: pathlib.Path) -> pathlib.Path:
    if not value:
        return default
    path = pathlib.Path(value).expanduser()
    if path.is_absolute():
        return path
    return REPO_ROOT / path


def allowed_chat_ids() -> set[str]:
    return split_ids(os.getenv("TELEGRAM_ALLOWED_CHAT_IDS") or os.getenv("TELEGRAM_CHAT_ID"))


def telegram_token() -> str:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        raise TelegramError(
            "Missing TELEGRAM_BOT_TOKEN. Configure .codex/telegram/.env.local first."
        )
    return token


def telegram_request(
    method: str,
    data: dict[str, str] | None = None,
    *,
    timeout: int = 35,
) -> dict[str, Any]:
    encoded = None
    if data is not None:
        encoded = urllib.parse.urlencode(data).encode("utf-8")

    url = f"https://api.telegram.org/bot{telegram_token()}/{method}"
    request = urllib.request.Request(url, data=encoded, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise TelegramError(f"Telegram request failed: {exc}") from exc

    if not payload.get("ok"):
        description = payload.get("description", "unknown Telegram API error")
        raise TelegramError(str(description))
    return payload


def chunk_text(text: str, limit: int = 3600) -> list[str]:
    if len(text) <= limit:
        return [text]

    chunks: list[str] = []
    remaining = text
    while len(remaining) > limit:
        split_at = remaining.rfind("\n", 0, limit)
        if split_at < limit // 2:
            split_at = limit
        chunks.append(remaining[:split_at].strip())
        remaining = remaining[split_at:].strip()
    if remaining:
        chunks.append(remaining)
    return chunks


def redact_sensitive_text(text: str) -> str:
    redacted = re.sub(
        r"\b\d{8,12}:[A-Za-z0-9_-]{30,}\b",
        "[REDACTED_TELEGRAM_BOT_TOKEN]",
        text,
    )
    redacted = re.sub(
        r"(?im)^(\s*(?:TELEGRAM_BOT_TOKEN|API_KEY|SECRET|TOKEN|PASSWORD)\s*=\s*).+$",
        r"\1[REDACTED]",
        redacted,
    )
    return redacted


def quote_markdown(text: str) -> str:
    if not text:
        return "> "
    return "\n".join(f"> {line}" if line else ">" for line in text.splitlines())


def append_transcript(chat_id: str, speaker: str, role: str, text: str) -> None:
    if not env_bool("CODEX_TELEGRAM_TRANSCRIPT_ENABLED", True):
        return

    transcript_file = resolve_repo_path(
        os.getenv("CODEX_TELEGRAM_TRANSCRIPT_FILE"),
        DEFAULT_TRANSCRIPT_FILE,
    )
    timestamp = datetime.datetime.now().astimezone().isoformat(timespec="seconds")
    safe_speaker = redact_sensitive_text(speaker)
    safe_text = redact_sensitive_text(text.strip())

    transcript_file.parent.mkdir(parents=True, exist_ok=True)
    with transcript_file.open("a", encoding="utf-8") as handle:
        handle.write(f"\n## {timestamp}\n\n")
        handle.write(f"**{role}**: {safe_speaker} (`chat_id: {chat_id}`)\n\n")
        handle.write(quote_markdown(safe_text))
        handle.write("\n")


def send_message(chat_id: str, text: str, *, log_to_transcript: bool = True) -> None:
    for part in chunk_text(text):
        telegram_request(
            "sendMessage",
            {
                "chat_id": chat_id,
                "text": part,
                "disable_web_page_preview": "true",
            },
        )
    if log_to_transcript:
        append_transcript(chat_id, "Codex Bot", "Codex", text)


def load_state() -> dict[str, Any]:
    if not STATE_FILE.exists():
        return {}
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def save_state(state: dict[str, Any]) -> None:
    TELEGRAM_DIR.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(
        json.dumps(state, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def update_author_name(message: dict[str, Any]) -> str:
    user = message.get("from") or {}
    parts = [user.get("first_name"), user.get("last_name")]
    name = " ".join(part for part in parts if part).strip()
    username = user.get("username")
    if username:
        return f"{name} (@{username})" if name else f"@{username}"
    return name or "Telegram owner"


def build_prompt(message_text: str, chat_id: str, author: str) -> str:
    return textwrap.dedent(
        f"""
        Bạn đang xử lý một tin nhắn Telegram của owner trong repo này.

        Hãy xem tin nhắn này giống như owner đang chat trực tiếp trong Codex:
        - Nếu là câu hỏi, trả lời trực tiếp và dễ hiểu.
        - Nếu là lệnh làm việc, triển khai theo `AGENTS.md` và skill liên quan.
        - Telegram được owner cấp full quyền cho dự án này; vẫn không được ghi secret vào repo/changelog/final response.
        - Trước khi kết thúc task, tuân thủ rule notification hiện có của repo.

        Người gửi Telegram: {author}
        Chat ID: {chat_id}

        Tin nhắn:
        {message_text}
        """
    ).strip()


def codex_base_command() -> list[str]:
    repo = os.getenv("CODEX_TELEGRAM_REPO", str(REPO_ROOT))
    command = ["codex", "--cd", repo]

    model = os.getenv("CODEX_TELEGRAM_MODEL", "").strip()
    profile = os.getenv("CODEX_TELEGRAM_PROFILE", "").strip()

    if model:
        command.extend(["--model", model])
    if profile:
        command.extend(["--profile", profile])
    if env_bool("CODEX_TELEGRAM_ENABLE_SEARCH", False):
        command.append("--search")

    if env_bool("CODEX_TELEGRAM_DANGEROUS_BYPASS", False):
        command.append("--dangerously-bypass-approvals-and-sandbox")
    else:
        sandbox = os.getenv("CODEX_TELEGRAM_SANDBOX", "danger-full-access")
        approval = os.getenv("CODEX_TELEGRAM_APPROVAL_POLICY", "never")
        command.extend(["--sandbox", sandbox, "--ask-for-approval", approval])

    return command


def codex_subprocess_env() -> dict[str, str]:
    env = os.environ.copy()
    for key in SENSITIVE_ENV_KEYS:
        env.pop(key, None)
    env["CODEX_TELEGRAM_SUPPRESS_NOTIFY"] = "1"
    return env


def missing_session_output(text: str) -> bool:
    lowered = text.lower()
    markers = [
        "no session",
        "no sessions",
        "no previous session",
        "session not found",
        "could not find session",
    ]
    return any(marker in lowered for marker in markers)


def parse_thread_id(output: str) -> str | None:
    for line in output.splitlines():
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if event.get("type") == "thread.started" and isinstance(event.get("thread_id"), str):
            return event["thread_id"]
    return None


def codex_command_for_mode(
    base: list[str],
    session_mode: str,
    output_file: pathlib.Path,
    chat_id: str,
    state: dict[str, Any],
) -> tuple[list[str], bool]:
    if session_mode == "telegram-thread":
        thread_id = ((state.get("threads") or {}).get(chat_id) or "").strip()
        if thread_id:
            return (
                base + ["exec", "resume", thread_id, "--json", "-o", str(output_file), "-"],
                True,
            )
        return base + ["exec", "--json", "-o", str(output_file), "-"], False

    if session_mode == "resume-last":
        return base + ["exec", "resume", "--last", "--json", "-o", str(output_file), "-"], True

    return base + ["exec", "--json", "-o", str(output_file), "-"], False


def save_thread_for_chat(chat_id: str, output: str) -> None:
    thread_id = parse_thread_id(output)
    if not thread_id:
        return
    state = load_state()
    threads = state.get("threads")
    if not isinstance(threads, dict):
        threads = {}
    threads[chat_id] = thread_id
    state["threads"] = threads
    save_state(state)


def run_codex(message_text: str, chat_id: str, author: str) -> tuple[bool, str]:
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    output_file = RUNS_DIR / f"last-message-{int(time.time())}-{chat_id}.txt"
    prompt = build_prompt(message_text, chat_id, author)
    timeout = env_int("CODEX_TELEGRAM_TIMEOUT_SECONDS", 7200)
    session_mode = os.getenv("CODEX_TELEGRAM_SESSION_MODE", "telegram-thread").strip()
    repo = os.getenv("CODEX_TELEGRAM_REPO", str(REPO_ROOT))
    state = load_state()

    base = codex_base_command()
    command, used_resume = codex_command_for_mode(
        base,
        session_mode,
        output_file,
        chat_id,
        state,
    )

    try:
        result = subprocess.run(
            command,
            input=prompt,
            text=True,
            cwd=repo,
            env=codex_subprocess_env(),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return False, f"Codex chạy quá {timeout} giây nên bot đã dừng chờ kết quả."

    combined_output = "\n".join([result.stdout, result.stderr]).strip()
    save_thread_for_chat(chat_id, combined_output)

    if (
        result.returncode != 0
        and used_resume
        and missing_session_output(combined_output)
    ):
        fallback_command = base + ["exec", "--json", "-o", str(output_file), "-"]
        result = subprocess.run(
            fallback_command,
            input=prompt,
            text=True,
            cwd=repo,
            env=codex_subprocess_env(),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout,
            check=False,
        )
        combined_output = "\n".join([result.stdout, result.stderr]).strip()
        save_thread_for_chat(chat_id, combined_output)

    final_message = ""
    if output_file.exists():
        final_message = output_file.read_text(encoding="utf-8").strip()
    if not final_message:
        final_message = combined_output[-3500:] or "Codex không trả về nội dung."

    if result.returncode == 0:
        return True, final_message

    error_tail = combined_output[-1200:] if combined_output else "Không có log lỗi."
    return False, f"Codex chưa hoàn thành task.\n\n{final_message}\n\nLog cuối:\n{error_tail}"


def handle_text_message(message: dict[str, Any], allowed_ids: set[str]) -> None:
    chat = message.get("chat") or {}
    chat_id = str(chat.get("id", ""))
    text = (message.get("text") or "").strip()
    author = update_author_name(message)

    if not chat_id:
        return
    if not text:
        send_message(chat_id, "Hiện bot chỉ nhận tin nhắn dạng text.")
        return
    append_transcript(chat_id, author, "Telegram", text)
    if text == "/id":
        send_message(chat_id, f"Telegram chat_id của bạn là: {chat_id}")
        return
    if text == "/help":
        send_message(
            chat_id,
            "Gửi bất kỳ câu hỏi/lệnh Codex nào vào đây. "
            "Nếu chat_id này được allow, bot sẽ chạy Codex full quyền trong repo.",
        )
        return

    if not allowed_ids:
        send_message(
            chat_id,
            "Bot đang ở chế độ setup nên chưa chạy Codex.\n"
            f"Chat ID này là: {chat_id}\n"
            "Hãy thêm chat ID này vào TELEGRAM_ALLOWED_CHAT_IDS.",
        )
        return

    if chat_id not in allowed_ids:
        send_message(chat_id, "Chat ID này chưa được phép điều khiển Codex.")
        return

    preview = text.replace("\n", " ").strip()
    if len(preview) > 180:
        preview = preview[:177] + "..."
    send_message(
        chat_id,
        "Đã nhận lệnh Telegram.\n"
        f"Task: {preview}\n"
        "Codex đang xử lý với full quyền trong repo này...",
    )

    ok, response = run_codex(text, chat_id, author)
    prefix = "Codex đã xong:\n\n" if ok else "Codex gặp lỗi hoặc bị chặn:\n\n"
    send_message(chat_id, prefix + response)


def poll_loop() -> None:
    allowed_ids = allowed_chat_ids()
    poll_timeout = env_int("CODEX_TELEGRAM_POLL_TIMEOUT_SECONDS", 25)
    state = load_state()
    offset = state.get("offset")

    me = telegram_request("getMe")
    username = (me.get("result") or {}).get("username", "unknown")
    print(f"Telegram Codex bot is running as @{username}", flush=True)
    if not allowed_ids:
        print("Setup mode: TELEGRAM_ALLOWED_CHAT_IDS is empty.", flush=True)

    if offset is None and env_bool("CODEX_TELEGRAM_SKIP_OLD_UPDATES_ON_START", True):
        old_updates = telegram_request("getUpdates", {"timeout": "0"}).get("result", [])
        last_update_id = None
        for update in old_updates:
            update_id = update.get("update_id")
            if isinstance(update_id, int):
                last_update_id = update_id
        if last_update_id is not None:
            offset = last_update_id + 1
            save_state({"offset": offset})
            print("Skipped old Telegram updates on startup.", flush=True)

    while True:
        payload: dict[str, str] = {"timeout": str(poll_timeout)}
        if offset is not None:
            payload["offset"] = str(offset)

        try:
            updates = telegram_request(
                "getUpdates",
                payload,
                timeout=poll_timeout + 10,
            ).get("result", [])
        except TelegramError as exc:
            print(f"Telegram polling error: {exc}", file=sys.stderr, flush=True)
            time.sleep(5)
            continue

        for update in updates:
            message = update.get("message")
            if isinstance(message, dict):
                try:
                    handle_text_message(message, allowed_ids)
                except Exception:
                    traceback.print_exc(file=sys.stderr)

            update_id = update.get("update_id")
            if isinstance(update_id, int):
                offset = update_id + 1
                save_state({"offset": offset})


def check_config() -> int:
    token_set = bool(os.getenv("TELEGRAM_BOT_TOKEN", "").strip())
    allowed_ids = allowed_chat_ids()
    transcript_file = resolve_repo_path(
        os.getenv("CODEX_TELEGRAM_TRANSCRIPT_FILE"),
        DEFAULT_TRANSCRIPT_FILE,
    )
    print(f"Repo: {os.getenv('CODEX_TELEGRAM_REPO', str(REPO_ROOT))}")
    print(f"Telegram token: {'set' if token_set else 'missing'}")
    print(f"Allowed chat IDs: {', '.join(sorted(allowed_ids)) if allowed_ids else 'missing'}")
    print(f"Session mode: {os.getenv('CODEX_TELEGRAM_SESSION_MODE', 'resume-last')}")
    print(f"Sandbox: {os.getenv('CODEX_TELEGRAM_SANDBOX', 'danger-full-access')}")
    print(f"Approval policy: {os.getenv('CODEX_TELEGRAM_APPROVAL_POLICY', 'never')}")
    print(f"Transcript: {'enabled' if env_bool('CODEX_TELEGRAM_TRANSCRIPT_ENABLED', True) else 'disabled'}")
    print(f"Transcript file: {transcript_file}")
    return 0 if token_set and allowed_ids else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Telegram bridge for Codex CLI.")
    parser.add_argument("--check", action="store_true", help="Validate local config without polling.")
    args = parser.parse_args()

    env_file = pathlib.Path(os.getenv("CODEX_TELEGRAM_ENV_FILE", str(DEFAULT_ENV_FILE)))
    load_env_file(env_file)

    if args.check:
        return check_config()

    try:
        poll_loop()
    except KeyboardInterrupt:
        print("Telegram Codex bot stopped.", flush=True)
        return 0
    except TelegramError as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
