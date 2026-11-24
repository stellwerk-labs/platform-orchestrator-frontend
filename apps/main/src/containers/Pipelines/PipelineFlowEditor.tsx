import { Form, Select, Switch } from 'antd';

import type { PipelineRecipe } from '@src/models/pipelines';

export const PipelineFlowEditor = ({
  recipe,
  onChange,
}: {
  recipe: PipelineRecipe;
  onChange: (value: Partial<PipelineRecipe>) => void;
}) => (
  <>
    <Form.Item label={'Deployment flow'} htmlFor={'pipeline-strategy'}>
      <Select
        id={'pipeline-strategy'}
        value={recipe.strategy}
        options={[
          { value: 'apply', label: 'Apply directly' },
          { value: 'reviewed', label: 'Plan, review and apply' },
        ]}
        onChange={(strategy: PipelineRecipe['strategy']) =>
          onChange({
            strategy,
            ...(strategy === 'apply'
              ? {
                  cost: undefined,
                  approval: undefined,
                  steps: recipe.steps.filter((step) => step.phase !== 'plan_check'),
                }
              : { approval: { mode: 'local' } }),
          })
        }
      />
    </Form.Item>
    {recipe.strategy === 'reviewed' && (
      <>
        <Form.Item label={'Estimate monthly cost'}>
          <Switch
            aria-label={'Estimate monthly cost'}
            checked={Boolean(recipe.cost?.enabled)}
            onChange={(enabled) =>
              onChange({
                cost: enabled ? { enabled: true } : undefined,
                ...(!enabled ? { approval: { mode: 'local' } } : {}),
              })
            }
          />
        </Form.Item>
        <Form.Item label={'Approval'} htmlFor={'pipeline-approval'}>
          <Select
            id={'pipeline-approval'}
            value={recipe.approval?.mode ?? 'local'}
            onChange={(mode: 'local' | 'cost_non_increasing') => onChange({ approval: { mode } })}
            options={[
              { value: 'local', label: 'Always request human approval' },
              {
                value: 'cost_non_increasing',
                label: 'Auto-approve when cost does not increase',
                disabled: !recipe.cost?.enabled,
              },
            ]}
          />
        </Form.Item>
      </>
    )}
  </>
);
