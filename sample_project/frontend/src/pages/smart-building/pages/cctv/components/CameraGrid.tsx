import { Box, IconButton, Typography, useTheme } from '@mui/material';
import { Maximize2, Volume2, VolumeX } from 'lucide-react';
import { useState } from 'react';

import VideoPlayer from './VideoPlayer';

interface Camera {
  id: string;
  name: string;
  location: string;
  streamUrl: string;
  status: 'online' | 'offline';
}

interface CameraGridProps {
  cameras: Camera[];
  viewMode: '1x1' | '2x2' | '3x3';
  selectedCameraId?: string | null;
}

const CameraCard = ({ camera }: { camera: Camera }) => {
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const theme = useTheme();
  const handleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <Box
      sx={{
        position: isFullscreen ? 'absolute' : 'relative',
        top: isFullscreen ? 0 : 'auto',
        left: isFullscreen ? 0 : 'auto',
        right: isFullscreen ? 0 : 'auto',
        bottom: isFullscreen ? 0 : 'auto',
        width: isFullscreen ? '100%' : 'auto',
        height: isFullscreen ? '100%' : 'auto',
        aspectRatio: isFullscreen ? 'auto' : '16/9',
        bgcolor: '#000',
        borderRadius: isFullscreen ? 0 : 2,
        overflow: 'hidden',
        border: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
        zIndex: isFullscreen ? 999 : 'auto',
        '&:hover .camera-controls': {
          opacity: 1,
        },
      }}
    >
      {/* Video Stream */}
      {camera.status === 'online' ? (
        <VideoPlayer src={camera.streamUrl} muted={isMuted} />
      ) : (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
          }}
        >
          <Typography>Camera offline</Typography>
        </Box>
      )}

      {/* Camera Info Overlay */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          p: 1.5,
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor:
                camera.status === 'online'
                  ? '#22c55e'
                  : theme.palette.semantic.error.main,
              animation:
                camera.status === 'online' ? 'pulse 2s infinite' : 'none',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.5 },
              },
            }}
          />
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'white' }}>
              {camera.name}
            </Typography>
            <Typography sx={{ fontSize: 11, color: '#94a3b8' }}>
              {camera.location}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Camera Controls */}
      <Box
        className="camera-controls"
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          p: 1.5,
          background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 1,
          opacity: 0,
          transition: 'opacity 0.3s',
        }}
      >
        <IconButton
          size="small"
          onClick={() => setIsMuted(!isMuted)}
          sx={{
            bgcolor: theme.palette.base.whiteAlpha[100],
            color: 'white',
            '&:hover': { bgcolor: theme.palette.base.whiteAlpha[200] },
          }}
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </IconButton>
        <IconButton
          size="small"
          onClick={handleFullscreen}
          sx={{
            bgcolor: theme.palette.base.whiteAlpha[100],
            color: 'white',
            '&:hover': { bgcolor: theme.palette.base.whiteAlpha[200] },
          }}
        >
          <Maximize2 size={16} />
        </IconButton>
      </Box>
    </Box>
  );
};

const CameraGrid = ({
  cameras,
  viewMode,
  selectedCameraId,
}: CameraGridProps) => {
  // Filter cameras based on view mode
  const displayCameras =
    viewMode === '1x1' && selectedCameraId
      ? cameras.filter((c) => c.id === selectedCameraId)
      : cameras;

  // Determine grid columns based on view mode
  const getGridColumns = () => {
    switch (viewMode) {
      case '1x1':
        return '1fr';
      case '2x2':
        return 'repeat(2, 1fr)';
      case '3x3':
        return 'repeat(3, 1fr)';
      default:
        return 'repeat(2, 1fr)';
    }
  };

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: getGridColumns(),
        gap: 1.5,
        p: 2,
        maxWidth: '100%',
        position: 'relative',
      }}
    >
      {displayCameras.map((camera) => (
        <CameraCard key={camera.id} camera={camera} />
      ))}
    </Box>
  );
};

export default CameraGrid;
