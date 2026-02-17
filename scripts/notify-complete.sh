#!/usr/bin/env bash
set -euo pipefail

# Prefer audible sound utilities; fallback to terminal bell.
if command -v paplay >/dev/null 2>&1; then
    paplay /usr/share/sounds/freedesktop/stereo/complete.oga 2>/dev/null || true
elif command -v aplay >/dev/null 2>&1; then
    aplay /usr/share/sounds/alsa/Front_Center.wav >/dev/null 2>&1 || true
fi

printf '\a'
