import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HistoryView } from './HistoryView';
import type { HistoryEntry } from '../hooks/useHistory';

const ENTRY: HistoryEntry = {
  id: 'h1',
  service: 'spotify',
  name: 'Road Trip Mix',
  url: 'https://example.com/pl1',
  createdAt: Date.now(),
  matched: 10,
  failed: 0,
  total: 10,
  status: 'completed',
};

describe('HistoryView', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deletes an entry only after the user confirms the browser dialog', async () => {
    const onDelete = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();

    render(<HistoryView history={[ENTRY]} onBack={vi.fn()} onResume={vi.fn()} onDelete={onDelete} />);

    await user.click(screen.getByText('✕'));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Road Trip Mix'));
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('deletes the entry once the user confirms', async () => {
    const onDelete = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();

    render(<HistoryView history={[ENTRY]} onBack={vi.fn()} onResume={vi.fn()} onDelete={onDelete} />);

    await user.click(screen.getByText('✕'));
    expect(onDelete).toHaveBeenCalledWith('h1');
  });
});
