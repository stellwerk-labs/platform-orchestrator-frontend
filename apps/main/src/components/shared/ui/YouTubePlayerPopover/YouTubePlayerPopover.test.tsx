import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { YouTubePlayerPopover } from './YouTubePlayerPopover';

describe('YouTubePlayerPopover', () => {
  it('renders a thumbnail image with the correct src', () => {
    render(<YouTubePlayerPopover videoId={'abc123'} label={'Watch demo'} />);

    const img = screen.getByRole('img', { name: 'Watch demo' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://img.youtube.com/vi/abc123/mqdefault.jpg');
  });

  it('does not show the video modal initially', () => {
    render(<YouTubePlayerPopover videoId={'abc123'} label={'Watch demo'} />);

    expect(screen.queryByTitle('Watch demo')).not.toBeInTheDocument();
  });

  it('opens a modal with the YouTube player when thumbnail is clicked', async () => {
    render(<YouTubePlayerPopover videoId={'abc123'} label={'Watch demo'} />);

    await userEvent.click(screen.getByRole('img', { name: 'Watch demo' }));

    const iframe = await screen.findByTitle('Watch demo');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', expect.stringContaining('youtube.com/embed/abc123'));
  });

  it('closes the modal when cancel is clicked', async () => {
    render(<YouTubePlayerPopover videoId={'abc123'} label={'Watch demo'} />);

    await userEvent.click(screen.getByRole('img', { name: 'Watch demo' }));
    expect(await screen.findByTitle('Watch demo')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByTitle('Watch demo')).not.toBeInTheDocument();
  });
});
