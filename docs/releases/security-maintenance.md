# Console security maintenance

Unreleased. This maintenance branch is not yet an available release.

## Security changes

Updated Axios, React Router, YAML parsing, Orval, Vite, Vitest and affected
transitive dependencies to patched versions. Orval 8 generation keeps the
existing Axios transport, MSW handlers and request/response contracts.

The 48-hour minimum release age is now configured in pnpm-workspace.yaml, where
pnpm reads it. Supplemental licence evidence is refreshed for the actual icon
package, with the same verified upstream MIT notice.

## Compatibility and remaining checks

The build and tests use Node 22.23.3 and pnpm 10.17.0. Application routes,
permissions and Module Management behavior are unchanged. Unrelated feature-flag
and analytics SDK versions are kept at the reviewed baseline.

The lockfile still contains braces 3.0.3, which has the high-severity
[GHSA-vfj7-8cjw-p6xm](https://github.com/micromatch/braces/issues/84) advisory and
no published upstream fix. It is used by pattern-matching build tools; this is
not evidence of remote code execution in the deployed browser application.
Its exposure or replacement needs a separate disposition before security
qualification is complete. No blanket audit exception is included.
