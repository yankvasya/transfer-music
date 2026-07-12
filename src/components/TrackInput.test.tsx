import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrackInput } from './TrackInput';

describe('TrackInput', () => {
  it('disables Continue until at least one track is parsed from the textarea', async () => {
    const onNext = vi.fn();
    const user = userEvent.setup();

    render(<TrackInput initialText="" onNext={onNext} />);

    expect(screen.getByText('Continue to Playlist Setup →')).toBeDisabled();

    await user.type(screen.getByPlaceholderText(/Artist 1 - Track Title 1/), 'Daft Punk - One More Time');

    expect(screen.getByText('1 Tracks detected')).toBeInTheDocument();
    expect(screen.getByText('Continue to Playlist Setup →')).toBeEnabled();
  });

  it('flags a line whose delimiter split leaves an empty artist or title as a whole-text fallback search', async () => {
    const user = userEvent.setup();
    render(<TrackInput initialText="" onNext={vi.fn()} />);

    // The "-" is found, but there's nothing before it, so artist ends up empty.
    await user.type(screen.getByPlaceholderText(/Artist 1 - Track Title 1/), '- Some Song With No Artist');

    expect(screen.getByText('1 Tracks detected')).toBeInTheDocument();
    expect(screen.getByText('1 lines will search by entire text (no split)')).toBeInTheDocument();
  });

  it('submits the parsed tracks and raw text on continue', async () => {
    const onNext = vi.fn();
    const user = userEvent.setup();

    render(<TrackInput initialText="" onNext={onNext} />);
    const textarea = screen.getByPlaceholderText(/Artist 1 - Track Title 1/);
    await user.type(textarea, 'Daft Punk - One More Time');
    await user.click(screen.getByText('Continue to Playlist Setup →'));

    expect(onNext).toHaveBeenCalledWith(
      [expect.objectContaining({ artist: 'Daft Punk', title: 'One More Time', isValid: true })],
      'Daft Punk - One More Time'
    );
  });
});
