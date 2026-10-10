import { Box, Button, Typography, useTheme } from '@mui/material';
import {
  Camera,
  Car,
  ChevronRight,
  Lock,
  Thermometer,
  Zap,
} from 'lucide-react';

import { theme } from '@/theme';

interface SubsystemItemProps {
  icon: React.ReactNode;
  title: string;
  status: string;
  statusColor: string;
  onClick?: () => void;
}

const SubsystemItem = ({
  icon,
  title,
  status,
  statusColor,
  onClick,
}: SubsystemItemProps) => {
  const theme = useTheme();
  return (
    <Button
      onClick={onClick}
      sx={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px',
        borderRadius: '12px',
        backgroundColor: theme.palette.base.whiteAlpha[50],
        border: `1px solid ${theme.palette.base.whiteAlpha[50]}`,
        textTransform: 'none',
        justifyContent: 'flex-start',
        transition: 'all 0.2s',
        '&:hover': {
          backgroundColor: theme.palette.base.whiteAlpha[100],
          '& .icon-box': {
            backgroundColor: theme.palette.base.cyanAlpha[200],
          },
          '& .chevron': {
            color: 'white',
          },
        },
      }}
    >
      <Box
        className="icon-box"
        sx={{
          padding: '8px',
          borderRadius: '8px',
          backgroundColor: 'rgb(15, 23, 42)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
        }}
      >
        <Box sx={{ color: theme.palette.semantic.info.light, display: 'flex' }}>
          {icon}
        </Box>
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <Typography
          sx={{
            fontSize: '12px',
            fontWeight: 500,
            color: 'white',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </Typography>
        <Typography
          sx={{
            fontSize: '10px',
            fontWeight: 'bold',
            color: statusColor,
          }}
        >
          {status}
        </Typography>
      </Box>
      <ChevronRight
        className="chevron"
        size={14}
        style={{ color: 'rgb(71, 85, 105)', transition: 'all 0.2s' }}
      />
    </Button>
  );
};

const SubsystemStatus = () => {
  const subsystems = [
    {
      icon: <Thermometer size={18} />,
      title: 'BMS – Điều hoà',
      status: 'Hoạt động',
      statusColor: theme.palette.semantic.success.light,
    },
    {
      icon: <Camera size={18} />,
      title: 'CCTV – Giám sát',
      status: '148/150',
      statusColor: theme.palette.semantic.info.light,
    },
    {
      icon: <Zap size={18} />,
      title: 'EMS – tiêu thụ điện',
      status: '12.4 kWh',
      statusColor: theme.palette.semantic.warning.light,
    },
    {
      icon: <Lock size={18} />,
      title: 'ACS – cửa bất thường',
      status: 'Bình thường',
      statusColor: theme.palette.semantic.success.light,
    },
    {
      icon: <Car size={18} />,
      title: 'Car Parking – Bãi đỗ xe',
      status: '45 chỗ trống',
      statusColor: '#60a5fa',
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
        Trạng thái theo hệ
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {subsystems.map((subsystem, index) => (
          <SubsystemItem
            key={index}
            icon={subsystem.icon}
            title={subsystem.title}
            status={subsystem.status}
            statusColor={subsystem.statusColor}
          />
        ))}
      </Box>
    </Box>
  );
};

export default SubsystemStatus;
