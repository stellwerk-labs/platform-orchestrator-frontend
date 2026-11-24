import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { matchesSearch, TableToolbar, useTableSearch } from './TableToolbar';

const Example = () => {
  const search = useTableSearch();
  const location = useLocation();
  const rows = [
    { id: 'runner-east', description: 'Production cluster' },
    { id: 'runner-west', description: 'Development cluster' },
  ].filter(
    (row) =>
      matchesSearch(search.query, row.id, row.description) &&
      (search.view !== 'east' || row.id.endsWith('east')),
  );
  return (
    <>
      <TableToolbar label={'runners'} {...search} filters={[{ value: 'east', label: 'East' }]} />
      <output aria-label={'Rows'}>{rows.map((row) => row.id).join(',')}</output>
      <output aria-label={'URL'}>{location.search}</output>
    </>
  );
};

describe('List search URL state', () => {
  it('matches safe visible fields by all words, without treating query as an expression', () => {
    expect(matchesSearch(' EAST production ', 'runner-east', 'Production cluster')).toBe(true);
    expect(matchesSearch('east missing', 'runner-east', 'Production cluster')).toBe(false);
    expect(matchesSearch('[east]', 'runner-east')).toBe(false);
  });

  it('restores shared links, preserves other route state, and clears both search and quick filter', async () => {
    render(
      <MemoryRouter initialEntries={['/runners?q=PROD&view=east&project=keep']}>
        <Example />
      </MemoryRouter>,
    );
    expect(screen.getByRole('textbox', { name: 'Search runners' })).toHaveValue('PROD');
    expect(screen.getByLabelText('Rows')).toHaveTextContent('runner-east');
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByLabelText('Rows')).toHaveTextContent('runner-east,runner-west');
    expect(screen.getByLabelText('URL')).toHaveTextContent('?project=keep');
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Search runners' }),
      'WEST development',
    );
    expect(screen.getByLabelText('Rows')).toHaveTextContent('runner-west');
    expect(screen.getByLabelText('URL')).toHaveTextContent('project=keep');
    await userEvent.clear(screen.getByRole('textbox', { name: 'Search runners' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Search runners' }), 'all');
    expect(screen.getByLabelText('URL')).toHaveTextContent('q=all');
  });
});
