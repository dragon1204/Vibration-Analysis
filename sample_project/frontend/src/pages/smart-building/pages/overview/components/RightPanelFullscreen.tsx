import { Box, IconButton, Typography, useTheme } from '@mui/material';
import {
  Activity,
  Bike,
  Car,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { useEffect } from 'react';

interface RightPanelFullscreenProps {
  open: boolean;
  onClose: () => void;
}

const RightPanelFullscreen = ({ open, onClose }: RightPanelFullscreenProps) => {
  const theme = useTheme();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: theme.zIndex.modal,
        bgcolor: theme.palette.base.blackAlpha[400],
        backdropFilter: 'blur(12px)',
        opacity: open ? 1 : 0,
        transition: 'opacity 0.3s',
      }}
      onClick={onClose}
    >
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <Box
          sx={{
            px: 4,
            py: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
            bgcolor: 'rgba(2, 6, 23, 0.4)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 3,
                background: `linear-gradient(to bottom right, ${theme.palette.semantic.info.main}, #2563eb)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 10px 15px -3px ${theme.palette.base.cyanAlpha[300]}`,
              }}
            >
              <Users size={24} color="white" />
            </Box>
            <Box>
              <Typography
                sx={{
                  fontSize: 24,
                  fontWeight: 'bold',
                  color: 'white',
                  textTransform: 'uppercase',
                  letterSpacing: '-0.025em',
                }}
              >
                Thống kê hiện tại
              </Typography>
              <Typography
                sx={{
                  fontSize: 14,
                  color: '#94a3b8',
                }}
              >
                Chế độ tập trung toàn màn hình
              </Typography>
            </Box>
          </Box>

          <IconButton
            onClick={onClose}
            sx={{
              p: 1.5,
              borderRadius: 3,
              border: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
              color: '#94a3b8',
              '&:hover': {
                bgcolor: theme.palette.base.whiteAlpha[100],
                color: 'white',
              },
              transition: 'all 0.2s',
            }}
            title="Đóng (ESC)"
          >
            <X size={24} />
          </IconButton>
        </Box>

        {/* Content */}
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            p: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: theme.palette.base.slateLightAlpha[300],
              borderRadius: '4px',
              '&:hover': {
                backgroundColor: theme.palette.base.slateLightAlpha[500],
              },
            },
          }}
        >
          <Box sx={{ maxWidth: 1024, width: '100%' }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                gap: 4,
              }}
            >
              {/* People Section */}
              <Box
                sx={{
                  bgcolor: theme.palette.base.slateDarkAlpha[400],
                  backdropFilter: 'blur(12px)',
                  border: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
                  borderRadius: 6,
                  p: 4,
                  boxShadow: `0 25px 50px -12px ${theme.palette.base.blackAlpha[250]}`,
                  animation: 'slideUp 0.6s ease-out',
                  '@keyframes slideUp': {
                    '0%': {
                      opacity: 0,
                      transform: 'translateY(40px)',
                    },
                    '100%': {
                      opacity: 1,
                      transform: 'translateY(0)',
                    },
                  },
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 3,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#94a3b8',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                    }}
                  >
                    Số người trong tòa nhà
                  </Typography>
                  <Users size={20} color="#64748b" />
                </Box>

                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 1.5,
                    mb: 4,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: 64,
                      fontWeight: 'bold',
                      color: 'white',
                      letterSpacing: '-0.05em',
                      lineHeight: 1,
                    }}
                  >
                    1,248
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: 14,
                      color: theme.palette.semantic.success.light,
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                    }}
                  >
                    Người
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Internal Staff */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 2,
                      borderRadius: 3,
                      bgcolor: theme.palette.base.whiteAlpha[50],
                      border: `1px solid ${theme.palette.base.whiteAlpha[50]}`,
                    }}
                  >
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}
                    >
                      <Box
                        sx={{
                          p: 1,
                          borderRadius: 2,
                          bgcolor: 'rgba(52, 211, 153, 0.1)',
                          color: theme.palette.semantic.success.light,
                          display: 'flex',
                        }}
                      >
                        <UserCheck size={18} />
                      </Box>
                      <Typography sx={{ fontSize: 14, color: '#cbd5e1' }}>
                        Nhân sự nội bộ
                      </Typography>
                    </Box>
                    <Typography
                      sx={{ fontSize: 24, fontWeight: 'bold', color: 'white' }}
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
                      p: 2,
                      borderRadius: 3,
                      bgcolor: theme.palette.base.whiteAlpha[50],
                      border: `1px solid ${theme.palette.base.whiteAlpha[50]}`,
                    }}
                  >
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}
                    >
                      <Box
                        sx={{
                          p: 1,
                          borderRadius: 2,
                          bgcolor: 'rgba(251, 191, 36, 0.1)',
                          color: theme.palette.semantic.warning.light,
                          display: 'flex',
                        }}
                      >
                        <UserPlus size={18} />
                      </Box>
                      <Typography sx={{ fontSize: 14, color: '#cbd5e1' }}>
                        Khách vãng lai
                      </Typography>
                    </Box>
                    <Typography
                      sx={{ fontSize: 24, fontWeight: 'bold', color: 'white' }}
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
                      p: 2,
                      borderRadius: 3,
                      bgcolor: theme.palette.base.whiteAlpha[50],
                      border: `1px solid ${theme.palette.base.whiteAlpha[50]}`,
                    }}
                  >
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}
                    >
                      <Box
                        sx={{
                          p: 1,
                          borderRadius: 2,
                          bgcolor: theme.palette.semantic.error.backgroundLight,
                          color: theme.palette.semantic.error.light,
                          display: 'flex',
                        }}
                      >
                        <UserX size={18} />
                      </Box>
                      <Typography sx={{ fontSize: 14, color: '#cbd5e1' }}>
                        Đối tượng lạ
                      </Typography>
                    </Box>
                    <Typography
                      sx={{ fontSize: 24, fontWeight: 'bold', color: 'white' }}
                    >
                      12
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Vehicles Section */}
              <Box
                sx={{
                  bgcolor: theme.palette.base.slateDarkAlpha[400],
                  backdropFilter: 'blur(12px)',
                  border: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
                  borderRadius: 6,
                  p: 4,
                  boxShadow: `0 25px 50px -12px ${theme.palette.base.blackAlpha[250]}`,
                  animation: 'slideUp 0.3s ease-out 0.15s both',
                  '@keyframes slideUp': {
                    '0%': {
                      opacity: 0,
                      transform: 'translateY(40px)',
                    },
                    '100%': {
                      opacity: 1,
                      transform: 'translateY(0)',
                    },
                  },
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 3,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#94a3b8',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                    }}
                  >
                    Số phương tiện hiện tại
                  </Typography>
                  <Activity size={20} color="#64748b" />
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {/* Cars */}
                  <Box
                    sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}
                      >
                        <Box
                          sx={{
                            p: 1,
                            borderRadius: 2,
                            bgcolor: 'rgba(34, 211, 238, 0.1)',
                          }}
                        >
                          <Car
                            size={20}
                            color={theme.palette.semantic.info.light}
                          />
                        </Box>
                        <Typography
                          sx={{
                            fontSize: 16,
                            fontWeight: 600,
                            color: '#cbd5e1',
                          }}
                        >
                          Ô tô
                        </Typography>
                      </Box>
                      <Typography
                        sx={{
                          fontSize: 24,
                          color: 'white',
                          fontWeight: 'bold',
                        }}
                      >
                        145 / 200
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        height: 12,
                        width: '100%',
                        bgcolor: '#1e293b',
                        borderRadius: 10,
                        overflow: 'hidden',
                      }}
                    >
                      <Box
                        sx={{
                          height: '100%',
                          width: '72.5%',
                          background: `linear-gradient(to right, ${theme.palette.semantic.info.main}, #3b82f6)`,
                          boxShadow: '0 0 12px rgba(34, 211, 238, 0.6)',
                          animation: 'progressBar 0.6s ease-out 0.4s both',
                          '@keyframes progressBar': {
                            '0%': {
                              width: '0%',
                            },
                            '100%': {
                              width: '72.5%',
                            },
                          },
                        }}
                      />
                    </Box>

                    <Box
                      sx={{ display: 'flex', justifyContent: 'space-between' }}
                    >
                      <Typography sx={{ fontSize: 14, color: '#64748b' }}>
                        Tỷ lệ sử dụng: 72.5%
                      </Typography>
                      <Typography sx={{ fontSize: 14, color: '#64748b' }}>
                        Còn trống: 55
                      </Typography>
                    </Box>
                  </Box>

                  {/* Motorcycles */}
                  <Box
                    sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}
                      >
                        <Box
                          sx={{
                            p: 1,
                            borderRadius: 2,
                            bgcolor: 'rgba(34, 211, 238, 0.1)',
                          }}
                        >
                          <Bike
                            size={20}
                            color={theme.palette.semantic.info.light}
                          />
                        </Box>
                        <Typography
                          sx={{
                            fontSize: 16,
                            fontWeight: 600,
                            color: '#cbd5e1',
                          }}
                        >
                          Xe máy
                        </Typography>
                      </Box>
                      <Typography
                        sx={{
                          fontSize: 24,
                          color: 'white',
                          fontWeight: 'bold',
                        }}
                      >
                        482 / 600
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        height: 12,
                        width: '100%',
                        bgcolor: '#1e293b',
                        borderRadius: 10,
                        overflow: 'hidden',
                      }}
                    >
                      <Box
                        sx={{
                          height: '100%',
                          width: '80.3%',
                          background: `linear-gradient(to right, ${theme.palette.semantic.info.main}, #3b82f6)`,
                          boxShadow: '0 0 12px rgba(34, 211, 238, 0.6)',
                          animation: 'progressBar2 0.6s ease-out 0.4s both',
                          '@keyframes progressBar2': {
                            '0%': {
                              width: '0%',
                            },
                            '100%': {
                              width: '80.3%',
                            },
                          },
                        }}
                      />
                    </Box>

                    <Box
                      sx={{ display: 'flex', justifyContent: 'space-between' }}
                    >
                      <Typography sx={{ fontSize: 14, color: '#64748b' }}>
                        Tỷ lệ sử dụng: 80.3%
                      </Typography>
                      <Typography sx={{ fontSize: 14, color: '#64748b' }}>
                        Còn trống: 118
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Footer */}
                <Box
                  sx={{
                    mt: 4,
                    pt: 3,
                    borderTop: `1px solid ${theme.palette.base.whiteAlpha[50]}`,
                  }}
                >
                  <Box
                    sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
                  >
                    <Typography
                      sx={{
                        fontSize: 12,
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                      }}
                    >
                      Dữ liệu mô phỏng
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: 12,
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
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default RightPanelFullscreen;
