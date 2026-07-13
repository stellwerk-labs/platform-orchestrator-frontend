import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { getListOrgMembershipsMockHandler } from '@src/hooks/react-query/v2/iam/membership/membership.msw';
import { getListRolesMockHandler } from '@src/hooks/react-query/v2/iam/role/role.msw';
import { getListServiceUsersMockHandler } from '@src/hooks/react-query/v2/iam/service-user/service-user.msw';
import { SubjectType, UserWithRole, UserWithRoleType } from '@src/models/v2/iam';
import { MockProviders } from '@src/testing-utils/MockProviders';
import { server } from '@src/testing-utils/mswServer';

import { AccessTable } from './AccessTable';

const mockUser: UserWithRole = {
  id: 'user-1',
  type: UserWithRoleType.user,
  subject_type: SubjectType.role,
  subject_id: 'role-1',
};

const mockServiceUser: UserWithRole = {
  id: 'service-user-1',
  type: UserWithRoleType['service-user'],
  subject_type: SubjectType.role,
  subject_id: 'role-2',
};

const mockUsers: UserWithRole[] = [mockUser, mockServiceUser];

const renderAccessTable = (props: Partial<Parameters<typeof AccessTable>[0]> = {}) => {
  return render(
    <MockProviders route={{ path: '/orgs/:orgId', url: '/orgs/my-org' }}>
      <AccessTable users={mockUsers} orgId={'my-org'} isLoading={false} {...props} />
    </MockProviders>,
  );
};

