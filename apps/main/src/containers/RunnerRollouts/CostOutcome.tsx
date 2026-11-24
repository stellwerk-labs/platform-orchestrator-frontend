import { DollarOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Button, Flex, Popover, Tag, Typography } from 'antd';

import type { CostEstimate } from './rolloutApi';

export const formatCost = (value: string | undefined, currency: string) => {
  if (!value || value.length > 128 || !/^-?\d+(\.\d+)?$/.test(value)) return 'Not available';
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = value.replace(/^-/, '').split('.');
  return `${currency} ${negative ? '−' : ''}${new Intl.NumberFormat().format(BigInt(whole!))}.${fraction.padEnd(2, '0')}`;
};

const costReasons: Record<string, string> = {
  incomplete_cost_coverage: 'Some resources have missing or unsupported pricing.',
  cost_baseline_unavailable: 'The plan does not contain a comparable cost baseline.',
  api_key_missing: 'Infracost is not configured at this site.',
  estimator_unavailable: 'The site could not reach its configured pricing estimator.',
  sensitive_pricing_configuration:
    'Pricing inputs include sensitive data and cannot be estimated safely.',
};

export const CostOutcome = ({ cost }: { cost: CostEstimate }) => {
  const complete =
    cost.status === 'complete' &&
    [cost.before_monthly, cost.after_monthly, cost.delta_monthly].every((value) =>
      Boolean(value && value.length <= 128 && /^-?\d+(\.\d+)?$/.test(value)),
    );
  const increasing =
    cost.delta_monthly &&
    !cost.delta_monthly.startsWith('-') &&
    !/^0+(\.0+)?$/.test(cost.delta_monthly);
  return (
    <Flex vertical gap={4}>
      <Tag
        icon={<DollarOutlined aria-hidden />}
        color={!complete ? 'warning' : increasing ? 'orange' : 'success'}>
        {complete ? 'Monthly estimate' : 'Incomplete estimate, human approval required'}
      </Tag>
      <Typography.Text>
        Baseline: {formatCost(cost.before_monthly, cost.currency)} / month → Planned:{' '}
        {formatCost(cost.after_monthly, cost.currency)} / month
      </Typography.Text>
      <Typography.Text>
        Change: {formatCost(cost.delta_monthly, cost.currency)} / month
      </Typography.Text>
      <Popover
        trigger={['click', 'focus']}
        title={'Estimate coverage'}
        content={
          <Flex vertical gap={4} style={{ maxWidth: 440 }}>
            <span>
              {(cost.reason && costReasons[cost.reason]) ||
                'Only complete, comparable estimates can authorize automatic approval.'}
            </span>
            {(
              [
                ['Baseline', cost.before_coverage],
                ['Planned', cost.after_coverage],
              ] as const
            ).map(
              ([label, coverage]) =>
                coverage && (
                  <span key={label}>
                    {label}: {coverage.resources} resources, {coverage.priced} priced,{' '}
                    {coverage.free} free, {coverage.unknown} unknown, {coverage.unpriced} unpriced,{' '}
                    {coverage.missing_usage} missing usage
                  </span>
                ),
            )}
            {cost.reason && <Typography.Text code>{cost.reason}</Typography.Text>}
            <span>
              Estimator: {cost.estimator} {cost.build}
            </span>
          </Flex>
        }>
        <Button type={'link'} size={'small'} icon={<InfoCircleOutlined aria-hidden />}>
          Estimate details
        </Button>
      </Popover>
    </Flex>
  );
};
