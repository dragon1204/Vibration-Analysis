import { Box, Typography, Button, Chip, Divider, CircularProgress, Snackbar, Alert } from '@mui/material';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { Radio } from 'lucide-react';

import type { IDevice, IDeviceResponse } from '@/services/building-device/device.model';
import type { Floor } from '@/services/urban/floor.service';
import type { Building as BuildingType } from '@/services/urban/building.service';
import { floorService } from '@/services/urban/floor.service';
import deviceService from '@/services/building-device/device.service';
import { useDeviceSocketContext } from '@/contexts/DeviceSocketContext';

/** Height per floor in 3D space units */
const FLOOR_HEIGHT_3D = 3.0;

/**
 * Convention: model 3D tòa nhà = /models/<buildingId>.glb
 * Khi tạo tòa nhà mới + upload file GLB, backend tự lưu thành <id>.glb
 * Frontend chỉ cần biết buildingId → tự suy ra đường dẫn.
 */
const getBuildingModelUrl = (_buildingId?: number): string => '/models/3.glb';


import { useBuilding } from '@/contexts/BuildingContext';
import FloorPlan2D from './components/FloorPlan2D';
import Bms3DViewer from './components/Bms3DViewer';
import HvacSchematic from './components/HvacSchematic';
import ViewModeToggle from './components/ViewModeToggle';
import DeviceAttributeControl from './components/DeviceAttributeControl';
import DeviceTrendChart from './components/DeviceTrendChart';
import FloorStatsBar from './components/FloorStatsBar';

