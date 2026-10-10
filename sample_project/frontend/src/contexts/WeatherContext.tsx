import React, { createContext, useContext, useState } from "react";

const WeatherContext = createContext<any>(null);

export const WeatherProvider = ({ children }: { children: React.ReactNode }) => {
  const [weatherCache, setWeatherCache] = useState<any>({});
  const [aqiCache, setAqiCache] = useState<any>({});

  const setWeather = (lat: number, lon: number, data: any) => {
    setWeatherCache((prev: any) => ({
      ...prev,
      [`${lat},${lon}`]: data,
    }));
  };

  const setAqi = (lat: number, lon: number, data: any) => {
    setAqiCache((prev: any) => ({
      ...prev,
      [`${lat},${lon}`]: data,
    }));
  };

  return (
    <WeatherContext.Provider value={{ weatherCache, aqiCache, setWeather, setAqi }}>
      {children}
    </WeatherContext.Provider>
  );
};

export const useWeather = () => useContext(WeatherContext);