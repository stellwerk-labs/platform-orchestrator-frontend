import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MockProviders } from '@src/testing-utils/MockProviders';

import { MultiFilterConditions } from '../MultiFilter/MultiFilterConditions';

describe('MultiFilterConditions', () => {
  const callBackMock = vi.fn();
  beforeEach(() => {
    render(
      <MockProviders>
        <MultiFilterConditions
          sectionId={'test-filter'}
          title={'Filter by athlete'}
          filterByOptions={[
            {
              value: 'name',
              label: 'Name',
              comboSelectOptions: [
                {
                  id: 'michael',
                  value: 'michael',
                  searchString: 'michael',
                  label: 'Michael Jordan',
                },
                {
                  id: 'cristiano',
                  value: 'cristiano',
                  searchString: 'cristiano',
                  label: 'Cristiano Ronaldo',
                },
              ],
            },
            {
              value: 'sport',
              label: 'Sport',
              comboSelectOptions: [
                {
                  id: 'basketball',
                  value: 'basketball',
                  searchString: 'basketball',
                  label: 'Basketball',
                },
                {
                  id: 'football',
                  value: 'football',
                  searchString: 'football',
                  label: 'Football',
                },
              ],
            },
            {
              value: 'age',
              label: 'Age',
              comboSelectOptions: [
                {
                  value: '45',
                  searchString: '45',
                  label: '45',
                },
                {
                  id: '38',
                  value: '38',
                  searchString: '38',
                  label: '38',
                },
              ],
            },
          ]}
          onFilterChange={callBackMock}
        />
      </MockProviders>,
    );
  });
  it('should show the title of the filter', async () => {
    expect(screen.getByText('Filter by athlete')).toBeTruthy();
  });
  it('should add a condition when the user clicks on add a condition', async () => {
    await userEvent.click(screen.getByRole('button', { name: /Add a condition/ }));
    expect(await screen.findAllByRole('combobox')).toHaveLength(2);
  });
  it('should add a condition with a filter by option that is not already selected when the user clicks on add condition twice', async () => {
    await userEvent.click(screen.getByRole('button', { name: /Add a condition/ }));
    await userEvent.click(screen.getByRole('button', { name: /Add a condition/ }));
    expect(await screen.findAllByRole('combobox')).toHaveLength(4);
  });
  it('should hide already selected filter by options', async () => {
    await userEvent.click(screen.getByRole('button', { name: /Add a condition/ }));
    await userEvent.click(screen.getByRole('button', { name: /Add a condition/ }));
    await userEvent.click(screen.getAllByRole('combobox')[0]!);
    await waitFor(() => {
      expect(screen.queryByRole('option', { name: /Name/ })).toBeNull();
    });
  });
  it('should hide add condition button and disable the filter by dropdown if the the user added conidtions with all the possible filter by option', async () => {
    await userEvent.click(screen.getByRole('button', { name: /Add a condition/ }));
    await userEvent.click(screen.getByRole('button', { name: /Add a condition/ }));
    await userEvent.click(screen.getByRole('button', { name: /Add a condition/ }));
    expect(screen.getAllByRole('button', { name: 'Delete filter condition' }).length).toBe(3);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Add a condition/ })).toBeNull();
    });
    await waitFor(() => {
      expect(screen.getAllByRole('combobox')[0])!.toBeDisabled();
    });
  });
  it('should delete a condition when the user clicks on delete', async () => {
    await userEvent.click(screen.getByRole('button', { name: /Add a condition/ }));
    await userEvent.click(screen.getByRole('button', { name: /Add a condition/ }));
    await userEvent.click(screen.getAllByRole('button', { name: /Delete filter condition/ })[0]!);
    expect(screen.getAllByRole('button', { name: /Delete filter condition/ }).length).toBe(1);
  });
});
