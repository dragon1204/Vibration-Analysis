import CloseIcon from '@mui/icons-material/Close';
import {
  Backdrop,
  Box,
  Button,
  Chip,
  IconButton,
  Typography,
  useTheme,
} from '@mui/material';
import type { ReactNode } from 'react';

interface StatPanelProps {
  open: boolean;
  module?: string;
  title: string;
  status?: 'online' | 'offline';
  onClose?: () => void;
  onViewReport?: () => void;
  children: ReactNode;
}

const StatPanel = ({
  open,
  module,
  title,
  status = 'online',
  onClose,
  onViewReport,
  children,
}: StatPanelProps) => {
  const theme = useTheme();
  return (
    <>
      <Backdrop
        open={open}
        onClick={onClose}
        sx={{
          zIndex: 1200,
          backgroundColor: theme.palette.base.blackAlpha[200],
        }}
      />
      <Box
        sx={{
          zIndex: 1300,
          width: 420,
          height: 'calc(100vh - 120px)',
          position: 'fixed',
          right: open ? 24 : -460,
          top: 90,
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(180deg, #0B1220 0%, #0F172A 100%)',
          backdropFilter: 'blur(16px)',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '-10px 0 40px rgba(0,0,0,0.6)',
          transition: 'right 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          outline: 'none',
          p: 1,
        }}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Box display="flex" justifyContent="space-between">
            <Box>
              {module && (
                <Typography
                  sx={{
                    fontSize: 12,
                    letterSpacing: '0.12em',
                    color: '#94A3B8',
                    mb: 0.5,
                  }}
                >
                  {module.toUpperCase()}
                </Typography>
              )}
              <Typography sx={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>
                {title}
              </Typography>
            </Box>
            <IconButton onClick={onClose}>
              <CloseIcon sx={{ color: '#94A3B8' }} />
            </IconButton>
          </Box>
          <Chip
            label={status.toUpperCase()}
            size="small"
            sx={{
              mt: 1,
              width: 'fit-content',
              px: 1,
              py: 1.8,
              textAlign: 'center',
              borderRadius: 2,
              border: '1px solid',
              borderColor:
                status === 'online'
                  ? theme.palette.semantic.success.main
                  : theme.palette.semantic.error.main,
              backgroundColor:
                status === 'online'
                  ? 'rgba(16,185,129,0.1)'
                  : 'rgba(239,68,68,0.1)',
              color:
                status === 'online'
                  ? theme.palette.semantic.success.main
                  : theme.palette.semantic.error.main,
              fontWeight: 600,
            }}
          />
        </Box>

        <Box
          sx={{
            flex: 1,
            p: 2,
            overflowY: 'auto',
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-thumb': {
              background: 'rgba(255,255,255,0.15)',
              borderRadius: 2,
            },
          }}
        >
          {children}
        </Box>

        <Box
          sx={{ py: 1.5, px: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <Button
            fullWidth
            onClick={onViewReport}
            sx={{
              height: 40,
              borderRadius: 2,
              fontWeight: 700,
              color: theme.palette.semantic.info.light,
              background: 'linear-gradient(180deg, #0B2942 0%, #062032 100%)',
              border: '1px solid rgba(34,211,238,0.3)',
              '&:hover': {
                background: 'linear-gradient(180deg, #0E3A5A 0%, #08304A 100%)',
              },
            }}
          >
            VIEW FULL REPORT
          </Button>
        </Box>
      </Box>
    </>
  );
};

export default StatPanel;
