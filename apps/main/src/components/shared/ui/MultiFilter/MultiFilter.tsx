import { FilterOutlined } from '@ant-design/icons';
import { Button, Checkbox, Flex, Popover } from 'antd';
import { cloneDeep } from 'lodash';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import {
  FilterByOption,
  FilterCondition,
  MultiFilterConditions,
} from '../MultiFilter/MultiFilterConditions';

export interface Filters {
  [sectionId: string]: {
    conditions?: FilterCondition[];
    checkboxes?: Record<string, boolean>;
  };
}

export interface FilterByOptions {
  [sectionId: string]: {
    title?: string;
    options: FilterByOption[];
    checkboxes?: { name: string; label: string }[];
  };
}

interface MultiFilterPanelProps {
  filterByOptions: FilterByOptions;
  onFiltersChange: (filterValues: Filters) => void;
  defaultFilters?: Filters;
  disabled?: boolean;
}

/**
 * @description The MultiFilter component is responsible for rendering a panel with multiple filter sections.
 * It uses the MultiFilterConditions component to render the filter conditions for each section.
 * The filter conditions and options are provided through the props.
 * When the filter conditions are changed, the onFiltersChange callback is called with the updated conditions.
 * The defaultConditions prop can be used to set the initial filter conditions.
 * The MultiFilter component also handles applying and canceling the filters.
 */

export const MultiFilter = ({
  onFiltersChange,
  defaultFilters,
  filterByOptions,
  disabled = false,
}: MultiFilterPanelProps) => {
  // state
  const [open, setOpen] = useState<boolean>(false);
  const [filters, setFilters] = useState<Filters>(defaultFilters || {});
  const [filterSetFromUrl, setFilterSetFromUrl] = useState<boolean>(false);

  // router
  const [searchParams, setSearchParams] = useSearchParams();
  const filterValuesFromURL = searchParams.get('filters');

  useEffect(() => {
    if (!filterSetFromUrl) {
      try {
        if (filterValuesFromURL) {
          setFilters(JSON.parse(filterValuesFromURL));
          onFiltersChange(JSON.parse(filterValuesFromURL));
          setFilterSetFromUrl(true);
        }
        // eslint-disable-next-line no-empty
      } catch (_) {}
    }
  }, [onFiltersChange, filterValuesFromURL, filterSetFromUrl]);

  useEffect(() => {
    if (defaultFilters) {
      setFilters(defaultFilters);
    }
  }, [defaultFilters]);

  // i18n
  const { t } = useTranslation();
  const uiTranslations = t('UI');

  const handleFilterChange = (filterSection: string, conditions: FilterCondition[]) => {
    setFilters((prevState) => {
      const newFilters = cloneDeep(prevState);
      if (!newFilters[filterSection]) {
        newFilters[filterSection] = { conditions };
      } else {
        newFilters[filterSection].conditions = conditions;
      }
      return newFilters;
    });
  };

  const handleCheckboxChange = (section: string, name: string, checked: boolean) => {
    setFilters((prevState) => {
      const newFilterConditions = { ...prevState };
      if (!newFilterConditions[section]) {
        newFilterConditions[section] = { checkboxes: { [name]: !checked } };
      } else {
        newFilterConditions[section].checkboxes = {
          ...(newFilterConditions[section].checkboxes || {}),
          [name]: !checked,
        };
      }
      return newFilterConditions;
    });
  };

  const applyFilters = () => {
    const newFilters = cloneDeep(filters);
    // remove conditions that have no values
    Object.keys(filters).forEach((section) => {
      const sectionCheckboxes = filters?.[section]?.checkboxes || {};
      const sectionConditions =
        filters?.[section]?.conditions?.filter(
          (condition) => condition.values && condition.values.length > 0,
        ) || [];

      newFilters[section] = {
        conditions: sectionConditions,
        checkboxes: sectionCheckboxes,
      };
    });
    setSearchParams(`filters=${JSON.stringify(newFilters)}`);
    onFiltersChange(filters);
    setOpen(false);
  };

  const cancel = () => {
    setSearchParams(`filters=${JSON.stringify(defaultFilters)}`);
    onFiltersChange(defaultFilters || {});
    setOpen(false);
  };

  const appliedFiltersCount = Object.values(defaultFilters || {}).reduce((acc, section) => {
    return section.conditions ? acc + section.conditions?.length : acc;
  }, 0);

  return (
    <Popover
      trigger={'click'}
      open={open}
      placement={'bottom'}
      onOpenChange={() => setOpen(!open)}
      content={
        <Flex vertical gap={'small'}>
          {Object.keys(filterByOptions).map((section) => (
            <Flex vertical gap={'small'} key={section}>
              <MultiFilterConditions
                sectionId={section}
                title={filterByOptions?.[section]?.title}
                filterByOptions={filterByOptions?.[section]?.options ?? []}
                defaultConditions={filters?.[section]?.conditions || []}
                onFilterChange={(newConditions) => handleFilterChange(section, newConditions)}
              />
              <div>
                {filters?.[section]?.conditions &&
                  filters?.[section]?.conditions.length > 0 &&
                  filterByOptions?.[section]?.checkboxes?.map((checkbox) => {
                    return (
                      <Flex vertical key={`${section}-${checkbox.name}`}>
                        <Checkbox
                          name={`${section}-${checkbox.name}`}
                          defaultChecked={filters?.[section]?.checkboxes?.[checkbox.name]}
                          onChange={(e) =>
                            handleCheckboxChange(section, checkbox.name, !e.target.checked || false)
                          }>
                          {checkbox?.label}
                        </Checkbox>
                      </Flex>
                    );
                  })}
              </div>
            </Flex>
          ))}
          <Flex gap={'small'}>
            <Button color={'primary'} variant={'solid'} onClick={applyFilters}>
              {uiTranslations.APPLY}
            </Button>
            <Button variant={'outlined'} onClick={cancel}>
              {uiTranslations.CANCEL}
            </Button>
          </Flex>
        </Flex>
      }>
      <Button
        className={'mr-md'}
        variant={'outlined'}
        icon={<FilterOutlined />}
        disabled={disabled}>
        {/* shows the total number of applied filter conditions on  the button*/}
        {appliedFiltersCount > 0
          ? appliedFiltersCount === 1
            ? `1 ${uiTranslations.FILTER_APPLIED}`
            : `${appliedFiltersCount} ${uiTranslations.FILTERS_APPLIED}`
          : uiTranslations.FILTERS}
      </Button>
    </Popover>
  );
};
