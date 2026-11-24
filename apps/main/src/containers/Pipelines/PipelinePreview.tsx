import {
  CheckCircleOutlined,
  DollarOutlined,
  LockOutlined,
  PlayCircleOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { Alert, Flex, List, Tag, Typography } from 'antd';

import type { PipelineRecipe, PipelineTool } from '@src/models/pipelines';

type TaskPhase = PipelineRecipe['steps'][number]['phase'];

export const PipelinePreview = ({
  recipe,
  tools,
}: {
  recipe: PipelineRecipe;
  tools: PipelineTool[];
}) => {
  const tasks = (phase: TaskPhase) =>
    recipe.steps
      .filter((step) => step.phase === phase)
      .map((step) => ({
        key: step.id,
        title: tools.find((tool) => tool.id === step.tool_id)?.name ?? step.tool_id,
        description: tools.find((tool) => tool.id === step.tool_id)?.description,
        icon: <CheckCircleOutlined aria-hidden />,
      }));
  const stages = [
    ...tasks('pre_plan'),
    ...(recipe.strategy === 'reviewed'
      ? [
          {
            key: 'plan',
            title: 'Plan',
            description: 'Save the exact plan at the Runner.',
            icon: <PlayCircleOutlined aria-hidden />,
          },
          ...(recipe.cost?.enabled
            ? [
                {
                  key: 'cost',
                  title: 'Estimate monthly cost',
                  description: 'Compare current and planned cost with resource coverage.',
                  icon: <DollarOutlined aria-hidden />,
                },
              ]
            : []),
          ...tasks('plan_check'),
          {
            key: 'approval',
            title:
              recipe.approval?.mode === 'cost_non_increasing'
                ? 'Conditional approval'
                : 'Human approval',
            description:
              recipe.approval?.mode === 'cost_non_increasing'
                ? 'Complete comparable cost does not increase: approve automatically. Increase or missing information: request human approval.'
                : 'An authorized person approves this exact saved plan.',
            icon: <SafetyCertificateOutlined aria-hidden />,
          },
        ]
      : []),
    {
      key: 'apply',
      title: recipe.strategy === 'reviewed' ? 'Apply saved plan' : 'Apply',
      description: 'Execute once at the Runner.',
      icon: <PlayCircleOutlined aria-hidden />,
    },
    ...tasks('post_apply'),
  ];
  const capabilities = [
    ...new Set(
      recipe.steps.flatMap(
        (step) => tools.find((tool) => tool.id === step.tool_id)?.required_capabilities ?? [],
      ),
    ),
  ];
  return (
    <Flex vertical gap={'small'}>
      <Typography.Title level={5}>Execution preview</Typography.Title>
      <List
        dataSource={stages}
        rowKey={'key'}
        renderItem={(stage) => (
          <List.Item>
            <List.Item.Meta
              avatar={stage.icon}
              title={stage.title}
              description={stage.description}
            />
          </List.Item>
        )}
      />
      <Flex gap={'small'} wrap>
        <Tag icon={<LockOutlined aria-hidden />}>Fixed deployment stages</Tag>
        {capabilities.map((capability) => (
          <Tag key={capability}>{capability}</Tag>
        ))}
      </Flex>
      {recipe.cost?.enabled && (
        <Alert
          type={'warning'}
          showIcon
          message={'Pricing requires a compatible site'}
          description={
            'Infracost must be configured with reachable network pricing or a site-local pricing service. Network pricing is unavailable at disconnected sites. Deployment admission validates the selected site; incomplete estimates always request human approval.'
          }
        />
      )}
    </Flex>
  );
};
