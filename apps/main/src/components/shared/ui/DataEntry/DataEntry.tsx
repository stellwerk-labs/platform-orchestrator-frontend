import { Flex, Typography } from 'antd';
import { ReactNode } from 'react';

interface DataEntryProps {
  label: string;
  value: string | ReactNode;
  copyable?: boolean;
}
export const DataEntry = ({ label, value, copyable }: DataEntryProps) => {
  return (
    <Flex vertical>
      <Typography.Text type={'secondary'} className={'txt-sm'}>
        {label}
      </Typography.Text>
      {typeof value === 'string' ? (
        <Typography.Text copyable={copyable}>{value}</Typography.Text>
      ) : (
        value
      )}
    </Flex>
  );
};
