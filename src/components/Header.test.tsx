import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from './Header';
import type { ConnectedAccount } from './Header';

const ACCOUNTS: ConnectedAccount[] = [
  { service: 'spotify', serviceName: 'Spotify', displayName: 'yankvasya', onLogout: vi.fn() },
  { service: 'deezer', serviceName: 'Deezer', displayName: 'yankvasya', onLogout: vi.fn() },
];

describe('Header', () => {
  it('collapses multiple logged-in accounts into a single dropdown button, closed by default', () => {
    render(<Header accounts={ACCOUNTS} onShowHistory={vi.fn()} onShowAbout={vi.fn()} onGoHome={vi.fn()} />);

    expect(screen.getByText('👤 Accounts (2)')).toBeInTheDocument();
    expect(screen.queryByTitle('Spotify')).not.toBeInTheDocument();
  });

  it('opens the dropdown on click, showing each account with its service icon and a logout button', async () => {
    const user = userEvent.setup();
    const { container } = render(<Header accounts={ACCOUNTS} onShowHistory={vi.fn()} onShowAbout={vi.fn()} onGoHome={vi.fn()} />);

    await user.click(screen.getByText('👤 Accounts (2)'));

    expect(screen.getByTitle('Spotify')).toBeInTheDocument();
    expect(screen.getByTitle('Deezer')).toBeInTheDocument();
    expect(container.querySelectorAll('svg.service-icon')).toHaveLength(2);
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
    expect(screen.getByTitle('Spotify')).toBeInTheDocument();

    await user.click(screen.getByTestId('outside'));
    expect(screen.queryByTitle('Spotify')).not.toBeInTheDocument();
  });

  it('renders no accounts button at all when nothing is logged in', () => {
    render(<Header accounts={[]} onShowHistory={vi.fn()} onShowAbout={vi.fn()} onGoHome={vi.fn()} />);
    expect(screen.queryByText(/Accounts/)).not.toBeInTheDocument();
  });

  it('cycles the theme toggle through auto -> light -> dark -> auto, stamping data-theme', async () => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    const user = userEvent.setup();
    render(<Header accounts={[]} onShowHistory={vi.fn()} onShowAbout={vi.fn()} onGoHome={vi.fn()} />);

    const toggle = screen.getByTitle('Theme: matching your system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);

    await user.click(toggle);
    expect(screen.getByTitle('Theme: light')).toBeInTheDocument();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    await user.click(screen.getByTitle('Theme: light'));
    expect(screen.getByTitle('Theme: dark')).toBeInTheDocument();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    await user.click(screen.getByTitle('Theme: dark'));
    expect(screen.getByTitle('Theme: matching your system')).toBeInTheDocument();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});
