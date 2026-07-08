# Codex Notification And Telegram Control

## Chủ đề này dùng để làm gì?

Chủ đề này giải thích cách repo cho phép Codex báo trạng thái task qua macOS/Telegram và nhận lệnh từ Telegram như một kênh chat phụ.

Mục tiêu không phải biến Telegram thành một backend sản phẩm. Đây là tooling nội bộ cho owner điều khiển Codex trong repo:

- Codex làm xong task thì báo rõ trạng thái.
- Owner có thể nhắn Telegram để hỏi đáp hoặc ra lệnh cho Codex.
- Luồng Telegram có transcript local để mở lại trong IDE/Codex.

## Cách nó hoạt động trong repo

Repo có ba phần chính:

- `.codex/scripts/notify-task.sh`: script thông báo task.
- `.codex/scripts/codex-telegram-bot.py`: bot Telegram local nhận tin nhắn rồi gọi Codex CLI.
- macOS LaunchAgent `com.codex.learning-path.telegram-bot`: giữ bot chạy bền ở nền.

Các secret thật không nằm trong git. Token bot, chat ID và config local nằm ở:

```txt
.codex/telegram/.env.local
```

File này bị `.gitignore` chặn.

## Luồng kỹ thuật

### 1. Thông báo macOS

Khi Codex kết thúc task, các skill và `AGENTS.md` yêu cầu gọi:

```bash
.codex/scripts/notify-task.sh done "<task/command>" "<kết quả ngắn>"
```

Script dùng AppleScript qua `osascript`:

```txt
notify-task.sh
-> osascript display notification
-> macOS Notification Center
```

Ba trạng thái chính:

- `done`: task đã hoàn thành.
- `blocked`: cần owner quyết định hoặc cung cấp thông tin.
- `failed`: task/check lỗi và chưa hoàn thành.

Nếu không chạy được notification macOS, script fallback ra terminal và không làm task fail.

### 2. Thông báo Telegram

`notify-task.sh` cũng đọc `.codex/telegram/.env.local`. Nếu có token và chat ID nhận thông báo, script gọi Telegram Bot API:

```txt
notify-task.sh
-> Telegram Bot API sendMessage
-> Telegram chat của owner
```

Điểm cần nhớ:

- Notification Telegram chỉ là message ngắn về trạng thái task.
- Không đưa secret, token, private URL hoặc dữ liệu nhạy cảm vào nội dung thông báo.
- Khi task được chạy từ chính Telegram bot, bot set `CODEX_TELEGRAM_SUPPRESS_NOTIFY=1` để giảm nguy cơ gửi thông báo trùng.

### 3. Điều khiển Codex qua Telegram

Bot Telegram chạy local bằng Python:

```txt
Telegram user message
-> codex-telegram-bot.py poll getUpdates
-> kiểm tra chat_id có được allow không
-> gọi codex exec trong repo
-> gửi final response lại Telegram bằng sendMessage
```

Bot không nhận lệnh từ mọi người. Chỉ `TELEGRAM_ALLOWED_CHAT_IDS` trong `.env.local` được phép điều khiển Codex.

Khi đã allow, Telegram có quyền tương đương owner trong repo. Vì vậy token bot và chat ID phải được xem là thông tin nhạy cảm.

### 4. Thread riêng cho Telegram

Bot dùng:

```txt
CODEX_TELEGRAM_SESSION_MODE=telegram-thread
```

Ý nghĩa:

- Telegram có một Codex thread riêng.
- Bot không resume nhầm phiên Codex app/terminal gần nhất.
- Thread ID được lưu local trong `.codex/telegram/state.json`.

Nếu thread cũ không còn tồn tại, bot fallback sang tạo thread mới.

### 5. Chạy bền bằng LaunchAgent

Chạy bot bằng terminal thường dễ bị dừng khi terminal/tool kết thúc. Vì vậy repo có script cài macOS LaunchAgent:

```bash
.codex/scripts/install-telegram-launch-agent.sh
```

LaunchAgent giữ bot chạy nền:

```txt
macOS launchd
-> run-telegram-bot.sh
-> codex-telegram-bot.py
-> Telegram polling loop
```

Kiểm tra trạng thái:

```bash
launchctl print gui/$(id -u)/com.codex.learning-path.telegram-bot
```

Gỡ bot nền:

```bash
.codex/scripts/uninstall-telegram-launch-agent.sh
```

### 6. Transcript Telegram

Bot ghi transcript local ở:

