import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { Button, Card, Flex, Select, Typography } from 'antd';

import type { PipelineRecipe, PipelineRecipeStep, PipelineTool } from '@src/models/pipelines';

const phaseNames = {
  pre_plan: 'Preparation',
  plan_check: 'Plan checks',
  post_apply: 'After apply',
};
const phaseOrder = Object.keys(phaseNames);
const nextStep = (tool: PipelineTool, steps: PipelineRecipeStep[]): PipelineRecipeStep => {
  const usedIds = new Set(steps.map((step) => step.id));
  let suffix = 1;
  let id = tool.id;
  while (usedIds.has(id)) id = `${tool.id}-${++suffix}`;
  return {
    id,
    tool_id: tool.id as PipelineRecipeStep['tool_id'],
    phase: tool.phase as PipelineRecipeStep['phase'],
    parameters: {},
  };
};

export const PipelineStepsEditor = ({
  recipe,
  tools,
  disabled,
  onChange,
}: {
  recipe: PipelineRecipe;
  tools: PipelineTool[];
  disabled: boolean;
  onChange: (value: Pick<PipelineRecipe, 'steps'>) => void;
}) => {
  const move = (id: string, direction: -1 | 1) => {
    const steps = [...recipe.steps];
    const index = steps.findIndex((step) => step.id === id);
    const target = steps[index + direction];
    if (!target || target.phase !== steps[index]?.phase) return;
    [steps[index], steps[index + direction]] = [steps[index + direction]!, steps[index]!];
    onChange({ steps });
  };
  const add = (id: string) => {
    const tool = tools.find((item) => item.id === id);
    if (!tool) return;
    const steps = [...recipe.steps, nextStep(tool, recipe.steps)].sort(
      (a, b) => phaseOrder.indexOf(a.phase) - phaseOrder.indexOf(b.phase),
    );
    onChange({ steps });
  };
  const phases = (Object.keys(phaseNames) as (keyof typeof phaseNames)[]).filter(
    (phase) => recipe.strategy === 'reviewed' || phase !== 'plan_check',
  );
  return (
    <Flex vertical gap={'middle'}>
      {phases.map((phase) => (
        <Card key={phase} size={'small'} title={phaseNames[phase]}>
          <Flex vertical gap={'small'}>
            {recipe.steps
              .filter((step) => step.phase === phase)
              .map((step, index, steps) => (
                <Flex key={step.id} gap={'small'} align={'center'} wrap>
                  <Typography.Text style={{ flex: 1 }}>
                    {tools.find((tool) => tool.id === step.tool_id)?.name ?? step.tool_id}
                    <Typography.Text type={'secondary'}> · {step.id}</Typography.Text>
                  </Typography.Text>
                  <Button
                    aria-label={`Move ${step.id} earlier`}
                    icon={<ArrowUpOutlined aria-hidden />}
                    disabled={disabled || index === 0}
                    onClick={() => move(step.id, -1)}
                  />
                  <Button
                    aria-label={`Move ${step.id} later`}
                    icon={<ArrowDownOutlined aria-hidden />}
                    disabled={disabled || index === steps.length - 1}
                    onClick={() => move(step.id, 1)}
                  />
                  <Button
                    danger
                    aria-label={`Remove ${step.id}`}
                    icon={<DeleteOutlined aria-hidden />}
                    disabled={disabled}
                    onClick={() =>
                      onChange({ steps: recipe.steps.filter((item) => item.id !== step.id) })
                    }
                  />
                </Flex>
              ))}
            <Select
              aria-label={`Add ${phaseNames[phase].toLowerCase()} step`}
              placeholder={
                <>
                  <PlusOutlined aria-hidden /> Add approved step
                </>
              }
              value={undefined}
              disabled={disabled || recipe.steps.length >= 16}
              options={tools
                .filter((tool) => tool.phase === phase)
                .map((tool) => ({ value: tool.id, label: tool.name }))}
              onChange={add}
            />
          </Flex>
        </Card>
      ))}
    </Flex>
  );
};
