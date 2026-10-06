# Console plugin UI host

The Console discovers organization-scoped UI contributions from
`GET /orgs/{orgId}/plugins`. It renders a visible contribution at the descriptor's
`route_prefix` in a sandboxed, different-origin iframe. The host protocol is UI
SDK version `1` at contract level `v1alpha`, supported for first-party plugins.

## Trust boundary

The child never receives the Console access token. After an exact
source/origin/nonce handshake, the host transfers a dedicated `MessagePort`. The
child can request only an operation ID advertised in the discovery descriptor.
The registered UI must also use a different hostname, not merely a different
port, because cookies are scoped by hostname rather than origin. Console session
cookies must be host-only. Production operators should prefer unrelated
registrable domains for Console and plugin assets so a parent-domain cookie
cannot cross the iframe boundary.
The host validates the SDK version, nonce, organization, operation registry,
structured parameters, and idempotency requirement before posting this fixed
envelope to Core:

```text
POST /orgs/{orgId}/plugins/{pluginId}/invoke
```

Core maps the operation ID to a fixed method and path template, reauthorizes the
session on every call, and owns availability and safety policy. The host does not
accept child-supplied URLs or methods.

Navigation messages are limited to the registered plugin mount or a path beneath
the active organization. They do not invoke APIs.

Reserved `core.*` and `iam.*` operation IDs are declared separately in
`ui.core_operations`; they are never accepted in the plugin operation list or
sent to the plugin invoke endpoint. A closed Console dispatcher maps only named
Core and IAM dependencies to existing authenticated clients, validates every
path/query/body shape, and returns the response over the same channel. Discovery
must advertise the exact operation before the child can call it. Unknown reserved
IDs fail closed. IAM checks accept only a single hyphenated capability in the
current installation's exact `plugin.<plugin-id>.*` namespace or a closed Core
permission. Scoped resources first verify Project and Environment UUID membership
through bounded, short-lived, organization-scoped Core inventory. The Pin mutation is
`core.discardEnvironmentModuleVersionPin`; the dispatcher hardcodes `discard`,
requires idempotency, and never exposes generic Pin actions.

The host retries its HELLO message for at most five seconds with the same fresh
nonce. This closes the iframe-load/listener-registration race without accepting a
stale READY or creating more than one channel.

## Local verification

```sh
pnpm --filter main-app check-typescript
pnpm --filter main-app exec vitest run \
  src/plugins/pluginValidation.test.ts \
  src/plugins/pluginInvocation.test.ts --silent
pnpm exec eslint --max-warnings=0 apps/main/src/plugins
```
