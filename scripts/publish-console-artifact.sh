#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/release-tools.sh
source "$root/scripts/release-tools.sh"
output="$(cd "${1:?usage: publish-console-artifact.sh VERIFIED_ARTIFACT_DIRECTORY}" && pwd)"
image=ghcr.io/stellwerk-labs/platform-orchestrator-frontend
python3 "$root/scripts/console-release.py" preflight
python3 "$root/scripts/console-release.py" verify "$output"
bash "$root/scripts/scan-release-content.sh" "$output" "$RELEASE_FORBIDDEN_LITERAL"
# A complete bounded archive scan above rejects links/traversal before this
# exact immutable OCI archive is extracted into a new, run-owned directory.
layout="$RUNNER_TEMP/console-publication-layout"
inspection="$RUNNER_TEMP/console-publication-inspection"
mkdir "$layout"
tar -xf "$output/console-image.oci.tar" -C "$layout"
bash "$root/scripts/check-console-artifact.sh" "$layout" "$inspection"
cmp "$output/inspection.json" "$inspection/report.json"
python3 "$root/scripts/console-release.py" image "$layout" "$inspection/report.json"
digest="$(jq -er '.image.digest' "$output/release.json")"
reference="$(python3 "$root/scripts/release_content.py" oci-reference "$layout" "$digest")"
environment=public-release
if [[ "$GITHUB_EVENT_NAME" == workflow_dispatch ]]; then environment=public-release-candidate; fi
gh api "repos/$GITHUB_REPOSITORY/environments/$environment" > "$RUNNER_TEMP/console-environment.json"
if [[ "$GITHUB_EVENT_NAME" == workflow_dispatch ]]; then
  python3 "$root/scripts/candidate-release.py" "$RELEASE_VERSION" "$RELEASE_SOURCE_SHA" \
    --environment-json "$RUNNER_TEMP/console-environment.json" --check-image-absent "$GITHUB_REPOSITORY"
else
  python3 "$root/scripts/stable-release-preflight.py" "$RELEASE_VERSION" "$RELEASE_SOURCE_SHA"
fi
python3 "$root/scripts/console-release.py" order

export DOCKER_CONFIG="$RUNNER_TEMP/console-publication-docker"
mkdir -m 0700 "$DOCKER_CONFIG"
printf '%s' "$GH_TOKEN" | oras login ghcr.io --username "$GITHUB_ACTOR" --password-stdin >/dev/null
printf '%s' "$GH_TOKEN" | docker login ghcr.io --username "$GITHUB_ACTOR" --password-stdin >/dev/null
timeout -k 5s 120s docker pull --quiet "$cosign_image" >/dev/null
docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$cosign_image" | grep -Fx "$cosign_image" >/dev/null
verification=(--certificate-identity "https://github.com/$GITHUB_WORKFLOW_REF" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-github-workflow-sha "$GITHUB_WORKFLOW_SHA")
cosign_release() {
  timeout -k 5s 120s docker run --rm --pull=never --read-only --cap-drop ALL \
    --security-opt no-new-privileges --user "$(id -u):$(id -g)" \
    --tmpfs /tmp:rw,noexec,nosuid,size=32m,mode=1777 --env HOME=/tmp --env DOCKER_CONFIG=/docker \
    --env GITHUB_ACTIONS --env ACTIONS_ID_TOKEN_REQUEST_URL --env ACTIONS_ID_TOKEN_REQUEST_TOKEN \
    --mount "type=bind,src=$DOCKER_CONFIG,dst=/docker,readonly" \
    --mount "type=bind,src=$output,dst=/release" "$cosign_image" "$@"
}

