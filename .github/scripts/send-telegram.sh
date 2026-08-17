#!/usr/bin/env bash
set -euo pipefail

# Send a Telegram message without writing Bot API payloads to stdout.
# Telegram tokens are "<bot_id>:<secret>"; sendMessage returns a Message
# whose from.id is that bot id. See:
# https://core.telegram.org/bots/api#authorizing-your-bot
# https://core.telegram.org/bots/api#sendmessage
# https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands#masking-a-value-in-a-log

if [ -z "${TELEGRAM_TOKEN:-}" ] || [ -z "${TELEGRAM_TO:-}" ]; then
  echo "telegram_error=TELEGRAM_TOKEN or TELEGRAM_TO is missing" >&2
  exit 1
fi

bot_id="${TELEGRAM_TOKEN%%:*}"
if [ -n "$bot_id" ]; then
  printf '::add-mask::%s\n' "$bot_id"
fi

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

http_code="$(
  curl --silent --show-error --max-time 30 \
    --output "$tmp" \
    --write-out '%{http_code}' \
    -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TELEGRAM_TO}" \
    --data-urlencode "disable_web_page_preview=true" \
    --data-urlencode "text=${TELEGRAM_MESSAGE:-}"
)"

python3 - "$tmp" "$http_code" <<'PY'
import json
import sys

path, http_code = sys.argv[1], sys.argv[2]
try:
    data = json.load(open(path, encoding='utf-8'))
except Exception:
    print(f'telegram_http={http_code} ok=unknown')
    print('telegram_error=invalid telegram response')
    sys.exit(1)

ok = bool(data.get('ok'))
print(f'telegram_http={http_code} ok={str(ok).lower()}')
if http_code != '200' or not ok:
    description = data.get('description') or data.get('error_code') or 'request failed'
    print(f'telegram_error={description}')
    sys.exit(1)
PY
