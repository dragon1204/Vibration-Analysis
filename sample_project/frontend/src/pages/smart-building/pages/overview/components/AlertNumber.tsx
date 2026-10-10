import { Box, Typography } from '@mui/material';

import { error, success, warning } from '@/configs/color';
import { theme } from '@/theme';

interface AlertCardProps {
  count: number;
  label: string;
  severity: 'critical' | 'warning' | 'normal';
}

const AlertCard = ({ count, label, severity }: AlertCardProps) => {
  const severityConfig = {
    critical: {
      bg: theme.palette.semantic.error.backgroundLight,
      border: 'rgba(239, 68, 68, 0.2)',
      textColor: error.main,
      labelColor: error.dark,
    },
    warning: {
      bg: 'rgba(245, 158, 11, 0.1)',
      border: 'rgba(245, 158, 11, 0.2)',
      textColor: warning.main,
      labelColor: warning.dark,
    },
    normal: {
      bg: 'rgba(16, 185, 129, 0.1)',
      border: theme.palette.semantic.success.background,
      textColor: success.main,
      labelColor: success.dark,
    },
  };

  const config = severityConfig[severity];

  return (
    <Box
      sx={{
        backgroundColor: config.bg,
        border: `1px solid ${config.border}`,
        padding: 1.5,
        borderRadius: 3,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Typography
        variant="h5"
        sx={{
          fontWeight: 'bold',
          color: config.textColor,
        }}
      >
        {count.toString().padStart(2, '0')}
      </Typography>
      <Typography
        sx={{
          fontSize: '10px',
          color: config.labelColor,
          textTransform: 'uppercase',
          fontWeight: 500,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
};

const AlertNumber = () => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography
        variant="caption"
        sx={{
          fontSize: '12px',
          fontWeight: 600,
          color: theme.palette.base.slateLightAlpha[1000],
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        Tổng quan cảnh báo
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 1,
        }}
      >
        <AlertCard count={3} label="Nghiêm trọng" severity="critical" />
        <AlertCard count={12} label="Cảnh báo" severity="warning" />
        <AlertCard count={85} label="Bình thường" severity="normal" />
      </Box>
    </Box>
  );
};

export default AlertNumber;
