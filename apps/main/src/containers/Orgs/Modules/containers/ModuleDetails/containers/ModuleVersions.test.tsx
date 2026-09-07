import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { CoreModuleVersion, ModuleVersionComparison } from '@src/models/v2/controlplane';

import {
  ComparisonList,
  formatComparisonItems,
  formatComparisonValue,
  moduleVersionComparisonDetails,
  moduleVersionLifecycleActions,
  stableSuccessorSemanticVersion,
} from './ModuleVersions';

const version = (
  lifecycle_status: CoreModuleVersion['lifecycle_status'],
  semantic_version = '1.2.0',
) =>
  ({
    lifecycle_status,
    semantic_version,
    uuid: '00000000-0000-0000-0000-000000000001',
  }) as CoreModuleVersion;

describe('Module Version lifecycle actions', () => {
  it('does not offer promotion for a prerelease', () => {
    expect(moduleVersionLifecycleActions(version('proposed', '1.2.0-rc.1'))).toEqual([
      'deprecate',
      'mark-defective',
    ]);
  });

  it('suggests the stable SemVer that outranks an exact prerelease', () => {
    expect(stableSuccessorSemanticVersion('2.4.0-rc.3')).toBe('2.4.0');
    expect(stableSuccessorSemanticVersion('2.4.0-beta.1+build.7')).toBe('2.4.0');
  });

  it('limits restoration and terminal Defective behavior', () => {
    const deprecated = version('deprecated');
    expect(moduleVersionLifecycleActions(deprecated, deprecated.uuid)).toEqual([
      'restore',
      'mark-defective',
    ]);
    expect(
      moduleVersionLifecycleActions(deprecated, '00000000-0000-0000-0000-000000000002'),
    ).toEqual(['mark-defective']);
    expect(moduleVersionLifecycleActions(version('defective'))).toEqual([]);
  });
});

describe('Module Version comparison', () => {
  it('renders empty and legacy null difference arrays as no changes', () => {
    expect(formatComparisonItems([])).toBe('None');
    expect(formatComparisonItems(null)).toBe('None');
  });

  it('renders changed keys in API order', () => {
    expect(formatComparisonItems(['image', 'replicas'])).toBe('image, replicas');
  });

  it('builds concrete before and after rows for changed, added and removed values', () => {
    const comparison = {
      from_version_uuid: '00000000-0000-0000-0000-000000000001',
      to_version_uuid: '00000000-0000-0000-0000-000000000002',
      before: {
        module_source: 'inline',
        module_source_code: 'before',
        artifact_digest: '',
        source_revision: 'revision-one',
        resource_type: 'workload',
        module_inputs: { annotations: { team: 'platform' }, removed: true },
        module_params: {},
        provider_mapping: {},
        dependencies: {},
        coprovisioned: [],
      },
      after: {
        module_source: 'inline',
        module_source_code: 'after',
        artifact_digest: '',
        source_revision: 'revision-two',
        resource_type: 'workload',
        module_inputs: { annotations: { team: 'retail' }, added: 3 },
        module_params: {},
        provider_mapping: {},
        dependencies: {},
        coprovisioned: [],
      },
      module_source_changed: false,
      module_source_code_changed: true,
      artifact_digest_changed: false,
      source_revision_changed: true,
      resource_type_changed: false,
      added_module_inputs: ['added'],
      removed_module_inputs: ['removed'],
      changed_module_inputs: ['annotations'],
      added_module_params: [],
      removed_module_params: [],
      changed_module_params: [],
      added_provider_mappings: [],
      removed_provider_mappings: [],
      changed_provider_mappings: [],
      added_dependencies: [],
      removed_dependencies: [],
      changed_dependencies: [],
      coprovisioning_changed: false,
    } as ModuleVersionComparison;

    expect(moduleVersionComparisonDetails(comparison)).toEqual([
      expect.objectContaining({ path: 'Inline source', before: 'before', after: 'after' }),
      expect.objectContaining({
        path: 'Source revision',
        before: 'revision-one',
        after: 'revision-two',
      }),
      expect.objectContaining({
        path: 'Module inputs / added',
        beforePresent: false,
        after: 3,
      }),
      expect.objectContaining({
        path: 'Module inputs / removed',
        before: true,
        afterPresent: false,
      }),
      expect.objectContaining({
        path: 'Module inputs / annotations',
        before: { team: 'platform' },
        after: { team: 'retail' },
      }),
    ]);

    render(<ComparisonList comparison={comparison} />);
    expect(screen.getByText('Detailed diff')).toBeVisible();
    expect(screen.getByText('Module inputs / annotations')).toBeVisible();
    expect(screen.getByText(/"team": "platform"/)).toBeVisible();
    expect(screen.getByText(/"team": "retail"/)).toBeVisible();
  });

  it('formats structured and absent values for diff display', () => {
    expect(formatComparisonValue({ team: 'retail' })).toBe('{\n  "team": "retail"\n}');
    expect(formatComparisonValue(undefined, false)).toBe('Not present');
    expect(formatComparisonValue('')).toBe('None');
  });
});