```txt
.codex/telegram/transcript.md
```

Transcript ghi:

- Tin nhắn Telegram của owner.
- Phản hồi Codex gửi lại Telegram.
- Timestamp, role và chat ID.

File này bị `.gitignore` chặn vì có thể chứa nội dung chat riêng. Bot có redaction cơ bản cho token/secret pattern, nhưng không nên gửi secret thật vào Telegram.

## Kỹ thuật chính

### `osascript`

`osascript` cho phép shell script gọi AppleScript để hiển thị notification native của macOS. Đây là cách nhẹ nhất để báo task xong mà không cần app riêng.

### Telegram Bot API

Telegram bot dùng HTTPS API:

- `getUpdates`: bot poll tin nhắn mới.
- `sendMessage`: bot gửi phản hồi hoặc notification.
- `getMe`: kiểm tra token bot còn hợp lệ.

### `codex exec`

Bot không nhúng Codex vào Python. Nó gọi Codex CLI:

```txt
codex exec
```

Ưu điểm:

- Tận dụng đúng Codex CLI đang dùng trên máy.
- Codex vẫn đọc `AGENTS.md`, skills và repo context.
- Có thể chạy với quyền tương đương phiên Codex local.

### Allowlist bằng chat ID

`TELEGRAM_ALLOWED_CHAT_IDS` là lớp bảo vệ chính. Nếu không có allowlist, bất kỳ ai có thể nhắn bot cũng có nguy cơ điều khiển Codex.

Trong repo này:

- `/id` dùng để lấy chat ID.
- Chỉ chat ID được allow mới chạy `codex exec`.
- Chat ID/token thật không commit.

## File quan trọng

```txt
.codex/scripts/notify-task.sh
.codex/scripts/codex-telegram-bot.py
.codex/scripts/run-telegram-bot.sh
.codex/scripts/install-telegram-launch-agent.sh
.codex/scripts/uninstall-telegram-launch-agent.sh
.codex/telegram/.env.example
.codex/telegram/.env.local
.codex/telegram/state.json
.codex/telegram/transcript.md
README.md
AGENTS.md
```

## Khi nào cần nhớ lại?

Đọc lại note này khi:

- Muốn biết vì sao task xong lại hiện notification.
- Telegram không phản hồi dù bot đã nhận tin.
- Cần kiểm tra bot đang chạy hay đã chết.
- Cần đổi token bot hoặc chat ID.
- Muốn xem lại transcript Telegram trong repo.
- Muốn hiểu tại sao Telegram dùng thread riêng thay vì resume phiên Codex gần nhất.

## Lỗi thường gặp

### Telegram nhắn rồi không thấy phản hồi

Kiểm tra LaunchAgent:

```bash
launchctl print gui/$(id -u)/com.codex.learning-path.telegram-bot
```

Xem log:

```bash
tail -f .codex/telegram/runs/launchd.out.log
tail -f .codex/telegram/runs/launchd.err.log
```

Kiểm tra queue Telegram:

- Nếu có update pending, bot chưa poll hoặc đang lỗi.
- Nếu queue sạch nhưng không thấy message, kiểm tra Telegram client hoặc log sendMessage.

### Token không hợp lệ

Telegram API sẽ trả `401 Unauthorized`. Cách xử lý:

1. Vào BotFather.
2. Revoke token cũ.
3. Dán token mới vào `.codex/telegram/.env.local`.
4. Chạy `getMe` hoặc `.codex/scripts/run-telegram-bot.sh --check`.

### Bot chạy terminal thì được, chạy nền thì chết

Chạy bằng LaunchAgent thay vì `nohup` hoặc terminal background:

```bash
.codex/scripts/install-telegram-launch-agent.sh
```

## Kiến thức cần nhớ

- Notification và Telegram bridge là tooling nội bộ của repo, không phải tính năng sản phẩm.
- Token Telegram bot tương đương quyền gửi/nhận qua bot; nếu lộ phải revoke.
- `chat_id` allowlist là điều kiện bắt buộc trước khi cho Telegram gọi Codex.
- `codex exec` là cầu nối giữa Telegram bot và Codex CLI.
- `telegram-thread` giúp Telegram có mạch hội thoại riêng, không lẫn với phiên Codex app/terminal.
- Transcript local giúp xem lại luồng Telegram trong repo, nhưng vẫn không nên gửi secret vào chat.

## Task liên quan

- Codex task completion notification.
- Telegram full-control Codex bridge.
- Telegram chat transcript.