const BuildingManagement = () => {
  const {
    currentBuilding,
    currentFloor,
    floorDevices,
    allBuildingDevices,
    floorMap,
    selectedDevice,
    setSelectedDevice,
    selected3DFloor,
    setSelected3DFloor,
    setAllBuildingDevices,
    setFloorDevices,
    activeTypeFilters,
  } = useBuilding();

  const [commandLoading, setCommandLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'2d' | '3d' | 'schematic'>('3d');
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'error' | 'warning' | 'success' | 'info' }>(
    { open: false, message: '', severity: 'info' },
  );

  // Real-time WebSocket data
  const { connected: wsConnected, deviceAttributes } = useDeviceSocketContext();

  // Merge WebSocket real-time data with REST data
  const mergedDevices = useMemo(() =>
    floorDevices.map((d) => {
      const wsAttrs = deviceAttributes[d.id];
      if (!wsAttrs) return d;
      return {
        ...d,
        attributes: { ...(d.attributes as Record<string, any>), ...wsAttrs },
      };
    }),
    [floorDevices, deviceAttributes],
  );

  // Merged selected device (auto-update with WS data)
  const mergedSelectedDevice = useMemo(() => {
    if (!selectedDevice) return null;
    const wsAttrs = deviceAttributes[selectedDevice.id];
    if (!wsAttrs) return selectedDevice;
    return {
      ...selectedDevice,
      attributes: { ...(selectedDevice.attributes as Record<string, any>), ...wsAttrs },
    };
  }, [selectedDevice, deviceAttributes]);

  // Live attributes for selected device
  const liveAttributes = useMemo(() => {
    if (!selectedDevice) return undefined;
    return deviceAttributes[selectedDevice.id];
  }, [selectedDevice, deviceAttributes]);

  const handleDeviceSelect = (device: IDevice) => {
    setSelectedDevice(device);
  };



  // 3D floor click handler
  const handle3DFloorSelect = useCallback((floorName: string) => {
    setSelected3DFloor(floorName || null);
  }, []);

  // Memoize floorsData to prevent camera snap-back on re-renders
  const floorsData = useMemo(
    () => Array.from(floorMap.values()).sort((a, b) => a.floorNumber - b.floorNumber),
    [floorMap],
  );

  // All building devices with computed Z coordinate for 3D positioning
  const devices3D = useMemo(() => {
    // Group devices by floor for grid-based auto-layout
    const floorGroups = new Map<number | null, IDevice[]>();
    allBuildingDevices.forEach((d) => {
      const key = d.floorId ?? null;
      if (!floorGroups.has(key)) floorGroups.set(key, []);
      floorGroups.get(key)!.push(d);
    });

    return allBuildingDevices.map((d) => {
      const floorInfo = d.floorId ? floorMap.get(d.floorId) : null;
      const floorNumber = floorInfo?.floorNumber ?? 0;
      const computedZ = (floorNumber + 2) * FLOOR_HEIGHT_3D; // +2 offset for basement floors (B2=-2 → 0)
      const wsAttrs = deviceAttributes[d.id];

      // MAPPING LOGIC: 2D Plan uses pixels (780x460), 3D Viewer uses world units (approx 20x12)
      let mapX = d.xCoordinate ?? 0;
      let mapY = d.yCoordinate ?? 0; // In DB, yCoordinate maps to Z depth in 3D

      // Auto-layout: grid-based distribution if coordinates are exactly 0
      if (mapX === 0 && mapY === 0) {
        const key = d.floorId ?? null;
        const floorDevices = floorGroups.get(key) || [];
        const deviceIndex = floorDevices.indexOf(d);
        const total = floorDevices.length;

        // Calculate grid dimensions (e.g., 6 devices → 3 cols × 2 rows)
        const cols = Math.max(1, Math.ceil(Math.sqrt(total)));
        const rows = Math.max(1, Math.ceil(total / cols));
        const col = deviceIndex % cols;
        const row = Math.floor(deviceIndex / cols);

        // Map grid cell to [-8, 8] range with padding so devices don't sit on edges
        mapX = cols === 1 ? 0 : -8 + (col / (cols - 1)) * 16;
        mapY = rows === 1 ? 0 : -8 + (row / (rows - 1)) * 16;
      } else if (Math.abs(mapX) > 20 || Math.abs(mapY) > 20) {
        // If values are large, they came from 2D drag-and-drop. Map them to 3D.
        mapX = (mapX / 780) * 20 - 10;
        mapY = (mapY / 460) * 12 - 6;
      }

      return {
        ...d,
        xCoordinate: mapX,
        yCoordinate: mapY,
        zCoordinate: computedZ,
        _floorName: floorInfo?.name ?? '',
        _floorNumber: floorInfo ? floorInfo.floorNumber : undefined,
        ...(wsAttrs ? { attributes: { ...(d.attributes as Record<string, any>), ...wsAttrs } } : {}),
      };
    });
  }, [allBuildingDevices, floorMap, deviceAttributes]);

  // BMS type filter groups (same as BuildingSidebar)
  const BMS_TYPE_FILTERS = [
    { key: 'HVAC', types: ['AHU', 'FCU', 'VAV', 'PAU', 'CHILLER', 'CHILLER_PIPE', 'CHILLER_VALVE', 'CHILLER_COLD_PUMP', 'CHILLER_COOLING_PUMP', 'CHILLER_COOLING_TOWER', 'AHU_FILTER', 'AHU_VALVE', 'AHU_SENSOR_TEMPERATURE', 'PAU_FILTER', 'PAU_VALVE', 'PAU_SENSOR_TEMPERATURE', 'COOLING'] },
    { key: 'FAN', types: ['FAN'] },
    { key: 'PUMP', types: ['PUMP'] },
    { key: 'FIRE', types: ['FIRE_PUMP', 'FIRE_ALARM'] },
    { key: 'LIGHT', types: ['LIGHT', 'DIM_LIGHT'] },
  ];

  // Apply type filters from sidebar to 3D/2D devices
  const filteredDevices3D = useMemo(() => {
    if (activeTypeFilters.length === 0) return devices3D;
    const allowedTypes = new Set<string>();
    activeTypeFilters.forEach((filterKey) => {
      const filter = BMS_TYPE_FILTERS.find((f) => f.key === filterKey);
      filter?.types.forEach((t) => allowedTypes.add(t));
    });
    return devices3D.filter((d) => allowedTypes.has(d.type));
  }, [devices3D, activeTypeFilters]);

  const handleCommand = async (key: string, value: any) => {
    if (!selectedDevice) {
      setToast({ open: true, message: 'Không có thiết bị nào được chọn', severity: 'error' });
      return;
    }
    console.log('=== COMMAND DEBUG ===');
    console.log('Device ID:', selectedDevice.id);
    console.log('Device Type:', selectedDevice.type);
    console.log('Building ID:', selectedDevice.buildingId);
    console.log('Command:', { [key]: value });
    setCommandLoading(true);
    try {
      const result = await deviceService.executeCommand(
        selectedDevice.id,
        selectedDevice.type,
        selectedDevice.buildingId ?? 0,
        { [key]: value },
      );
      console.log('Command SUCCESS:', result);
      setToast({ open: true, message: `Đã gửi lệnh ${key}=${value}`, severity: 'success' });
    } catch (err: any) {
      const errData = err?.response?.data;
      const errMsg = errData?.message || err?.message || String(err);
      const isPrerequisite = errData?.code === 'PREREQUISITE_FAILED' || errMsg.includes('Phải bật trước');
      console.error('Command FAILED:', errData || err);
      setToast({
        open: true,
        message: isPrerequisite
          ? `⚠️ ${errMsg}`
          : `Lỗi điều khiển: ${errMsg}`,
        severity: isPrerequisite ? 'warning' : 'error',
      });
    } finally {
      setCommandLoading(false);
    }
  };

  const handleDevicePositionChange = useCallback(
    (deviceId: string, x: number, y: number) => {
      // Update floorDevices (for 2D plan)
      setFloorDevices((prev) =>
        prev.map((d) =>
          d.id === deviceId ? { ...d, xCoordinate: x, yCoordinate: y } : d,
        ),
      );
      // Also update allBuildingDevices (so 3D plan picks up the new coords)
      setAllBuildingDevices((prev: IDevice[]) =>
        prev.map((d: IDevice) =>
          d.id === deviceId ? { ...d, xCoordinate: x, yCoordinate: y } : d,
        ),
      );
      // Persist to database
      deviceService.updateDevice(deviceId, { xCoordinate: x, yCoordinate: y })
        .catch((err) => console.error('Failed to save device position:', err));
    },
    [],
  );

  const deviceForPanel = mergedSelectedDevice || selectedDevice;

  return (
    <>


      {/* View Mode Toggle */}
      <Box
        sx={{
          position: 'absolute',
          top: 70,
          left: 320,
          zIndex: 10,
        }}
      >
        <ViewModeToggle mode={viewMode} onChange={setViewMode} />
      </Box>

      {/* Main Viewer — 2D / 3D / Schematic */}
      <Box
        sx={{
          position: 'absolute',
          top: 110,
          left: 320,
          right: deviceForPanel ? 380 : 20,
          bottom: 90,
          overflow: 'hidden',
          zIndex: 5,
          transition: 'right 0.3s ease',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          background: '#0B1220',
          borderRadius: 2,
        }}
      >
        {/* Viewer Area */}
        <Box sx={{ flex: 1, minHeight: 0, mt: 1, overflowY: 'auto' }}>
          {viewMode === '2d' && (
            <FloorPlan2D
              devices={filteredDevices3D}
              floorLevel={currentFloor?.floorNumber ?? 0}
              floorName={
                currentFloor
                  ? `${currentFloor.name} — ${currentBuilding?.name || ''}`
                  : 'Chưa chọn tầng'
              }
              selectedDeviceId={selectedDevice?.id}
              onDeviceSelect={handleDeviceSelect}
              onDevicePositionChange={handleDevicePositionChange}
              modelUrl={getBuildingModelUrl(currentBuilding?.id)}
              floorsData={floorsData}
            />
          )}

          {viewMode === '3d' && currentBuilding && (
            <Bms3DViewer
              modelUrl={getBuildingModelUrl(currentBuilding.id)}
              selectedFloor={selected3DFloor}
              onFloorSelect={handle3DFloorSelect}
              devices={filteredDevices3D}
              selectedDeviceId={selectedDevice?.id}
              onDeviceSelect={handleDeviceSelect}
              floorsData={floorsData}
              onDevicePositionChange={handleDevicePositionChange}
            />
          )}

          {viewMode === 'schematic' && (
            <HvacSchematic
              devices={activeTypeFilters.length === 0 ? mergedDevices : mergedDevices.filter((d) => {
                const allowedTypes = new Set<string>();
                activeTypeFilters.forEach((filterKey) => {
                  const filter = BMS_TYPE_FILTERS.find((f) => f.key === filterKey);
                  filter?.types.forEach((t) => allowedTypes.add(t));
                });
                return allowedTypes.has(d.type);
              })}
              selectedDeviceId={selectedDevice?.id}
              onDeviceSelect={handleDeviceSelect}
              floorName={currentFloor?.name}
            />
          )}
        </Box>


      </Box>

      {/* Device Control Panel — Slide in from right */}
      {deviceForPanel && (
        <Box
          sx={{
            position: 'absolute',
            top: 90,
            right: 20,
            bottom: 20,
            width: 340,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(180deg, #0B1220 0%, #0F172A 100%)',
            backdropFilter: 'blur(16px)',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '-10px 0 40px rgba(0,0,0,0.6)',
            overflow: 'hidden',
          }}
        >
          {/* Panel Header */}
          <Box sx={{ p: 2.5, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box>
                <Typography sx={{ fontSize: 10, color: '#64748b', letterSpacing: '0.1em', mb: 0.5 }}>
                  {deviceForPanel.type}
                </Typography>
                <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
                  {deviceForPanel.name}
                </Typography>
              </Box>
              <Button
                size="small"
                onClick={() => setSelectedDevice(null)}
                sx={{ minWidth: 0, color: '#94a3b8', fontSize: 18, p: 0.5 }}
              >
                ✕
              </Button>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
              <Chip
                label={deviceForPanel.isOnline !== false ? 'ONLINE' : 'OFFLINE'}
                size="small"
                sx={{
                  height: 22, fontSize: 10, fontWeight: 700,
                  bgcolor: deviceForPanel.isOnline !== false ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                  color: deviceForPanel.isOnline !== false ? '#22c55e' : '#ef4444',
                  border: `1px solid ${deviceForPanel.isOnline !== false ? '#22c55e' : '#ef4444'}`,
                }}
              />
              <Chip
                label={deviceForPanel.status || 'ACTIVE'}
                size="small"
                sx={{ height: 22, fontSize: 10, fontWeight: 600, bgcolor: 'rgba(0,200,255,0.1)', color: '#00e5ff' }}
              />
              {/* Live indicator */}
              {liveAttributes && (
                <Chip
                  icon={<Radio size={10} />}
                  label="LIVE"
                  size="small"
                  sx={{
                    height: 22, fontSize: 10, fontWeight: 700,
                    bgcolor: 'rgba(34,197,94,0.15)',
                    color: '#22c55e',
                    border: '1px solid rgba(34,197,94,0.3)',
                    animation: 'pulse 2s ease-in-out infinite',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 1 },
                      '50%': { opacity: 0.6 },
                    },
                    '& .MuiChip-icon': { color: '#22c55e' },
                  }}
                />
              )}
            </Box>
          </Box>

          {/* Attributes / Controls */}
          <Box
            sx={{
              flex: 1, p: 2, overflowY: 'auto',
              '&::-webkit-scrollbar': { width: 4 },
              '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.1)', borderRadius: 2 },
            }}
          >
            <Typography sx={{ fontSize: 11, color: '#64748b', letterSpacing: '0.1em', mb: 1.5 }}>
              THUỘC TÍNH THIẾT BỊ
            </Typography>

            {deviceForPanel.attributes && Object.keys(deviceForPanel.attributes).length > 0 ? (
              Object.entries(deviceForPanel.attributes).map(([key, value]) => (
                <Box key={key}>
                  <DeviceAttributeControl
                    attrKey={key}
                    value={value}
                    disabled={commandLoading}
                    deviceType={deviceForPanel.type}
                    onCommand={handleCommand}
                  />
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
                </Box>
              ))
            ) : (
              <Typography sx={{ color: '#475569', fontSize: 12 }}>
                Thiết bị chưa có dữ liệu thuộc tính
              </Typography>
            )}

            {/* Trend Chart */}
            <Box sx={{ mt: 2 }}>
              <DeviceTrendChart
                device={deviceForPanel}
                liveAttributes={liveAttributes}
              />
            </Box>

            {/* Device Info */}
            <Typography sx={{ fontSize: 11, color: '#64748b', letterSpacing: '0.1em', mt: 3, mb: 1.5 }}>
              THÔNG TIN THIẾT BỊ
            </Typography>
            {[
              { label: 'Device ID', value: deviceForPanel.deviceId },
              { label: 'EBO ID', value: deviceForPanel.eboId },
              { label: 'Feature Code', value: deviceForPanel.featureCode },
              { label: 'Manufacturer', value: deviceForPanel.manufacturer },
              { label: 'Model', value: deviceForPanel.model },
              { label: 'Serial', value: deviceForPanel.serialNumber },
              { label: 'Position', value: `X: ${deviceForPanel.xCoordinate ?? '-'} / Y: ${deviceForPanel.yCoordinate ?? '-'}` },
            ]
              .filter((row) => row.value)
              .map((row) => (
                <Box key={row.label} sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
                  <Typography sx={{ color: '#64748b', fontSize: 11 }}>{row.label}</Typography>
                  <Typography sx={{ color: '#cbd5e1', fontSize: 11, fontWeight: 500 }}>
                    {row.value}
                  </Typography>
                </Box>
              ))}
          </Box>

          {/* Command Button */}
          <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <Button
              fullWidth
              disabled={commandLoading}
              onClick={() => {
                const attrs = deviceForPanel.attributes as Record<string, any> | null;
                let commandKey = 'running';
                let currentStatus = false;

                if (attrs?.status !== undefined) {
                  commandKey = 'status';
                  currentStatus = !!attrs.status;
                } else if (attrs?.state !== undefined) {
                  commandKey = 'state';
                  currentStatus = attrs.state === 1 || attrs.state === true;
                } else if (attrs?.running !== undefined) {
                  commandKey = 'running';
                  currentStatus = !!attrs.running;
                }

                // Always send boolean — backend DTOs expect boolean for state
                const nextValue = !currentStatus;

                handleCommand(commandKey, nextValue);
              }}
              sx={{
                height: 40, borderRadius: 2, fontWeight: 700, fontSize: 12,
                color: '#00e5ff',
                background: 'linear-gradient(180deg, #0B2942 0%, #062032 100%)',
                border: '1px solid rgba(0,229,255,0.3)',
                '&:hover': { background: 'linear-gradient(180deg, #0E3A5A 0%, #08304A 100%)' },
                '&:disabled': { color: '#475569' },
              }}
            >
              {commandLoading ? (
                <CircularProgress size={16} sx={{ color: '#00e5ff' }} />
              ) : (
                'GỬI LỆNH ĐIỀU KHIỂN'
              )}
            </Button>
          </Box>
        </Box>
      )}

      {/* Toast Notification */}
      <Snackbar
        open={toast.open}
        autoHideDuration={toast.severity === 'warning' ? 6000 : 3000}
        onClose={() => setToast(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setToast(prev => ({ ...prev, open: false }))}
          severity={toast.severity}
          variant="filled"
          sx={{
            width: '100%',
            fontSize: 13,
            fontWeight: 600,
            ...(toast.severity === 'warning' && {
              bgcolor: 'rgba(245,158,11,0.95)',
              color: '#fff',
            }),
          }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default BuildingManagement;
