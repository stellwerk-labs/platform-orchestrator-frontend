import { describe, expect, it } from 'vitest';

import { parseDeploymentError } from './parseDeploymentError';

describe('parseDeploymentError', () => {
  describe('JSON error messages', () => {
    it('should extract summary from JSON error with summary field', () => {
      const errorMessage = JSON.stringify({
        summary: 'Module configuration failed',
        detail: 'The S3 bucket could not be created',
        module_id: 'acme/s3-bucket',
        module_version: '1.0.0',
      });

      const result = parseDeploymentError(errorMessage);

      expect(result.isJson).toBe(true);
      expect(result.friendlyMessage).toBe('Module configuration failed');
      expect(result.rawMessage).toBe(errorMessage);
      expect(result.parsedJson?.summary).toBe('Module configuration failed');
      expect(result.parsedJson?.module_id).toBe('acme/s3-bucket');
      expect(result.failingModuleIds).toEqual(['acme/s3-bucket']);
    });

    it('should use detail when summary is not present', () => {
      const errorMessage = JSON.stringify({
        detail: 'Provider authentication failed',
        entity_type: 'provider',
        provider_type: 'aws',
        provider_id: 'my-aws-account',
      });

      const result = parseDeploymentError(errorMessage);

      expect(result.isJson).toBe(true);
      expect(result.friendlyMessage).toBe('Provider authentication failed');
      expect(result.parsedJson?.provider_type).toBe('aws');
      expect(result.failingModuleIds).toEqual([]);
    });

    it('should use action when summary and detail are not present', () => {
      const errorMessage = JSON.stringify({
        action: 'Check your AWS credentials',
        entity_type: 'provider',
      });

      const result = parseDeploymentError(errorMessage);

      expect(result.isJson).toBe(true);
      expect(result.friendlyMessage).toBe('Check your AWS credentials');
    });

    it('should construct message from entity_type when no summary/detail/action', () => {
      const errorMessage = JSON.stringify({
        entity_type: 'module',
        entity_id: 'my-module-instance',
      });

      const result = parseDeploymentError(errorMessage);

      expect(result.isJson).toBe(true);
      expect(result.friendlyMessage).toBe('module error (my-module-instance)');
    });

    it('should handle JSON with module_id for highlighting', () => {
      const errorMessage = JSON.stringify({
        summary: 'Terraform apply failed',
        module_id: 'acme/postgres',
        module_version: '2.1.0',
      });

      const result = parseDeploymentError(errorMessage);

      expect(result.failingModuleIds).toEqual(['acme/postgres']);
    });

    it('should handle JSON with workload information', () => {
      const errorMessage = JSON.stringify({
        summary: 'Output validation failed',
        entity_type: 'output',
        workload: 'backend-api',
      });

      const result = parseDeploymentError(errorMessage);

      expect(result.isJson).toBe(true);
      expect(result.parsedJson?.workload).toBe('backend-api');
    });

    it('should default to "Deployment failed" when JSON has no useful fields', () => {
      const errorMessage = JSON.stringify({
        some_random_field: 'value',
      });

      const result = parseDeploymentError(errorMessage);

      expect(result.isJson).toBe(true);
      expect(result.friendlyMessage).toBe('Deployment failed');
    });
  });

  describe('Plain text error messages', () => {
    it('should use fallback message for plain text errors', () => {
      const errorMessage =
        'runner failed with code TF_ERROR: failed to assume role: https response error StatusCode: 403, RequestID: abc123, api error AccessDenied: Not authorized to perform sts:AssumeRoleWithWebIdentity';

      const result = parseDeploymentError(errorMessage);

      expect(result.isJson).toBe(false);
      expect(result.friendlyMessage).toBe(errorMessage);
      expect(result.rawMessage).toBe(errorMessage);
      expect(result.parsedJson).toBeUndefined();
      expect(result.failingModuleIds).toEqual([]);
    });

    it('should use fallback message when no colon is present', () => {
      const errorMessage = 'Deployment failed due to timeout';

      const result = parseDeploymentError(errorMessage);

      expect(result.isJson).toBe(false);
      expect(result.friendlyMessage).toBe(errorMessage);
      expect(result.rawMessage).toBe(errorMessage);
    });

    it('should use fallback message for any plain text error', () => {
      const errorMessage = 'Error: ' + 'a'.repeat(300);

      const result = parseDeploymentError(errorMessage);

      expect(result.isJson).toBe(false);
      expect(result.friendlyMessage).toBe(errorMessage);
    });

    it('should use fallback message for short text', () => {
      const errorMessage = 'Failed:';

      const result = parseDeploymentError(errorMessage);

      expect(result.isJson).toBe(false);
      expect(result.friendlyMessage).toBe(errorMessage);
    });

    it('should use fallback message for empty-like text', () => {
      const errorMessage = 'Error:';

      const result = parseDeploymentError(errorMessage);

      expect(result.isJson).toBe(false);
      expect(result.friendlyMessage).toBe(errorMessage);
    });
  });

  describe('Malformed JSON', () => {
    it('should treat malformed JSON as plain text and use fallback', () => {
      const errorMessage = '{ invalid json: missing quotes }';

      const result = parseDeploymentError(errorMessage);

      expect(result.isJson).toBe(false);
      expect(result.friendlyMessage).toBe(errorMessage);
    });
  });
});
