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
no published upstream fix. Its remaining dependency path is the existing
development-only jscpd duplication check, using the repository's checked-in
patterns. It is not shipped in the browser bundle.

On 22 October 2026 the maintainer accepted this finding only for that build-time
use of trusted patterns. Keep the advisory and the audit's nonzero result
visible. This is not a patched-package claim or a blanket audit bypass, and does
not cover new untrusted patterns or other dependencies. Reassess if the inputs
or trust boundary change. The existing duplication gate and threshold remain
enabled. jscpd 5 was not adopted because its Linux native dependency graph also
contains a known certificate-verification issue.
