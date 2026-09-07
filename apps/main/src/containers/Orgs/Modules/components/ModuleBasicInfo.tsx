import { Flex } from 'antd';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { DataEntry } from '@src/components/shared/ui/DataEntry/DataEntry';
import { MatchParams } from '@src/config/routing';
import { useGetModuleCatalogueEntry } from '@src/hooks/react-query/v2/controlplane/modules/modules';
import { DATE_FORMATS_TYPES, formatDate } from '@src/utilities/datetime/datetime';

export const ModuleBasicInfo = () => {
  // i18n
  const { t } = useTranslation();
  const resourcesTranslations = t('ACCOUNT_SETTINGS').RESOURCES;

  // router
  const { orgId, moduleId } = useParams<keyof MatchParams>() as MatchParams;

  // React Query
  const { data: module } = useGetModuleCatalogueEntry(orgId, moduleId);

  return (
    <Flex gap={'middle'} wrap={'wrap'} data-testid={'resource-definition-creation-info'}>
      <DataEntry label={resourcesTranslations.RESOURCE_TYPE} value={module?.resource_type} />
      {module && (
        <DataEntry
          label={resourcesTranslations.CREATED_AT}
          value={formatDate(module.created_at, DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE)}
        />
      )}
    </Flex>
  );
};
