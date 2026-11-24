import { SearchOutlined } from '@ant-design/icons';
import { Button, Flex, Input, Select } from 'antd';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';

export const matchesSearch = (query: string, ...values: (string | undefined)[]) => {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const text = values.filter(Boolean).join(' ').toLocaleLowerCase();
  return words.every((word) => text.includes(word));
};

// URL state only. Each list owns its data, predicates and pagination.
export const useTableSearch = () => {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const view = params.get('view') ?? 'all';
  const update = (key: 'q' | 'view', value: string) => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value && (key === 'q' || value !== 'all')) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };
  const clearFilters = () =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete('q');
        next.delete('view');
        return next;
      },
      { replace: true },
    );
  return {
    query,
    view,
    clearFilters,
    setQuery: (value: string) => update('q', value),
    setView: (value: string) => update('view', value),
  };
};

export const TableToolbar = ({
  label,
  query,
  setQuery,
  view,
  setView,
  filters,
  clearFilters,
  children,
  placeholder,
}: {
  label: string;
  query: string;
  setQuery: (value: string) => void;
  view: string;
  setView: (value: string) => void;
  filters: { value: string; label: string }[];
  clearFilters: () => void;
  children?: ReactNode;
  placeholder?: string;
}) => (
  <Flex gap={'small'} align={'center'} wrap style={{ marginBottom: 12 }}>
    <Input
      aria-label={`Search ${label}`}
      placeholder={placeholder ?? `Search ${label}`}
      prefix={<SearchOutlined aria-hidden />}
      maxLength={200}
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      allowClear
      style={{ flex: '1 1 240px', maxWidth: 440 }}
    />
    <Select
      aria-label={`Filter ${label}`}
      value={view}
      onChange={setView}
      options={[{ value: 'all', label: 'All' }, ...filters]}
      style={{ minWidth: 180 }}
    />
    {(query || view !== 'all') && <Button onClick={clearFilters}>Clear filters</Button>}
    {children}
  </Flex>
);
