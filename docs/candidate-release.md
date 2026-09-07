# Manual Release Candidates

The normal main-branch release remains unchanged. A separate manual CI path can
publish an explicitly approved, already tagged release candidate without updating
stable/latest channels. It is enabled only in the original
`stellwerk-labs/platform-orchestrator-frontend` repository.

## Before Dispatch

- Transfer this workflow/helper/docs change separately through an approved
  workflow-only source change. Use `[skip release]` on that bootstrap change and
  verify no unrelated main-branch commits would publish.
- Obtain explicit approval for the source revision, root candidate tag, release
  notes and public GHCR image destination.
- Create the approved `vX.Y.Z-rc.N` tag separately at the reviewed 40-character
  commit SHA. The workflow never creates or moves tags.
- Add reviewed notes at `docs/releases/<candidate-tag>.md` in the tagged source.
- Configure the existing `public-release-candidate` environment with required
  reviewers before dispatch. A missing or unreviewed environment is a blocker.
- Keep the coordinated CP, DP, IAM and Runner candidate endpoints/images pinned
  to the manifest-approved set used during the browser and API-flow checks.

## Dispatch and Recovery

Dispatch the Tests workflow with `candidate_tag` and `candidate_sha`. Lint,
typecheck, duplicate detection, unit tests, production build and Playwright checks
run against the supplied SHA. The protected publication job revalidates the
SHA/tag/reviewer contract, refuses any existing draft or published GitHub release
for the tag, refuses any existing image tag, reserves a GitHub prerelease with
`--latest=false`, and then publishes only the exact RC image tag.

If a failure happens after release reservation, the RC identifier is consumed.
Inspect the failed run and prepare a newly approved `rc.N+1`; do not overwrite
the image, delete evidence, rerun against a moved tag or promote it as stable.
