import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '@src/testing-utils/mswServer';

import { invokeBridgeOperation } from './hostOperationInvocation';
import type { PluginInvocationRequest, PluginOperationDescriptor } from './types';

const userId = '11111111-1111-4111-8111-111111111111';
const member = {
  id: 'private-membership-id',
  user_id: userId,
  user_display_name: 'Ada Admin',
  user_primary_email_address: 'ada@example.com',
  subject_type: 'role',
  subject: 'private-role',
  identity_providers: ['private-provider'],
};
const operation: PluginOperationDescriptor = { id: 'iam.getActor', method: 'GET', mutating: false };
const request: PluginInvocationRequest = {
  operation_id: operation.id,
  path_parameters: { userId },
};
const lookup = (orgId = 'current-org', input = request) =>
  invokeBridgeOperation(orgId, 'dev.stellwerk.drift', operation, input);
const memberUrl = 'http://example.com/orgs/:orgId/members';

beforeEach(() => {
  server.use(
    http.post(
      'http://example.com/auth/check-permissions',
      () => new HttpResponse(null, { status: 403 }),
    ),
  );
});

describe('current-organization actor lookup', () => {
  it('uses the exact IAM user filter and returns only the matching minimal identity', async () => {
    server.use(
      http.get(memberUrl, ({ request: outgoing, params }) => {
        expect(params.orgId).toBe('current-org');
        expect([...new URL(outgoing.url).searchParams.entries()].sort()).toEqual([
          ['per_page', '1'],
          ['userId', userId],
        ]);
        // Multiple memberships of this same user need no additional identity reads.
        return HttpResponse.json({ items: [member], next_page_token: 'more-memberships' });
      }),
    );
    await expect(lookup()).resolves.toEqual({
      status: 200,
      body: {
        actor: { user_id: userId, display_name: 'Ada Admin', primary_email: 'ada@example.com' },
      },
    });
  });

  it('returns an explicit unavailable actor for a removed or absent current-org member', async () => {
    server.use(http.get(memberUrl, () => HttpResponse.json({ items: [] })));
    await expect(lookup()).resolves.toEqual({ status: 200, body: { actor: null } });
  });

  it('keeps identities scoped to each host organization and omits absent email', async () => {
    server.use(
      http.get(memberUrl, ({ params }) =>
        HttpResponse.json({
          items: [{ user_id: userId, user_display_name: `Member in ${params.orgId}` }],
        }),
      ),
    );
    for (const orgId of ['first-org', 'second-org']) {
      await expect(lookup(orgId)).resolves.toEqual({
        status: 200,
        body: { actor: { user_id: userId, display_name: `Member in ${orgId}` } },
      });
    }
  });

  it('refuses mismatched, ambiguous or malformed IAM identities', async () => {
    for (const page of [
      { items: [{ ...member, user_id: '22222222-2222-4222-8222-222222222222' }] },
      { items: [member, member] },
      { items: [null] },
      { items: [{ ...member, user_display_name: 7 }] },
      { items: [{ ...member, user_primary_email_address: {} }] },
      { items: null },
      {},
    ]) {
      server.use(http.get(memberUrl, () => HttpResponse.json(page)));
      await expect(lookup()).rejects.toThrow('Actor details are unavailable or access was denied.');
    }
  });
});

it('returns the actual member detail route only with both current-org read permissions', async () => {
  server.use(
    http.get(memberUrl, () => HttpResponse.json({ items: [member] })),
    http.post('http://example.com/auth/check-permissions', async ({ request: outgoing }) => {
      const checks = (await outgoing.json()) as { resource: string; permission: string }[];
      expect(checks).toEqual([
        { resource: 'organization:current-org', permission: 'membership_read' },
        { resource: 'organization:current-org', permission: 'role_read' },
      ]);
      return HttpResponse.json({
        items: checks.map((permission_check) => ({ permission_check, allowed: true })),
      });
    }),
  );
  await expect(lookup()).resolves.toEqual({
    status: 200,
    body: {
      actor: {
        user_id: userId,
        display_name: 'Ada Admin',
        primary_email: 'ada@example.com',
        detail_route: `/members/${userId}`,
      },
    },
  });
});

it('keeps the identity but omits navigation for denied, unrelated, malformed or unavailable permission checks', async () => {
  server.use(http.get(memberUrl, () => HttpResponse.json({ items: [member] })));
  for (const items of [
    [
      {
        permission_check: { resource: 'organization:current-org', permission: 'membership_read' },
        allowed: true,
      },
      {
        permission_check: { resource: 'organization:current-org', permission: 'role_read' },
        allowed: false,
      },
    ],
    [
      {
        permission_check: { resource: 'organization:other-org', permission: 'membership_read' },
        allowed: true,
      },
      {
        permission_check: { resource: 'organization:other-org', permission: 'role_read' },
        allowed: true,
      },
    ],
    [
      {
        permission_check: { resource: 'organization:current-org', permission: 'membership_read' },
        allowed: true,
      },
      {
        permission_check: { resource: 'organization:current-org', permission: 'membership_read' },
        allowed: true,
      },
    ],
    [],
    null,
  ]) {
    server.use(
      http.post('http://example.com/auth/check-permissions', () => HttpResponse.json({ items })),
    );
    const result = await lookup();
    expect(result.body).toEqual({
      actor: { user_id: userId, display_name: 'Ada Admin', primary_email: 'ada@example.com' },
    });
  }
  server.use(
    http.post(
      'http://example.com/auth/check-permissions',
      () => new HttpResponse(null, { status: 403 }),
    ),
  );
  expect((await lookup()).body).toEqual({
    actor: { user_id: userId, display_name: 'Ada Admin', primary_email: 'ada@example.com' },
  });
});

describe('actor lookup authorization', () => {
  it('reauthorizes after a successful read and keeps denied response details out of the bridge', async () => {
    let calls = 0;
    server.use(
      http.get(memberUrl, () => {
        calls++;
        return calls === 1
          ? HttpResponse.json({ items: [member] })
          : HttpResponse.json({ message: 'private revoked membership detail' }, { status: 403 });
      }),
    );
    await lookup();
    const denied = lookup();
    await expect(denied).rejects.toThrow('Actor details are unavailable or access was denied.');
    await expect(denied).rejects.not.toThrow('private revoked membership detail');
    expect(calls).toBe(2);
  });

  it('rejects organization injection and unsupported input before any IAM request', async () => {
    let calls = 0;
    server.use(
      http.get(memberUrl, () => {
        calls++;
        return HttpResponse.json({ items: [member] });
      }),
    );
    const invalidInputs: PluginInvocationRequest[] = [
      { ...request, path_parameters: { userId, orgId: 'other-org' } },
      { ...request, path_parameters: { userId: '../users' } },
      { ...request, path_parameters: {} },
      { ...request, query: { orgId: ['other-org'] } },
      { ...request, body: { user_id: userId, org_id: 'other-org' } },
      { ...request, idempotency_key: 'not-a-command' },
    ];
    for (const input of invalidInputs) {
      await expect(lookup('current-org', input)).rejects.toThrow(/Host operation/);
    }
    expect(calls).toBe(0);
  });

  it('requires the advertised read-only GET descriptor', async () => {
    for (const incompatible of [
      { ...operation, method: 'POST' as const },
      { ...operation, mutating: true },
    ]) {
      await expect(
        invokeBridgeOperation('current-org', 'dev.stellwerk.drift', incompatible, request),
      ).rejects.toThrow('The advertised host operation descriptor is incompatible.');
    }
  });
});
