import { Box, Paper, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import SunnyIcon from "@mui/icons-material/Sunny";
import CloudIcon from "@mui/icons-material/Cloud";
import CloudySnowingIcon from '@mui/icons-material/CloudySnowing';
import WeatherIcon from "@/assets/icons/weather.svg";
import HumidityIcon from "@/assets/icons/humidity.svg";
import AirIcon from "@/assets/icons/air.svg";
import AqiIcon from "@/assets/icons/aqi.svg";
import WindIcon  from "@/assets/icons/wind.svg";
import { useWeather } from "@/contexts/WeatherContext";
import useTranslation from "@/hooks/use-translation";
import { OPENWEATHER_API_KEY, WAQI_API_KEY } from "@/configs/constant.config";

interface WeatherInfoProps {
  lat: number;
  lon: number;
}

const WeatherInfo = ({ lat, lon }: WeatherInfoProps) => {
  const { t } = useTranslation();
  const { weatherCache, aqiCache, setWeather, setAqi } = useWeather();
  const cacheKey = `${lat},${lon}`;
  const weather = weatherCache?.[cacheKey];
  const aqi = aqiCache?.[cacheKey];
  const [loading, setLoading] = useState(!weather || !aqi);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (weather && aqi) return;

    const fetchWeather = async () => {
      setLoading(true);
      setError(null);
      try {
        const weatherRes = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}&lang=vi`
        );
        const weatherData = await weatherRes.json();

        if (!weatherRes.ok || !weatherData.main) {
          throw new Error(weatherData.message || "Không lấy được dữ liệu thời tiết.");
        }

        const aqiRes = await fetch(
          `https://api.waqi.info/feed/geo:${lat};${lon}/?token=${WAQI_API_KEY}`
        );
        const aqiData = await aqiRes.json();

        if (aqiData.status !== "ok" || !aqiData.data) {
          throw new Error("Không lấy được dữ liệu AQI.");
        }

        setWeather(lat, lon, weatherData);
        setAqi(lat, lon, aqiData.data);
      } catch (error: any) {
        setError(error.message || "Đã xảy ra lỗi.");
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, [lat, lon, weather, aqi, setWeather, setAqi]);

  // Hàm chuyển đổi AQI thành mô tả chất lượng không khí
  const getAirQuality = (aqi: number) => {
    if (aqi <= 50) return t('air_good');
    if (aqi <= 100) return t('air_moderate');
    if (aqi <= 150) return t('air_unhealthy_sensitive');
    if (aqi <= 200) return t('air_unhealthy');
    if (aqi <= 300) return t('air_very_unhealthy');
    return t('air_hazardous');
  };

  // Lấy ngày hiện tại
  const today = new Date();
  const days = [t('sun'), t('mon'), t('tue'), t('wed'), t('thu'), t('fri'), t('sat')];
  const dayOfWeek = days[today.getDay()];
  const dateStr = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

  if (loading) return <div style={{ color: "white" }}>{t('loading')}</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;
  if (!weather || !aqi) return <div>{t('no_weather_data')}</div>;

  const getWeatherIcon = (main: string) => {
    switch (main) {
      case "Clear":
        return <SunnyIcon sx={{ fontSize: 60, color: "#FFD700" }} />;
      case "Clouds":
        return <CloudIcon sx={{ fontSize: 60, color: "#B0BEC5" }} />;
      case "Rain":
      case "Drizzle":
        return <CloudySnowingIcon sx={{ fontSize: 60, color: "#4FC3F7" }} />;
      default:
        return <img src={WeatherIcon} style={{ width: 120, height: 95 }} />;
    }
  };

  return (
    <Paper
      elevation={4}
      sx={{
        padding: 2,
        color: '#FFFFFF',
        maxWidth: 360,
        background: 'linear-gradient(to bottom, #143839 0%, #0C2728 100%)',
      }}
    >
      <Typography sx={{ fontWeight: 500, fontSize: 19, color: '#9FD44E' }}>
        {t('weather')}
      </Typography>

      <Typography sx={{ fontWeight: 400, fontSize: 14 }}>
        {dayOfWeek}, {dateStr}
      </Typography>

      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          my: 1,
        }}
      >
        <Box sx={{ display: "inline-block" }}>
          <Typography
            sx={{ fontWeight: 700, fontSize: 45, color: '#00DFC6', lineHeight: 1.1 }}
          >
            {Math.round(weather.main.temp)}°C
          </Typography>
          <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
            {t('feels_like')}: {Math.round(weather.main.feels_like)}°C
          </Typography>
        </Box>
        <Box>
          {getWeatherIcon(weather.weather[0].main)}
        </Box>  
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box sx={{ fontSize: 32, mr: 1.5 }}>
            <img src={HumidityIcon} style={{ width: 27, height: 27 }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 400, fontSize: 12 }}>{t('humidity')}</Typography>
            <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{weather.main.humidity}%</Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box sx={{ fontSize: 32, mr: 1.5, color: '#66BB6A' }}>
            <img src={AirIcon} style={{ width: 32, height: 32 }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 400, fontSize: 12 }}>{t('air')}</Typography>
            <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
              {getAirQuality(aqi.aqi)}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box sx={{ fontSize: 32, mr: 1.5, color: '#FF7043' }}>
            <img src={AqiIcon} style={{ width: 32, height: 32 }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 400, fontSize: 12 }}>AQI</Typography>
            <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{aqi.aqi}</Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box sx={{ fontSize: 32, mr: 1.5, color: '#81D4FA' }}>
            <img src={WindIcon} style={{ width: 32, height: 32 }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 400, fontSize: 12 }}>{t('wind_speed')}</Typography>
            <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{weather.wind.speed} m/s</Typography>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
};

export default WeatherInfo;