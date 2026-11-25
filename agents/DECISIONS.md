# Decisions


## 2026-11-12: Console maintenance state and catalogue filters

- Preserve existing permissions, confirmation and default behavior. PostgreSQL TLS is opt-in through `DATABASE_SSLMODE`; use existing driver and certificate mechanisms.
- Catalogue filters use complete optional summaries, omit version data for core-only readers, and keep unavailable distinct from false. Verification remains unimplemented; its filter is intentionally present with an explicit limitation.

## 2026-11-13: Infracost Administration

Use a write-only password field plus presence-only readback. Omitted key preserves; explicit removal requires estimates off. Enablement is captured for new executions; key rotation affects fresh dispatches.


## Managed deployment logs, 2026-11-13

Use automatic native-cookie log reads with dedicated org/environment deployment_logs_read, preserving explicitlegacyclientmode only inCLI. No browser keyinput/cache/replay; managedplaintextqueryneverfallsbacktociphertext.


## Logs toolbar layout, 2026-11-13

Use an optional shared viewer toolbar render slot to arrange its existing raw toggle on the native page, keeping plugin viewer layout and raw state unchanged.

## Native pipeline source export

Prepare Native pipeline application changes as a source export with all product code, tests, documentation and release controls retained.

## Console image startup readiness

Treat an initial remote disconnect as a transient only while waiting for HTTP startup. Keep the existing retry count, request timeout and all semantic image assertions. This test-only correction requires no runtime image rebuild.

## 2026-11-25: Pipeline RC documentation

Mark Deployment Pipelines as an RC feature, separate from the current stable release.
Preserve direct Apply as the built-in default; publishing a recipe alone changes no default.
This documentation correction changes no runtime, schema, dependency or RC version
and does not invalidate the existing functional qualification.


## 2026-11-25: Providers search browser contract

Use the existing accessible name for the Providers search field in its browser regression. Preserve provider fixtures and verify description-aware matches, narrowing to a provider type and clearing search; application behavior is unchanged.
