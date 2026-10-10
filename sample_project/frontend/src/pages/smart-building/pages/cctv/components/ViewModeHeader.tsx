import { Box, Button, Typography, useTheme } from '@mui/material';
import { Eye } from 'lucide-react';

interface ViewModeHeaderProps {
  viewMode: '1x1' | '2x2' | '3x3';
  onViewModeChange: (mode: '1x1' | '2x2' | '3x3') => void;
}

const ViewModeHeader = ({
  viewMode,
  onViewModeChange,
}: ViewModeHeaderProps) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 3,
        py: 2,
        bgcolor: 'rgba(2, 6, 23, 0.88)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
      }}
    >
      {/* Title */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Eye size={20} color="#67e8f9" />
        <Typography
          sx={{
            fontSize: 16,
            color: '#FFFFFF',
          }}
        >
          Xem trực tiếp
        </Typography>
      </Box>

      {/* View Mode Buttons */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          onClick={() => onViewModeChange('1x1')}
          sx={{
            minWidth: 'auto',
            px: 1.5,
            py: 0.75,
            bgcolor:
              viewMode === '1x1'
                ? theme.palette.semantic.info.main
                : theme.palette.base.whiteAlpha[50],
            color: viewMode === '1x1' ? '#ffffff' : '#94a3b8',
            fontWeight: 700,
            fontSize: 10,
            borderRadius: 2,
            border: `1px solid ${viewMode === '1x1' ? theme.palette.semantic.info.main : theme.palette.base.whiteAlpha[100]}`,
            transition: 'all 0.2s',
            textTransform: 'none',
            '&:hover': {
              bgcolor:
                viewMode === '1x1'
                  ? '#0891b2'
                  : theme.palette.base.whiteAlpha[100],
            },
          }}
        >
          1x1
        </Button>
        <Button
          onClick={() => onViewModeChange('2x2')}
          sx={{
            minWidth: 'auto',
            px: 1.5,
            py: 0.75,
            bgcolor:
              viewMode === '2x2'
                ? theme.palette.semantic.info.main
                : theme.palette.base.whiteAlpha[50],
            color: viewMode === '2x2' ? '#ffffff' : '#94a3b8',
            fontWeight: 700,
            fontSize: 10,
            borderRadius: 2,
            border: `1px solid ${viewMode === '2x2' ? theme.palette.semantic.info.main : theme.palette.base.whiteAlpha[100]}`,
            transition: 'all 0.2s',
            textTransform: 'none',
            '&:hover': {
              bgcolor:
                viewMode === '2x2'
                  ? '#0891b2'
                  : theme.palette.base.whiteAlpha[100],
            },
          }}
        >
          2x2
        </Button>
        <Button
          onClick={() => onViewModeChange('3x3')}
          sx={{
            minWidth: 'auto',
            px: 1.5,
            py: 0.75,
            bgcolor:
              viewMode === '3x3'
                ? theme.palette.semantic.info.main
                : theme.palette.base.whiteAlpha[50],
            color: viewMode === '3x3' ? '#ffffff' : '#94a3b8',
            fontWeight: 700,
            fontSize: 10,
            borderRadius: 2,
            border: `1px solid ${viewMode === '3x3' ? theme.palette.semantic.info.main : theme.palette.base.whiteAlpha[100]}`,
            transition: 'all 0.2s',
            textTransform: 'none',
            '&:hover': {
              bgcolor:
                viewMode === '3x3'
                  ? '#0891b2'
                  : theme.palette.base.whiteAlpha[100],
            },
          }}
        >
          3x3
        </Button>
      </Box>
    </Box>
  );
};

export default ViewModeHeader;
