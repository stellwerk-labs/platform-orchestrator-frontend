import { getCheckPermissionsMockHandler } from '@src/hooks/react-query/v2/iam/user/user.msw';
import { ResourcePermissionCheck } from '@src/models/v2/iam';

/**
 * Answers every IAM permission check the page sends with `allowed(check)`, and
 * records the checks in `seen` so tests can assert the exact resource and permission.
 */
export const answerPermissionChecks = (
  allowed: (check: ResourcePermissionCheck) => boolean,
  seen?: ResourcePermissionCheck[],
) =>
  getCheckPermissionsMockHandler(async ({ request }) => {
    const checks = (await request.json()) as ResourcePermissionCheck[];
    seen?.push(...checks);
    return {
      items: checks.map((permission_check) => ({
        permission_check,
        allowed: allowed(permission_check),
      })),
    };
  });
