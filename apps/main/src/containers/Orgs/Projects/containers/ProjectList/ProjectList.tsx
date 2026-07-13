import { Empty, Flex, Table, TableColumnProps } from 'antd';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';

import { PageHeader } from '@src/components/shared/PageHeader/PageHeader';
import { SearchInput } from '@src/components/shared/ui/SearchInput/SearchInput';
import { DOCS_GET_STARTED_EMPTY_STATE, DOCS_PROJECTS } from '@src/config/docs-links';
import { MatchParams } from '@src/config/routing';
import { useFilterProjects } from '@src/hooks/useFilterProjects';
import { Project } from '@src/models/v2/controlplane';
import { DATE_FORMATS_TYPES, formatDate } from '@src/utilities/datetime/datetime';

export const ProjectList = () => {
  // i18n
  const { t } = useTranslation('viewApplicationList');

  // Router hooks
  const { orgId } = useParams<keyof MatchParams>() as MatchParams;

  // Component state
  const [filterValue, setFilterValue] = useState<string>();
  const [orgIdFromState, setOrgIdFromState] = useState<string>(orgId);

  // React Query
  const { filteredProjects, projectsLoading } = useFilterProjects(filterValue);

  /*
   *  We use the orgIdFromState and applicationsFromState state variables for performance reasons.
   *  It makes sure the useEffect that dispatches the pausing calls only tracks neccessary updates for orgId and applications variables.
   *  Thereby, reducing the amount of times the dispatch calls are made.
   */
  useEffect(() => {
    if (orgId !== orgIdFromState) {
      setOrgIdFromState(orgId);
    }
  }, [orgId, orgIdFromState]);

  const handleFilterInput = (value: string) => {
    setFilterValue(value);
  };

  const columns: TableColumnProps<Project>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      onFilter: (value, record) => record.id.includes(value as string),
      filters: filteredProjects?.map((project) => ({
        text: project.id,
        value: project.id,
      })),
      filterSearch: true,
      sorter: (a, b) => a.id.localeCompare(b.id),
      render: (_, { id }) => (
        <Link to={id} tabIndex={0}>
          {id}
        </Link>
      ),
    },
    {
      title: 'Display name',
      dataIndex: 'display_name',
      showSorterTooltip: { target: 'full-header' },
      key: 'display_name',
      onFilter: (value, record) => record.display_name.includes(value as string),
      filters: filteredProjects?.map((project) => ({
        text: project.display_name,
        value: project.display_name,
      })),
      filterSearch: true,
      sorter: (a, b) => a.display_name.localeCompare(b.display_name),
      render: (_, { display_name, id }) => <Link to={id}>{display_name}</Link>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: '300px',
      sorter: (a, b) => a.status.localeCompare(b.status),
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      width: '300px',
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      render: (value) => formatDate(value, DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE),
    },
  ];

  return (
    <>
      <PageHeader customHeading={t('APPLICATIONS_TITLE') as string} />
      <Flex vertical gap={'middle'}>
        <SearchInput
          placeholder={t('FILTER_PROJECTS') as string}
          onChange={handleFilterInput}
          debounceEvent
        />
        <Table
          columns={columns}
          dataSource={filteredProjects}
          loading={projectsLoading}
          locale={{
            emptyText: (
              <Empty
                description={
                  <>
                    No projects found, see{' '}
                    <a href={DOCS_PROJECTS} target={'_blank'} rel={'noreferrer noopener'}>
                      projects docs
                    </a>{' '}
                    for details, or follow the{' '}
                    <a
                      href={DOCS_GET_STARTED_EMPTY_STATE}
                      target={'_blank'}
                      rel={'noreferrer noopener'}>
                      tutorial
                    </a>{' '}
                    to explore the full setup flow.
                  </>
                }
                styles={{ image: { display: 'none' } }}
              />
            ),
          }}
          rowKey={'id'}
        />
      </Flex>
    </>
  );
};
