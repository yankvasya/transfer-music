import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from './Header';
import type { ConnectedAccount } from './Header';

const ACCOUNTS: ConnectedAccount[] = [
  { serviceName: 'Spotify', icon: '🟢', displayName: 'yankvasya', onLogout: vi.fn() },
  { serviceName: 'Deezer', icon: '🎶', displayName: 'yankvasya', onLogout: vi.fn() },
];

describe('Header', () => {
  it('collapses multiple logged-in accounts into a single dropdown button, closed by default', () => {
    render(<Header accounts={ACCOUNTS} onShowHistory={vi.fn()} onShowAbout={vi.fn()} onGoHome={vi.fn()} />);

    expect(screen.getByText('👤 Accounts (2)')).toBeInTheDocument();
    expect(screen.queryByText('🟢')).not.toBeInTheDocument();
  });

  it('opens the dropdown on click, showing each account with its service icon and a logout button', async () => {
    const user = userEvent.setup();
    render(<Header accounts={ACCOUNTS} onShowHistory={vi.fn()} onShowAbout={vi.fn()} onGoHome={vi.fn()} />);

    await user.click(screen.getByText('👤 Accounts (2)'));

    expect(screen.getByText('🟢')).toBeInTheDocument();
    expect(screen.getByText('🎶')).toBeInTheDocument();
    expect(screen.getAllByText('yankvasya')).toHaveLength(2);
    expect(screen.getAllByText('Logout')).toHaveLength(2);
  });

  it('calls the right account\'s onLogout when its button is clicked', async () => {
    const user = userEvent.setup();
    render(<Header accounts={ACCOUNTS} onShowHistory={vi.fn()} onShowAbout={vi.fn()} onGoHome={vi.fn()} />);

    await user.click(screen.getByText('👤 Accounts (2)'));
    await user.click(screen.getAllByText('Logout')[0]);

    expect(ACCOUNTS[0].onLogout).toHaveBeenCalled();
    expect(ACCOUNTS[1].onLogout).not.toHaveBeenCalled();
  });

  it('closes the dropdown when clicking outside it', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <Header accounts={ACCOUNTS} onShowHistory={vi.fn()} onShowAbout={vi.fn()} onGoHome={vi.fn()} />
      </div>
    );

    await user.click(screen.getByText('👤 Accounts (2)'));
    expect(screen.getByText('🟢')).toBeInTheDocument();

    await user.click(screen.getByTestId('outside'));
    expect(screen.queryByText('🟢')).not.toBeInTheDocument();
  });

  it('renders no accounts button at all when nothing is logged in', () => {
    render(<Header accounts={[]} onShowHistory={vi.fn()} onShowAbout={vi.fn()} onGoHome={vi.fn()} />);
    expect(screen.queryByText(/Accounts/)).not.toBeInTheDocument();
  });
});
