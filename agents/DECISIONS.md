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


## Candidate browser test bootstrap

Add the controls and phase-logs browser matrix to the reusable test workflow. During the main-only bootstrap, run that added matrix on workflow_dispatch, using the exact candidate SHA, while retaining the existing main and pull-request unit/E2E jobs. The full feature source keeps the matrix unconditional; landing that source replaces the temporary bootstrap condition. Existing publication dormancy, review and source-identity controls remain unchanged.
