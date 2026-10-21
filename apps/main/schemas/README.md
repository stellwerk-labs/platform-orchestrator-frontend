# API schema sources

The Console generates clients from curated Control Plane and Data Plane schemas
in this directory. They contain the operations the Console uses, not the complete
public APIs. Plugin workload and other non-Console operations are excluded.

Current source revisions:

- Control Plane: [`openapi/spec.yaml`](https://github.com/stellwerk-labs/platform-orchestrator-cp/blob/fc8059255bd16ff61b0e4d3db122efd34912d068/openapi/spec.yaml), SHA-256 `903b836a6acd02aa24aa0f9adb41093a65df7e1be8358d9f11baf1b2de906022`.
- Data Plane: [`openapi/spec.yaml`](https://github.com/stellwerk-labs/platform-orchestrator-dp/blob/cad9716c8d441826b5fcb6b3715c32c153d86284/openapi/spec.yaml), SHA-256 `410482810079b527428180a468ac943f98f1ca86368c8032d5eddc85791381ec`.

To update these inputs, compare the Console operations and referenced schemas
with the pinned public specs. Copy the updated contract fields and metadata into
the existing schemas, preserving the Console's operation subset. Run
`pnpm run orval` from the repository root and review all generated changes.
These revisions record API provenance, not a published image release.
