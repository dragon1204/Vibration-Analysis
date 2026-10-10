import { Box, Typography, Chip, Divider } from '@mui/material';
import { useState, useEffect, useMemo } from 'react';
import { Zap, Droplets, Thermometer, Wind, TrendingUp, TrendingDown, Activity } from 'lucide-react';

import BuildingSidebar from '../../components/BuildingSidebar';
import { useBuilding } from '@/contexts/BuildingContext';
import { useDeviceSocketContext } from '@/contexts/DeviceSocketContext';
import { EMS_DEVICE_TYPES } from '@/constants/device-systems';

const EnergyManagement = () => {
  const { currentFloor, floorDevices } = useBuilding();
  const { liveData } = useDeviceSocketContext();

  // Filter EMS devices only
  const emsDevices = useMemo(() => {
    return floorDevices.filter((d) => EMS_DEVICE_TYPES.includes(d.type as any));
  }, [floorDevices]);

  // Merge live data
  const mergedDevices = useMemo(() => {
    if (!liveData || Object.keys(liveData).length === 0) return emsDevices;
    return emsDevices.map((d) => {
      const live = liveData[d.deviceId || ''];
      if (!live) return d;
      return { ...d, attributes: { ...(d.attributes as any), ...live }, isOnline: true };
    });
  }, [emsDevices, liveData]);

  // Group by type
  const groupedDevices = useMemo(() => {
    const groups: Record<string, typeof mergedDevices> = {};
    mergedDevices.forEach((d) => {
      if (!groups[d.type]) groups[d.type] = [];
      groups[d.type].push(d);
    });
    return groups;
  }, [mergedDevices]);

  const TYPE_INFO: Record<string, { label: string; icon: any; color: string; unit: string }> = {
    ELECTRIC: { label: 'Thiết bị điện', icon: Zap, color: '#fbbf24', unit: 'kW' },
    ELECTRIC_METER: { label: 'Đồng hồ điện', icon: Activity, color: '#f59e0b', unit: 'kWh' },
    POWER_BREAKER: { label: 'Aptomat / CB', icon: Zap, color: '#ef4444', unit: '' },
    WATER_METER: { label: 'Đồng hồ nước', icon: Droplets, color: '#3b82f6', unit: 'm³' },
    BTU_METER: { label: 'Đồng hồ BTU', icon: Thermometer, color: '#ef4444', unit: 'BTU' },
    CO2_METER: { label: 'Cảm biến CO₂', icon: Wind, color: '#22c55e', unit: 'ppm' },
  };

  const totalDevices = mergedDevices.length;
  const onlineDevices = mergedDevices.filter((d) => d.isOnline !== false).length;

  return (
    <>
      {/* Sidebar */}
      <Box
        sx={{
          position: 'absolute',
          top: 90,
          left: 20,
          bottom: 90,
          width: 280,
          zIndex: 9,
        }}
      >
        <BuildingSidebar systemFilter="ems" />
      </Box>

      {/* Main Content */}
      <Box
        sx={{
          position: 'absolute',
          top: 90,
          left: 320,
          right: 20,
          bottom: 90,
          overflow: 'auto',
          zIndex: 1,
          bgcolor: 'rgba(2, 6, 23, 0.75)',
          backdropFilter: 'blur(12px)',
          borderRadius: 3,
          p: 2.5,
        }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography sx={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>
              Quản lý Năng lượng
            </Typography>
            <Typography sx={{ color: '#64748b', fontSize: 12 }}>
              {currentFloor ? `${currentFloor.name}` : 'Chưa chọn tầng'} — {totalDevices} thiết bị
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Box sx={{ px: 2, py: 1, borderRadius: 2, bgcolor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <Typography sx={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>ONLINE</Typography>
              <Typography sx={{ fontSize: 18, color: '#22c55e', fontWeight: 700 }}>{onlineDevices}</Typography>
            </Box>
            <Box sx={{ px: 2, py: 1, borderRadius: 2, bgcolor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <Typography sx={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>OFFLINE</Typography>
              <Typography sx={{ fontSize: 18, color: '#ef4444', fontWeight: 700 }}>{totalDevices - onlineDevices}</Typography>
            </Box>
          </Box>
        </Box>

        {/* Device Groups */}
        {Object.keys(groupedDevices).length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Zap size={48} color="#475569" />
            <Typography sx={{ color: '#64748b', fontSize: 14, mt: 2 }}>
              Chưa có thiết bị năng lượng nào trên tầng này
            </Typography>
            <Typography sx={{ color: '#475569', fontSize: 12, mt: 0.5 }}>
              Chọn tầng từ sidebar bên trái để xem thiết bị
            </Typography>
          </Box>
        ) : (
          Object.entries(groupedDevices).map(([type, devices]) => {
            const info = TYPE_INFO[type] || { label: type, icon: Zap, color: '#94a3b8', unit: '' };
            const Icon = info.icon;
            return (
              <Box key={type} sx={{ mb: 3 }}>
                {/* Group header */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <Icon size={16} color={info.color} />
                  <Typography sx={{ color: info.color, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {info.label}
                  </Typography>
                  <Chip label={devices.length} size="small" sx={{ height: 20, fontSize: 10, bgcolor: `${info.color}20`, color: info.color }} />
                </Box>

                {/* Device cards grid */}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 1.5 }}>
                  {devices.map((device) => {
                    const attrs = device.attributes as Record<string, any> | null;
                    const mainValue = attrs?.value ?? attrs?.power ?? attrs?.energy ?? attrs?.reading ?? attrs?.level ?? '--';
                    return (
                      <Box
                        key={device.id}
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          bgcolor: 'rgba(15,23,42,0.6)',
                          border: `1px solid rgba(255,255,255,0.08)`,
                          backdropFilter: 'blur(8px)',
                          transition: 'all 0.2s',
                          '&:hover': { border: `1px solid ${info.color}50`, bgcolor: 'rgba(15,23,42,0.8)' },
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Box>
                            <Typography sx={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>
                              {device.name}
                            </Typography>
                            <Typography sx={{ color: '#64748b', fontSize: 10 }}>
                              {device.deviceId || device.eboId || '—'}
                            </Typography>
                          </Box>
                          <Box
                            sx={{
                              width: 8, height: 8, borderRadius: '50%',
                              bgcolor: device.isOnline !== false ? '#22c55e' : '#ef4444',
                              boxShadow: `0 0 6px ${device.isOnline !== false ? '#22c55e' : '#ef4444'}`,
                            }}
                          />
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                          <Typography sx={{ color: info.color, fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                            {typeof mainValue === 'number' ? mainValue.toFixed(1) : mainValue}
                          </Typography>
                          {info.unit && (
                            <Typography sx={{ color: '#64748b', fontSize: 12 }}>
                              {info.unit}
                            </Typography>
                          )}
                        </Box>
                        {/* Status chips */}
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                          <Chip
                            label={device.status || 'N/A'}
                            size="small"
                            sx={{ height: 18, fontSize: 9, bgcolor: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}
                          />
                          {attrs?.alarm && (
                            <Chip label="ALARM" size="small" sx={{ height: 18, fontSize: 9, bgcolor: 'rgba(239,68,68,0.15)', color: '#ef4444' }} />
                          )}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            );
          })
        )}
      </Box>
    </>
  );
};

export default EnergyManagement;
