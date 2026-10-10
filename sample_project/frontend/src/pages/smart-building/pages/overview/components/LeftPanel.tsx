import { Box, IconButton, Typography, useTheme } from '@mui/material';

import AlertChart from './AlertChart';
import AlertNumber from './AlertNumber';
import EnergyChart from './EnergyChart';
import LatestAlert from './LatestAlert';
import SubsystemStatus from './SubsystemStatus';
import SystemStatus from './SystemStatus';
import TrendChart from './TrendChart';

// import { Maximize2 } from "lucide-react";

interface LeftPanelProps {
  onClose?: () => void;
}

const LeftPanel = ({ onClose }: LeftPanelProps) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        position: 'fixed',
        right: 0,
        overflowY: 'auto',
        backgroundColor: '#000000',
        width: '320px',
        height: '100vh',
        zIndex: theme.zIndex.fab,
        animation: 'slideInRightPanel 0.3s ease-out',
        '@keyframes slideInRightPanel': {
          '0%': {
            transform: 'translateX(100%)',
            opacity: 0,
          },
          '100%': {
            transform: 'translateX(0)',
            opacity: 1,
          },
        },
        '&::-webkit-scrollbar': {
          width: '4px',
        },
        '&::-webkit-scrollbar-track': {
          backgroundColor: 'transparent',
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: theme.palette.base.slateLightAlpha[300],
          borderRadius: '3px',
          '&:hover': {
            backgroundColor: '#08647F',
          },
          '&:active': {
            backgroundColor: '#08647F',
          },
        },
      }}
    >
      {/* Info */}
      <Box
        sx={{
          height: '72px',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          position: 'sticky',
          borderBottom: '1px solid #7a7a7a',
        }}
      >
        <Typography
          sx={{
            color: 'white',
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: '-0.025em',
            lineHeight: 1.2,
            flex: 1,
          }}
        >
          DASHBOARD – TỔNG QUAN VẬN HÀNH
        </Typography>

        {/* <IconButton
          sx={{
            color: 'rgba(255,255,255,0.7)',
            '&:hover': {
              color: 'rgba(255,255,255,1)',
              bgcolor: 'rgba(255,255,255,0.1)',
            },
          }}
        >
          <Maximize2 size={18} />
        </IconButton> */}

        <IconButton
          onClick={onClose}
          sx={{
            color: '#9DA4AE',
            '&:hover': {
              color: 'white',
              bgcolor: 'rgba(255,255,255,0.1)',
            },
            '& svg': {
              transition: 'stroke 0.2s ease',
            },
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="18" x="3" y="3" rx="2"></rect>
            <path d="M9 3v18"></path>
            <path d="m16 15-3-3 3-3"></path>
          </svg>
        </IconButton>
      </Box>

      <Box sx={{ p: 2, gap: 3, display: 'flex', flexDirection: 'column' }}>
        <AlertNumber />
        <AlertChart />
        <EnergyChart />
        <SystemStatus />
        <TrendChart />
        <SubsystemStatus />
        <LatestAlert />
      </Box>
    </Box>
  );
};

export default LeftPanel;