# Only the existing candidate/stable workflow jobs call this after their human
# artifact gate. Partial publication reserves immutable names and is not retried.
release_args=(--verify-tag --draft --latest=false --title "$RELEASE_VERSION" --notes-file "$output/release-notes.md")
if [[ "$GITHUB_EVENT_NAME" == workflow_dispatch ]]; then release_args+=(--prerelease); fi
gh release create "$RELEASE_VERSION" "${release_args[@]}" --repo "$GITHUB_REPOSITORY" >/dev/null
# A verified local tag descriptor preserves OCI media types; digest-only copy
# can change the descriptor and therefore cannot be used for this boundary.
printf 'Copying verified OCI graph to reserved Console tag.\n'
timeout -k 5s 120s oras cp --no-tty --from-oci-layout "$layout:$reference" "$image:$RELEASE_VERSION" >/dev/null
printf 'OCI copy accepted; checking read-only registry visibility of the exact graph.\n'
timeout -k 5s 120s python3 "$root/scripts/registry_visibility.py" "$layout" "$image:$RELEASE_VERSION" "$digest"
while IFS= read -r subject; do
  cosign_release sign --yes --oidc-provider github-actions "$image@$subject" >/dev/null
  cosign_release verify "${verification[@]}" "$image@$subject" >/dev/null
  cosign_release attest --yes --oidc-provider github-actions --type slsaprovenance1 \
    --predicate /release/source-provenance.json "$image@$subject" >/dev/null
  cosign_release verify-attestation "${verification[@]}" --type slsaprovenance1 --output json \
    "$image@$subject" > "$RUNNER_TEMP/console-verified-provenance.json"
  python3 "$root/scripts/console-release.py" statement "$RUNNER_TEMP/console-verified-provenance.json" \
    "$subject" https://slsa.dev/provenance/v1 "$output/source-provenance.json"
done < <(jq -r '.image.digest, (.image.payloads | to_entries[] | .value.manifest)' "$output/release.json")
for arch in amd64 arm64; do
  platform="$(jq -er --arg arch "$arch" '.image.payloads[$arch].manifest' "$output/release.json")"
  for subject in "$digest" "$platform"; do
    cosign_release attest --yes --oidc-provider github-actions --type spdxjson \
      --predicate "/release/console-linux-$arch.spdx.json" "$image@$subject" >/dev/null
    cosign_release verify-attestation "${verification[@]}" --type spdxjson --output json \
      "$image@$subject" > "$RUNNER_TEMP/console-verified-sbom.json"
    python3 "$root/scripts/console-release.py" statement "$RUNNER_TEMP/console-verified-sbom.json" \
      "$subject" https://spdx.dev/Document "$output/console-linux-$arch.spdx.json"
  done
done
cosign_release sign-blob --yes --oidc-provider github-actions --bundle /release/SHA256SUMS.sigstore.json /release/SHA256SUMS >/dev/null
cosign_release verify-blob "${verification[@]}" --bundle /release/SHA256SUMS.sigstore.json /release/SHA256SUMS >/dev/null
bash "$root/scripts/scan-release-content.sh" "$output" "$RELEASE_FORBIDDEN_LITERAL"
anonymous="$RUNNER_TEMP/console-publication-anonymous"
mkdir -m 0700 "$anonymous"
test "$(DOCKER_CONFIG="$anonymous" oras resolve "$image:$RELEASE_VERSION")" = "$digest"
DOCKER_CONFIG="$anonymous" cosign_release verify "${verification[@]}" "$image@$digest" >/dev/null
assets=("$output/"*)
gh release upload "$RELEASE_VERSION" "${assets[@]}" --repo "$GITHUB_REPOSITORY"
download="$RUNNER_TEMP/console-publication-download"
mkdir "$download"
gh release download "$RELEASE_VERSION" --repo "$GITHUB_REPOSITORY" --dir "$download"
for file in "${assets[@]}"; do cmp "$file" "$download/$(basename "$file")"; done
gh release view "$RELEASE_VERSION" --repo "$GITHUB_REPOSITORY" --json body | \
  jq -e --rawfile notes "$output/release-notes.md" '.body == $notes' >/dev/null
latest=false
if [[ "$GITHUB_EVENT_NAME" == push ]]; then latest=true; fi
gh release edit "$RELEASE_VERSION" --repo "$GITHUB_REPOSITORY" --draft=false --latest="$latest"
