import { Flex, Tag } from 'antd';

interface TagListProps {
  items?: string[];
}

export const TagList = ({ items }: TagListProps) => {
  if (!items || !items.length) {
    return '-';
  }

  return (
    <Flex wrap>
      {items.map((item) => (
        <Tag key={item}>{item}</Tag>
      ))}
    </Flex>
  );
};
