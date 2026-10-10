import { Box, Typography, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  AreaChart,
  Area,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { IDevice } from '@/services/building-device/device.model';

interface DeviceTrendChartProps {
  device: IDevice | null;
  /** Live attribute updates — when WebSocket pushes new data */
  liveAttributes?: Record<string, any>;
}

type TimeRange = '1h' | '6h' | '24h' | '7d';

interface DataPoint {
  time: string;
  timestamp: number;
  [key: string]: any;
}

/* ─── Simulated historical data generator ─── */
// In production, this would call ClickHouse API
const generateHistoricalData = (
  device: IDevice,
  range: TimeRange,
): DataPoint[] => {
  const now = Date.now();
  const attrs = device.attributes as Record<string, any> | null;
  if (!attrs) return [];

  const intervals: Record<TimeRange, { count: number; step: number }> = {
    '1h': { count: 12, step: 5 * 60 * 1000 },    // 5 min intervals
    '6h': { count: 18, step: 20 * 60 * 1000 },    // 20 min intervals
    '24h': { count: 24, step: 60 * 60 * 1000 },   // 1 hour intervals
    '7d': { count: 28, step: 6 * 60 * 60 * 1000 }, // 6 hour intervals
  };

  const { count, step } = intervals[range];

  // Get numeric attributes to chart
  const numericKeys = Object.entries(attrs)
    .filter(([, v]) => typeof v === 'number')
    .map(([k]) => k);

  if (numericKeys.length === 0) return [];

  const data: DataPoint[] = [];
  for (let i = count; i >= 0; i--) {
    const ts = now - i * step;
    const date = new Date(ts);
    const timeLabel = range === '7d'
      ? `${date.getDate()}/${date.getMonth() + 1}`
      : `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

    const point: DataPoint = { time: timeLabel, timestamp: ts };
    numericKeys.forEach((key) => {
      const base = attrs[key] as number;
      // Add small random variation for realistic appearance
      const variance = base * 0.08;
      point[key] = i === 0
        ? base // Latest point = current real value
        : Math.round((base + (Math.random() - 0.5) * variance * 2) * 10) / 10;
    });
    data.push(point);
  }
  return data;
};

/* ─── Attribute colors ─── */
const ATTR_COLORS: Record<string, string> = {
  temperature: '#ef4444',
  roomTemp: '#ef4444',
  roomTemperature: '#ef4444',
  setpoint: '#3b82f6',
  setTemp: '#3b82f6',
  humidity: '#06b6d4',
  co2: '#f59e0b',
  co2Level: '#f59e0b',
  fanSpeed: '#8b5cf6',
  speed: '#8b5cf6',
  valvePosition: '#14b8a6',
  valve: '#14b8a6',
  power: '#fbbf24',
  energy: '#f97316',
  pressure: '#ec4899',
  current: '#a78bfa',
  voltage: '#22d3ee',
  brightness: '#eab308',
  dimming: '#eab308',
};

const getAttrColor = (key: string): string =>
  ATTR_COLORS[key] || '#00e5ff';

const DeviceTrendChart = ({ device, liveAttributes }: DeviceTrendChartProps) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [selectedAttrs, setSelectedAttrs] = useState<string[]>([]);

  // Determine chartable attributes
  const numericAttrs = useMemo(() => {
    if (!device?.attributes) return [];
    return Object.entries(device.attributes as Record<string, any>)
      .filter(([, v]) => typeof v === 'number')
      .map(([k]) => k);
  }, [device?.attributes]);

  // Auto-select first 3 attributes
  useEffect(() => {
    if (numericAttrs.length > 0 && selectedAttrs.length === 0) {
      setSelectedAttrs(numericAttrs.slice(0, 3));
    }
  }, [numericAttrs]);

  // Generate data (would be API call in production)
  const chartData = useMemo(() => {
    if (!device) return [];
    return generateHistoricalData(device, timeRange);
  }, [device, timeRange]);

  // Merge live data as latest point
  const dataWithLive = useMemo(() => {
    if (!liveAttributes || chartData.length === 0) return chartData;
    const latest = { ...chartData[chartData.length - 1] };
    Object.entries(liveAttributes).forEach(([k, v]) => {
      if (typeof v === 'number') latest[k] = v;
    });
    latest.time = 'Now';
    return [...chartData.slice(0, -1), latest];
  }, [chartData, liveAttributes]);

  if (!device) {
    return (
      <Box sx={{
        p: 3, textAlign: 'center',
        color: '#64748b', fontSize: 12,
      }}>
        Chọn thiết bị để xem biểu đồ xu hướng
      </Box>
    );
  }

  if (numericAttrs.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center', color: '#64748b', fontSize: 11 }}>
        Không có dữ liệu số để hiển thị
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* Header with time range selector */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600 }}>
          📊 Trend Chart
        </Typography>
        <ToggleButtonGroup
          size="small"
          value={timeRange}
          exclusive
          onChange={(_, v) => v && setTimeRange(v)}
          sx={{
            '& .MuiToggleButton-root': {
              color: '#64748b',
              fontSize: 10,
              px: 1,
              py: 0.3,
              border: '1px solid rgba(255,255,255,0.1)',
              '&.Mui-selected': {
                bgcolor: 'rgba(0,229,255,0.15)',
                color: '#00e5ff',
                border: '1px solid rgba(0,229,255,0.3)',
              },
            },
          }}
        >
          <ToggleButton value="1h">1H</ToggleButton>
          <ToggleButton value="6h">6H</ToggleButton>
          <ToggleButton value="24h">24H</ToggleButton>
          <ToggleButton value="7d">7D</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Attribute selector chips */}
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {numericAttrs.map((attr) => {
          const isActive = selectedAttrs.includes(attr);
          const color = getAttrColor(attr);
          return (
            <Box
              key={attr}
              onClick={() => {
                setSelectedAttrs((prev) =>
                  isActive
                    ? prev.filter((a) => a !== attr)
                    : [...prev, attr]
                );
              }}
              sx={{
                px: 1, py: 0.25,
                borderRadius: 1,
                fontSize: 9,
                fontWeight: 500,
                cursor: 'pointer',
                border: `1px solid ${isActive ? color : 'rgba(255,255,255,0.1)'}`,
                bgcolor: isActive ? `${color}20` : 'transparent',
                color: isActive ? color : '#64748b',
                transition: 'all 0.2s',
                userSelect: 'none',
                '&:hover': {
                  bgcolor: `${color}10`,
                  color: color,
                },
              }}
            >
              {attr}
            </Box>
          );
        })}
      </Box>

      {/* Chart */}
      <Box
        sx={{
          backgroundColor: '#1B2537',
          borderRadius: 2,
          border: '1px solid rgba(255,255,255,0.06)',
          p: 1,
          '& *:focus, & *:focus-visible': { outline: 'none' },
        }}
      >
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={dataWithLive}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal vertical={false} />
            <XAxis
              dataKey="time"
              stroke="#94a3b8"
              tick={{ fill: '#64748b', fontSize: 9 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#94a3b8"
              tick={{ fill: '#64748b', fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15,23,42,0.95)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                fontSize: 11,
                backdropFilter: 'blur(12px)',
              }}
              labelStyle={{ color: '#94a3b8' }}
            />
            {selectedAttrs.map((attr) => (
              <Area
                key={attr}
                type="monotone"
                dataKey={attr}
                stroke={getAttrColor(attr)}
                fill={`${getAttrColor(attr)}15`}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: getAttrColor(attr), stroke: '#0f172a', strokeWidth: 2 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
};

export default DeviceTrendChart;
