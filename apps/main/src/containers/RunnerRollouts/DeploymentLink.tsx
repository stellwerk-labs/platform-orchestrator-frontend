import { ArrowRightOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useLinkClickHandler } from 'react-router';

export const DeploymentLink = ({url,children}: {url:string;children:string}) => {
  const onClick = useLinkClickHandler<HTMLAnchorElement>(url);
  return <Button type={'primary'} href={url} onClick={onClick} icon={<ArrowRightOutlined aria-hidden />}>{children}</Button>;
};
