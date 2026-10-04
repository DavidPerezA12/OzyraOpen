import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RichMarkdown } from './RichMarkdown';

const noop = () => undefined;

describe('RichMarkdown', () => {
  it('renderiza markdown con formato', async () => {
    render(<RichMarkdown content={'# Título\n\n**negrita**'} copyToClipboard={noop} />);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Título');
    expect(await screen.findByText('negrita')).toBeInTheDocument();
  });

  it('bloquea imágenes remotas mostrando solo el alt', async () => {
    render(
      <RichMarkdown content={'![tracker](https://evil.example/pixel.png)'} copyToClipboard={noop} />
    );
    expect(await screen.findByText('tracker')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('permite imágenes relativas con lazy y sin referrer', async () => {
    render(<RichMarkdown content={'![logo](/icon/logo.png)'} copyToClipboard={noop} />);
    const img = (await screen.findByRole('img')) as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/icon/logo.png');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer');
  });

  it('neutraliza data: en imágenes', async () => {
    render(
      <RichMarkdown
        content={'![x](data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=)'}
        copyToClipboard={noop}
      />
    );
    expect(await screen.findByText('x')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
