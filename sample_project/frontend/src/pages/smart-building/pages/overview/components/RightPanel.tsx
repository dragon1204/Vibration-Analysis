import {
  Box,
  IconButton,
  LinearProgress,
  Typography,
  useTheme,
} from '@mui/material';
import {
  Activity,
  Bike,
  Car,
  ChevronRight,
  Maximize2,
  UserCheck,
  UserPlus,
  UserX,
  Users,
} from 'lucide-react';
import { useState } from 'react';

import RightPanelFullscreen from './RightPanelFullscreen';

interface RightPanelProps {
  onClose?: () => void;
}

const RightPanel = ({ onClose }: RightPanelProps) => {
  const theme = useTheme();
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  return (
    <>
      <Box
        sx={{
          width: 300,
          minWidth: 300,
          height: '100%',
          bgcolor: theme.palette.base.slateDarkAlpha[400],
          borderLeft: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 2,
            borderBottom: `1px solid ${theme.palette.base.whiteAlpha[50]}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: theme.palette.base.whiteAlpha[50],
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: 'rgba(34, 211, 238, 1)',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                boxShadow: '0 0 8px rgba(34, 211, 238, 0.8)',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.5 },
                },
              }}
            />
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 700,
                color: 'white',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Thống kê hiện tại
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              onClick={() => setFullscreenOpen(true)}
              size="small"
              sx={{
                p: 0.5,
                borderRadius: 2,
                color: theme.palette.base.slateLightAlpha[1000],
                '&:hover': {
                  bgcolor: theme.palette.base.whiteAlpha[100],
                  color: 'rgba(34, 211, 238, 1)',
                },
                transition: 'all 0.2s',
              }}
              title="Mở rộng toàn màn hình"
            >
              <Maximize2 size={16} />
            </IconButton>

            <IconButton
              onClick={onClose}
              size="small"
              sx={{
                p: 0.5,
                borderRadius: 2,
                color: theme.palette.base.slateLightAlpha[1000],
                '&:hover': {
                  bgcolor: theme.palette.base.whiteAlpha[100],
                  color: 'white',
                },
                transition: 'all 0.2s',
              }}
            >
              <ChevronRight size={16} />
            </IconButton>
          </Box>
        </Box>

        {/* Content */}
        <Box sx={{
          p: 2.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          flex: 1,
          overflowY: 'auto',
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.1)', borderRadius: 2 },
        }}>
          {/* People Section */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Typography
                sx={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: theme.palette.base.slateLightAlpha[1000],
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                Số người trong tòa nhà
              </Typography>
              <Users size={14} color="rgba(100, 116, 139, 1)" />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
              <Typography
                sx={{
                  fontSize: 32,
                  fontWeight: 700,
                  color: 'white',
                  letterSpacing: '-0.05em',
                }}
              >
                1,248
              </Typography>
              <Typography
                sx={{
                  fontSize: 10,
                  color: 'rgba(52, 211, 153, 1)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                Người
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {/* Internal Staff */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      p: 0.75,
                      borderRadius: 2,
                      bgcolor: 'rgba(52, 211, 153, 0.1)',
                      color: 'rgba(52, 211, 153, 1)',
                      display: 'flex',
                    }}
                  >
                    <UserCheck size={12} />
                  </Box>
                  <Typography
                    sx={{ fontSize: 12, color: 'rgba(203, 213, 225, 1)' }}
                  >
                    Nhân sự nội bộ
                  </Typography>
                </Box>
                <Typography
                  sx={{ fontSize: 12, fontWeight: 700, color: 'white' }}
                >
                  842
                </Typography>
              </Box>

              {/* Visitors */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      p: 0.75,
                      borderRadius: 2,
                      bgcolor: 'rgba(251, 191, 36, 0.1)',
                      color: 'rgba(251, 191, 36, 1)',
                      display: 'flex',
                    }}
                  >
                    <UserPlus size={12} />
                  </Box>
                  <Typography
                    sx={{ fontSize: 12, color: 'rgba(203, 213, 225, 1)' }}
                  >
                    Khách vãng lai
                  </Typography>
                </Box>
                <Typography
                  sx={{ fontSize: 12, fontWeight: 700, color: 'white' }}
                >
                  394
                </Typography>
              </Box>

              {/* Unknown */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      p: 0.75,
                      borderRadius: 2,
                      bgcolor: theme.palette.semantic.error.backgroundLight,
                      color: 'rgba(239, 68, 68, 1)',
                      display: 'flex',
                    }}
                  >
                    <UserX size={12} />
                  </Box>
                  <Typography
                    sx={{ fontSize: 12, color: 'rgba(203, 213, 225, 1)' }}
                  >
                    Đối tượng lạ
                  </Typography>
                </Box>
                <Typography
                  sx={{ fontSize: 12, fontWeight: 700, color: 'white' }}
                >
                  12
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Divider */}
          <Box
            sx={{ height: '1px', bgcolor: theme.palette.base.whiteAlpha[50] }}
          />

          {/* Vehicles Section */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Typography
                sx={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: theme.palette.base.slateLightAlpha[1000],
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                Số phương tiện hiện tại
              </Typography>
              <Activity size={14} color="rgba(100, 116, 139, 1)" />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Cars */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Car size={12} color="rgba(34, 211, 238, 1)" />
                    <Typography
                      sx={{ fontSize: 10, color: 'rgba(203, 213, 225, 1)' }}
                    >
                      Ô tô
                    </Typography>
                  </Box>
                  <Typography
                    sx={{ fontSize: 10, color: 'white', fontWeight: 700 }}
                  >
                    145 / 200
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={72.5}
                  sx={{
                    height: 4,
                    borderRadius: 2,
                    bgcolor: 'rgba(30, 41, 59, 1)',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: 'rgba(34, 211, 238, 1)',
                      boxShadow: '0 0 8px rgba(34, 211, 238, 0.5)',
                    },
                  }}
                />
              </Box>

              {/* Motorcycles */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Bike size={12} color="rgba(34, 211, 238, 1)" />
                    <Typography
                      sx={{ fontSize: 10, color: 'rgba(203, 213, 225, 1)' }}
                    >
                      Xe máy
                    </Typography>
                  </Box>
                  <Typography
                    sx={{ fontSize: 10, color: 'white', fontWeight: 700 }}
                  >
                    482 / 600
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={80.3}
                  sx={{
                    height: 4,
                    borderRadius: 2,
                    bgcolor: 'rgba(30, 41, 59, 1)',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: 'rgba(34, 211, 238, 1)',
                      boxShadow: '0 0 8px rgba(34, 211, 238, 0.5)',
                    },
                  }}
                />
              </Box>
            </Box>
          </Box>

          {/* Footer */}
          <Box
            sx={{
              pt: 1,
              borderTop: `1px solid ${theme.palette.base.whiteAlpha[50]}`,
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography
                sx={{
                  fontSize: 8,
                  color: 'rgba(100, 116, 139, 1)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                Dữ liệu mô phỏng
              </Typography>
              <Typography
                sx={{
                  fontSize: 8,
                  color: 'rgba(34, 211, 238, 0.6)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontWeight: 700,
                }}
              >
                Cập nhật theo thời gian thực (demo)
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      <RightPanelFullscreen
        open={fullscreenOpen}
        onClose={() => setFullscreenOpen(false)}
      />
    </>
  );
};

export default RightPanel;
