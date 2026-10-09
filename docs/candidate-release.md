# Manual release candidates

Stable version and tag assignment still belongs to the existing main-branch
semantic-release action. The manual path publishes an explicitly approved,
already tagged candidate without updating stable/latest channels. Both publication
paths are dormant unless explicitly enabled in the original
`stellwerk-labs/platform-orchestrator-frontend` repository.

## Before dispatch

- Transfer this workflow/helper/docs change separately through an approved
  workflow-only source change. Use `[skip release]` on that bootstrap change and
  verify no unrelated main-branch commits would publish.
- Obtain explicit approval for the source revision, root candidate tag, release
  notes and public GHCR image destination.
- Create the approved `vX.Y.Z-rc.N` tag separately at the reviewed 40-character
  commit SHA. The workflow never creates or moves tags.
- Add reviewed notes at `docs/releases/<candidate-tag>.md` in the tagged source.
- Configure the existing `public-release-candidate` environment with required
  human reviewers before dispatch. Stable releases also require a pre-existing
  `public-release` human-review environment, for source/tag assignment and then
  exact-artifact publication. A missing or unreviewed environment is a blocker;
  this workflow never provisions environments or approves/bypasses a review.
- Independently approve and set `CONSOLE_PUBLIC_RELEASES_ENABLED=true` and the
  `CONSOLE_FORBIDDEN_LITERAL` repository secret used for private-reference scans.
  Verify that the existing Console GHCR package is public. Activation is not
  permission to dispatch, approve or publish a particular release.
- Keep the coordinated CP, DP, IAM and Runner candidate endpoints/images pinned
  to the manifest-approved set used during the browser and API-flow checks.

## Dispatch and recovery

Dispatch the Tests workflow with `candidate_tag` and `candidate_sha`. Lint,
typecheck, duplicate detection, unit tests, production build and Playwright checks
run against the supplied SHA. Two independent no-cache OCI builds must have
identical platform manifests, configs, layers and notices. The full OCI index and
BuildKit attestation envelopes can differ; both are preserved and that variance is
reported, not presented as byte-identical provenance.

Before human publication review, the workflow scans original layers, merged
payloads, archive contents and final metadata, and records immutable artifact
ID/digest/run/source/checksum identities. Syft inventories installed OS packages;
Vite supplies the actual bundled JavaScript inventory, not an inference from
minified JavaScript. Original bundled-package notices and the application's
license ship under both `/licenses` and `/app/build/licenses`. Exact added APK
notices and base nginx notices are preserved separately. This inventory is not a
legal certification of the distribution.

After human review, the publication job verifies that same artifact again, repeats
source/tag/reviewer and duplicate checks, and reserves a draft prerelease with
`--latest=false`. It copies the inspected OCI tag descriptor without rebuilding,
verifies the registry digest, and signs/verifies index/platform subjects, source
provenance and platform SBOM predicates against the exact producing workflow
commit and OIDC issuer. Candidate source and workflow commits may differ only
when the dispatched workflow bytes are identical; their identities are recorded
separately. The release becomes visible only after anonymous registry verification
and uploaded-asset byte comparison. Stable publication uses the same artifact
boundary and updates latest only after verification.

Local builds from a private mirror are diagnostic evidence, not automatically
publishable artifacts. Private origins in BuildKit provenance must fail the final
content scan; do not rewrite provenance or suppress the origin to make it pass.
These checks do not introduce signed stable tags or assert a SLSA assurance level.

If a failure happens after release reservation, the RC identifier is consumed.
Inspect the failed run and prepare a newly approved `rc.N+1`; do not overwrite
the image, delete evidence, rerun against a moved tag or promote it as stable.
