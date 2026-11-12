# API schema sources

The Console generates clients from curated Control Plane and Data Plane schemas
in this directory. They contain the operations the Console uses, not the complete
public APIs. Plugin workload and other non-Console operations are excluded.

New and changed Module/interface contracts come from the immutable source
revisions below. Unrelated curated entries retain the prior CP `fc805925` and
DP `cad9716c` inputs; this file does not claim a complete API mirror.

Module/interface source revisions:

- Control Plane: commit `1a2a812e48ac35a478398747b37cf90f6d536c07`, full source `openapi/spec.yaml` SHA-256 `cc9c8c3813be81bfa487fa8d8e38457c51cca8ef17f6eecf59d775ef89677875`.
- Data Plane: commit `eee2fb607084ce5eef994726a2c3b88082e85397`, full source `openapi/spec.yaml` SHA-256 `e2cb98ee7622a892a6cb20d67afeae70fc81e17cffd982757a227e3db24b38fa`.

These curated inputs retain the existing Console operations and add Draft authoring,
scoped immutable test capture/execution and exact Resource Type interfaces. Internal
runtime catalogue and admission operations are excluded. Verify the coordinated
server source is publicly available before publishing the Console.

To update these inputs, compare the Console operations and referenced schemas
with the pinned public specs. Copy the updated contract fields and metadata into
the existing schemas, preserving the Console's operation subset. Run
`pnpm run orval --clean` from the repository root and review all generated changes.
These revisions record API provenance, not a published image release.

Provider retirement entries use the public Control Plane contract commit
`935835a8efa36623f955294b48fadbaedb90436f`, full `openapi/spec.yaml` SHA-256
`d622638c9aaa6baaf3b9648cbba3f3518f1738e6d20583f804c69c0f1421db7c`.
Only Provider status and deletion responses were imported into the curated schema.
Internal retirement proof endpoints are excluded. The public source is available
at that immutable commit; matching server artifacts are qualified separately.

Installation settings and browser session requests use small handwritten clients
in `settingsApi.ts` and `SessionGuard.tsx`. Their contract sources are the actual
server routes and handlers at these public revisions:

- Control Plane `935835a8efa36623f955294b48fadbaedb90436f`,
  `internal/api/server.go` and `internal/api/installation_maintenance.go`, for
  `GET /platform-settings/maintenance-status` and installation readiness.
- Data Plane `79c303569075f9754eb0e767eca547ce62c65b13`,
  `internal/api/server.go` and `internal/api/installation_settings.go`, for
  `GET` and `PUT /platform-settings/deployments` (maintenance policy).
- IAM `2d402bf501ec4b8217ad3ad10833a1b8658bea36`,
  `internal/api/server.go`, `internal/api/browser_sessions.go` and
  `internal/api/installation_settings.go`, for session policy, browser session
  inspection and genuine activity reporting.

These installation operations are not part of the generated OpenAPI subset.
The unchanged public IAM `openapi/spec.yaml` has SHA-256
`703e941a255dc57a6639abbdf434e4bcbb3b389dd3639b912b2917717ff77512`;
it is not the definition of these handwritten installation routes. Public source
availability does not establish a released or installed matching server version.

Module catalogue quick filters currently include local additive contract changes
from Control Plane worktree `platform-orchestrator-cp-release-pilot-20261112`,
branch `fix/modules-and-database-tls-20261112`, based on
`2ab7c3482d96882bf09b4fe4295a0cdbb7ac9d8f`. Its modified `openapi/spec.yaml`
has SHA-256 `2206a8c312106fc5b0471f6b71271b0b0c36d904200504c7f46a10b81b010b38`.
This identifies an unpublished local producer, not a public commit or release.
The curated additions are optional `has_proposed` and `default_verified` fields
on `ModuleCatalogueEntry`, returned only by listing with `module.version.read`.
They summarize all versions and the current Default respectively. The existing
verification model only supports `unverified`, so Default verified currently
matches no modules. Replace this local provenance with an immutable public
producer revision before publishing the Console.
