#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
python3 "$root/scripts/release_content.py" export "${1:?OCI layout required}" "${2:?new inspection output required}" "${3:-amd64,arm64}"
bash "$root/scripts/scan-release-content.sh" "$2" "${RELEASE_FORBIDDEN_LITERAL:-}"
