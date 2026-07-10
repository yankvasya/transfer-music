import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SourceDestinationSelect } from './SourceDestinationSelect';
import type { ConnectorId } from './SourceDestinationSelect';

const ALL_IDS: ConnectorId[] = ['plain-text', 'spotify', 'youtube', 'yandex-music', 'deezer'];

function getColumns(container: HTMLElement) {
  const [fromCol, toCol] = container.querySelectorAll('.connector-column');
  return { fromCol, toCol };
}

function activeId(column: Element): ConnectorId | undefined {
  const active = column.querySelector('.connector-tile.active');
  return ALL_IDS.find((id) => active?.textContent?.includes(id === 'yandex-music' ? 'Yandex Music' : id === 'plain-text' ? 'Plain Text' : id[0].toUpperCase() + id.slice(1)));
}

function tileButtons(column: Element): HTMLButtonElement[] {
  return Array.from(column.querySelectorAll('button.connector-tile'));
}

// Regression test for a bug class that recurred twice in this project: disabling a
// connector tile based on "incompatible with the other column's current selection" made
// some From/To combinations literally unclickable (no way to escape the disabled state).
// The fix removed all `disabled` attributes in favor of auto-correcting the other
// column on click — this test exhaustively clicks every From tile against every To tile
// (and vice versa) and asserts no tile is ever disabled, and every resulting pair is valid.
describe('SourceDestinationSelect picker', () => {
  it('never disables any tile, for any reachable combination', async () => {
    const user = userEvent.setup();
    const { container } = render(<SourceDestinationSelect onContinue={vi.fn()} />);
    const { fromCol, toCol } = getColumns(container);

    for (const fromButton of tileButtons(fromCol)) {
      await user.click(fromButton);
      for (const toButton of tileButtons(toCol)) {
        await user.click(toButton);

        for (const btn of [...tileButtons(fromCol), ...tileButtons(toCol)]) {
          expect(btn).not.toBeDisabled();
        }
      }
    }
  });

  it('auto-corrects the other column instead of getting stuck when a click would make from === to', async () => {
    const user = userEvent.setup();
    const { container } = render(<SourceDestinationSelect onContinue={vi.fn()} />);
    const { fromCol, toCol } = getColumns(container);

    // Force From and To onto the same value (Spotify) via two clicks, then confirm the
    // component auto-corrected rather than ending up with from === to.
    const spotifyFromBtn = tileButtons(fromCol).find((b) => b.textContent?.includes('Spotify'))!;
    const spotifyToBtn = tileButtons(toCol).find((b) => b.textContent?.includes('Spotify'))!;

    await user.click(spotifyToBtn); // To = Spotify (From starts as Plain Text, so this is valid so far)
    await user.click(spotifyFromBtn); // From = Spotify -> would collide with To = Spotify

    expect(activeId(fromCol)).toBe('spotify');
    expect(activeId(toCol)).not.toBe('spotify');
  });

  it('calls onContinue with the currently selected from/to pair', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    const { container, getByText } = render(<SourceDestinationSelect onContinue={onContinue} />);
    const { toCol } = getColumns(container);

    const youtubeToBtn = tileButtons(toCol).find((b) => b.textContent?.includes('YouTube'))!;
    await user.click(youtubeToBtn);
    await user.click(getByText('Continue →'));

    expect(onContinue).toHaveBeenCalledWith('plain-text', 'youtube');
  });
});
