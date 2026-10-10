import { Box, LinearProgress, Typography } from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';

interface StatusBarProps {
  label: string;
  value: number;
  color: string;
  shadowColor: string;
}

const StyledLinearProgress = styled(LinearProgress)<{
  barcolor: string;
  shadowcolor: string;
}>(({ barcolor, shadowcolor }) => ({
  height: 6,
  borderRadius: 9999,
  backgroundColor: 'rgb(30, 41, 59)',
  '& .MuiLinearProgress-bar': {
    backgroundColor: barcolor,
    boxShadow: `0 0 8px ${shadowcolor}`,
    borderRadius: 9999,
  },
}));

const StatusBar = ({ label, value, color, shadowColor }: StatusBarProps) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography
          sx={{
            fontSize: '12px',
            color: 'rgb(203, 213, 225)',
          }}
        >
          {label}
        </Typography>
        <Typography
          sx={{
            fontSize: '12px',
            fontWeight: 'bold',
            color: color,
          }}
        >
          {value}%
        </Typography>
      </Box>
      <StyledLinearProgress
        variant="determinate"
        value={value}
        barcolor={color}
        shadowcolor={shadowColor}
      />
    </Box>
  );
};

const SystemStatus = () => {
  const theme = useTheme();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
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
        Tình trạng hệ thống
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <StatusBar
          label="Tỷ lệ hoạt động"
          value={98}
          color={theme.palette.semantic.success.light}
          shadowColor="rgba(16, 185, 129, 0.5)"
        />
        <StatusBar
          label="Thiết bị lỗi"
          value={2}
          color={theme.palette.semantic.error.light}
          shadowColor="rgba(239, 68, 68, 0.5)"
        />
      </Box>
    </Box>
  );
};

export default SystemStatus;
