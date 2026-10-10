import { Box, Typography } from '@mui/material';
import { Activity, AlertTriangle, Wifi, WifiOff, Thermometer, Zap } from 'lucide-react';
import { useMemo } from 'react';

import type { IDevice } from '@/services/building-device/device.model';

interface FloorStatsBarProps {
  floorName?: string;
  devices: IDevice[];
}

const FloorStatsBar = ({ floorName, devices }: FloorStatsBarProps) => {
  const stats = useMemo(() => {
    const total = devices.length;
    const online = devices.filter((d) => d.isOnline !== false).length;
    const offline = total - online;
    const maintenance = devices.filter((d) => d.status === 'MAINTENANCE').length;
    const alarm = devices.filter((d) => d.status === 'ERROR').length;

    // Average temperature from sensor devices
    const tempDevices = devices.filter((d) => {
      const attrs = d.attributes as Record<string, any> | null;
      return attrs && (attrs.temperature != null || attrs.roomTemp != null || attrs.roomTemperature != null);
    });
    const avgTemp = tempDevices.length > 0
      ? tempDevices.reduce((sum, d) => {
          const attrs = d.attributes as Record<string, any>;
          return sum + (attrs.temperature ?? attrs.roomTemp ?? attrs.roomTemperature ?? 0);
        }, 0) / tempDevices.length
      : null;

    // Count by type
    const typeGroups: Record<string, number> = {};
    devices.forEach((d) => {
      typeGroups[d.type] = (typeGroups[d.type] || 0) + 1;
    });

    return { total, online, offline, maintenance, alarm, avgTemp, typeGroups };
  }, [devices]);

  if (devices.length === 0) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 2.5,
        py: 1.5,
        background: 'rgba(2,6,23,0.85)',
        backdropFilter: 'blur(12px)',
        borderRadius: '14px',
        border: '1px solid rgba(255,255,255,0.08)',
        flexWrap: 'wrap',
      }}
    >
      {/* Floor name */}
      {floorName && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 1 }}>
          <Box sx={{
            width: 8, height: 8, borderRadius: '50%',
            bgcolor: '#00e5ff',
            boxShadow: '0 0 8px #00e5ff',
          }} />
          <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>
            {floorName}
          </Typography>
        </Box>
      )}

      {/* Separator */}
      <Box sx={{ width: 1, height: 24, bgcolor: 'rgba(255,255,255,0.1)' }} />

      {/* Total */}
      <StatChip
        icon={<Activity size={13} />}
        label="Tổng"
        value={stats.total}
        color="#e2e8f0"
      />

      {/* Online */}
      <StatChip
        icon={<Wifi size={13} />}
        label="Online"
        value={stats.online}
        color="#22c55e"
      />

      {/* Offline */}
      {stats.offline > 0 && (
        <StatChip
          icon={<WifiOff size={13} />}
          label="Offline"
          value={stats.offline}
          color="#ef4444"
        />
      )}

      {/* Alarm */}
      {stats.alarm > 0 && (
        <StatChip
          icon={<AlertTriangle size={13} />}
          label="Alarm"
          value={stats.alarm}
          color="#f59e0b"
          pulse
        />
      )}

      {/* Average Temp */}
      {stats.avgTemp !== null && (
        <>
          <Box sx={{ width: 1, height: 24, bgcolor: 'rgba(255,255,255,0.1)' }} />
          <StatChip
            icon={<Thermometer size={13} />}
            label="Avg Temp"
            value={`${stats.avgTemp.toFixed(1)}°C`}
            color="#06b6d4"
          />
        </>
      )}

      {/* Device type breakdown */}
      <Box sx={{ width: 1, height: 24, bgcolor: 'rgba(255,255,255,0.1)' }} />
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {Object.entries(stats.typeGroups)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([type, count]) => (
            <Typography
              key={type}
              sx={{
                fontSize: 9,
                color: '#94a3b8',
                bgcolor: 'rgba(255,255,255,0.06)',
                px: 1,
                py: 0.25,
                borderRadius: 1,
                fontWeight: 500,
              }}
            >
              {type}: {count}
            </Typography>
          ))}
      </Box>
    </Box>
  );
};

/* ─── Stat Chip sub-component ─── */
const StatChip = ({
  icon,
  label,
  value,
  color,
  pulse,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
  pulse?: boolean;
}) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
    <Box sx={{ color, display: 'flex', alignItems: 'center' }}>{icon}</Box>
    <Box>
      <Typography sx={{ color: '#64748b', fontSize: 9, lineHeight: 1 }}>{label}</Typography>
      <Typography
        sx={{
          color,
          fontSize: 13,
          fontWeight: 700,
          lineHeight: 1.2,
          ...(pulse && {
            animation: 'pulse 2s ease-in-out infinite',
            '@keyframes pulse': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.5 },
            },
          }),
        }}
      >
        {value}
      </Typography>
    </Box>
  </Box>
);

export default FloorStatsBar;
