import { describe, expect, it } from 'vitest';

import { SubjectType, UserMembershipRequest } from '@src/models/v2/iam';

import { deduplicateMemberships, parseScope, toScope } from './memberships';

describe('removeDuplicates', () => {
  it('should remove duplicate memberships', () => {
    const memberships: UserMembershipRequest[] = [
      {
        subject_type: SubjectType.role,
        subject: 'role1',
        scope: 'app:myapp',
      },
      {
        subject_type: SubjectType.role,
        subject: 'role2',
        scope: 'env:production',
      },
      {
        subject_type: SubjectType.role,
        subject: 'role1',
        scope: 'app:myapp',
      },
    ];

    const result = deduplicateMemberships(memberships);

    expect(result).toHaveLength(2);
    expect(result).toEqual([
      {
        subject_type: SubjectType.role,
        subject: 'role1',
        scope: 'app:myapp',
      },
      {
        subject_type: SubjectType.role,
        subject: 'role2',
        scope: 'env:production',
      },
    ]);
  });
});

describe('toScope', () => {
  it('should create role scope correctly', () => {
    expect(toScope('xyz', undefined)).toEqual('project:xyz');

    expect(toScope('xyz', 'abc')).toEqual('env:abc');
  });
});

describe('parseScope', () => {
  it('should parse scope correctly', () => {
    expect(parseScope('project:xyz')).toEqual({ type: 'project', id: 'xyz' });
    expect(parseScope('env:xyz')).toEqual({ type: 'env', id: 'xyz' });
  });
});
