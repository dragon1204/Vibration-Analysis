import { Box, Typography, useTheme } from '@mui/material';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts';

const TrendChart = () => {
  const theme = useTheme();
  const data = [
    { time: '08:00', value: 650 },
    { time: '10:00', value: 780 },
    { time: '12:00', value: 720 },
    { time: '14:00', value: 920 },
    { time: '16:00', value: 820 },
    { time: '18:00', value: 860 },
    { time: '20:00', value: 680 },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography
        variant="caption"
        sx={{
          fontSize: '12px',
          fontWeight: 600,
          color: theme.palette.base.slateLightAlpha[1000],
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        Biểu đồ xu hướng
      </Typography>
      <Box
        sx={{
          backgroundColor: '#11182C',
          borderRadius: 3,
          border: `1px solid ${theme.palette.base.whiteAlpha[50]}`,
          padding: 1,
          '& *:focus': {
            outline: 'none',
          },
          '& *:focus-visible': {
            outline: 'none',
          },
        }}
      >
        <ResponsiveContainer width="100%" height={133}>
          <LineChart data={data}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#334155"
              horizontal={true}
              vertical={false}
            />
            <XAxis
              dataKey="time"
              stroke="#94a3b8"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgb(15, 23, 42)',
                border: '1px solid rgb(51, 65, 85)',
                borderRadius: '4px',
                fontSize: '12px',
              }}
              labelStyle={{ color: '#94a3b8' }}
              itemStyle={{ color: theme.palette.semantic.info.main }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={theme.palette.semantic.info.main}
              strokeWidth={2}
              dot={{
                fill: theme.palette.semantic.info.main,
                stroke: theme.palette.semantic.info.main,
                strokeWidth: 2,
                r: 4,
              }}
              activeDot={{
                fill: theme.palette.semantic.info.main,
                stroke: theme.palette.semantic.info.main,
                strokeWidth: 2,
                r: 5,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
};

export default TrendChart;
