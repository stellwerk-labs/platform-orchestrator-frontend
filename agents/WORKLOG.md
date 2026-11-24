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

## Native pipeline source export

Prepared the Native pipeline application source export. Public artifact publication and hosted qualification are separate release steps.

## 2026-11-24: Pipeline runtime flag

Added the existing pipeline feature flag to normal runtime environment injection. The existing release contracts now exercise actual startup generation with the flag enabled, disabled and unset; the image smoke checks the served flag.
All 11 release contracts and shell checks passed, followed by independent source reviews. Actual image smoke qualification and public publication remain separate steps.

## 2026-11-24: Console image readiness

The image smoke now retries an initial HTTP remote disconnect within its existing bounded readiness loop. Real startup observation reproduced the disconnect followed by a successful response; runtime files and all feature/configuration, SPA, asset and notice assertions are unchanged. The whole corrected image smoke, all 11 release contracts, shell checks and diff checks passed.
