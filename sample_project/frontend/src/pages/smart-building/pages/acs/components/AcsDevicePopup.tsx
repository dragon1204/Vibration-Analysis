import { Box, IconButton, Typography, useTheme } from '@mui/material';
import { Activity, X } from 'lucide-react';

interface AcsDevicePopupProps {
  open: boolean;
  onClose: () => void;
  deviceName?: string;
  cpuUsage?: number;
  memory?: number;
  storage?: number;
  status?: string;
}

const AcsDevicePopup = ({
  open,
  onClose,
  deviceName = 'Server Room',
  cpuUsage = 55,
  memory = 90,
  storage = 256,
  status = 'Hoạt động',
}: AcsDevicePopupProps) => {
  const theme = useTheme();

  const metrics = [
    { label: 'CPU Usage', value: cpuUsage, unit: '%' },
    { label: 'Memory', value: memory, unit: '%' },
    { label: 'Storage', value: storage, unit: 'GB' },
    { label: 'Uptime', value: '30 mins ago', unit: '' },
  ];

  if (!open) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: '380px',
        zIndex: theme.zIndex.modal,
        bgcolor: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(24px)',
        border: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
        borderRadius: '16px',
        boxShadow: `0 25px 50px -12px ${theme.palette.base.blackAlpha[250]}`,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2.5,
          py: 2,
          borderBottom: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
          bgcolor: 'rgba(2, 6, 23, 0.4)',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'start',
            justifyContent: 'space-between',
            mb: 1.5,
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography
              sx={{
                fontSize: '0.875rem',
                fontWeight: 'bold',
                color: 'white',
                mb: 0.5,
              }}
            >
              {deviceName}
            </Typography>
            <Typography
              sx={{
                fontSize: '0.75rem',
                color: '#94a3b8',
              }}
            >
              {cpuUsage}%
            </Typography>
          </Box>
          <IconButton
            onClick={onClose}
            sx={{
              p: 1,
              borderRadius: '8px',
              color: '#94a3b8',
              '&:hover': {
                bgcolor: theme.palette.base.whiteAlpha[100],
                color: 'white',
              },
            }}
          >
            <X size={18} />
          </IconButton>
        </Box>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 0.75,
            borderRadius: '8px',
            border: `1px solid ${theme.palette.semantic.success.background}`,
            bgcolor: 'rgba(16, 185, 129, 0.1)',
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: theme.palette.semantic.success.main,
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.5 },
              },
            }}
          />
          <Typography
            sx={{
              fontSize: '0.75rem',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              color: theme.palette.semantic.success.main,
            }}
          >
            {status}
          </Typography>
        </Box>
      </Box>

      {/* Content - Metrics Grid */}
      <Box sx={{ p: 2.5 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 1.5,
          }}
        >
          {metrics.map((metric, index) => (
            <Box
              key={index}
              sx={{
                bgcolor: theme.palette.base.whiteAlpha[50],
                border: `1px solid ${theme.palette.base.whiteAlpha[50]}`,
                borderRadius: '12px',
                p: 1.5,
                transition: 'background-color 0.2s',
                '&:hover': {
                  bgcolor: theme.palette.base.whiteAlpha[100],
                },
              }}
            >
              <Typography
                sx={{
                  fontSize: '10px',
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  mb: 0.5,
                }}
              >
                {metric.label}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                <Typography
                  sx={{
                    fontSize: '1.125rem',
                    fontWeight: 'bold',
                    color: 'white',
                  }}
                >
                  {metric.value}
                </Typography>
                {metric.unit && (
                  <Typography
                    sx={{
                      fontSize: '0.75rem',
                      color: '#94a3b8',
                    }}
                  >
                    {metric.unit}
                  </Typography>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          px: 2.5,
          py: 1.5,
          borderTop: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
          bgcolor: 'rgba(2, 6, 23, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Activity size={14} color={theme.palette.semantic.info.light} />
          <Typography
            sx={{
              fontSize: '0.75rem',
              color: '#94a3b8',
            }}
          >
            Last updated: Just now
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default AcsDevicePopup;
