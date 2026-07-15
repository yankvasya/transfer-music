import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

  describe('pasting a Deezer playlist link', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('fetches the tracklist and fills the textarea with it', async () => {
      globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('tracks')) {
          return new Response(JSON.stringify({ data: [{ title: 'One More Time', artist: { name: 'Daft Punk' }, readable: true }], next: null }));
        }
        return new Response(JSON.stringify({ title: 'Robot Anthems' }));
      }) as unknown as typeof fetch;

      const user = userEvent.setup();
      render(<TrackInput initialText="" onNext={vi.fn()} />);

      await user.click(screen.getByPlaceholderText(/Deezer playlist link/));
      await user.paste('https://www.deezer.com/playlist/42');

      await waitFor(() => expect(screen.getByText('Imported from "Robot Anthems"')).toBeInTheDocument());
      expect(screen.getByDisplayValue('Daft Punk - One More Time')).toBeInTheDocument();
      expect(screen.getByText('Continue to Playlist Setup →')).toBeEnabled();
    });

    it('shows an error and leaves the link in place when the fetch fails', async () => {
      globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ error: { type: 'DataException', message: 'no data', code: 800 } }))) as unknown as typeof fetch;

      const user = userEvent.setup();
      render(<TrackInput initialText="" onNext={vi.fn()} />);

      await user.click(screen.getByPlaceholderText(/Deezer playlist link/));
      await user.paste('https://www.deezer.com/playlist/bad');

      await waitFor(() => expect(screen.getByText(/doesn't exist or isn't public/)).toBeInTheDocument());
      expect(screen.getByDisplayValue('https://www.deezer.com/playlist/bad')).toBeInTheDocument();
    });

    it('does not attempt a fetch for plain tracklist text', async () => {
      globalThis.fetch = vi.fn() as unknown as typeof fetch;

      const user = userEvent.setup();
      render(<TrackInput initialText="" onNext={vi.fn()} />);

      await user.click(screen.getByPlaceholderText(/Deezer playlist link/));
      await user.paste('Daft Punk - One More Time');

      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });
});
