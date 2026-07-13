import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { YouTubePlayer } from './YouTubePlayer';

describe('YouTubePlayer', () => {
  it('renders an iframe with the correct YouTube embed src', () => {
    render(<YouTubePlayer videoId={'abc123'} />);

    const iframe = screen.getByTitle('Video player');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', expect.stringContaining('youtube.com/embed/abc123'));
  });

  it('uses a custom title for the iframe', () => {
    render(<YouTubePlayer videoId={'abc123'} title={'Platform Orchestrator demo'} />);

    expect(screen.getByTitle('Platform Orchestrator demo')).toBeInTheDocument();
  });

  it('adds autoplay param when autoplay is true', () => {
    render(<YouTubePlayer videoId={'abc123'} autoplay />);

    const iframe = screen.getByTitle('Video player');
    const src = iframe.getAttribute('src') ?? '';
    expect(src).toContain('autoplay=1');
    expect(src).not.toContain('mute=1');
  });

  it('adds mute param when muted is true', () => {
    render(<YouTubePlayer videoId={'abc123'} muted />);

    const src = screen.getByTitle('Video player').getAttribute('src') ?? '';
    expect(src).toContain('mute=1');
    expect(src).not.toContain('autoplay=1');
  });

  it('does not add autoplay or mute params by default', () => {
    render(<YouTubePlayer videoId={'abc123'} />);

    const src = screen.getByTitle('Video player').getAttribute('src') ?? '';
    expect(src).not.toContain('autoplay=1');
    expect(src).not.toContain('mute=1');
  });

  it('uses custom aspectRatio', () => {
    render(<YouTubePlayer videoId={'abc123'} aspectRatio={'4/3'} />);

    const wrapper = screen.getByTitle('Video player').parentElement;
    expect(wrapper?.getAttribute('style')).toContain('aspect-ratio: 4/3');
  });
});
