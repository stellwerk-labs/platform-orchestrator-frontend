interface YouTubePlayerProps {
  videoId: string;
  title?: string;
  autoplay?: boolean;
  muted?: boolean;
  aspectRatio?: string;
}

export const YouTubePlayer = ({
  videoId,
  title = 'Video player',
  autoplay = false,
  muted = false,
  aspectRatio = '16/9',
}: YouTubePlayerProps) => {
  const params = new URLSearchParams({ rel: '0' });
  if (autoplay) params.set('autoplay', '1');
  if (muted) params.set('mute', '1');

  return (
    <div style={{ position: 'relative', aspectRatio, width: '100%' }}>
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?${params}`}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
        allow={
          'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
        }
        allowFullScreen
        title={title}
      />
    </div>
  );
};
