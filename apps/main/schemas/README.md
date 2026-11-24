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

Module catalogue quick filters use additive contract changes from public Control
Plane commit `afaf973352a9ac240e79688f35751147de7f8717`. Its full `openapi/spec.yaml`
has SHA-256 `2206a8c312106fc5b0471f6b71271b0b0c36d904200504c7f46a10b81b010b38`.
The curated additions are optional `has_proposed` and `default_verified` fields
on `ModuleCatalogueEntry`, returned only by listing with `module.version.read`.
They summarize all versions and the current Default respectively. The existing
verification model only supports `unverified`, so Default verified currently
matches no modules. This is immutable public source provenance; matching server
artifacts are qualified separately before release.

Deployment and pipeline browser contracts use these immutable public sources:

- Control Plane: [`6b133551f03fe48130b8bf9974f77b19c614271c`](https://raw.githubusercontent.com/stellwerk-labs/platform-orchestrator-cp/6b133551f03fe48130b8bf9974f77b19c614271c/openapi/spec.yaml),
  Git blob `66865d77542d16373e26ac10b2e5c92a7b9323b4`, full `openapi/spec.yaml`
  SHA-256 `b720ffe7154012200f52c3b509baaa51ff67ac57140a0dabbd5e9b41d9b649b8`.
  The curated slice covers Runner registration/read/update and their 42-schema
  closure, plus the retained-outcome acknowledgement operation. The latter's
  descriptions include ordinary retained ownership as well as plugin work.
- Data Plane: [`e31b51422403c7b1aee3ee033bb645a304009b94`](https://raw.githubusercontent.com/stellwerk-labs/platform-orchestrator-dp/e31b51422403c7b1aee3ee033bb645a304009b94/openapi/spec.yaml),
  Git blob `5d3a805e0b742fda21026e5af9cee7aa532696ab`, full `openapi/spec.yaml`
  SHA-256 `43a4ad79fc8e1ad2f8dcc8410c3eb6e884f829325f9c18abecfcc5e55885dfef`.
  The refreshed curated slice covers deployment listing (bounded pagination,
  search and quick filters), optional pipeline summary and creation selection,
  the existing log endpoint and `managed_logs` creation field. Other operations
  and schemas remain curated; Runner result callbacks are not refreshed by this
  browser-source update. The existing browser-specific log-recipient description
  retains its explicit explanation of `managed_logs`.
- Pipeline authoring: [`openapi/pipelines.yaml` at the same public Control Plane revision](https://raw.githubusercontent.com/stellwerk-labs/platform-orchestrator-cp/6b133551f03fe48130b8bf9974f77b19c614271c/openapi/pipelines.yaml),
  Git blob `a1feed1bfd33786b129654954acd3c41a3bd6b9e`,
  SHA-256 `629867b8e7b1f20080ef6de9ecb003755846b4add3bf4c00d5f98569ea76299f`.
  `pipelines.yml` is the exact complete file at this revision. Its bytes already
  matched before this provenance update.

These sources were fetched anonymously from the immutable public URLs and checked
against the Git blobs and SHA-256 values above. This proves source availability,
not a released image or matching installed server version. Historical sources for
unrelated curated entries above remain applicable.

`runner-source.json` records the exact selected Runner schemas and semantic hash.
All 42 are unchanged by this source refresh, so `changed_schemas` is empty. Its
`curated_nonselected_unchanged` flag is false because the acknowledgement operation's
descriptions also change. Native inventory remains optional in disabled READ
responses, with explicit null permitted in native PATCH. Enabled Create retains
Core's authoritative inventory and protocol/capability business requirements.

The existing bounded handwritten `deploymentPipelineApi.ts`, phase-log reader
and `pipelineDocumentApi.ts` remain in use. Their pipeline execution, control,
saved-plan, central-log and document operations were compared with these public
contracts. Saved-plan action callers consume only the returned ID; they do not
require a full Deployment response. The legacy `planLogsApi.ts` Runner-rollout
`/plan-logs` route is not described by this public OpenAPI and remains unchanged;
this source comparison does not qualify that route. Decrypted log contents remain
outside the query cache. Editor completion continues to use the runtime
`/orgs/{org}/projects/{project}/pipelines/schema` endpoint.

Use the existing pinned Orval 8.43.0 and normal formatter through
`pnpm run orval --clean`, followed by `pnpm run generate:runner-schema`. Source
preparation alone does not establish successful generation or client qualification.
