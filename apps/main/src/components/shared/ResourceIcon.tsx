import { CustomIcon, iconMap } from '@src/components/shared/ui/CustomIcon/CustomIcon';

interface ResourceIconProps {
  type: string;
  size?: number;
  color?: string;
}

export const ResourceIcon = ({ type, size, color }: ResourceIconProps) => {
  return (
    <CustomIcon
      style={{ fontSize: `${size}px`, color }}
      name={
        Object.keys(iconMap).includes(type)
          ? type
          : type.includes('k8s-cluster')
            ? 'kubernetes'
            : type?.includes('aws') || type === 'sqs'
              ? 'amazon'
              : 'generic-resource'
      }
    />
  );
};