describe('AccessTable', () => {
  it('should render empty table with correct columns', async () => {
    server.use(
      getListOrgMembershipsMockHandler({ items: [] }),
      getListServiceUsersMockHandler({ items: [] }),
      getListRolesMockHandler({ items: [] }),
    );

    renderAccessTable();

    expect(await screen.findByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Email' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Type/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Role' })).toBeInTheDocument();
  });

  it('should display user names from memberships', async () => {
    server.use(
      getListOrgMembershipsMockHandler({
        items: [
          {
            id: 'membership-1',
            created_at: '2024-01-01T00:00:00Z',
            user_id: 'user-1',
            user_display_name: 'John Doe',
            user_primary_email_address: 'john@example.com',
            subject_type: SubjectType.role,
            subject: 'role-1',
          },
        ],
      }),
      getListServiceUsersMockHandler({ items: [] }),
      getListRolesMockHandler({ items: [] }),
    );

    renderAccessTable({ users: [mockUser] });

    expect(await screen.findByRole('link', { name: 'John Doe' })).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });

  it('should display service user names', async () => {
    server.use(
      getListOrgMembershipsMockHandler({ items: [] }),
      getListServiceUsersMockHandler({
        items: [
          {
            id: 'service-user-1',
            generated_at: '2024-01-01T00:00:00Z',
            generated_by: 'user-1',
            display_name: 'CI Bot',
            current_token_expires_at: '2025-01-01T00:00:00Z',
            roles: [],
          },
        ],
      }),
      getListRolesMockHandler({ items: [] }),
    );

    renderAccessTable({ users: [mockServiceUser] });

    expect(await screen.findByRole('link', { name: 'CI Bot' })).toBeInTheDocument();
  });

  it('should display correct tags for user type', async () => {
    server.use(
      getListOrgMembershipsMockHandler({
        items: [
          {
            id: 'membership-1',
            created_at: '2024-01-01T00:00:00Z',
            user_id: 'user-1',
            user_display_name: 'John Doe',
            subject_type: SubjectType.role,
            subject: 'role-1',
          },
        ],
      }),
      getListServiceUsersMockHandler({ items: [] }),
      getListRolesMockHandler({ items: [] }),
    );

    renderAccessTable({ users: [mockUser] });

    expect(await screen.findByText('User')).toBeInTheDocument();
    expect(screen.queryByText('Service User')).not.toBeInTheDocument();
  });

  it('should display correct tags for service user type', async () => {
    server.use(
      getListOrgMembershipsMockHandler({ items: [] }),
      getListServiceUsersMockHandler({
        items: [
          {
            id: 'service-user-1',
            generated_at: '2024-01-01T00:00:00Z',
            generated_by: 'user-1',
            display_name: 'CI Bot',
            current_token_expires_at: '2025-01-01T00:00:00Z',
            roles: [],
          },
        ],
      }),
      getListRolesMockHandler({ items: [] }),
    );

    renderAccessTable({ users: [mockServiceUser] });

    expect(screen.getByText('Service User')).toBeInTheDocument();
    expect(screen.queryByText('User')).not.toBeInTheDocument();
  });

  it('should display role names', async () => {
    server.use(
      getListOrgMembershipsMockHandler({
        items: [
          {
            id: 'membership-1',
            created_at: '2024-01-01T00:00:00Z',
            user_id: 'user-1',
            user_display_name: 'John Doe',
            subject_type: SubjectType.role,
            subject: 'role-1',
          },
        ],
      }),
      getListServiceUsersMockHandler({ items: [] }),
      getListRolesMockHandler({
        items: [
          {
            id: 'role-1',
            display_name: 'Admin',
            created_at: '2024-01-01T00:00:00Z',
            created_by: 'system',
            permissions: [],
          },
        ],
      }),
    );

    renderAccessTable({ users: [mockUser] });

    expect(await screen.findByText('Admin')).toBeInTheDocument();
  });

  it('should display dash when email is not available', async () => {
    server.use(
      getListOrgMembershipsMockHandler({
        items: [
          {
            id: 'membership-1',
            created_at: '2024-01-01T00:00:00Z',
            user_id: 'user-1',
            user_display_name: 'John Doe',
            user_primary_email_address: undefined,
            subject_type: SubjectType.role,
            subject: 'role-1',
          },
        ],
      }),
      getListServiceUsersMockHandler({ items: [] }),
      getListRolesMockHandler({ items: [] }),
    );

    renderAccessTable({ users: [mockUser] });

    await screen.findByRole('link', { name: 'John Doe' });
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThan(1);
    expect(within(rows[1]!).getByText('-')).toBeInTheDocument();
  });

  it('should link to correct membership details URL for users', async () => {
    server.use(
      getListOrgMembershipsMockHandler({
        items: [
          {
            id: 'membership-1',
            created_at: '2024-01-01T00:00:00Z',
            user_id: 'user-1',
            user_display_name: 'John Doe',
            subject_type: SubjectType.role,
            subject: 'role-1',
          },
        ],
      }),
      getListServiceUsersMockHandler({ items: [] }),
      getListRolesMockHandler({ items: [] }),
    );

    renderAccessTable({ users: [mockUser] });

    const link = await screen.findByRole('link', { name: 'John Doe' });
    expect(link).toHaveAttribute('href', '/orgs/my-org/members/user-1');
  });

  it('should link to correct service user details URL for service users', async () => {
    server.use(
      getListOrgMembershipsMockHandler({ items: [] }),
      getListServiceUsersMockHandler({
        items: [
          {
            id: 'service-user-1',
            generated_at: '2024-01-01T00:00:00Z',
            generated_by: 'user-1',
            display_name: 'CI Bot',
            current_token_expires_at: '2025-01-01T00:00:00Z',
            roles: [],
          },
        ],
      }),
      getListRolesMockHandler({ items: [] }),
    );

    renderAccessTable({ users: [mockServiceUser] });

    const link = await screen.findByRole('link', { name: 'CI Bot' });
    expect(link).toHaveAttribute('href', '/orgs/my-org/service-users/service-user-1');
  });

  it('should display empty state when no users', async () => {
    server.use(
      getListOrgMembershipsMockHandler({ items: [] }),
      getListServiceUsersMockHandler({ items: [] }),
      getListRolesMockHandler({ items: [] }),
    );

    renderAccessTable({ users: [] });

    expect(await screen.findByText('No users have access')).toBeInTheDocument();
  });

  it('should show loading state', async () => {
    server.use(
      getListOrgMembershipsMockHandler({ items: [] }),
      getListServiceUsersMockHandler({ items: [] }),
      getListRolesMockHandler({ items: [] }),
    );

    renderAccessTable({ isLoading: true });

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(document.querySelector('.ant-spin')).toBeInTheDocument();
  });
});
