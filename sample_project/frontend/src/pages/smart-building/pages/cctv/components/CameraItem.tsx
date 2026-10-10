import { Box, Typography, useTheme } from '@mui/material';

interface CameraItemProps {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline';
  active?: boolean;
  onClick: () => void;
}

const CameraItem = ({
  name,
  location,
  status,
  active,
  onClick,
}: CameraItemProps) => {
  const theme = useTheme();
  return (
    <Box
      onClick={onClick}
      sx={{
        p: 1,
        cursor: 'pointer',
        borderRadius: 1.5,
        bgcolor: active ? theme.palette.base.cyanAlpha[150] : 'transparent',
        border: `1px solid ${active ? theme.palette.base.cyanAlpha[400] : 'transparent'}`,
        transition: 'all 0.2s',
        '&:hover': {
          bgcolor: active
            ? theme.palette.base.cyanAlpha[200]
            : theme.palette.base.whiteAlpha[50],
          border: `1px solid ${active ? theme.palette.base.cyanAlpha[500] : theme.palette.base.whiteAlpha[100]}`,
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        {/* Status Indicator */}
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor:
              status === 'online'
                ? '#22c55e'
                : theme.palette.semantic.error.main,
            flexShrink: 0,
            animation:
              status === 'online'
                ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                : 'none',
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

        {/* Camera Info */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: 13,
              fontWeight: 600,
              color: active ? '#67e8f9' : '#ffffff',
              mb: 0.25,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {name}
          </Typography>
          <Typography
            sx={{
              fontSize: 10,
              color: active ? 'rgba(103, 232, 249, 0.7)' : '#94a3b8',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {location}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default CameraItem;
