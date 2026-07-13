import { Button, Flex } from 'antd';
import { useTranslation } from 'react-i18next';

import { DOCS_HELP } from '@src/config/docs-links';
import { getSelectedOrganization } from '@src/utilities/local-storage';

export const DefaultErrorPageButtons = () => {
  const { t } = useTranslation();
  const uiTranslations = t('UI');

  return (
    <Flex gap={'middle'}>
      <Button variant={'outlined'} href={`/orgs/${getSelectedOrganization()}/projects`}>
        {uiTranslations.GO_TO_PROJECTS_OVERVIEW}
      </Button>
      <Button variant={'outlined'} target={'_blank'} href={DOCS_HELP}>
        {uiTranslations.HELP}
      </Button>
    </Flex>
  );
};
