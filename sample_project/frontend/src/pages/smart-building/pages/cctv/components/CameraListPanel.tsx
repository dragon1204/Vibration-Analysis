import { Box, InputBase, Typography, useTheme } from '@mui/material';
import { Search } from 'lucide-react';

import CameraItem from './CameraItem';

interface Camera {
  id: string;
  name: string;
  location: string;
  streamUrl: string;
  status: 'online' | 'offline';
}

interface CameraListPanelProps {
  cameras: Camera[];
  selectedCameraId: string | null;
  onCameraSelect: (cameraId: string) => void;
}

const CameraListPanel = ({
  cameras,
  selectedCameraId,
  onCameraSelect,
}: CameraListPanelProps) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        width: 270,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'rgba(2, 6, 23, 0.88)',
        backdropFilter: 'blur(16px)',
        borderRight: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 2,
          borderBottom: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
        }}
      >
        {/* Search Box */}
        <Box
          sx={{
            height: 36,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: 1,
            bgcolor: theme.palette.base.whiteAlpha[50],
            borderRadius: 2,
            border: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
          }}
        >
          <Search size={16} color="#94a3b8" />
          <InputBase
            placeholder="Tìm kiếm camera..."
            sx={{
              flex: 1,
              color: '#ffffff',
              fontSize: 13,
              '& input::placeholder': {
                color: '#64748b',
                opacity: 1,
              },
            }}
          />
        </Box>
      </Box>

      {/* Camera List */}
      <Box
        sx={{
          flex: 1,
          p: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.75,
          overflowY: 'auto',
          /* scrollbar style */
          '&::-webkit-scrollbar': {
            width: '4px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: theme.palette.base.slateLightAlpha[300],
            borderRadius: '3px',
            '&:hover': {
              backgroundColor: '#08647F',
            },
          },
        }}
      >
        {cameras.map((camera) => (
          <CameraItem
            key={camera.id}
            id={camera.id}
            name={camera.name}
            location={camera.location}
            status={camera.status}
            active={selectedCameraId === camera.id}
            onClick={() => onCameraSelect(camera.id)}
          />
        ))}
      </Box>

      {/* Footer - Cameras Status */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderTop: '1px solid rgba(255,255,255,0.08)',
          bgcolor: 'rgba(2, 6, 23, 0.9)',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: '#22c55e',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                '@keyframes pulse': {
                  '0%, 100%': {
                    opacity: 1,
                  },
                  '50%': {
                    opacity: 0.5,
                  },
                },
              }}
            />
            <Typography
              sx={{
                fontSize: 11,
                color: '#94a3b8',
              }}
            >
              Cameras Online
            </Typography>
          </Box>
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 700,
              color: '#22c55e',
            }}
          >
            {cameras.filter((c) => c.status === 'online').length}/
            {cameras.length}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default CameraListPanel;
