# Pagination Debt Tracking

This document tracks all `useList*` hooks from `@src/hooks/react-query/v2` that potentially need pagination support.

## Controlplane (CP)

| Function                                   | File                                 | Not used? | Fixed? |
| ------------------------------------------ | ------------------------------------ | --------- | ------ |
| `useListInternalOrganizations`             | organizations/organizations.ts       | [x]       | [ ]    |
| `useListModuleProviders`                   | providers/providers.ts               | [ ]       | [x]    |
| `useListEnvironmentTypes`                  | environment-type/environment-type.ts | [ ]       | [x]    |
| `useListModuleRulesInOrg`                  | rules/rules.ts                       | [ ]       | [x]    |
| `useListProjects`                          | project/project.ts                   | [ ]       | [x]    |
| `useListInternalEnvironmentsByProjectUuid` | environment/environment.ts           | [x]       | [ ]    |
| `useListEnvironments`                      | environment/environment.ts           | [ ]       | [x]    |
| `useListEnvironmentsInOrg`                 | environment/environment.ts           | [x]       | [ ]    |
| `useListAvailableResourceTypes`            | resource-type/resource-type.ts       | [ ]       | [x]    |
| `useListResourceTypes`                     | resource-type/resource-type.ts       | [ ]       | [x]    |
| `useListSandboxes`                         | sandboxes/sandboxes.ts               | [ ]       | [x]    |
| `useListModules`                           | modules/modules.ts                   | [ ]       | [x]    |
| `useListModuleVersions`                    | modules/modules.ts                   | [x]       | [ ]    |
| `useListRunners`                           | runner/runner.ts                     | [ ]       | [x]    |
| `useListRunnerRulesInOrg`                  | runner/runner.ts                     | [ ]       | [x]    |

## Dataplane (DP)

| Function                     | File                               | Not used? | Fixed? |
| ---------------------------- | ---------------------------------- | --------- | ------ |
| `useListDeployments`         | deployment/deployment.ts           | [ ]       | [x]    |
| `useListLastDeployments`     | deployment/deployment.ts           | [x]       | [ ]    |
| `useListMetadataKeys`        | metadata-key/metadata-key.ts       | [x]       | [ ]    |
| `useListActiveResourceNodes` | active-resource/active-resource.ts | [ ]       | [x]    |

## IAM

| Function                   | File                         | Not used? | Fixed? |
| -------------------------- | ---------------------------- | --------- | ------ |
| `useListUserMemberships`   | membership/membership.ts     | [x]       | [ ]    |
| `useListOrgMemberships`    | membership/membership.ts     | [ ]       | [x]    |
| `useListInvitations`       | invitation/invitation.ts     | [ ]       | [x]    |
| `useListUserSessionTokens` | user/user.ts                 | [ ]       | [x]    |
| `useListServiceUsers`      | service-user/service-user.ts | [ ]       | [x]    |
| `useListEnvironmentUsers`  | environment/environment.ts   | [ ]       | [x]    |
| `useListRoles`             | role/role.ts                 | [ ]       | [x]    |
| `useListProjectUsers`      | project/project.ts           | [ ]       | [x]    |

## Summary

**Total: 27 unique `useList*` functions** (15 CP, 4 DP, 8 IAM)

---

## Candidates for Server-Side Pagination

These hooks display data in tables/lists where we don't need all values upfront and don't do client-side filtering. They could benefit from implementing proper server-side pagination in the UI.

| Hook                                       | Service | Reason                                                    | Not used? | Fixed? |
| ------------------------------------------ | ------- | --------------------------------------------------------- | --------- | ------ |
| `useListModuleRulesInOrg`                  | CP      | Rules table could grow large in complex orgs              | [ ]       | [ ]    |
| `useListInternalEnvironmentsByProjectUuid` | CP      | Projects can have many environments                       | [ ]       | [ ]    |
| `useListEnvironments`                      | CP      | Environment tables could benefit from pagination          | [ ]       | [ ]    |
| `useListEnvironmentsInOrg`                 | CP      | Org-level environment list can be large                   | [ ]       | [ ]    |
| `useListModuleVersions`                    | CP      | Module versions can be numerous per module                | [ ]       | [ ]    |
| `useListDeployments`                       | DP      | Deployments grow continuously over time                   | [ ]       | [ ]    |
| `useListLastDeployments`                   | DP      | Recent deployments subset; still benefits from pagination | [ ]       | [ ]    |
| `useListActiveResourceNodes`               | DP      | Complex environments can have many resource nodes         | [ ]       | [ ]    |
| `useListUserSessionTokens`                 | IAM     | User sessions could grow over time                        | [ ]       | [ ]    |

---

## Needs All Pages (useAllPages)

These hooks require fetching all data upfront because they're used in dropdowns/selects, client-side filtering/search, or validation/lookup scenarios.

| Hook                            | Service | Reason                                                   | Not used? | Fixed? |
| ------------------------------- | ------- | -------------------------------------------------------- | --------- | ------ |
| `useListInternalOrganizations`  | CP      | Internal/system hook for org management                  | [ ]       | [ ]    |
| `useListModuleProviders`        | CP      | Client-side filtering in providers table                 | [ ]       | [ ]    |
| `useListEnvironmentTypes`       | CP      | Used in selects; limited config data per org             | [ ]       | [ ]    |
| `useListProjects`               | CP      | Used for redirect logic and existence checks             | [ ]       | [ ]    |
| `useListAvailableResourceTypes` | CP      | Dropdown/selection use case                              | [ ]       | [ ]    |
| `useListResourceTypes`          | CP      | Client-side filtering and search                         | [ ]       | [ ]    |
| `useListSandboxes`              | CP      | Check existence and fetch first; small dataset           | [ ]       | [ ]    |
| `useListModules`                | CP      | Client-side search/filter on ID and resource_type        | [ ]       | [ ]    |
| `useListRunners`                | CP      | Client-side search in runners table                      | [ ]       | [ ]    |
| `useListRunnerRulesInOrg`       | CP      | Client-side filtering by project/env-type                | [ ]       | [ ]    |
| `useListMetadataKeys`           | DP      | Limited config data; likely used in dropdowns            | [ ]       | [ ]    |
| `useListUserMemberships`        | IAM     | Per-user memberships; small dataset                      | [ ]       | [ ]    |
| `useListOrgMemberships`         | IAM     | Already uses `useAllPages()`; mixed with invitations     | [ ]       | [ ]    |
| `useListInvitations`            | IAM     | Mixed with memberships in OrgMembers table               | [ ]       | [ ]    |
| `useListServiceUsers`           | IAM     | Needs all data for role assignment dropdowns             | [ ]       | [ ]    |
| `useListEnvironmentUsers`       | IAM     | Role-based access display; small per environment         | [ ]       | [ ]    |
| `useListRoles`                  | IAM     | Already uses `useAllPages()`; used in multiple dropdowns | [ ]       | [ ]    |
| `useListProjectUsers`           | IAM     | Project-level access control                             | [ ]       | [ ]    |

---

## Notes

- These hooks are imported from `@src/hooks/react-query/v2/(controlplane|dataplane|iam)/`
- Currently the frontend only queries the first page without taking advantage of pagination
- Use `useAllPages` from `@src/hooks/useFetchAllPages.ts` to fetch all pages when needed
- Some hooks like `useListRoles` and `useListOrgMemberships` already use the `useAllPages()` pattern
