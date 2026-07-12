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

    render(<HistoryView history={[ENTRY]} onBack={vi.fn()} onResume={vi.fn()} onDelete={onDelete} onImportHistory={vi.fn()} />);

    await user.click(screen.getByText('✕'));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Road Trip Mix'));
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('deletes the entry once the user confirms', async () => {
    const onDelete = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();

    render(<HistoryView history={[ENTRY]} onBack={vi.fn()} onResume={vi.fn()} onDelete={onDelete} onImportHistory={vi.fn()} />);

    await user.click(screen.getByText('✕'));
    expect(onDelete).toHaveBeenCalledWith('h1');
  });

  it('exports history as a downloadable JSON file', async () => {
    const user = userEvent.setup();
    let capturedBlob: Blob | null = null;
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      capturedBlob = blob as Blob;
      return 'blob:mock';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    render(<HistoryView history={[ENTRY]} onBack={vi.fn()} onResume={vi.fn()} onDelete={vi.fn()} onImportHistory={vi.fn()} />);
    await user.click(screen.getByText('⬇ Export History'));

    expect(createObjectURL).toHaveBeenCalled();
    const text = await capturedBlob!.text();
    expect(JSON.parse(text)).toEqual([ENTRY]);
  });

  it('imports a valid backup file and reports how many entries were restored', async () => {
    const user = userEvent.setup();
    const onImportHistory = vi.fn().mockReturnValue(2);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const { container } = render(
      <HistoryView history={[]} onBack={vi.fn()} onResume={vi.fn()} onDelete={vi.fn()} onImportHistory={onImportHistory} />
    );
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([JSON.stringify([ENTRY])], 'backup.json', { type: 'application/json' });

    await user.upload(fileInput, file);

    expect(onImportHistory).toHaveBeenCalledWith([ENTRY]);
    expect(alertSpy).toHaveBeenCalledWith('Restored 2 history entries.');
  });

  it('shows an error alert for a file that is not valid JSON/an array', async () => {
    const user = userEvent.setup();
    const onImportHistory = vi.fn();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const { container } = render(
      <HistoryView history={[]} onBack={vi.fn()} onResume={vi.fn()} onDelete={vi.fn()} onImportHistory={onImportHistory} />
    );
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['not json'], 'backup.json', { type: 'application/json' });

    await user.upload(fileInput, file);

    expect(onImportHistory).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("doesn't look like"));
  });
});
