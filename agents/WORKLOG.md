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

## 2026-11-25: Pipeline RC documentation

Prepared customer-facing RC availability and deployment-default guidance without
runtime, schema, dependency or version changes. Focused documentation checks cover
text, links, file hashes and applicable generator templates; the full functional
suite was not rerun because the qualified application code is unchanged.
See DECISIONS.md and LEARNINGS.md for scope and documentation maintenance guidance.


## 2026-11-25: Providers search browser contract

Aligned the existing Providers browser case with the accessible search control and broad search semantics. Retained its inputs, added a narrowing check with the expected provider source, and kept the clear-search check. No application, dependency or configuration change; focused browser verification and normal full hosted qualification are separate.


## 2026-11-25: Forward Console pipeline candidate

Prepared the rc2 README entry and new release note after the reviewed, signed Providers search regression update. The old rc1 note and application runtime remain unchanged. Normal hosted tests, reproducibility and original-public artifact verification remain required before distribution completion.


### CSS image URL validation

Corrected the CSS image URL delimiter and extended the existing image-scanning regression to both forms. Application code, dependencies, image construction and release identities are unchanged. The same regression fails with the old parser and passes with the correction. All 29 release-content tests and the complete retained two-platform payload check passed with the pinned secret scanner.

### Prepare Console RC3 metadata

Prepared the forward candidate header and README link for the reviewed embedded-image parser correction. Existing RC2 notes and product runtime, build inputs and dependencies are unchanged.
