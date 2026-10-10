import { Box, Typography, useTheme } from '@mui/material';

interface AlertItemProps {
  system: string;
  time: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  onClick?: () => void;
}

const AlertItem = ({
  system,
  time,
  message,
  severity,
  onClick,
}: AlertItemProps) => {
  const theme = useTheme();
  const severityConfig = {
    critical: theme.palette.semantic.error.main,
    warning: theme.palette.semantic.warning.main,
    info: '#3b82f6',
  };

  const dotColor = severityConfig[severity];

  return (
    <Box
      onClick={onClick}
      sx={{
        padding: '12px',
        borderRadius: '12px',
        backgroundColor: theme.palette.base.whiteAlpha[50],
        border: `1px solid ${theme.palette.base.whiteAlpha[50]}`,
        cursor: 'pointer',
        transition: 'all 0.2s',
        '&:hover': {
          borderColor: theme.palette.base.whiteAlpha[200],
          '& .message': {
            color: 'white',
          },
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '4px',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Box
            sx={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: dotColor,
            }}
          />
          <Typography
            sx={{
              fontSize: '10px',
              fontWeight: 'bold',
              color: 'rgb(203, 213, 225)',
            }}
          >
            {system}
          </Typography>
        </Box>
        <Typography
          sx={{
            fontSize: '10px',
            color: 'rgb(100, 116, 139)',
          }}
        >
          {time}
        </Typography>
      </Box>
      <Typography
        className="message"
        sx={{
          fontSize: '11px',
          color: 'rgb(148, 163, 184)',
          transition: 'color 0.2s',
        }}
      >
        {message}
      </Typography>
    </Box>
  );
};

const LatestAlert = () => {
  const theme = useTheme();
  const alerts = [
    {
      system: 'CCTV',
      time: '14:20',
      message: 'Mất kết nối Camera 04-F2',
      severity: 'critical' as const,
    },
    {
      system: 'ACS',
      time: '14:15',
      message: 'Cửa thoát hiểm mở lâu',
      severity: 'warning' as const,
    },
    {
      system: 'BMS',
      time: '14:02',
      message: 'Nhiệt độ phòng Server cao',
      severity: 'critical' as const,
    },
    {
      system: 'PMS',
      time: '13:55',
      message: 'Lỗi thanh chắn Lane B',
      severity: 'info' as const,
    },
  ];

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        paddingBottom: '16px',
      }}
    >
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
        Cảnh báo gần nhất
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {alerts.map((alert, index) => (
          <AlertItem
            key={index}
            system={alert.system}
            time={alert.time}
            message={alert.message}
            severity={alert.severity}
          />
        ))}
      </Box>
    </Box>
  );
};

export default LatestAlert;
