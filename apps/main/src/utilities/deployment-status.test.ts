import { describe, expect, it } from 'vitest';

import { getDeploymentStatus } from './deployment-status';

describe('getDeploymentStatus', () => {
  it('should return "Never deployed" for "never deployed" status', () => {
    expect(getDeploymentStatus('never deployed')).toBe('Never deployed');
  });

  it('should return "Failed" for "failed" status', () => {
    expect(getDeploymentStatus('failed')).toBe('Failed');
  });

  it('should return "Timed out" for "timeout" status', () => {
    expect(getDeploymentStatus('timeout')).toBe('Timed out');
  });

  it('should return "Successful" for "succeeded" status', () => {
    expect(getDeploymentStatus('succeeded')).toBe('Successful');
  });

  it('should return "Deploying" for "in progress" status', () => {
    expect(getDeploymentStatus('in progress')).toBe('Deploying');
  });

  it('should return "Cluster changed" for "cluster_changed" status', () => {
    expect(getDeploymentStatus('cluster_changed')).toBe('Cluster changed');
  });

  it('should return empty string for unknown status', () => {
    expect(getDeploymentStatus('unknown')).toBe('');
  });
});
