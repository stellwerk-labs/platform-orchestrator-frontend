import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Flex, Select, SelectProps, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface FilterByOption {
  label: string;
  value: string;
  /** the comboselect autocomplete options for each filter by item */
  comboSelectOptions?: SelectProps['options'];
}

export interface FilterCondition {
  filterBy: string;
  /** the selected filter values in the combo select for the filter condition */
  values?: string[];
}

interface MultiFilterConditionsProps {
  /** a unique id for the filter conditions section  */
  sectionId: string;
  /** the dropwdowm items of the possible options to filter by */
  filterByOptions: FilterByOption[];
  /** the heading of the filter  */
  title?: string;
  /** define the default conditions of the filter */
  defaultConditions?: FilterCondition[];
  /** callback function that will be called whenever the filter conidtions change */
  onFilterChange?: (conditions: FilterCondition[]) => void;
}

export const MultiFilterConditions = ({
  title,
  filterByOptions,
  defaultConditions,
  onFilterChange,
}: MultiFilterConditionsProps) => {
  // State
  const [conditions, setConditions] = useState<FilterCondition[]>(defaultConditions || []);
  const [dropdownFilterOptions, setDropdownFilterOptions] =
    useState<SelectProps['options']>(filterByOptions);

  // i18n
  const { t } = useTranslation();
  const translations = t('UI');

  const selectedFilterByOptions = conditions.map((condition) => condition.filterBy);
  const handleAddConditionClick = () => {
    setConditions((prevState) => {
      const newConditions = [...prevState];

      const firstFilterOption = filterByOptions?.filter(
        (option) => !selectedFilterByOptions.includes(option.value),
      )?.[0]?.value;

      if (firstFilterOption) {
        newConditions.push({
          filterBy: firstFilterOption,
        });
      }
      setDropdownFilterOptions(
        filterByOptions.filter((option) => !selectedFilterByOptions.includes(option.value)),
      );
      return newConditions;
    });
  };

  const handleConditionValuesChange = (items: string[], index: number) => {
    setConditions((prevState) => {
      const newConditions = JSON.parse(JSON.stringify(prevState));
      newConditions[index].values = items;
      if (onFilterChange) {
        onFilterChange(newConditions);
      }
      return newConditions;
    });
  };

  const handleConditionFilterByChange = (value: string, index: number) => {
    setConditions((prevState) => {
      // stringfying and parsing the previous state to assign a deep copy of the conditions
      const newConditions = JSON.parse(JSON.stringify(prevState));
      newConditions[index].filterBy = value;
      if (onFilterChange) {
        onFilterChange(newConditions);
      }
      return newConditions;
    });
  };

  const deleteCondition = (index: number) => {
    setConditions((prevState) => {
      const newConditions = [...prevState];
      newConditions.splice(index, 1);
      if (onFilterChange) {
        onFilterChange(newConditions);
      }
      return newConditions;
    });
  };

  return (
    <Flex vertical gap={'small'}>
      <Typography.Text className={'txt-sm'}>{title || translations.FILTER_BY}</Typography.Text>
      {selectedFilterByOptions.length < filterByOptions.length && (
        <Flex>
          <Button
            size={'small'}
            variant={'link'}
            color={'primary'}
            icon={<PlusOutlined />}
            onClick={handleAddConditionClick}>
            {translations.ADD_A_CONDITION}
          </Button>
        </Flex>
      )}

      <Flex vertical gap={'small'}>
        {conditions.map((condition, index) => {
          const filterBy = condition.filterBy;
          const filterByOption = filterByOptions.find((option) => option.value === filterBy);

          const comboSelectItems = filterByOption?.comboSelectOptions || [];

          return (
            <Flex gap={'small'} align={'center'} key={condition.filterBy}>
              <Select
                options={dropdownFilterOptions}
                defaultValue={condition.filterBy}
                onChange={(value: string) => handleConditionFilterByChange(value, index)}
                style={{ width: '150px' }}
                disabled={conditions.length === filterByOptions.length}
              />
              <Typography.Text type={'secondary'} className={'txt-sm'}>
                {translations.IS_ONE_OF}
              </Typography.Text>
              <Select
                mode={'multiple'}
                options={comboSelectItems}
                defaultValue={condition.values}
                style={{ width: '200px' }}
                onChange={(items) => handleConditionValuesChange(items, index)}
              />
              <Button
                icon={<DeleteOutlined />}
                aria-label={translations.DELETE_FILTER_CONDITION}
                onClick={() => deleteCondition(index)}
              />
            </Flex>
          );
        })}
      </Flex>
    </Flex>
  );
};
