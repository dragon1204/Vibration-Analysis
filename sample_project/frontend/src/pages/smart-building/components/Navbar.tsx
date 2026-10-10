import {
  Box,
  Button,
  Divider,
  IconButton,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  BoxIcon,
  Camera,
  Car,
  GitBranch,
  Globe,
  LayoutGrid,
  Thermometer,
  Users,
  Zap,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  tooltip: string;
}

const Navbar = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const getActiveTab = () => {
    const pathParts = location.pathname.split('/').filter(Boolean);
    return pathParts[2] || 'overview';
  };

  const activeTab = getActiveTab();
  const handleTabClick = (tabId: string) => {
    const pathParts = location.pathname.split('/').filter(Boolean);
    const basePath = `/${pathParts.slice(0, 2).join('/')}`;
    navigate(`${basePath}/${tabId}`);
  };

  const navItems: NavItem[] = [
    {
      id: 'overview',
      label: 'Toàn cảnh',
      icon: <LayoutGrid size={14} />,
      tooltip: 'Chuyển sang Toàn cảnh',
    },
    {
      id: 'bms',
      label: 'BMS',
      icon: <Thermometer size={14} />,
      tooltip: 'Chuyển sang BMS',
    },
    {
      id: 'cctv',
      label: 'CCTV',
      icon: <Camera size={14} />,
      tooltip: 'Chuyển sang CCTV',
    },
    {
      id: 'ems',
      label: 'EMS',
      icon: <Zap size={14} />,
      tooltip: 'Chuyển sang EMS',
    },
    {
      id: 'acs',
      label: 'ACS',
      icon: <BoxIcon size={14} />,
      tooltip: 'Chuyển sang ACS',
    },
    {
      id: 'parking',
      label: 'Car Parking',
      icon: <Car size={14} />,
      tooltip: 'Chuyển sang Car Parking',
    },
    {
      id: 'ioc',
      label: 'IOC',
      icon: <Globe size={14} />,
      tooltip: 'Chuyển sang IOC',
    },
    {
      id: 'device-rules',
      label: 'RULES',
      icon: <GitBranch size={14} />,
      tooltip: 'Quản lý Hoạt cảnh & Ràng buộc',
    },
    {
      id: 'users',
      label: 'SYS',
      icon: <Users size={14} />,
      tooltip: 'Chuyển sang Quản lý Hệ Thống',
    },
  ];

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.5,
        bgcolor: 'rgba(2, 6, 23, 0.9)',
        borderRadius: 4,
        p: 0.75,
        width: 'fit-content',
        mx: 'auto',
        backdropFilter: 'blur(10px)',
        border: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          backgroundColor: 'rgb(19, 25, 39)',
          borderRadius: 3,
          transition: '0.2s',
          position: 'relative',
        }}
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const button = (
            <Button
              onClick={() => handleTabClick(item.id)}
              sx={{
                mt: 0.5,
                mb: 0.5,
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                px: 2,
                py: 1,
                borderRadius: 2,
                fontSize: '11px',
                fontWeight: 'bold',
                letterSpacing: '0.1em',
                transition: 'all 0.2s',
                position: 'relative',
                minWidth: 'auto',
                whiteSpace: 'nowrap',
                ...(isActive
                  ? {
                      bgcolor: '#00B8DB',
                      color: '#0f172a',
                      boxShadow: `0 4px 14px 0 ${theme.palette.base.cyanAlpha[200]}`,
                    }
                  : {
                      color: '#94a3b8',
                      '&:hover': {
                        color: 'white',
                        bgcolor: theme.palette.base.whiteAlpha[50],
                      },
                    }),
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </Button>
          );

          return isActive ? (
            <Box key={item.id}>{button}</Box>
          ) : (
            <Tooltip
              key={item.id}
              title={item.tooltip}
              placement="top"
              slotProps={{
                tooltip: {
                  sx: {
                    bgcolor: 'rgb(15, 23, 43)',
                    color: 'white',
                    fontSize: '0.6rem',
                    px: 2,
                    py: 1,
                    borderRadius: 1,
                    border: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
                  },
                },
              }}
            >
              {button}
            </Tooltip>
          );
        })}
      </Box>

      <Divider
        orientation="vertical"
        flexItem
        sx={{
          bgcolor: theme.palette.base.whiteAlpha[100],
          width: '1px',
        }}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <IconButton
          sx={{
            p: 1.25,
            borderRadius: 3,
            bgcolor: theme.palette.base.whiteAlpha[50],
            color: '#cbd5e1',
            '&:hover': {
              bgcolor: theme.palette.base.whiteAlpha[100],
            },
          }}
        >
          <LayoutGrid size={23} />
        </IconButton>
      </Box>
    </Box>
  );
};

export default Navbar;
