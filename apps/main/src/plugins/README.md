# Console plugin UI host

The Console discovers organization-scoped UI contributions from
`GET /orgs/{orgId}/plugins`. It renders a visible contribution at the descriptor's
`route_prefix` in a sandboxed, different-origin iframe. The host protocol is UI
SDK version `1` at contract level `v1alpha`, supported for first-party plugins.

Discovery refreshes every 30 seconds while the Console is visible. Core's
non-secret entitlement projection supplies development-licence warnings and
restricted-access notices in the host, outside the plugin frame. While a licence
is in its grace period, Core's `entitlement.warning` is shown as a banner with
its `message` and `grace_until`; the plugin stays usable. The host reads the
warning through `entitlementWarning()`, which ignores a malformed warning
instead of rejecting the descriptor, so a warning can never hide a plugin. The Console
does not calculate expiry, verify signatures or grant access. Every operation
still goes through current server authorization; renewing a licence never
restarts paused work. Generic display contracts live in `types.ts` alongside
the existing host protocol, not in plugin-specific domain code.

## Trust boundary

The child never receives the user's session or any other credential. After an
exact source/origin/nonce handshake, the host transfers a dedicated
`MessagePort`. The child can request only an operation ID advertised in the
discovery descriptor.

The session cookie belongs to IAM, not to the Console: IAM sets it with
`Domain=` the API hostname, so browsers send it to the API hostname and to every
subdomain of it, on any port. A plugin UI origin must therefore lie outside that
scope, and outside the API's CORS policy, which answers its allowed origins with
credentials; otherwise plugin JavaScript could call the API as the user. The
Console refuses a UI origin on its own hostname, on any port, because cookies
are scoped by hostname rather than origin. The Helm chart refuses a
`console.gatewayApi.route.pluginUiOrigins` entry that is not an exact HTTPS
origin, that uses the Console hostname, the API hostname or a subdomain of it,
or that an entry of `global.gatewayApi.backend.cors.allowOrigins` matches; list
the exact Console origins there before adding plugin UIs. Serve plugin UIs from
a registrable domain of their own, so they cannot set cookies for a parent
domain they would share with the Console or the API either.

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

`core.getModuleVersionUsage` is a read-only dependency for plugins that need
current Module adoption. It accepts exactly `moduleId` and `moduleVersionId`
identifiers, encodes them as path segments, and uses the existing generated Core
client under the active Console organization. It accepts no query, body or
organization override. Advertising this operation does not grant Module read
permission: Core still authorizes the current user independently. Read failures
remain failures, not empty usage results.

Protected Deployment logs and outputs use two additional closed operations,
`core.getPluginDeploymentLogs` and `core.getPluginDeploymentOutputs`. The child
supplies only immutable Project, Environment, and Deployment UUIDs. The host
calls the fixed user-authenticated Core material route for the current
organization and plugin; Core verifies the immutable receipt relationship and
current ordinary access, including after Environment deletion. Logs render in a Console-owned modal;
outputs download from a short-lived host-only blob URL. The child receives only
a `204` completion or an error, never plaintext, a key, a bearer credential, or
a blob URL. Material over 16 MiB fails closed in the host as well as Core.

The host retries its HELLO message for at most five seconds with the same fresh
nonce. This closes the iframe-load/listener-registration race without accepting a
stale READY or creating more than one channel.

## Contextual actions

A plugin can contribute a declarative Module Version action through
`ui.contextual_actions`. The host accepts only `resource_type: module_version`, a
plugin-relative path, and query values selected from `$module_id`,
`$semantic_version`, or `$version_uuid`. It resolves the path beneath the
descriptor's registered `route_prefix`; descriptors cannot supply an origin,
absolute route, arbitrary URL, or literal query value.

The contribution names a `required_operation_id` from the plugin-owned operation
registry. It is visible only while that operation is advertised, the plugin is
available in `full` mode, the iframe descriptor remains valid, and the declared
Module Version lifecycle and semantic-version conditions match. The link does not
invoke the operation. It opens the plugin UI, whose eventual operation request is
still checked by the normal bridge and server authorization path.

## Local verification

```sh
pnpm --filter main-app check-typescript
VITE_BASE_URL=http://example.com pnpm --filter main-app exec vitest run src/plugins --silent
pnpm exec eslint --max-warnings=0 apps/main/src/plugins
```

`PluginFrame.test.tsx` plays the plugin frame in jsdom, which cannot load a
cross-origin document: it reads what the host posts to the frame window,
dispatches window messages with an explicit source and origin, and talks over
the real `MessagePort` the host transfers. Core answers come from MSW at
`VITE_BASE_URL`. Only a real browser with two origins proves the CSP, cookie
and frame isolation itself.
