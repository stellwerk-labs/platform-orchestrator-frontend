import { defineConfig, OutputOptions } from 'orval';

const defaultOutputs: Omit<OutputOptions, 'target' | 'schemas'> = {
  mode: 'tags-split',
  prettier: true,
  client: 'react-query',
  mock: {
    type: 'msw',
    useExamples: true,
    baseUrl: 'http://example.com',
    generateEachHttpStatus: true,
  },
  override: {
    operations: {
      checkPermissions: {
        query: {
          useQuery: true,
        },
      },
    },
    mutator: {
      path: './src/custom-instance.ts',
      name: 'customInstance',
    },
    mock: {
      delay: false,
      properties: {
        dismissed_prompts: ['onboarding-survey'],
        next_page_token: undefined,
      },
    },
  },
};
export default defineConfig({
  controlplane: {
    output: {
      ...defaultOutputs,
      target: './src/hooks/react-query/v2/controlplane',
      schemas: './src/models/v2/controlplane',
    },
    input: {
      target: './schemas/cp.yml',
    },
  },
  dataplane: {
    output: {
      ...defaultOutputs,
      target: './src/hooks/react-query/v2/dataplane',
      schemas: './src/models/v2/dataplane',
    },
    input: {
      target: './schemas/dp.yml',
    },
  },
  iam: {
    hooks: {
      afterAllFilesWrite: 'pnpm run format-orval',
    },
    output: {
      ...defaultOutputs,
      target: './src/hooks/react-query/v2/iam',
      schemas: './src/models/v2/iam',
    },
    input: {
      target: './schemas/iam.yml',
    },
  },
});
