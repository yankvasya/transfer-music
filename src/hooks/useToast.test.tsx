import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from './useToast';

describe('useToast', () => {
  it('throws when called outside a ToastProvider', () => {
    // Swallow the expected React error-boundary console noise for this one assertion.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useToast())).toThrow('useToast must be used within a ToastProvider');
    spy.mockRestore();
  });

  it('renders a toast with the right type class when shown', async () => {
    const user = userEvent.setup();
    function Trigger() {
      const { showToast } = useToast();
      return <button onClick={() => showToast('Something happened', 'success')}>fire</button>;
    }

    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );

    await user.click(screen.getByText('fire'));

    const toast = screen.getByText('Something happened');
    expect(toast).toHaveClass('toast', 'toast-success');
  });

  it('defaults to the info type when none is given', async () => {
    const user = userEvent.setup();
    function Trigger() {
      const { showToast } = useToast();
      return <button onClick={() => showToast('Plain message')}>fire</button>;
    }

    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );

    await user.click(screen.getByText('fire'));
    expect(screen.getByText('Plain message')).toHaveClass('toast-info');
  });

  it('dismisses a toast when clicked', async () => {
    const user = userEvent.setup();
    function Trigger() {
      const { showToast } = useToast();
      return <button onClick={() => showToast('Click me away')}>fire</button>;
    }

    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );

    await user.click(screen.getByText('fire'));
    const toast = screen.getByText('Click me away');
    await user.click(toast);

    expect(screen.queryByText('Click me away')).not.toBeInTheDocument();
  });

  it('auto-dismisses after the timeout', async () => {
    // userEvent relies on real timers internally for its own simulated delays, so it
    // deadlocks against vi.useFakeTimers() — fireEvent's synchronous dispatch avoids that.
    vi.useFakeTimers();
    function Trigger() {
      const { showToast } = useToast();
      return <button onClick={() => showToast('Fades away')}>fire</button>;
    }

    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('fire'));
    expect(screen.getByText('Fades away')).toBeInTheDocument();

    vi.advanceTimersByTime(6000);
    vi.useRealTimers();
    await waitFor(() => expect(screen.queryByText('Fades away')).not.toBeInTheDocument());
  });
});
