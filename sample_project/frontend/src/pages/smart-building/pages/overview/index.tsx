import {
  Backdrop,
  Box,
  Tooltip,
  styled,
  tooltipClasses,
} from '@mui/material';
import { BoxIcon, Camera, Car, Thermometer, Zap } from 'lucide-react';
import { useState } from 'react';

import Overview3dImage from '@/assets/images/3D-overview.png';
import { theme } from '@/theme';
import DevicePanel from '../../components/DevicePanel';
import DevicePopup from '../../components/DevicePopup';
import Footer from './components/Footer';
import LeftPanel from './components/LeftPanel';
import RightPanel from './components/RightPanel';

const CustomTooltip = styled(({ className, ...props }: any) => (
  <Tooltip {...props} classes={{ popper: className }} />
))({
  [`& .${tooltipClasses.tooltip}`]: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(34, 211, 238, 0.3)',
    borderRadius: '12px',
    padding: '12px 16px',
    fontSize: '13px',
    fontWeight: 500,
    maxWidth: 220,
  },
  [`& .${tooltipClasses.arrow}`]: {
    color: 'rgba(15, 23, 42, 0.95)',
    '&::before': {
      border: '1px solid rgba(34, 211, 238, 0.3)',
    },
  },
});

const Overview = () => {
  const [leftOpen, setLeftOpen] = useState(false);
  const [deviceOpen, setDeviceOpen] = useState(false);
  const [selectedDeviceState, setSelectedDeviceState] = useState<any>(null);


  const buildingIcons = [
    {
      icon: <Zap size={18} />,
      color: theme.palette.warning.main,
      position: { top: '37%', left: '35%' },
      tooltip: {
        title: 'TỦ ĐIỆN TỔNG',
        subtitle: 'Tải cao (85%)',
        status: 'Trạng thái: Cảnh báo',
        statusColor: theme.palette.warning.main,
      },
      deviceData: {
        name: 'Tủ điện tổng',
        temperature: 42,
        status: 'Cảnh báo',
      },
    },
    {
      icon: <Thermometer size={18} />,
      color: 'rgba(6, 182, 212, 0.9)',
      position: { top: '40%', right: '35%' },
      tooltip: {
        title: 'CẢM BIẾN NHIỆT ĐỘ',
        subtitle: 'Nhiệt độ: 24°C',
        status: 'Trạng thái: Hoạt động tốt',
        statusColor: theme.palette.semantic.success.main,
      },
      deviceData: {
        name: 'Cảm biến Tầng 5',
        temperature: 24.5,
        status: 'Hoạt động',
      },
    },
    {
      icon: <Camera size={18} />,
      color: 'rgba(190, 18, 60, 0.9)',
      position: { bottom: '30%', right: '27%' },
      tooltip: {
        title: 'CAMERA SẢNH CHÍNH',
        subtitle: 'Kết nối ổn định',
        status: 'Trạng thái: Hoạt động',
        statusColor: theme.palette.semantic.success.main,
      },
      deviceData: {
        name: 'Camera Sảnh Chính',
        temperature: 28,
        status: 'Hoạt động',
      },
    },
    {
      icon: <BoxIcon size={18} />,
      color: 'rgba(21, 94, 117, 0.9)',
      position: { bottom: '25%', left: '40%' },
      tooltip: {
        title: 'SERVER ROOM',
        subtitle: 'Ổn định',
        status: 'Trạng thái: Bình thường',
        statusColor: theme.palette.semantic.success.main,
      },
      deviceData: {
        name: 'Server Room',
        temperature: 22,
        status: 'Hoạt động',
      },
    },
    {
      icon: <Car size={18} />,
      color: 'rgba(21, 94, 117, 0.9)',
      position: { bottom: '20%', left: '30%' },
      tooltip: {
        title: 'CỔNG VÀO A',
        subtitle: 'Barrier hoạt động tốt',
        status: 'Trạng thái: Bình thường',
        statusColor: theme.palette.semantic.success.main,
      },
      deviceData: {
        name: 'Cổng vào A',
        temperature: 25,
        status: 'Hoạt động',
      },
    },
  ];

  const handleDeviceClick = (device: any) => {
    setSelectedDeviceState(device.deviceData);
    setDeviceOpen(true);
  };

  const handleCloseDevice = () => {
    setDeviceOpen(false);
    setSelectedDeviceState(null);
  };

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 90,
        left: 300,
        right: 0,
        bottom: 70,
        display: 'flex',
        overflow: 'hidden',
        zIndex: 1,
      }}
    >
      {/* Main content area — building image + icons */}
      <Box
        sx={{
          flex: 1,
          position: 'relative',
          backgroundImage: `url(${Overview3dImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `
              radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 100%),
              linear-gradient(to right, rgba(0,0,0,0.5) 0%, transparent 15%, transparent 85%, rgba(0,0,0,0.5) 100%),
              linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 15%, transparent 85%, rgba(0,0,0,0.4) 100%)
            `,
            pointerEvents: 'none',
          },
        }}
      >
        {/* Building Icons */}
        {buildingIcons.map((item, index) => (
          <CustomTooltip
            key={index}
            title={
              <Box>
                <Box
                  sx={{
                    fontSize: '12px',
                    color: theme.palette.semantic.info.light,
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    mb: 0.5,
                  }}
                >
                  {item.tooltip.title}
                </Box>
                <Box
                  sx={{
                    fontSize: '12px',
                    color: 'white',
                    fontWeight: 600,
                    mb: 0.5,
                  }}
                >
                  {item.tooltip.subtitle}
                </Box>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    fontSize: '10px',
                    fontWeight: 'bold',
                    letterSpacing: '0.05em',
                  }}
                >
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      bgcolor: item.tooltip.statusColor,
                      boxShadow: `0 0 8px ${item.tooltip.statusColor}`,
                    }}
                  />
                  <Box sx={{ color: item.tooltip.statusColor }}>
                    {item.tooltip.status}
                  </Box>
                </Box>
              </Box>
            }
            arrow
            placement="top"
          >
            <Box
              onClick={() => handleDeviceClick(item)}
              sx={{
                position: 'absolute',
                ...item.position,
                zIndex: 5,
                width: 40,
                height: 40,
                borderRadius: '50%',
                bgcolor: item.color,
                backdropFilter: 'blur(8px)',
                border: `2px solid ${theme.palette.base.whiteAlpha[200]}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                cursor: 'pointer',
                boxShadow: `0 0 30px ${item.color}, 0 8px 16px ${theme.palette.base.blackAlpha[300]}`,
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'scale(1.15)',
                  boxShadow: `0 0 60px ${item.color}, 0 16px 32px ${theme.palette.base.blackAlpha[500]}`,
                  border: `2px solid ${theme.palette.base.whiteAlpha[400]}`,
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  inset: -4,
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${item.color}40 0%, transparent 70%)`,
                  zIndex: -1,
                },
              }}
            >
              {item.icon}
            </Box>
          </CustomTooltip>
        ))}

        {/* Footer inside image area */}
        <Footer />
      </Box>

      {/* Right Panel — always visible, side by side */}
      <RightPanel />

      {/* LeftPanel — overlay when opened */}
      {leftOpen && <LeftPanel onClose={() => setLeftOpen(false)} />}

      {/* Device Backdrop */}
      <Backdrop
        open={deviceOpen}
        onClick={handleCloseDevice}
        sx={{
          zIndex: theme.zIndex.modal - 1,
          bgcolor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Device Popup */}
      {selectedDeviceState && (
        <DevicePopup
          open={deviceOpen}
          onClose={handleCloseDevice}
          deviceName={selectedDeviceState.name}
          temperature={selectedDeviceState.temperature}
          status={selectedDeviceState.status}
        />
      )}

      {/* Device Panel */}
      <DevicePanel open={deviceOpen} onClose={handleCloseDevice} />
    </Box>
  );
};

export default Overview;

