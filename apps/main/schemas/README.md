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

Provider retirement entries use the signed local Control Plane contract commit
`92d87c7ea7b1123c522c474387ee2bf0e94ffc07`, full spec SHA-256
`d622638c9aaa6baaf3b9648cbba3f3518f1738e6d20583f804c69c0f1421db7c`. Only Provider status and deletion
responses were imported into the curated schema. This source is unpublished;
its public availability and matching server behavior must be qualified before a
Console release. Internal retirement proof endpoints are excluded.
