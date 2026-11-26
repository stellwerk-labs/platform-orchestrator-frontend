#!/usr/bin/env bash
# Copy one verified OCI layout reference to its reserved registry tag.
#
#   copy-oci-layout.sh LAYOUT_REF DESTINATION
#
# `oras cp --no-tty` reads every manifest it has just pushed back from the destination to print its
# status, and GHCR can answer that read with 404 for a moment (Data Plane v4.5.0-rc.3 lost a candidate
# to it). The copy is content-addressed and only ever points DESTINATION at the layout root, so it is
# repeated for exactly that error; oras already retries 408, 429 and 5xx itself. Anything else, a
# timeout included, fails at once. A failed attempt may already have written the correct tag, so the
# caller checks the destination's absence once, before this script, and what it serves afterwards.
set -euo pipefail
layout_ref="${1:?usage: copy-oci-layout.sh LAYOUT_REF DESTINATION}"
destination="${2:?usage: copy-oci-layout.sh LAYOUT_REF DESTINATION}"
# Every failing attempt still lands at least one manifest, so six attempts cover the published graph.
attempts=6
pause="${PUBLISH_RETRY_PAUSE_SECONDS:-10}"
lag='^Error response from registry: sha256:[0-9a-f]{64}: not found$'
errors="$(mktemp)"
trap 'rm -f -- "$errors"' EXIT

for attempt in $(seq "$attempts"); do
  status=0
  timeout -k 5s 120s oras cp --no-tty --from-oci-layout "$layout_ref" "$destination" 2>"$errors" || status=$?
  cat "$errors" >&2
  if ((status == 0)); then exit 0; fi
  if ((status != 1 || attempt == attempts)) || ! tail -n 1 "$errors" | grep -Eq "$lag"; then
    exit "$status"
  fi
  printf 'Registry did not yet serve a manifest it had just accepted; copy attempt %d of %d, retrying.\n' \
    "$attempt" "$attempts" >&2
  sleep "$pause"
done
