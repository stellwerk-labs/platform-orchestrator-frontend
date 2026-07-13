import { Modal } from 'antd';
import { useState } from 'react';

import { YouTubePlayer } from '../YouTubePlayer/YouTubePlayer';

interface YouTubePlayerPopoverProps {
  videoId: string;
  label?: string;
}

export const YouTubePlayerPopover = ({ videoId, label }: YouTubePlayerPopoverProps) => {
  const [open, setOpen] = useState(false);
  const thumbnail = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

  return (
    <>
      <button
        type={'button'}
        onClick={() => setOpen(true)}
        aria-label={label ? `Play video: ${label}` : 'Play video'}
        style={{
          cursor: 'pointer',
          width: '100%',
          display: 'block',
          padding: 0,
          borderWidth: 0,
          // eslint-disable-next-line no-restricted-syntax -- CSS reset, not a color
          background: 'transparent',
        }}>
        <img
          src={thumbnail}
          alt={label || 'Video thumbnail'}
          style={{ width: '100%', display: 'block' }}
        />
      </button>
      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        title={label}
        footer={null}
        width={720}
        centered
        destroyOnHidden>
        <YouTubePlayer videoId={videoId} title={label} autoplay />
      </Modal>
    </>
  );
};
