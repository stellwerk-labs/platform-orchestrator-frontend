import {
  getGetProjectMockHandler,
  getListProjectsMockHandler,
} from '@src/hooks/react-query/v2/controlplane/project/project.msw';
import { getListSandboxesMockHandler } from '@src/hooks/react-query/v2/controlplane/sandboxes/sandboxes.msw';
import {
  getGetCurrentUserMockHandler,
  getGetCurrentUserResponseMock,
} from '@src/hooks/react-query/v2/iam/user/user.msw';
import { Project } from '@src/models/v2/controlplane';

import { test } from '../testFixtures';

test.describe('Project list', () => {
  test('should redirect to correct URL when clicking on project', async ({ page, network }) => {
    const project: Project = {
      id: 'project-1',
      display_name: 'Project 1',
      updated_at: '',
      created_at: '',
      status: 'active',
      uuid: '',
    };
    network.use(
      getGetCurrentUserMockHandler({
        ...getGetCurrentUserResponseMock(),
        dismissed_prompts: ['welcome-page'],
      }),
      getListProjectsMockHandler({
        items: [project],
      }),
      getGetProjectMockHandler(project),
      getListSandboxesMockHandler({ items: [] }),
    );

    await page.goto('/');

    await page.getByRole('link', { name: 'Project 1' }).click();

    await test.expect(page).toHaveURL(/.*\/orgs\/([^/]+)\/projects\/project-1\/envs$/);
  });
});
