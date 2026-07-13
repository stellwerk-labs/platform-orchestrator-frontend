import React from 'react';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@src/components/shared/PageHeader/PageHeader';
import { Environment } from '@src/models/v2/controlplane';

interface ViewEnvironmentHeaderProps {
  environment?: Environment;
}
export const ViewEnvironmentHeader = ({ environment }: ViewEnvironmentHeaderProps) => {
  // i18n
  const { t } = useTranslation();
  const uiTranslations = t('UI');

  const showEnvironmentId = environment?.id !== environment?.display_name;

  return (
    <>
      <PageHeader environment={environment} showPageContext />
      {showEnvironmentId && (
        <>
          <div className={'txt-translucent txt-sm'}>{uiTranslations.ENVIRONMENT_ID}</div>
          <div className={'mb-lg'}>{environment?.id}</div>
        </>
      )}
    </>
  );
};
