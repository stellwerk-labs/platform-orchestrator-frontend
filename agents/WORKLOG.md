# Worklog


## 2026-11-12: Console maintenance state and catalogue filters

- Implemented the requested local change with targeted tests and documentation. Independent planning, green and final clean-code reviews passed after correcting partial-summary availability and removing an unsupported mTLS mount example.
- TLS configuration was exercised against real PostgreSQL; UI and complete-history/permission boundaries were tested. Hosted release qualification and immutable public schema/image pins remain pending. No public publication or live deployment is established by this local checkpoint.

## 2026-11-13: Infracost Administration

Replaced obsolete online-feed controls with Infracost enablement/customer key, defaults off. Focused11tests, TypeScript, full lint, independent reviews and actual IAM/DP/CP/PG/Vault browser cycle passed. No publication or deployment.


## Managed deployment logs, 2026-11-13

ReplacedmanualkeyUIwithautomaticmanagedreads;18actualHTTP/DOMtestspass, fullTypeScript+ESLint passedbeforecuratedgeneration, generatedcontractfromactualDPsource; no new dependencies.


## Logs toolbar layout, 2026-11-13

Layout-only: removed duplicate Runner logs card title; composed Reload/Clear/raw toggle and right-aligned nowrap hint in one toolbar. Scoped Prettier, ESLint and TypeScript passed. User explicitly requested no full test-suite rerun; no API/auth/key/log state behavior changed.


## Candidate browser workflow bootstrap

Prepared the existing controls and phase-logs browser matrix for the main dispatcher with a candidate-only event condition. Existing candidate, workflow and Console release contracts pass all29 tests. actionlint was unavailable and was not executed. Application files, dependencies and candidate workflow bytes are unchanged. Hosted matrix results, public dormancy/readback and protected publication approval remain separate requirements. See DECISIONS.md and LEARNINGS.md.


## Registry lag copy retry, 2026-11-26

`scripts/copy-oci-layout.sh` replaces the single `oras cp` in `publish-console-artifact.sh`, before the visibility wait: at most 6 attempts, 10 s apart, each under 120 s, repeated only for the GHCR read-after-write 404. `copy-oci-layout_test.py` runs the pinned ORAS 1.3.4 against a loopback registry that lags (retried, tag points at the layout root) or denies pushes (1 attempt); the pinned-tools step now installs ORAS and runs it. The stable order contract now follows the script and rejects any inline `oras cp`. All 6 publication contract suites and the new test pass; actionlint was unavailable. See DECISIONS.md.
