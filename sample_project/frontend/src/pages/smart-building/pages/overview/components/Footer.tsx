import {
  Box,
  MenuItem,
  Select,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Info,
  MapPin,
  OctagonAlert,
  Search,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Event {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  system: string;
  timestamp: string;
  location: string;
  status?: 'pending' | 'resolved';
}

const Footer = () => {
  const theme = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [height, setHeight] = useState(48);
  const [isDragging, setIsDragging] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [systemFilter, setSystemFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('today');
  const footerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  const events: Event[] = [
    {
      id: '1',
      severity: 'critical',
      title: 'Nhiệt độ phòng Server vượt ngưỡng',
      description: 'Nhiệt độ phòng Server tầng 5 đã vượt 28°C',
      system: 'BMS',
      timestamp: '2024-02-04 14:23:45',
      location: 'Tầng 5 - Phòng Server Room A',
      status: 'pending',
    },
    {
      id: '2',
      severity: 'critical',
      title: 'Mất kết nối Camera 04-F2',
      description: 'Camera giám sát tầng 4 khu vực F2 mất kết nối mạng',
      system: 'CCTV',
      timestamp: '2024-02-04 14:20:15',
      location: 'Tầng 4 - Khu vực F2 (Hành lang chính)',
    },
    {
      id: '3',
      severity: 'warning',
      title: 'Cửa thoát hiểm mở lâu',
      description: 'Cửa thoát hiểm tầng 3 phía Đông mở quá 5 phút',
      system: 'ACS',
      timestamp: '2024-02-04 14:15:22',
      location: 'Tầng 3 - Cửa thoát hiểm phía Đông',
    },
    {
      id: '4',
      severity: 'critical',
      title: 'Tiêu thụ điện vượt ngưỡng đỉnh',
      description: 'Công suất tiêu thụ điện đạt 95% công suất tối đa',
      system: 'EMS',
      timestamp: '2024-02-04 14:02:33',
      location: 'Tổng - Hệ thống điện chính',
      status: 'pending',
    },
  ];

  const criticalCount = events.filter((e) => e.severity === 'critical').length;
  const warningCount = events.filter((e) => e.severity === 'warning').length;
  const infoCount = events.filter((e) => e.severity === 'info').length;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isExpanded) return; // Only allow dragging when expanded
    setIsDragging(true);
    startYRef.current = e.clientY;
    startHeightRef.current = height;
    e.preventDefault();
  };

  const handleToggleExpand = () => {
    if (isExpanded) {
      setIsExpanded(false);
      setHeight(48);
    } else {
      setIsExpanded(true);
      setHeight(300);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaY = startYRef.current - e.clientY;
      const maxHeight = window.innerHeight * 0.7;
      const newHeight = Math.max(
        200,
        Math.min(maxHeight, startHeightRef.current + deltaY),
      );
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case 'critical':
        return {
          icon: <OctagonAlert size={16} />,
          color: theme.palette.semantic.error.light,
          bg: theme.palette.semantic.error.backgroundLight,
          border: 'rgba(239, 68, 68, 0.2)',
        };
      case 'warning':
        return {
          icon: <TriangleAlert size={16} />,
          color: theme.palette.semantic.warning.light,
          bg: 'rgba(251, 191, 36, 0.1)',
          border: 'rgba(251, 191, 36, 0.2)',
        };
      default:
        return {
          icon: <Info size={16} />,
          color: theme.palette.semantic.info.light,
          bg: 'rgba(34, 211, 238, 0.1)',
          border: 'rgba(34, 211, 238, 0.2)',
        };
    }
  };

  return (
    <Box
      ref={footerRef}
      sx={{
        position: 'fixed',
        bottom: 85, // Moved up to avoid overlapping the Navbar (action bar)
        left: 300, // Make room for Sidebar
        right: 0,
        zIndex: theme.zIndex.drawer,
        bgcolor: 'rgba(2, 6, 23, 0.6)',
        backdropFilter: 'blur(24px)',
        borderTop: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
        boxShadow: `0 -25px 50px -12px ${theme.palette.base.blackAlpha[250]}`,
        height: `${height}px`,
        display: 'flex',
        flexDirection: 'column',
        userSelect: isDragging ? 'none' : 'auto',
        touchAction: 'pan-x',
        transition: isExpanded ? 'none' : 'height 0.3s ease',
      }}
    >
      {/* Drag Handle */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pt: 1,
          cursor: isExpanded ? (isDragging ? 'grabbing' : 'grab') : 'default',
          '&:active': {
            cursor: isExpanded ? 'grabbing' : 'default',
          },
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 4,
            borderRadius: 10,
            bgcolor: 'rgba(100, 116, 139, 0.5)',
            transition: 'background-color 0.2s',
            '&:hover': {
              bgcolor: isExpanded
                ? 'rgba(100, 116, 139, 0.7)'
                : 'rgba(100, 116, 139, 0.5)',
            },
          }}
        />
      </Box>

      {/* Content */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          pb: isExpanded ? 2 : 0,
        }}
      >
        {!isExpanded ? (
          /* Collapsed View */
          <Box sx={{ px: 3, pb: 1 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography
                  sx={{
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: 'white',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Sự kiện / Trạng thái hệ thống
                </Typography>

                {/* Compact Badges */}
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 1,
                      py: 0.25,
                      borderRadius: 1.5,
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      bgcolor: theme.palette.semantic.error.backgroundLight,
                    }}
                  >
                    <OctagonAlert
                      size={11}
                      color={theme.palette.semantic.error.light}
                    />
                    <Typography
                      sx={{
                        fontSize: '10px',
                        fontWeight: 'bold',
                        color: theme.palette.semantic.error.light,
                      }}
                    >
                      {criticalCount}
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 1,
                      py: 0.25,
                      borderRadius: 1.5,
                      border: '1px solid rgba(251, 191, 36, 0.2)',
                      bgcolor: 'rgba(251, 191, 36, 0.1)',
                    }}
                  >
                    <TriangleAlert
                      size={11}
                      color={theme.palette.semantic.warning.light}
                    />
                    <Typography
                      sx={{
                        fontSize: '10px',
                        fontWeight: 'bold',
                        color: theme.palette.semantic.warning.light,
                      }}
                    >
                      {warningCount}
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 1,
                      py: 0.25,
                      borderRadius: 1.5,
                      border: '1px solid rgba(34, 211, 238, 0.2)',
                      bgcolor: 'rgba(34, 211, 238, 0.1)',
                    }}
                  >
                    <Info size={11} color={theme.palette.semantic.info.light} />
                    <Typography
                      sx={{
                        fontSize: '10px',
                        fontWeight: 'bold',
                        color: theme.palette.semantic.info.light,
                      }}
                    >
                      {infoCount}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  onClick={handleToggleExpand}
                  sx={{
                    fontSize: '10px',
                    color: theme.palette.semantic.info.light,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    cursor: 'pointer',
                    '&:hover': {
                      color: theme.palette.semantic.info.main,
                    },
                  }}
                >
                  Xem chi tiết
                </Typography>

                <Box
                  onClick={handleToggleExpand}
                  sx={{
                    p: 0.75,
                    borderRadius: 2,
                    color: '#94a3b8',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: theme.palette.base.whiteAlpha[100],
                      color: 'white',
                    },
                  }}
                >
                  <ChevronDown size={14} />
                </Box>
              </Box>
            </Box>
          </Box>
        ) : (
          /* Expanded View */
          <>
            {/* Header */}
            <Box
              sx={{
                px: 3,
                pb: 2,
                borderBottom: `1px solid ${theme.palette.base.whiteAlpha[50]}`,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 2,
                }}
              >
                <Typography
                  sx={{
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: 'white',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Sự kiện / Trạng thái hệ thống
                </Typography>

                {/* Filter Badges & Collapse Button */}
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                  {/* Filter Badges */}
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.75,
                        px: 1.5,
                        py: 0.75,
                        borderRadius: 2,
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        bgcolor: theme.palette.semantic.error.backgroundLight,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': {
                          bgcolor: 'rgba(239, 68, 68, 0.2)',
                          transform: 'scale(1.05)',
                        },
                      }}
                    >
                      <OctagonAlert
                        size={16}
                        color={theme.palette.semantic.error.light}
                      />
                      <Typography
                        sx={{
                          fontSize: '0.875rem',
                          fontWeight: 'bold',
                          color: theme.palette.semantic.error.light,
                        }}
                      >
                        {criticalCount}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: '10px',
                          color: '#94a3b8',
                          textTransform: 'uppercase',
                        }}
                      >
                        Nghiêm trọng
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.75,
                        px: 1.5,
                        py: 0.75,
                        borderRadius: 2,
                        border: '1px solid rgba(251, 191, 36, 0.2)',
                        bgcolor: 'rgba(251, 191, 36, 0.1)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': {
                          bgcolor: 'rgba(251, 191, 36, 0.2)',
                          transform: 'scale(1.05)',
                        },
                      }}
                    >
                      <TriangleAlert
                        size={16}
                        color={theme.palette.semantic.warning.light}
                      />
                      <Typography
                        sx={{
                          fontSize: '0.875rem',
                          fontWeight: 'bold',
                          color: theme.palette.semantic.warning.light,
                        }}
                      >
                        {warningCount}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: '10px',
                          color: '#94a3b8',
                          textTransform: 'uppercase',
                        }}
                      >
                        Cảnh báo
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.75,
                        px: 1.5,
                        py: 0.75,
                        borderRadius: 2,
                        border: '1px solid rgba(34, 211, 238, 0.2)',
                        bgcolor: 'rgba(34, 211, 238, 0.1)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': {
                          bgcolor: 'rgba(34, 211, 238, 0.2)',
                          transform: 'scale(1.05)',
                        },
                      }}
                    >
                      <Info
                        size={16}
                        color={theme.palette.semantic.info.light}
                      />
                      <Typography
                        sx={{
                          fontSize: '0.875rem',
                          fontWeight: 'bold',
                          color: theme.palette.semantic.info.light,
                        }}
                      >
                        {infoCount}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: '10px',
                          color: '#94a3b8',
                          textTransform: 'uppercase',
                        }}
                      >
                        Thông tin
                      </Typography>
                    </Box>
                  </Box>

                  {/* Collapse Button */}
                  <Box
                    onClick={handleToggleExpand}
                    sx={{
                      p: 0.75,
                      borderRadius: 2,
                      color: '#94a3b8',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        bgcolor: theme.palette.base.whiteAlpha[100],
                        color: 'white',
                      },
                    }}
                    title="Ẩn"
                  >
                    <ChevronDown size={14} />
                  </Box>
                </Box>
              </Box>

              {/* Search & Filters */}
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                <Box sx={{ flex: 1, position: 'relative' }}>
                  <Search
                    size={16}
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#64748b',
                      pointerEvents: 'none',
                      zIndex: 1,
                    }}
                  />
                  <TextField
                    fullWidth
                    placeholder="Tìm kiếm sự kiện..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        height: '36px',
                        pl: 5,
                        pr: 2,
                        bgcolor: theme.palette.base.whiteAlpha[50],
                        border: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
                        borderRadius: 2,
                        fontSize: '0.875rem',
                        color: 'white',
                        '& fieldset': { border: 'none' },
                        '&:hover': {
                          bgcolor: theme.palette.base.whiteAlpha[100],
                        },
                        '&.Mui-focused': {
                          borderColor: 'rgba(34, 211, 238, 0.5)',
                          bgcolor: theme.palette.base.whiteAlpha[100],
                        },
                      },
                      '& .MuiOutlinedInput-input': {
                        padding: 0,
                        height: '100%',
                        '&::placeholder': {
                          color: '#64748b',
                          opacity: 1,
                        },
                      },
                    }}
                  />
                </Box>

                <Select
                  value={systemFilter}
                  onChange={(e) => setSystemFilter(e.target.value)}
                  MenuProps={{
                    anchorOrigin: {
                      vertical: 'top',
                      horizontal: 'left',
                    },
                    transformOrigin: {
                      vertical: 'bottom',
                      horizontal: 'left',
                    },
                    PaperProps: {
                      sx: {
                        bgcolor: '#0f172a',
                        border: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
                        mt: -0.5,
                        '& .MuiMenuItem-root': {
                          color: 'white',
                          fontSize: '0.875rem',
                          '&:hover': {
                            bgcolor: '#1e293b',
                          },
                          '&.Mui-selected': {
                            bgcolor: '#1e293b',
                            '&:hover': {
                              bgcolor: '#334155',
                            },
                          },
                        },
                      },
                    },
                  }}
                  sx={{
                    height: '36px',
                    px: 1.5,
                    bgcolor: '#0f172a',
                    border: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
                    borderRadius: 2,
                    fontSize: '0.875rem',
                    color: 'white',
                    minWidth: 150,
                    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                    '&:hover': {
                      bgcolor: '#1e293b',
                    },
                    '& .MuiSelect-select': {
                      py: 0,
                      display: 'flex',
                      alignItems: 'center',
                    },
                    '& .MuiSelect-icon': { color: '#94a3b8' },
                  }}
                >
                  <MenuItem value="all">Tất cả hệ thống</MenuItem>
                  <MenuItem value="BMS">BMS</MenuItem>
                  <MenuItem value="CCTV">CCTV</MenuItem>
                  <MenuItem value="EMS">EMS</MenuItem>
                  <MenuItem value="ACS">ACS</MenuItem>
                  <MenuItem value="PMS">Car Parking</MenuItem>
                </Select>

                <Select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value)}
                  MenuProps={{
                    anchorOrigin: {
                      vertical: 'top',
                      horizontal: 'left',
                    },
                    transformOrigin: {
                      vertical: 'bottom',
                      horizontal: 'left',
                    },
                    PaperProps: {
                      sx: {
                        bgcolor: '#0f172a',
                        border: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
                        mt: -0.5,
                        '& .MuiMenuItem-root': {
                          color: 'white',
                          fontSize: '0.875rem',
                          '&:hover': {
                            bgcolor: '#1e293b',
                          },
                          '&.Mui-selected': {
                            bgcolor: '#1e293b',
                            '&:hover': {
                              bgcolor: '#334155',
                            },
                          },
                        },
                      },
                    },
                  }}
                  sx={{
                    height: '36px',
                    px: 1.5,
                    bgcolor: '#0f172a',
                    border: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
                    borderRadius: 2,
                    fontSize: '0.875rem',
                    color: 'white',
                    minWidth: 130,
                    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                    '&:hover': {
                      bgcolor: '#1e293b',
                    },
                    '& .MuiSelect-select': {
                      py: 0,
                      display: 'flex',
                      alignItems: 'center',
                    },
                    '& .MuiSelect-icon': { color: '#94a3b8' },
                  }}
                >
                  <MenuItem value="today">Hôm nay</MenuItem>
                  <MenuItem value="24h">24 giờ qua</MenuItem>
                  <MenuItem value="7d">7 ngày qua</MenuItem>
                </Select>
              </Box>
            </Box>

            {/* Events List */}
            <Box
              sx={{
                flex: 1,
                overflowY: 'auto',
                px: 3,
                '&::-webkit-scrollbar': { width: '6px' },
                '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
                '&::-webkit-scrollbar-thumb': {
                  bgcolor: theme.palette.base.slateLightAlpha[300],
                  borderRadius: '3px',
                  '&:hover': {
                    bgcolor: theme.palette.base.slateLightAlpha[500],
                  },
                },
              }}
            >
              <Box
                sx={{ display: 'flex', flexDirection: 'column', gap: 1, py: 2 }}
              >
                {events.map((event) => {
                  const severityConfig = getSeverityConfig(event.severity);
                  return (
                    <Box
                      key={event.id}
                      sx={{
                        p: 2,
                        borderRadius: 3,
                        bgcolor: theme.palette.base.whiteAlpha[50],
                        border: `1px solid ${theme.palette.base.whiteAlpha[50]}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': {
                          border: `1px solid ${theme.palette.base.whiteAlpha[200]}`,
                          bgcolor: theme.palette.base.whiteAlpha[100],
                          '& .chevron': {
                            color: theme.palette.semantic.info.light,
                          },
                          '& .title': {
                            color: theme.palette.semantic.info.light,
                          },
                        },
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'start',
                          justifyContent: 'space-between',
                          gap: 2,
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'start',
                            gap: 1.5,
                            flex: 1,
                          }}
                        >
                          <Box
                            sx={{
                              p: 1,
                              borderRadius: 2,
                              color: severityConfig.color,
                              bgcolor: severityConfig.bg,
                              border: `1px solid ${severityConfig.border}`,
                              display: 'flex',
                            }}
                          >
                            {severityConfig.icon}
                          </Box>

                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                mb: 0.5,
                              }}
                            >
                              <Typography
                                className="title"
                                sx={{
                                  fontSize: '0.875rem',
                                  fontWeight: 600,
                                  color: 'white',
                                  transition: 'color 0.2s',
                                }}
                              >
                                {event.title}
                              </Typography>
                              {event.status === 'pending' && (
                                <Box
                                  sx={{
                                    px: 1,
                                    py: 0.25,
                                    borderRadius: 1,
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    bgcolor: 'rgba(239, 68, 68, 0.2)',
                                    color: theme.palette.semantic.error.light,
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                  }}
                                >
                                  CHƯA XỬ LÝ
                                </Box>
                              )}
                            </Box>

                            <Typography
                              sx={{
                                fontSize: '0.75rem',
                                color: '#94a3b8',
                                mb: 1,
                              }}
                            >
                              {event.description}
                            </Typography>

                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2,
                                color: '#64748b',
                              }}
                            >
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.5,
                                }}
                              >
                                <Typography
                                  sx={{
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    color: theme.palette.semantic.info.light,
                                  }}
                                >
                                  {event.system}
                                </Typography>
                              </Box>

                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.5,
                                }}
                              >
                                <Clock size={10} />
                                <Typography
                                  component="span"
                                  sx={{ fontSize: '12px' }}
                                >
                                  {event.timestamp}
                                </Typography>
                              </Box>

                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.5,
                                }}
                              >
                                <MapPin size={10} />
                                <Typography
                                  component="span"
                                  sx={{ fontSize: '12px' }}
                                >
                                  {event.location}
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
                        </Box>

                        <ChevronRight
                          size={16}
                          className="chevron"
                          style={{
                            color: '#475569',
                            flexShrink: 0,
                            transition: 'color 0.2s',
                          }}
                        />
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
};

export default Footer;
