import CloudIcon from '@mui/icons-material/Cloud';
import CloudySnowingIcon from '@mui/icons-material/CloudySnowing';
import SunnyIcon from '@mui/icons-material/Sunny';
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  IconButton,
  Toolbar,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { Bell, Clock, House, MapPin, Search, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import WeatherIcon from '@/assets/icons/weather.svg';
import { OPENWEATHER_API_KEY } from '@/configs/constant.config';
import { useBuilding } from '@/contexts/BuildingContext';
import { useDeviceSocketContext } from '@/contexts/DeviceSocketContext';

import { useWeather } from '@/contexts/WeatherContext';

import NotifyPopup from './NotifyPopup';


const Header = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notifyOpen, setNotifyOpen] = useState(false);

  const navigate = useNavigate();
  const theme = useTheme();

  // Get building data from API context (fetched by slug from URL params)
  const { currentBuilding: building } = useBuilding();
  const { connected: wsConnected } = useDeviceSocketContext();

  // Fallback to Hanoi coordinates when building has no lat/lon
  const DEFAULT_LAT = 21.0285;
  const DEFAULT_LON = 105.8542;
  const LAT = building?.urban?.latitude ?? DEFAULT_LAT;
  const LON = building?.urban?.longitude ?? DEFAULT_LON;
  const locationName = building?.name || building?.urban?.name || 'Smart Building';

  const { weatherCache, setWeather } = useWeather();
  const cacheKey = `${LAT},${LON}`;
  const weather = weatherCache?.[cacheKey];
  const [loading, setLoading] = useState(!weather);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (weather) return;
    if (LAT == null || LON == null) return; // Skip if no coordinates available
    const fetchWeather = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch weather information from OpenWeatherMap
        const weatherRes = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${LAT}&lon=${LON}&units=metric&appid=${OPENWEATHER_API_KEY}&lang=vi`,
        );
        const weatherData = await weatherRes.json();

        if (!weatherRes.ok || !weatherData.main) {
          throw new Error(weatherData.message || 'No weather data.');
        }

        setWeather(LAT, LON, weatherData);
      } catch (error: any) {
        setError(error.message || 'An error occurred.');
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, [weather, setWeather, LAT, LON]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };
  const formatDate = (date: Date) => {
    const weekdays = [
      'Chủ Nhật',
      'Thứ Hai',
      'Thứ Ba',
      'Thứ Tư',
      'Thứ Năm',
      'Thứ Sáu',
      'Thứ Bảy',
    ];
    const day = weekdays[date.getDay()];
    const dateStr = date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
    return `${day}, ${dateStr}`;
  };

  const getWeatherIcon = (main: string) => {
    switch (main) {
      case 'Clear':
        return <SunnyIcon sx={{ fontSize: 20, color: '#FFD700' }} />;
      case 'Clouds':
        return <CloudIcon sx={{ fontSize: 20, color: '#B0BEC5' }} />;
      case 'Rain':
      case 'Drizzle':
        return <CloudySnowingIcon sx={{ fontSize: 20, color: '#4FC3F7' }} />;
      default:
        return <img src={WeatherIcon} style={{ width: 30, height: 20 }} />;
    }
  };

  return (
    <AppBar
      sx={{
        position: 'fixed',
        backgroundColor: 'transparent',
        display: 'flex',
        pointerEvents: 'none',
        flexDirection: 'row',
      }}
    >
      <Toolbar
        sx={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            pointerEvents: 'auto',
          }}
        >
          <IconButton
            title="Quay lại Tổng quan"
            onClick={() => navigate('/')}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 1,
              bgcolor: 'rgba(2, 6, 23, 0.6)',
              backdropFilter: 'blur(24px)',
              borderRadius: 3,
              border: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
              boxShadow: `0 10px 15px -3px ${theme.palette.base.blackAlpha[100]}, 0 4px 6px -4px ${theme.palette.base.blackAlpha[100]}`,
              transition: 'all 0.3s ease',
              '&:hover': {
                borderColor: theme.palette.base.cyanAlpha[500],
                bgcolor: 'rgba(2, 6, 23, 0.6)',
                '& .house-icon': {
                  transform: 'scale(1.1)',
                },
                '& .text-label': {
                  color: theme.palette.semantic.info.light,
                },
              },
            }}
          >
            <House
              size={16}
              color={theme.palette.semantic.info.light}
              className="house-icon"
              style={{ transition: 'transform 0.3s ease' }}
            />
            <Typography
              className="text-label"
              sx={{
                color: '#cbd5e1',
                fontWeight: 500,
                fontSize: '0.75rem',
                transition: 'color 0.3s ease',
              }}
            >
              Tổng quan
            </Typography>
          </IconButton>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              bgcolor: 'rgba(2, 6, 23, 0.4)',
              backdropFilter: 'blur(12px)',
              px: 2,
              py: 1,
              borderRadius: 4,
              border: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
              boxShadow: `0 10px 15px -3px ${theme.palette.base.blackAlpha[100]}, 0 4px 6px -4px ${theme.palette.base.blackAlpha[100]}`,
            }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                bgcolor: '#dc2626',
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '700',
                color: 'white',
                fontSize: '1.5rem',
              }}
            >
              {building?.name?.charAt(0)?.toUpperCase() || 'B'}
            </Box>
            <Box>
              <Typography
                sx={{
                  fontSize: '1rem',
                  fontWeight: '800',
                  color: 'white',
                  textTransform: 'uppercase',
                  letterSpacing: '-0.025em',
                }}
              >
                {building?.urban?.name || building?.name || 'Smart Building'}
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  fontSize: '0.75rem',
                  color: '#94a3b8',
                }}
              >
                <MapPin size={12} />
                <Typography component="span" sx={{ fontSize: '0.725rem' }}>
                  {building?.urban?.address || building?.address || 'Chưa có địa chỉ'}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>


        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            pointerEvents: 'auto',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              bgcolor: 'rgba(2, 6, 23, 0.4)',
              backdropFilter: 'blur(12px)',
              px: 3,
              py: 1,
              borderRadius: 4,
              border: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
              boxShadow: `0 10px 15px -3px ${theme.palette.base.blackAlpha[100]}, 0 4px 6px -4px ${theme.palette.base.blackAlpha[100]}`,
            }}
          >
            {/* Weather Info */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box>
                {loading || error ? (
                  <img src={WeatherIcon} style={{ width: 30, height: 20 }} />
                ) : (
                  getWeatherIcon(weather.weather[0].main)
                )}
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography
                  sx={{
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    color: 'white',
                  }}
                >
                  {loading || error
                    ? '--'
                    : `${Math.round(weather.main.temp)}°C`}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.725rem',
                    color: '#94a3b8',
                    textTransform: 'uppercase',
                  }}
                >
                  {locationName}
                </Typography>
              </Box>
            </Box>

            <Divider
              orientation="vertical"
              flexItem
              sx={{ bgcolor: theme.palette.base.whiteAlpha[100], width: '1px' }}
            />

            {/* Time Info */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  p: 0.75,
                  borderRadius: 2,
                  bgcolor: theme.palette.base.whiteAlpha[50],
                  color: theme.palette.semantic.info.light,
                  display: 'flex',
                }}
              >
                <Clock size={20} />
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography
                  sx={{
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    color: 'white',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatTime(currentTime)}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.725rem',
                    color: '#94a3b8',
                    textTransform: 'uppercase',
                  }}
                >
                  {formatDate(currentTime)}
                </Typography>
              </Box>
            </Box>

            <Divider
              orientation="vertical"
              flexItem
              sx={{ bgcolor: theme.palette.base.whiteAlpha[100], width: '1px' }}
            />

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton
                sx={{
                  p: 1,
                  borderRadius: '50%',
                  color: '#cbd5e1',
                  '&:hover': { bgcolor: theme.palette.base.whiteAlpha[100] },
                }}
              >
                <Search size={20} />
              </IconButton>
              <IconButton
                onClick={() => setNotifyOpen(!notifyOpen)}
                sx={{
                  p: 1,
                  borderRadius: '50%',
                  color: '#cbd5e1',
                  position: 'relative',
                  '&:hover': {
                    bgcolor: theme.palette.base.whiteAlpha[100],
                    color: theme.palette.semantic.info.light,
                  },
                }}
              >
                <Bell size={20} />
                <Box
                  sx={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 8,
                    height: 8,
                    bgcolor: theme.palette.semantic.error.main,
                    borderRadius: '50%',
                    border: '1px solid #0f172a',
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 1 },
                      '50%': { opacity: 0.5 },
                    },
                  }}
                />
              </IconButton>
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: '#0891b2',
                  border: `1px solid ${theme.palette.base.whiteAlpha[200]}`,
                  cursor: 'pointer',
                }}
              >
                <User size={20} />
              </Avatar>
            </Box>
          </Box>
        </Box>
      </Toolbar>

      <NotifyPopup open={notifyOpen} onClose={() => setNotifyOpen(false)} />
    </AppBar>
  );
};

export default Header;
