import {
  Box,
  Button,
  IconButton,
  Slider,
  Typography,
  useTheme,
} from '@mui/material';
import { Thermometer, Wind, X } from 'lucide-react';
import { useState } from 'react';

import IllustrationImage from '@/assets/images/illustration.png';

interface DevicePanelProps {
  open: boolean;
  onClose: () => void;
}

const DevicePanel = ({ open, onClose }: DevicePanelProps) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [mode, setMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [setpoint, setSetpoint] = useState(22);

  const tabs = ['Tổng quan', 'Thiết bị', 'Cảnh báo', 'Biểu đồ'];

  if (!open) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        right: '24px',
        top: '96px',
        bottom: '24px',
        width: '400px',
        zIndex: theme.zIndex.modal,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: theme.palette.base.slateDarkAlpha[600],
        backdropFilter: 'blur(24px)',
        border: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
        borderRadius: '24px',
        boxShadow: `0 25px 50px -12px ${theme.palette.base.blackAlpha[250]}`,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
          bgcolor: theme.palette.base.whiteAlpha[50],
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '12px',
              bgcolor: 'rgba(34, 211, 238, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(34, 211, 238, 0.3)',
            }}
          >
            <Thermometer size={20} color={theme.palette.semantic.info.light} />
          </Box>
          <Box>
            <Typography
              sx={{
                fontSize: '10px',
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                mb: 0.25,
              }}
            >
              Hệ thống
            </Typography>
            <Typography
              sx={{
                fontSize: '0.875rem',
                fontWeight: 'bold',
                color: 'white',
              }}
            >
              Hệ thống BMS
            </Typography>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}
            >
              <Box
                sx={{
                  width: 6,
                  height: 6,
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
                  fontSize: '10px',
                  color: theme.palette.semantic.success.main,
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                Vận hành: Ổn định
              </Typography>
            </Box>
          </Box>
        </Box>
        <IconButton
          onClick={onClose}
          sx={{
            p: 1,
            borderRadius: '12px',
            color: '#94a3b8',
            '&:hover': {
              bgcolor: theme.palette.base.whiteAlpha[100],
            },
          }}
        >
          <X size={20} />
        </IconButton>
      </Box>

      {/* Tabs */}
      <Box
        sx={{
          display: 'flex',
          borderBottom: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
          px: 2,
          bgcolor: theme.palette.base.whiteAlpha[50],
        }}
      >
        {tabs.map((tab, index) => (
          <Button
            key={index}
            onClick={() => setActiveTab(index)}
            sx={{
              px: 2,
              py: 1.5,
              fontSize: '10px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color:
                activeTab === index
                  ? theme.palette.semantic.info.light
                  : '#64748b',
              position: 'relative',
              minWidth: 'auto',
              '&:hover': {
                color:
                  activeTab === index
                    ? theme.palette.semantic.info.light
                    : '#cbd5e1',
                bgcolor: 'transparent',
              },
              '&::after':
                activeTab === index
                  ? {
                      content: '""',
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '2px',
                      bgcolor: theme.palette.semantic.info.light,
                      boxShadow: '0 0 10px rgba(34, 211, 238, 0.5)',
                    }
                  : {},
            }}
          >
            {tab}
          </Button>
        ))}
      </Box>

      {/* Content */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 3,
          '&::-webkit-scrollbar': { width: '4px' },
          '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: theme.palette.base.whiteAlpha[100],
            borderRadius: '3px',
            '&:hover': { bgcolor: theme.palette.base.whiteAlpha[200] },
          },
        }}
      >
        {activeTab === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Diagram */}
            <Box
              sx={{
                position: 'relative',
                width: '100%',
                aspectRatio: '16/10',
                borderRadius: '16px',
                overflow: 'hidden',
                border: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
                boxShadow: `0 25px 50px -12px ${theme.palette.base.blackAlpha[250]}`,
                mb: 3,
              }}
            >
              <Box
                component="img"
                src={IllustrationImage}
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  filter: 'grayscale(0.2) contrast(1.1) brightness(0.8)',
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(to bottom, transparent, rgba(2, 6, 23, 0.4), rgba(2, 6, 23, 0.9))',
                  zIndex: 2,
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  bottom: 0,
                  p: 2,
                  zIndex: 4,
                }}
              >
                <Box
                  sx={{
                    backdropFilter: 'blur(24px)',
                    bgcolor: theme.palette.base.slateDarkAlpha[400],
                    border: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
                    borderRadius: '16px',
                    p: 2,
                    boxShadow: `0 10px 15px -3px ${theme.palette.base.blackAlpha[100]}`,
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'start',
                      mb: 1.5,
                    }}
                  >
                    <Box>
                      <Typography
                        sx={{
                          fontSize: '0.875rem',
                          fontWeight: 900,
                          color: 'white',
                          textTransform: 'uppercase',
                          letterSpacing: '-0.025em',
                        }}
                      >
                        Hệ thống AHU Trung tâm
                      </Typography>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.75,
                          mt: 0.5,
                        }}
                      >
                        <Box
                          sx={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            bgcolor: theme.palette.semantic.info.main,
                            boxShadow: '0 0 5px rgba(6, 182, 212, 0.8)',
                          }}
                        />
                        <Typography
                          sx={{
                            fontSize: '9px',
                            color: theme.palette.semantic.info.light,
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                          }}
                        >
                          Hình minh họa (demo)
                        </Typography>
                      </Box>
                    </Box>
                    <Box
                      sx={{
                        px: 1.5,
                        py: 0.5,
                        borderRadius: '8px',
                        bgcolor: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        fontSize: '9px',
                        color: theme.palette.semantic.success.main,
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Vận hành
                    </Box>
                  </Box>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 2,
                      pt: 1.5,
                      borderTop: `1px solid ${theme.palette.base.whiteAlpha[50]}`,
                    }}
                  >
                    <Box>
                      <Typography
                        sx={{
                          fontSize: '8px',
                          color: '#94a3b8',
                          textTransform: 'uppercase',
                          fontWeight: 600,
                          letterSpacing: '0.05em',
                        }}
                      >
                        Temp Out
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: '13px',
                          fontWeight: 'bold',
                          color: 'white',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        24.5°C
                      </Typography>
                    </Box>
                    <Box>
                      <Typography
                        sx={{
                          fontSize: '8px',
                          color: '#94a3b8',
                          textTransform: 'uppercase',
                          fontWeight: 600,
                          letterSpacing: '0.05em',
                        }}
                      >
                        RH Out
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: '13px',
                          fontWeight: 'bold',
                          color: 'white',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        55%
                      </Typography>
                    </Box>
                    <Box>
                      <Typography
                        sx={{
                          fontSize: '8px',
                          color: '#94a3b8',
                          textTransform: 'uppercase',
                          fontWeight: 600,
                          letterSpacing: '0.05em',
                        }}
                      >
                        Fan Speed
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: '13px',
                          fontWeight: 'bold',
                          color: 'white',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        82%
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Box>

            {/* Stats Grid */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 1.5,
              }}
            >
              <Box
                sx={{
                  bgcolor: theme.palette.base.whiteAlpha[50],
                  p: 2,
                  borderRadius: '16px',
                  border: `1px solid ${theme.palette.base.whiteAlpha[50]}`,
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mb: 0.5,
                  }}
                >
                  <Thermometer size={12} color="#fb923c" />
                  <Typography
                    sx={{
                      fontSize: '10px',
                      color: '#94a3b8',
                      textTransform: 'uppercase',
                    }}
                  >
                    Nhiệt độ
                  </Typography>
                </Box>
                <Typography
                  sx={{
                    fontSize: '1.25rem',
                    fontWeight: 'bold',
                    color: 'white',
                  }}
                >
                  24.5°C
                </Typography>
                <Typography
                  sx={{
                    fontSize: '10px',
                    color: theme.palette.semantic.success.main,
                    mt: 0.5,
                  }}
                >
                  Ổn định
                </Typography>
              </Box>
              <Box
                sx={{
                  bgcolor: theme.palette.base.whiteAlpha[50],
                  p: 2,
                  borderRadius: '16px',
                  border: `1px solid ${theme.palette.base.whiteAlpha[50]}`,
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mb: 0.5,
                  }}
                >
                  <Wind size={12} color={theme.palette.semantic.info.light} />
                  <Typography
                    sx={{
                      fontSize: '10px',
                      color: '#94a3b8',
                      textTransform: 'uppercase',
                    }}
                  >
                    Độ ẩm
                  </Typography>
                </Box>
                <Typography
                  sx={{
                    fontSize: '1.25rem',
                    fontWeight: 'bold',
                    color: 'white',
                  }}
                >
                  55%
                </Typography>
                <Typography
                  sx={{
                    fontSize: '10px',
                    color: theme.palette.semantic.info.light,
                    mt: 0.5,
                  }}
                >
                  Lý tưởng
                </Typography>
              </Box>
            </Box>

            {/* Quick Control */}
            <Box
              sx={{
                bgcolor: theme.palette.base.slateDarkAlpha[400],
                p: 2.5,
                borderRadius: '16px',
                border: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  color: 'white',
                  textTransform: 'uppercase',
                  mb: 2,
                }}
              >
                Điều khiển nhanh
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Mode Toggle */}
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Typography sx={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                    Chế độ vận hành
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      bgcolor: '#020617',
                      p: 0.5,
                      borderRadius: '8px',
                    }}
                  >
                    <Button
                      onClick={() => setMode('AUTO')}
                      sx={{
                        px: 1.5,
                        py: 0.5,
                        fontSize: '10px',
                        fontWeight: 'bold',
                        minWidth: 'auto',
                        bgcolor:
                          mode === 'AUTO'
                            ? theme.palette.semantic.info.main
                            : 'transparent',
                        color: mode === 'AUTO' ? '#020617' : '#94a3b8',
                        borderRadius: '6px',
                        '&:hover': {
                          bgcolor:
                            mode === 'AUTO'
                              ? theme.palette.semantic.info.light
                              : theme.palette.base.whiteAlpha[50],
                        },
                      }}
                    >
                      AUTO
                    </Button>
                    <Button
                      onClick={() => setMode('MANUAL')}
                      sx={{
                        px: 1.5,
                        py: 0.5,
                        fontSize: '10px',
                        fontWeight: 'bold',
                        minWidth: 'auto',
                        bgcolor:
                          mode === 'MANUAL'
                            ? theme.palette.semantic.info.main
                            : 'transparent',
                        color: mode === 'MANUAL' ? '#020617' : '#94a3b8',
                        borderRadius: '6px',
                        '&:hover': {
                          bgcolor:
                            mode === 'MANUAL'
                              ? theme.palette.semantic.info.light
                              : theme.palette.base.whiteAlpha[50],
                        },
                      }}
                    >
                      MANUAL
                    </Button>
                  </Box>
                </Box>

                {/* Setpoint Slider */}
                <Box>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '10px',
                      color: '#94a3b8',
                      mb: 1,
                    }}
                  >
                    <Typography component="span" sx={{ fontSize: '10px' }}>
                      Setpoint
                    </Typography>
                    <Typography component="span" sx={{ fontSize: '10px' }}>
                      {setpoint}°C
                    </Typography>
                  </Box>
                  <Slider
                    value={setpoint}
                    onChange={(_, value) => setSetpoint(value as number)}
                    min={16}
                    max={30}
                    sx={{
                      color: theme.palette.semantic.info.main,
                      '& .MuiSlider-thumb': {
                        width: 16,
                        height: 16,
                        '&:hover, &.Mui-focusVisible': {
                          boxShadow: '0 0 0 8px rgba(6, 182, 212, 0.16)',
                        },
                      },
                      '& .MuiSlider-track': {
                        height: 4,
                      },
                      '& .MuiSlider-rail': {
                        height: 4,
                        bgcolor: theme.palette.base.whiteAlpha[100],
                      },
                    }}
                  />
                </Box>

                <Button
                  fullWidth
                  sx={{
                    py: 1,
                    bgcolor: theme.palette.semantic.info.main,
                    color: '#020617',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    borderRadius: '8px',
                    textTransform: 'uppercase',
                    '&:hover': {
                      bgcolor: theme.palette.semantic.info.light,
                    },
                  }}
                >
                  Áp dụng thay đổi
                </Button>
              </Box>
            </Box>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '300px',
            }}
          >
            <Typography
              sx={{
                fontSize: '0.875rem',
                color: '#64748b',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Đang phát triển
            </Typography>
          </Box>
        )}
      </Box>

      {/* Footer */}
      <Box
        sx={{
          p: 2,
          borderTop: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
          bgcolor: theme.palette.base.whiteAlpha[50],
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            fullWidth
            sx={{
              py: 1.25,
              borderRadius: '12px',
              bgcolor: theme.palette.semantic.info.main,
              color: '#020617',
              fontSize: '10px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              '&:hover': {
                bgcolor: theme.palette.semantic.info.light,
              },
            }}
          >
            Cấu hình hệ thống
          </Button>
          <Button
            fullWidth
            sx={{
              py: 1.25,
              borderRadius: '12px',
              bgcolor: theme.palette.base.whiteAlpha[100],
              color: 'white',
              fontSize: '10px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              border: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
              '&:hover': {
                bgcolor: theme.palette.base.whiteAlpha[200],
              },
            }}
          >
            Xuất báo cáo
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default DevicePanel;
