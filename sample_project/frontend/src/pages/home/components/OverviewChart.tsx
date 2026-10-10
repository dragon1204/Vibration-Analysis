import { Box, Button, Typography, useTheme } from '@mui/material';
import { TrendingUp } from 'lucide-react';
import { useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// Mock data cho biểu đồ 24h
const generateData24h = () => {
  const hours = Array.from({ length: 24 }, (_, i) => {
    const hour = (14 + i) % 24;
    return {
      time: `${hour.toString().padStart(2, '0')}:00`,
      warning: Math.floor(Math.random() * 8),
      energy: Math.floor(Math.random() * 1000),
    };
  });
  return hours;
};

// Mock data cho biểu đồ 7 ngày
const generateData7Days = () => {
  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  return days.map((day) => ({
    time: day,
    warning: Math.floor(Math.random() * 30),
    energy: Math.floor(Math.random() * 5000),
  }));
};

const OverviewChart = () => {
  const [period, setPeriod] = useState<'24h' | '7days'>('24h');
  const data = period === '24h' ? generateData24h() : generateData7Days();
  const theme = useTheme();

  return (
    <Box
      sx={{
        p: 3,
        borderRadius: 3,
        bgcolor: 'rgba(30, 41, 59, 0.9)',
        backdropFilter: 'blur(4px)',
        border: `1px solid ${theme.palette.base.cyanAlpha[200]}`,
      }}
    >
      {/* Header */}
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
            fontSize: '1.125rem',
            fontWeight: 'bold',
            color: theme.palette.semantic.info.light,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <TrendingUp size={20} />
          Xu Hướng
        </Typography>

        {/* Filter Buttons */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            onClick={() => setPeriod('24h')}
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              fontSize: '0.75rem',
              fontWeight: 500,
              textTransform: 'none',
              transition: 'all 0.3s ease',
              bgcolor:
                period === '24h' ? theme.palette.semantic.info.main : '#334155',
              color: period === '24h' ? '#fff' : '#94a3b8',
              '&:hover': {
                bgcolor: period === '24h' ? '#0891b2' : '#475569',
              },
            }}
          >
            24h
          </Button>
          <Button
            onClick={() => setPeriod('7days')}
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              fontSize: '0.75rem',
              fontWeight: 500,
              textTransform: 'none',
              transition: 'all 0.3s ease',
              bgcolor:
                period === '7days'
                  ? theme.palette.semantic.info.main
                  : '#334155',
              color: period === '7days' ? '#fff' : '#94a3b8',
              '&:hover': {
                bgcolor: period === '7days' ? '#0891b2' : '#475569',
              },
            }}
          >
            7 ngày
          </Button>
        </Box>
      </Box>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="time" stroke="#94a3b8" style={{ fontSize: 12 }} />
          <YAxis
            yAxisId="left"
            stroke={theme.palette.semantic.warning.main}
            style={{ fontSize: 12 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke={theme.palette.semantic.info.main}
            style={{ fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: `1px solid ${theme.palette.semantic.info.main}`,
              borderRadius: 8,
              fontSize: 12,
              color: '#FFFFFF',
            }}
          />
          <Legend />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="warning"
            name="Cảnh báo"
            stroke={theme.palette.semantic.warning.main}
            strokeWidth={2}
            dot={{
              fill: theme.palette.semantic.warning.main,
              strokeWidth: 2,
              r: 3,
            }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="energy"
            name="Năng lượng (kWh)"
            stroke={theme.palette.semantic.info.main}
            strokeWidth={2}
            dot={{
              fill: theme.palette.semantic.info.main,
              strokeWidth: 2,
              r: 3,
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default OverviewChart;
