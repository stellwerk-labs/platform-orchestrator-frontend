#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/release-tools.sh
source "$root/scripts/release-tools.sh"
version="${1:?usage: build-console-image.sh VERSION SOURCE_SHA NEW_OCI_TAR NEW_METADATA_JSON}"
source_sha="${2:?source SHA required}"
output="${3:?new OCI tar path required}"
metadata="${4:?new build metadata path required}"
[[ "$version" =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-rc\.[1-9][0-9]*)?$ ]]
[[ "$source_sha" =~ ^[0-9a-f]{40}$ ]]
test "$(git -C "$root" rev-parse HEAD)" = "$source_sha"
test -z "$(git -C "$root" status --porcelain)"
test ! -e "$output"
test ! -e "$metadata"
epoch="$(git -C "$root" show -s --format=%ct "$source_sha")"
# Each invocation is one bounded build. The workflow invokes two independent
# no-cache builds and compares inspected platform payloads, not attestation IDs.
timeout -k 5s 300s docker buildx build --no-cache --platform linux/amd64,linux/arm64 \
  --file "$root/apps/main/Dockerfile" --build-arg "SOURCE_DATE_EPOCH=$epoch" \
  --build-arg "VERSION=$version" --tag "ghcr.io/stellwerk-labs/platform-orchestrator-frontend:$version" \
  --label "org.opencontainers.image.version=$version" \
  --label "org.opencontainers.image.revision=$source_sha" \
  --sbom="generator=$buildkit_sbom_generator" --provenance=mode=max \
  --output "type=oci,dest=$output,rewrite-timestamp=true" --metadata-file "$metadata" "$root"
