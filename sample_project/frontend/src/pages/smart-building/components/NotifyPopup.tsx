import {
  Backdrop,
  Box,
  Button,
  IconButton,
  Typography,
  useTheme,
} from '@mui/material';
import {
  CircleAlert,
  CircleCheck,
  Clock,
  TriangleAlert,
  X,
} from 'lucide-react';

interface Notification {
  id: string;
  type: 'critical' | 'warning' | 'info';
  system: string;
  time: string;
  message: string;
  status: 'unhandled' | 'processing' | 'resolved' | 'monitoring';
  icon: 'alert' | 'warning' | 'check';
}

interface NotifyPopupProps {
  open: boolean;
  onClose: () => void;
}

const NotifyPopup = ({ open, onClose }: NotifyPopupProps) => {
  const theme = useTheme();
  const notifications: Notification[] = [
    {
      id: '1',
      type: 'critical',
      system: 'CCTV',
      time: '14:20',
      message: 'Mất kết nối Camera 04-F2',
      status: 'unhandled',
      icon: 'alert',
    },
    {
      id: '2',
      type: 'warning',
      system: 'ACS',
      time: '14:15',
      message: 'Cửa thoát hiểm mở lâu',
      status: 'processing',
      icon: 'warning',
    },
    {
      id: '3',
      type: 'critical',
      system: 'BMS',
      time: '14:02',
      message: 'Nhiệt độ phòng Server cao',
      status: 'unhandled',
      icon: 'alert',
    },
    {
      id: '4',
      type: 'info',
      system: 'PMS',
      time: '13:55',
      message: 'Lỗi thanh chắn Lane B',
      status: 'resolved',
      icon: 'check',
    },
    {
      id: '5',
      type: 'warning',
      system: 'EMS',
      time: '13:40',
      message: 'Tiêu thụ điện vượt ngưỡng',
      status: 'monitoring',
      icon: 'warning',
    },
    {
      id: '6',
      type: 'warning',
      system: 'CCTV',
      time: '13:22',
      message: 'Phát hiện chuyển động bất thường',
      status: 'processing',
      icon: 'warning',
    },
    {
      id: '7',
      type: 'critical',
      system: 'BMS',
      time: '13:10',
      message: 'AHU Tầng 3 dừng hoạt động',
      status: 'unhandled',
      icon: 'alert',
    },
  ];

  const getIconComponent = (icon: string, type: string) => {
    const color =
      type === 'critical'
        ? theme.palette.semantic.error.main
        : type === 'warning'
          ? theme.palette.semantic.warning.main
          : '#3b82f6';

    switch (icon) {
      case 'alert':
        return <CircleAlert size={16} color={color} />;
      case 'warning':
        return <TriangleAlert size={16} color={color} />;
      case 'check':
        return <CircleCheck size={16} color={color} />;
      default:
        return null;
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'unhandled':
        return {
          label: 'Chưa xử lý',
          bgcolor: theme.palette.semantic.error.backgroundLight,
          borderColor: 'rgba(239, 68, 68, 0.2)',
          color: theme.palette.semantic.error.light,
        };
      case 'processing':
        return {
          label: 'Đang xử lý',
          bgcolor: 'rgba(245, 158, 11, 0.1)',
          borderColor: 'rgba(245, 158, 11, 0.2)',
          color: theme.palette.semantic.warning.light,
        };
      case 'resolved':
        return {
          label: 'Đã xử lý',
          bgcolor: 'rgba(59, 130, 246, 0.1)',
          borderColor: 'rgba(59, 130, 246, 0.2)',
          color: '#60a5fa',
        };
      case 'monitoring':
        return {
          label: 'Đang giám sát',
          bgcolor: 'rgba(245, 158, 11, 0.1)',
          borderColor: 'rgba(245, 158, 11, 0.2)',
          color: theme.palette.semantic.warning.light,
        };
      default:
        return { label: '', bgcolor: '', borderColor: '', color: '' };
    }
  };

  const criticalCount = notifications.filter(
    (n) => n.type === 'critical',
  ).length;
  const warningCount = notifications.filter((n) => n.type === 'warning').length;
  const infoCount = notifications.filter((n) => n.type === 'info').length;

  if (!open) return null;

  return (
    <>
      <Backdrop
        open={open}
        onClick={onClose}
        sx={{
          zIndex: theme.zIndex.modal - 1,
          bgcolor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
          pointerEvents: 'auto',
        }}
      />
      <Box
        sx={{
          position: 'fixed',
          top: '80px',
          right: '24px',
          width: '420px',
          maxHeight: 'calc(100vh - 120px)',
          zIndex: theme.zIndex.modal,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(24px)',
          border: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
          borderRadius: '16px',
          boxShadow: `0 25px 50px -12px ${theme.palette.base.blackAlpha[250]}`,
          overflow: 'hidden',
          pointerEvents: 'auto',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2.5,
            py: 2,
            borderBottom: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
            bgcolor: 'rgba(2, 6, 23, 0.4)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 2,
                bgcolor: 'rgba(34, 211, 238, 0.1)',
                border: '1px solid rgba(34, 211, 238, 0.2)',
              }}
            >
              <CircleAlert
                size={20}
                color={theme.palette.semantic.info.light}
              />
            </Box>
            <Box>
              <Typography
                sx={{
                  fontSize: '0.875rem',
                  fontWeight: 'bold',
                  color: 'white',
                  textTransform: 'uppercase',
                  letterSpacing: '0.025em',
                  lineHeight: 1.2,
                }}
              >
                Thông báo hệ thống
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.75rem',
                  color: '#94a3b8',
                  mt: 0.25,
                }}
              >
                {notifications.length} thông báo mới
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={onClose}
            sx={{
              p: 1,
              borderRadius: '8px',
              color: '#94a3b8',
              '&:hover': {
                bgcolor: theme.palette.base.whiteAlpha[100],
                color: 'white',
              },
            }}
          >
            <X size={20} />
          </IconButton>
        </Box>

        {/* Stats */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            px: 2.5,
            py: 1.5,
            bgcolor: 'rgba(2, 6, 23, 0.2)',
            borderBottom: `1px solid ${theme.palette.base.whiteAlpha[50]}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: theme.palette.semantic.error.main,
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.5 },
                },
              }}
            />
            <Typography sx={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
              <Box
                component="span"
                sx={{
                  fontWeight: 'bold',
                  color: theme.palette.semantic.error.light,
                }}
              >
                {criticalCount}
              </Box>
              Nghiêm trọng
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: theme.palette.semantic.warning.main,
              }}
            />
            <Typography sx={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
              <Box
                component="span"
                sx={{
                  fontWeight: 'bold',
                  color: theme.palette.semantic.warning.light,
                }}
              >
                {warningCount}
              </Box>{' '}
              Cảnh báo
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: '#3b82f6',
              }}
            />
            <Typography sx={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
              <Box
                component="span"
                sx={{ fontWeight: 'bold', color: '#60a5fa' }}
              >
                {infoCount}
              </Box>{' '}
              Thông tin
            </Typography>
          </Box>
        </Box>

        {/* Notification List */}
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            '&::-webkit-scrollbar': { width: '4px' },
            '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: theme.palette.base.whiteAlpha[100],
              borderRadius: '3px',
              '&:hover': { bgcolor: '#08647F' },
            },
          }}
        >
          <Box sx={{ p: 1.5 }}>
            {notifications.map((notification) => {
              const statusConfig = getStatusConfig(notification.status);

              return (
                <Box
                  key={notification.id}
                  sx={{
                    position: 'relative',
                    p: 2,
                    mb: 1,
                    borderRadius: '12px',
                    bgcolor: theme.palette.base.whiteAlpha[50],
                    border: `1px solid ${theme.palette.base.whiteAlpha[50]}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: theme.palette.base.whiteAlpha[100],
                      borderColor: 'rgba(34, 211, 238, 0.3)',
                      '& .detail-text': { opacity: 1 },
                      '& .hover-gradient': { opacity: 1 },
                      '& .message': { color: 'white' },
                    },
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mb: 1,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {getIconComponent(notification.icon, notification.type)}
                      <Typography
                        sx={{
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          color: 'white',
                          textTransform: 'uppercase',
                        }}
                      >
                        {notification.system}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        color: '#64748b',
                      }}
                    >
                      <Clock size={12} />
                      <Typography sx={{ fontSize: '0.75rem' }}>
                        {notification.time}
                      </Typography>
                    </Box>
                  </Box>
                  <Typography
                    className="message"
                    sx={{
                      fontSize: '0.875rem',
                      color: '#cbd5e1',
                      mb: 1.5,
                      lineHeight: 1.6,
                      transition: 'color 0.2s',
                    }}
                  >
                    {notification.message}
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.75,
                        px: 1.5,
                        py: 0.5,
                        borderRadius: '8px',
                        border: `1px solid ${statusConfig.borderColor}`,
                        bgcolor: statusConfig.bgcolor,
                        fontSize: '12px',
                        fontWeight: 500,
                        color: statusConfig.color,
                      }}
                    >
                      {statusConfig.label}
                    </Box>
                    <Typography
                      className="detail-text"
                      sx={{
                        fontSize: '12px',
                        color: theme.palette.semantic.info.light,
                        fontWeight: 500,
                        opacity: 0,
                        transition: 'opacity 0.2s',
                      }}
                    >
                      Xem chi tiết →
                    </Typography>
                  </Box>
                  <Box
                    className="hover-gradient"
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '12px',
                      background:
                        'linear-gradient(to right, rgba(34, 211, 238, 0), rgba(34, 211, 238, 0.05), rgba(34, 211, 238, 0))',
                      opacity: 0,
                      transition: 'opacity 0.2s',
                      pointerEvents: 'none',
                    }}
                  />
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Footer */}
        <Box
          sx={{
            px: 2.5,
            py: 1.5,
            borderTop: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
            bgcolor: 'rgba(2, 6, 23, 0.4)',
          }}
        >
          <Button
            fullWidth
            sx={{
              py: 1.25,
              px: 2,
              borderRadius: '8px',
              bgcolor: 'rgba(34, 211, 238, 0.1)',
              border: '1px solid rgba(34, 211, 238, 0.2)',
              color: theme.palette.semantic.info.light,
              fontSize: '0.75rem',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              '&:hover': {
                bgcolor: 'rgba(34, 211, 238, 0.2)',
              },
            }}
          >
            Xem tất cả thông báo
          </Button>
        </Box>
      </Box>
    </>
  );
};

export default NotifyPopup;
