import { Box, Typography, useTheme } from '@mui/material';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

interface StatItemProps {
  label: string;
  value: string;
  color: string;
  showBorder?: 'left' | 'right' | 'both';
}

const StatItem = ({ label, value, color, showBorder }: StatItemProps) => {
  const theme = useTheme();
  const getBorderStyle = () => {
    if (showBorder === 'both')
      return {
        borderLeft: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
        borderRight: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
      };
    if (showBorder === 'left')
      return { borderLeft: `1px solid ${theme.palette.base.whiteAlpha[100]}` };
    if (showBorder === 'right')
      return { borderRight: `1px solid ${theme.palette.base.whiteAlpha[100]}` };
    return {};
  };

  return (
    <Box
      sx={{
        textAlign: 'center',
        ...getBorderStyle(),
      }}
    >
      <Typography
        sx={{
          fontSize: '9px',
          color: 'rgb(100, 116, 139)',
          textTransform: 'uppercase',
          marginBottom: '4px',
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: '14px',
          fontWeight: 'bold',
          color: color,
        }}
      >
        {value}
      </Typography>
    </Box>
  );
};

const EnergyChart = () => {
  const theme = useTheme();
  const data = [
    { time: '00:00', value: 400 },
    { time: '02:00', value: 360 },
    { time: '04:00', value: 310 },
    { time: '06:00', value: 380 },
    { time: '08:00', value: 450 },
    { time: '10:00', value: 500 },
    { time: '12:00', value: 550 },
    { time: '14:00', value: 530 },
    { time: '16:00', value: 490 },
    { time: '18:00', value: 450 },
    { time: '20:00', value: 420 },
    { time: '22:00', value: 380 },
    { time: '23:00', value: 350 },
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
        Tải năng lượng (EMS)
      </Typography>
      <Box
        sx={{
          backgroundColor: '#11182C',
          borderRadius: 3,
          border: `1px solid ${theme.palette.base.whiteAlpha[50]}`,
          padding: 1.25,
          '& *:focus': {
            outline: 'none',
          },
          '& *:focus-visible': {
            outline: 'none',
          },
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 1.5,
            marginBottom: 1.5,
          }}
        >
          <StatItem
            label="Hiện tại"
            value="850 kW"
            color={theme.palette.semantic.info.light}
          />
          <StatItem
            label="Trung bình"
            value="620 kW"
            color="rgb(203, 213, 225)"
            showBorder="both"
          />
          <StatItem
            label="Đỉnh"
            value="850 kW"
            color={theme.palette.semantic.warning.light}
          />
        </Box>

        <ResponsiveContainer width="100%" height={60}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="energyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={theme.palette.semantic.info.main}
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor={theme.palette.semantic.info.main}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={theme.palette.semantic.info.main}
              strokeWidth={2}
              fill="url(#energyGradient)"
              fillOpacity={0.6}
            />
          </AreaChart>
        </ResponsiveContainer>

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '4px',
            paddingX: '4px',
          }}
        >
          <Typography sx={{ fontSize: '8px', color: 'rgb(100, 116, 139)' }}>
            00:00
          </Typography>
          <Typography sx={{ fontSize: '8px', color: 'rgb(100, 116, 139)' }}>
            12:00
          </Typography>
          <Typography sx={{ fontSize: '8px', color: 'rgb(100, 116, 139)' }}>
            23:00
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default EnergyChart;
