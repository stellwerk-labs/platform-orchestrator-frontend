# Learnings


## 2026-11-12: qualification boundaries

- A paginated first page cannot prove version absence. Complete catalogue summaries require version-read permission, not just catalogue read access.
- `require` prevents plaintext fallback but does not generally authenticate server identity. CA verification uses existing driver settings; a private-key mount needs its own restrictive permissions.

## 2026-11-13: Infracost Administration

Mutation errors retain only safe status/message metadata. Clear fields on success, error and Reload; unchanged query data may be structurally shared, so an effect alone is insufficient.


## Managed deployment logs, 2026-11-13

Formattedlogsareusefulonlywithcoherentkeycustody. ReuseexistingVaultTransitmodel fornormaldeployments instead of exposing agekeyhandlinginGUI. ScopedpermissionneedsorgORexactenvchecks, backendauthorizestheactualdeploymentenv.

IAM resource identity is `env:<uuid>`, not `environment:<uuid>`. Build permission fixtures from the actual server contract; mirrored invented prefixes can let client tests pass while scoped users are denied.

## Native pipeline source export

Keep the released application source and its public SDK contracts aligned; preserve existing compatibility exports.

## HTTP startup probes

A published container port may accept and close an HTTP connection before the service is ready. Python can raise RemoteDisconnected directly rather than wrapping it in URLError, so bounded readiness probes must handle that observed transition explicitly.

## 2026-11-25: Pipeline RC documentation

Put availability guidance at feature entry points and keep operational limits explicit.
Customer guidance must avoid internal experiment history and private environment details.
For generated documentation, preserve notices in the source templates while retaining
dynamic schemas, examples and imports.
