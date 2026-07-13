import { Flex, Result, Typography } from 'antd';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import ErrorSVG from '@src/assets/svg/illustrations/404.svg?react';

import { DefaultErrorPageButtons } from './components/DefaultErrorPageButtons';

interface ErrorPageProps {
  title?: string;
  descriptionTexts?: string[];
  buttons?: ReactNode;
}

export const ErrorPage = ({ title, descriptionTexts, buttons }: ErrorPageProps) => {
  // i18n
  const { t } = useTranslation();
  const errorTranslations = t('ERROR');

  return (
    <Result
      title={title || errorTranslations.PAGE_NOT_FOUND}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
      subTitle={
        descriptionTexts && (
          <Flex vertical gap={'small'}>
            {descriptionTexts.map((text: string, index: number) => {
              // eslint-disable-next-line react/no-array-index-key
              return <Typography.Text key={index}> {text}</Typography.Text>;
            })}
          </Flex>
        )
      }
      icon={<ErrorSVG />}
      extra={<Flex gap={'small'}>{buttons ? buttons : <DefaultErrorPageButtons />}</Flex>}
    />
  );
};
