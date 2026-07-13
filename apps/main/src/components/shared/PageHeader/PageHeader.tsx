import { Flex, theme, Typography } from 'antd';
import React, { ReactElement, ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { HTMLDocumentTitle } from '@src/components/shared/HTMLDocumentTitle';
import { BreadcrumbItem, useBreadcrumbs } from '@src/hooks/useBreadcrumbs';
import { Environment } from '@src/models/v2/controlplane';

import styles from './PageHeader.module.css';

const { Title, Text } = Typography;

interface PageHeaderProps {
  rightContent?: ReactNode;
  customHeading?: string | ReactNode;
  HTMLCustomTitle?: string;
  subtitles?: (ReactElement | string)[];
  statusMessage?: ReactNode;
  /** Show page context above the title */
  showPageContext?: boolean;
  environment?: Environment;
}

export const PageHeader = ({
  subtitles,
  rightContent,
  customHeading,
  HTMLCustomTitle,
  statusMessage,
  showPageContext,
}: PageHeaderProps) => {
  // i18n
  const { t } = useTranslation();
  const translations = t('NAVIGATION');

  const crumbs = useBreadcrumbs();
  const lastCrumb: BreadcrumbItem | undefined = useMemo(() => crumbs[crumbs.length - 1], [crumbs]);

  const { token } = theme.useToken();

  const header = lastCrumb?.labelAsTitle && lastCrumb?.label ? lastCrumb.label : lastCrumb?.name;

  const getSubtitle = () => {
    switch (lastCrumb?.label) {
      case 'App':
        return translations.APPLICATION;
      case 'Env':
        return translations.ENVIRONMENT;
      default:
        return lastCrumb?.label;
    }
  };

  return (
    <Flex justify={'space-between'} align={'flex-start'}>
      <HTMLDocumentTitle title={HTMLCustomTitle || customHeading?.toString() || header} />
      <div style={{ margin: `${token.marginLG}px 0` }}>
        {showPageContext && lastCrumb?.label && <Text type={'secondary'}>{getSubtitle()}</Text>}
        <Flex align={'center'}>
          <Title className={styles.title}>{customHeading || header}</Title>
          <Text>{statusMessage}</Text>
        </Flex>

        <Flex align={'center'}>
          {subtitles?.map((subtitle, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <span key={i}>{subtitle}</span>
          ))}
        </Flex>
      </div>
      <Flex align={'start'}>{rightContent}</Flex>
    </Flex>
  );
};
