import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ServiceIcon } from './ServiceIcon';
import type { ServiceId } from '../types';

const SERVICES: ServiceId[] = ['spotify', 'youtube', 'yandex-music', 'deezer'];

describe('ServiceIcon', () => {
  it.each(SERVICES)('renders a real SVG (not emoji text) for %s', (service) => {
    const { container } = render(<ServiceIcon service={service} />);
    const svg = container.querySelector('svg.service-icon');
    expect(svg).toBeInTheDocument();
    expect(svg?.querySelector('path')).toBeInTheDocument();
  });

  it('renders at the requested size', () => {
    const { container } = render(<ServiceIcon service="spotify" size={40} />);
    const svg = container.querySelector('svg.service-icon');
    expect(svg).toHaveAttribute('width', '40');
    expect(svg).toHaveAttribute('height', '40');
  });

  it('defaults to size 20 when not specified', () => {
    const { container } = render(<ServiceIcon service="deezer" />);
    const svg = container.querySelector('svg.service-icon');
    expect(svg).toHaveAttribute('width', '20');
  });
});
