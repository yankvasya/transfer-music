import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  it('shows the text on hover and hides it again on mouse leave', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip text="Explanation text">
        <span>Trigger</span>
      </Tooltip>
    );

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    await user.hover(screen.getByText('Trigger'));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Explanation text');

    await user.unhover(screen.getByText('Trigger'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows on click, for touch devices with no hover', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip text="Explanation text">
        <span>Trigger</span>
      </Tooltip>
    );

    await user.click(screen.getByText('Trigger'));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Explanation text');
  });

  it('is reachable by keyboard: shows on focus, hides on blur', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button>Before</button>
        <Tooltip text="Explanation text">
          <span>Trigger</span>
        </Tooltip>
      </>
    );

    await user.tab(); // focuses "Before"
    await user.tab(); // focuses the tooltip trigger
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await user.tab(); // moves focus away
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
