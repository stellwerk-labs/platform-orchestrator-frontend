# Module Drafts and Resource Type interface versions

Unreleased candidate, requiring the coordinated server API and gateway routes.

Adds a Module's Drafts tab for editable authoring, retained revisions, explicit
reload after a concurrent change, immutable scoped test capture, normal Runner
execution/status, publication and discard. Saving another attempt preserves its
intended SemVer and earlier captures. Publication closes the exact stored revision
as a distinct Proposed Version, without making it Default or deploying it.

Resource Types expose immutable interface history and explicit consecutive
interface publication. Existing Module Versions keep their exact binding. New
publication and stable-successor actions preserve an explicitly selected interface
and use its capability-specific API route, with no older-handler fallback.

Fresh tests require authoring and scoped deployment authority; server admission
and Pins remain authoritative. A first implementation needs a Module Rule scoped
to both Project and Environment until a Default exists. Unsupported servers show
an error instead of deploying another Version.

Local qualification includes TypeScript, lint, all519unit tests with coverage,
production build, Chromium19pass/1existing skip and actual IAM/CP/DP/Runner browser
scenarios. The live tests cover A/B under one intended SemVer, retained captures,
reader denial, publication, interface evolution, exact stable successor, stale
editor rejection and normal Environment destruction. Seeded cross-service upgrade/restart also passes with native server binaries.
Complete the final packaged upgrade, public SDK and plugin-compatible release
checks before publishing this candidate.
