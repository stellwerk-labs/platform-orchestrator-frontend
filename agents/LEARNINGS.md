# Learnings


## 2026-11-12: qualification boundaries

- A paginated first page cannot prove version absence. Complete catalogue summaries require version-read permission, not just catalogue read access.
- `require` prevents plaintext fallback but does not generally authenticate server identity. CA verification uses existing driver settings; a private-key mount needs its own restrictive permissions.

## 2026-11-13: Infracost Administration

Mutation errors retain only safe status/message metadata. Clear fields on success, error and Reload; unchanged query data may be structurally shared, so an effect alone is insufficient.


## Managed deployment logs, 2026-11-13

Formattedlogsareusefulonlywithcoherentkeycustody. ReuseexistingVaultTransitmodel fornormaldeployments instead of exposing agekeyhandlinginGUI. ScopedpermissionneedsorgORexactenvchecks, backendauthorizestheactualdeploymentenv.

IAM resource identity is `env:<uuid>`, not `environment:<uuid>`. Build permission fixtures from the actual server contract; mirrored invented prefixes can let client tests pass while scoped users are denied.
