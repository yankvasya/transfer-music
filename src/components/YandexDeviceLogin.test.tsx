import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { YandexDeviceLogin } from './YandexDeviceLogin';

const deviceCode = { userCode: 'ABCD-1234', verificationUrl: 'https://yandex.ru/device' };

describe('YandexDeviceLogin', () => {
  it('copies the device code to the clipboard', async () => {
    const user = userEvent.setup();

    render(
      <YandexDeviceLogin deviceCode={deviceCode} authStatus="waiting" authError={null} onStart={vi.fn()} onCancel={vi.fn()} />
    );

    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    await user.click(screen.getByText('📋 Copy'));

    expect(writeText).toHaveBeenCalledWith('ABCD-1234');
    await waitFor(() => expect(screen.getByText('✓ Copied!')).toBeInTheDocument());
    vi.restoreAllMocks();
  });

  it('shows a failure state when the Clipboard API rejects', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));

    render(
      <YandexDeviceLogin deviceCode={deviceCode} authStatus="waiting" authError={null} onStart={vi.fn()} onCancel={vi.fn()} />
    );

    await user.click(screen.getByText('📋 Copy'));

    await waitFor(() => expect(screen.getByText('Copy failed')).toBeInTheDocument());
    vi.restoreAllMocks();
  });
});
