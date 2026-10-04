import React, { StrictMode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import App from './App';

const renderApp = () => render(<StrictMode><App/></StrictMode>);
const openPage = label => fireEvent.click(screen.getAllByText(label.toUpperCase()).find(el => el.classList.contains('nav-item')));

describe('App (demo mode)', () => {
  it('renders every page without crashing', async () => {
    renderApp();
    await screen.findByText('Ledgelog');
    for (const page of ['Dashboard', 'Insights', 'Budgets', 'Forecast', 'Investments', 'Retirement', 'Rules']) {
      openPage(page);
      expect(screen.queryByRole('alert')).toBeNull();
      expect(document.querySelector('.sub-hdr .page-ttl')?.textContent).toMatch(new RegExp(page === 'Retirement' ? 'Retirement' : page));
    }
  });

  it('Escape and Cmd+K do not throw', async () => {
    renderApp();
    await screen.findByText('Ledgelog');
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(screen.getByPlaceholderText(/Search transactions/)).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByPlaceholderText(/Search transactions/)).toBeNull();
  });

  it('adds a transaction once (even under StrictMode) and updates the account balance once', async () => {
    renderApp();
    await screen.findByText('Ledgelog');
    const before = screen.getAllByText(/4,521\.38/).length;
    expect(before).toBeGreaterThan(0);

    fireEvent.click(document.querySelector('.btn-add-txn'));
    fireEvent.change(screen.getAllByPlaceholderText('Description…')[0], { target: { value: 'Smoke test lunch' } });
    fireEvent.change(document.querySelector('.amt-input'), { target: { value: '12.50' } });
    fireEvent.click(document.querySelector('.mtx-footer .btn-pri'));

    // untagged transactions live in the Untagged tab by design
    fireEvent.click(screen.getByText('Untagged').closest('.txn-tab'));
    await waitFor(() => expect(screen.getAllByText('Smoke test lunch')).toHaveLength(1));
    expect(screen.getAllByText(/4,508\.88/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/4,496\.38/)).toHaveLength(0); // would mean it was applied twice
  });

  it('deletes into the Deleted tab and restores', async () => {
    renderApp();
    await screen.findByText('Ledgelog');
    fireEvent.click(document.querySelector('.txn-table tbody .ctx-btn'));
    fireEvent.click(screen.getByText('Delete', { selector: '.ctx-item' }));
    const deletedTab = screen.getByText('Deleted').closest('.txn-tab');
    await waitFor(() => expect(within(deletedTab).getByText('2')).toBeInTheDocument());
    fireEvent.click(deletedTab);
    fireEvent.click(document.querySelector('.txn-table tbody .ctx-btn'));
    fireEvent.click(screen.getByText('Restore', { selector: '.ctx-item' }));
    await waitFor(() => expect(within(deletedTab).getByText('1')).toBeInTheDocument());
  });

  it('creates a budget from the Budgets page', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderApp();
    await screen.findByText('Ledgelog');
    openPage('Budgets');
    const rowsBefore = document.querySelectorAll('.budgets-table tbody tr').length;
    fireEvent.click(screen.getByText('Add Budget', { selector: 'button' }));
    fireEvent.change(document.querySelector('.modal-box input[type="number"]'), { target: { value: '75' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(document.querySelectorAll('.budgets-table tbody tr').length).toBe(rowsBefore + 1));
  });

  it('switches every tab to another display currency', async () => {
    renderApp();
    await screen.findByText('Ledgelog');
    const inr = screen.getByRole('tab', { name: 'INR' });
    fireEvent.click(inr);
    expect(inr).toHaveAttribute('aria-selected', 'true');
    for (const page of ['Dashboard', 'Insights', 'Budgets', 'Forecast', 'Investments', 'Retirement', 'Rules']) {
      openPage(page);
      expect(screen.queryByRole('alert')).toBeNull();
    }
    openPage('Dashboard');
    expect(document.querySelector('.summary-strip').textContent).toContain('₹');
  });
});
