import { Box, Button, useTheme } from '@mui/material';
import { Box as BoxIcon, Grid3x3 } from 'lucide-react';

interface ViewToggleProps {
  view: '2D' | '3D';
  onViewChange: (view: '2D' | '3D') => void;
}

const ViewToggle = ({ view, onViewChange }: ViewToggleProps) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        bgcolor: 'rgba(2, 6, 23, 0.6)',
        backdropFilter: 'blur(12px)',
        px: 0.75,
        py: 0.75,
        borderRadius: 10,
        border: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
        boxShadow: `0 10px 15px -3px ${theme.palette.base.blackAlpha[100]}`,
        pointerEvents: 'auto',
      }}
    >
      <Button
        onClick={() => onViewChange('2D')}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 0.75,
          borderRadius: 10,
          fontSize: '0.75rem',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          transition: 'all 0.3s',
          minWidth: 'auto',
          ...(view === '2D'
            ? {
                bgcolor: theme.palette.semantic.info.light,
                color: '#0f172a',
                boxShadow: '0 10px 15px -3px rgba(34, 211, 238, 0.2)',
                '&:hover': {
                  bgcolor: theme.palette.semantic.info.main,
                },
              }
            : {
                bgcolor: 'transparent',
                color: '#94a3b8',
                '&:hover': {
                  color: 'white',
                  bgcolor: theme.palette.base.whiteAlpha[50],
                },
              }),
        }}
      >
        <Grid3x3 size={14} />
        <span>2D</span>
      </Button>

      <Button
        onClick={() => onViewChange('3D')}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 0.75,
          borderRadius: 10,
          fontSize: '0.75rem',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          transition: 'all 0.3s',
          minWidth: 'auto',
          ...(view === '3D'
            ? {
                bgcolor: theme.palette.semantic.info.light,
                color: '#0f172a',
                boxShadow: '0 10px 15px -3px rgba(34, 211, 238, 0.2)',
                '&:hover': {
                  bgcolor: theme.palette.semantic.info.main,
                },
              }
            : {
                bgcolor: 'transparent',
                color: '#94a3b8',
                '&:hover': {
                  color: 'white',
                  bgcolor: theme.palette.base.whiteAlpha[50],
                },
              }),
        }}
      >
        <BoxIcon size={14} />
        <span>3D</span>
      </Button>
    </Box>
  );
};

export default ViewToggle;
