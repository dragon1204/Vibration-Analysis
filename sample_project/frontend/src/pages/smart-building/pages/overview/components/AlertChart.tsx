import { Box, Typography, useTheme } from '@mui/material';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

interface LegendItemProps {
  color: string;
  label: string;
  value: number;
}

const LegendItem = ({ color, label, value }: LegendItemProps) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Box
          sx={{
            width: '8px',
            height: '8px',
            borderRadius: '2px',
            backgroundColor: color,
          }}
        />
        <Typography
          sx={{
            fontSize: '12px',
            color: 'rgb(203, 213, 225)',
          }}
        >
          {label}
        </Typography>
      </Box>
      <Typography
        sx={{
          fontSize: '12px',
          fontWeight: 'bold',
          color: color,
        }}
      >
        {value.toString().padStart(2, '0')}
      </Typography>
    </Box>
  );
};

const AlertChart = () => {
  const theme = useTheme();
  const data = [
    { name: 'Healthy', value: 85, color: theme.palette.semantic.success.main },
    { name: 'Warning', value: 12, color: theme.palette.semantic.warning.main },
    { name: 'Critical', value: 3, color: theme.palette.semantic.error.main },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
        Tình trạng tổng quan
      </Typography>
      <Box
        sx={{
          backgroundColor: '#11182C',
          borderRadius: 3,
          border: `1px solid ${theme.palette.base.whiteAlpha[50]}`,
          padding: 1.5,
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Box sx={{ flexShrink: 0 }}>
            <ResponsiveContainer width={100} height={100}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={28}
                  outerRadius={42}
                  dataKey="value"
                  stroke="#fff"
                  strokeWidth={1}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </Box>
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <LegendItem
              color={theme.palette.semantic.success.light}
              label="Bình thường"
              value={85}
            />
            <LegendItem
              color={theme.palette.semantic.warning.light}
              label="Cảnh báo"
              value={12}
            />
            <LegendItem
              color={theme.palette.semantic.error.light}
              label="Nghiêm trọng"
              value={3}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default AlertChart;
