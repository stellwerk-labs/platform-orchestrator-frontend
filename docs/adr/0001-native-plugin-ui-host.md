# ADR 0001: Host native plugin UIs across an origin boundary

- Status: accepted, contract level `v1alpha` for first-party plugins
- Date: 2026-09-28

## Context

The OSS Console needs stable extension points while Enterprise features remain
separately built and delivered. Loading arbitrary partner JavaScript into the
Console origin would give it the Core token, DOM, storage, and ambient authority.
A plugin must retain the existing authenticated UX without receiving that
authority.

## Decision

Core returns organization-scoped plugin descriptors and an exact operation
registry. The Console validates the descriptor and mounts its entrypoint in a
sandboxed iframe whose registered HTTPS origin must use a different hostname
from the Console. The user's session cookie is IAM's, set with `Domain=` the API
hostname, so the API hostname and all its subdomains receive it. Plugin UI
origins must lie outside that scope and outside the API's credentialed CORS
policy, so that plugin JavaScript reaches Core only through the host.

```text
Plugin iframe              OSS Console host                 Core gateway
     | READY(nonce) <--- HELLO(nonce)                           |
     | <==== scoped MessageChannel ====>                        |
     | operation ID + structured values                         |
     | -----------------------> | validate session/registry      |
     |                          | POST fixed invoke envelope --->|
     |                          |     auth + policy + mapping     |
     | <----------------------- | <------------------------------|
```

The handshake validates the exact frame window, registered origin, SDK version,
and fresh nonce. The host repeats HELLO for the same nonce during a bounded
five-second window because iframe load can precede the child's listener
registration; it accepts only the first matching READY and then stops retrying.
Port requests repeat the nonce and active organization. Mutation
bodies are JSON-snapshotted and require an idempotency key. Query values use
`Record<string, string[]>` so repeated keys survive. Core alone maps operation
IDs to methods, fixed templates, allowed query keys, parameter values, assertions,
and resource authorization.

## Consequences

- Plugin JavaScript cannot access the Console token, DOM, or storage.
- Core can hide or restrict operations for unavailable and safety-only modes.
- Theme, locale, route, and operation responses need an explicit versioned SDK.
- The Console CSP and the plugin's `frame-ancestors` policy must permit only the
  intended origin pair.
- Plugin UI origins must stay off the API hostname and its subdomains and out of
  the API's CORS allowlist, which the Helm chart enforces. A registrable domain
  of their own also keeps plugin UIs from setting cookies for a parent domain
  they would share with the Console or the API.
- Integrated testing requires both origins and a real discovery/invocation
  gateway; a same-origin component mock cannot prove this boundary.
