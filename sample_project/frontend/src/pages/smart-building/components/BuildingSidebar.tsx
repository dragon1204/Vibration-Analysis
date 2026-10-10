import { Box, Chip, CircularProgress, InputAdornment, TextField, Typography, useTheme } from '@mui/material';
import {
  Building, Camera, ChevronDown, ChevronRight, Search,
  Fan, Droplets, Flame, Lightbulb, Thermometer, Wind,
  Gauge, ShieldAlert, Zap, CircleDot,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import deviceService from '@/services/building-device/device.service';
import type { IDevice, IDeviceResponse } from '@/services/building-device/device.model';
import { buildingService, type Building as BuildingType } from '@/services/urban/building.service';
import { floorService, type Floor } from '@/services/urban/floor.service';

import { useBuilding } from '@/contexts/BuildingContext';
import { type SystemType, SYSTEM_DEVICE_TYPES } from '@/constants/device-systems';

/* ─── Device type icons & colors ─── */
const DEVICE_TYPE_MAP: Record<string, { icon: any; color: string; label: string }> = {
  FAN:           { icon: Fan,          color: '#3b82f6', label: 'Fan' },
  PUMP:          { icon: Droplets,     color: '#06b6d4', label: 'Pump' },
  FIRE_PUMP:     { icon: Flame,        color: '#ef4444', label: 'Fire Pump' },
  FIRE_ALARM:    { icon: ShieldAlert,  color: '#f59e0b', label: 'Fire Alarm' },
  LIGHT:         { icon: Lightbulb,    color: '#eab308', label: 'Light' },
  DIM_LIGHT:     { icon: Lightbulb,    color: '#ca8a04', label: 'Dim Light' },
  AHU:           { icon: Wind,         color: '#8b5cf6', label: 'AHU' },
  FCU:           { icon: Thermometer,  color: '#14b8a6', label: 'FCU' },
  VAV:           { icon: Gauge,        color: '#f97316', label: 'VAV' },
  PAU:           { icon: Wind,         color: '#a78bfa', label: 'PAU' },
  CHILLER:       { icon: Thermometer,  color: '#22d3ee', label: 'Chiller' },
  ELECTRIC:      { icon: Zap,          color: '#fbbf24', label: 'Electrical' },
  ELECTRIC_METER:{ icon: Zap,          color: '#f59e0b', label: 'Meter' },
  CAMERA:        { icon: Camera,       color: '#ef4444', label: 'Camera' },
};

const getDeviceTypeInfo = (type: string) =>
  DEVICE_TYPE_MAP[type] || { icon: CircleDot, color: '#94a3b8', label: type };

/* ─── Type filter groups per system ─── */
const BMS_TYPE_FILTERS = [
  { key: 'HVAC', types: ['AHU', 'FCU', 'VAV', 'PAU', 'CHILLER', 'CHILLER_PIPE', 'CHILLER_VALVE', 'CHILLER_COLD_PUMP', 'CHILLER_COOLING_PUMP', 'CHILLER_COOLING_TOWER', 'AHU_FILTER', 'AHU_VALVE', 'AHU_SENSOR_TEMPERATURE', 'PAU_FILTER', 'PAU_VALVE', 'PAU_SENSOR_TEMPERATURE', 'COOLING'], label: 'HVAC', color: '#8b5cf6' },
  { key: 'FAN', types: ['FAN'], label: 'Fan', color: '#3b82f6' },
  { key: 'PUMP', types: ['PUMP'], label: 'Pump', color: '#06b6d4' },
  { key: 'FIRE', types: ['FIRE_PUMP', 'FIRE_ALARM'], label: 'Fire', color: '#ef4444' },
  { key: 'LIGHT', types: ['LIGHT', 'DIM_LIGHT'], label: 'Light', color: '#eab308' },
];

const EMS_TYPE_FILTERS = [
  { key: 'ELECTRIC', types: ['ELECTRIC', 'ELECTRIC_METER', 'POWER_BREAKER'], label: 'Elec', color: '#fbbf24' },
  { key: 'WATER', types: ['WATER_METER'], label: 'Water', color: '#3b82f6' },
  { key: 'BTU', types: ['BTU_METER'], label: 'BTU', color: '#ef4444' },
  { key: 'CO2', types: ['CO2_METER'], label: 'CO2', color: '#22c55e' },
];

const CCTV_TYPE_FILTERS = [
  { key: 'CAMERA', types: ['CAMERA'], label: 'Camera', color: '#ef4444' },
];

const SYSTEM_FILTERS: Record<SystemType, typeof BMS_TYPE_FILTERS> = {
  bms: BMS_TYPE_FILTERS,
  ems: EMS_TYPE_FILTERS,
  cctv: CCTV_TYPE_FILTERS,
};

const SYSTEM_TITLES: Record<SystemType, string> = {
  bms: 'BMS SYSTEMS',
  cctv: 'CCTV SYSTEMS',
  ems: 'EMS SYSTEMS',
};

interface BuildingSidebarProps {
  systemFilter?: SystemType;
}

const BuildingSidebar = ({ systemFilter = 'bms' }: BuildingSidebarProps) => {
  const theme = useTheme();
  
  const { 
    currentBuilding, 
    handleBuildingSelect, 
    currentFloor, 
    handleFloorSelect,
    selectedDevice,
    handleDeviceSelect,
    activeTypeFilters,
    setActiveTypeFilters,
  } = useBuilding();

  const [buildings, setBuildings] = useState<BuildingType[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [devices, setDevices] = useState<IDevice[]>([]);
  
  // Use expandedBuilding for UI state, initialized from currentBuilding if it exists
  const [expandedBuilding, setExpandedBuilding] = useState<number | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [devicesLoading, setDevicesLoading] = useState(false);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const activeFilters = activeTypeFilters;
  const setActiveFilters = setActiveTypeFilters;

  // Fetch buildings on mount
  useEffect(() => {
    const fetchBuildings = async () => {
      try {
        const data = await buildingService.getBuildings();
        const list = Array.isArray(data) ? data : [];
        setBuildings(list);
        // Auto-expand first building
        if (list.length > 0) {
          const defaultBuilding = currentBuilding || list[0];
          setExpandedBuilding(defaultBuilding.id);
          if (!currentBuilding) {
            handleBuildingSelect(defaultBuilding);
          }
          await loadFloors(defaultBuilding.id);
        }
      } catch (err) {
        console.error('Failed to fetch buildings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBuildings();
  }, []);

  const loadFloors = async (buildingId: number) => {
    try {
      const data = await floorService.getFloors(buildingId);
      const list = Array.isArray(data) ? data : [];
      setFloors(list);
      // Auto-select first floor
      if (list.length > 0) {
        const defaultFloor = currentFloor || list[0];
        const devs = await loadDevices(defaultFloor.id, buildingId);
        setSelectedFloor(defaultFloor.id);
        if (!currentBuilding || !currentFloor) {
            handleFloorSelect(defaultFloor, devs, buildingId);
        }
      }
    } catch (err) {
      console.error('Failed to fetch floors:', err);
    }
  };

  const TYPE_FILTERS = SYSTEM_FILTERS[systemFilter];
  const allowedTypes = SYSTEM_DEVICE_TYPES[systemFilter];

  const loadDevices = async (floorId: number, buildingId?: number): Promise<IDevice[]> => {
    setDevicesLoading(true);
    try {
      const result: IDeviceResponse = await deviceService.getDevices({
        buildingId,
        floorId,
        take: 200,
      });
      // Filter by system type
      const items = (result?.items || []).filter((d) => allowedTypes.includes(d.type as any));
      setDevices(items);
      return items;
    } catch (err) {
      console.error('Failed to fetch devices:', err);
      setDevices([]);
      return [];
    } finally {
      setDevicesLoading(false);
    }
  };

  const onSelectBuilding = (b: BuildingType) => {
    if (expandedBuilding === b.id) {
      setExpandedBuilding(null);
    } else {
      setExpandedBuilding(b.id);
      loadFloors(b.id);
      handleBuildingSelect(b);
    }
  };

  const onSelectFloor = async (f: Floor, buildingId: number) => {
    setSelectedFloor(f.id);
    // Immediately update 3D view BEFORE waiting for device fetch
    handleFloorSelect(f, [], buildingId);
    // Then fetch devices and update with full data
    const devs = await loadDevices(f.id, buildingId);
    handleFloorSelect(f, devs, buildingId);
  };

  const toggleFilter = (filterKey: string) => {
    setActiveFilters((prev) =>
      prev.includes(filterKey)
        ? prev.filter((f) => f !== filterKey)
        : [...prev, filterKey]
    );
  };

  // Filter devices by search + type filters
  const filteredDevices = useMemo(() => {
    let result = devices;

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (d) => d.name.toLowerCase().includes(q) || d.type.toLowerCase().includes(q)
      );
    }

    // Type filter
    if (activeFilters.length > 0) {
      const allowedTypes = new Set<string>();
      activeFilters.forEach((filterKey) => {
        const filter = TYPE_FILTERS.find((f) => f.key === filterKey);
        filter?.types.forEach((t) => allowedTypes.add(t));
      });
      result = result.filter((d) => allowedTypes.has(d.type));
    }

    return result;
  }, [devices, searchQuery, activeFilters]);

  // Group filtered devices by type
  const groupedDevices = useMemo(() => {
    const groups: Record<string, IDevice[]> = {};
    filteredDevices.forEach((d) => {
      if (!groups[d.type]) groups[d.type] = [];
      groups[d.type].push(d);
    });
    return groups;
  }, [filteredDevices]);

  const getDeviceStatusColor = (device: IDevice) => {
    if (!device.isOnline) return '#ef4444';
    if (device.status === 'ACTIVE') return '#22c55e';
    if (device.status === 'MAINTENANCE') return '#f59e0b';
    return '#94a3b8';
  };

  return (
    <Box
      sx={{
        width: 280,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 3,
        border: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
        boxShadow: `0 20px 60px ${theme.palette.base.blackAlpha[600]}`,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2.5, py: 2, gap: 1,
          display: 'flex', alignItems: 'center',
          borderBottom: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
          bgcolor: 'rgba(2, 6, 23, 0.9)',
        }}
      >
        <Building size={16} color="#ffffff" />
        <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>
          {SYSTEM_TITLES[systemFilter]}
        </Typography>
        <Chip
          label={buildings.length}
          size="small"
          sx={{
            ml: 'auto',
            height: 20, fontSize: 10,
            bgcolor: 'rgba(0,200,255,0.15)',
            color: '#00e5ff',
          }}
        />
      </Box>

      {/* Search */}
      <Box sx={{ px: 1.5, pt: 1.5, pb: 0.5, bgcolor: 'rgba(2, 6, 23, 0.88)' }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Tìm thiết bị..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={14} color="#64748b" />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              fontSize: 11,
              color: '#e2e8f0',
              bgcolor: 'rgba(255,255,255,0.04)',
              borderRadius: 2,
              '& fieldset': { borderColor: 'rgba(255,255,255,0.08)' },
              '&:hover fieldset': { borderColor: 'rgba(0,229,255,0.3)' },
              '&.Mui-focused fieldset': { borderColor: '#00e5ff' },
            },
          }}
        />
      </Box>

      {/* Type Filters */}
      <Box sx={{ px: 1.5, pb: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap', bgcolor: 'rgba(2, 6, 23, 0.88)' }}>
        {TYPE_FILTERS.map((filter) => {
          const count = devices.filter((d) => filter.types.includes(d.type)).length;
          if (count === 0) return null;
          const isActive = activeFilters.includes(filter.key);
          return (
            <Chip
              key={filter.key}
              label={`${filter.label} (${count})`}
              size="small"
              onClick={() => toggleFilter(filter.key)}
              sx={{
                height: 22, fontSize: 9, fontWeight: 600,
                bgcolor: isActive ? `${filter.color}25` : 'rgba(255,255,255,0.04)',
                color: isActive ? filter.color : '#94a3b8',
                border: `1px solid ${isActive ? `${filter.color}50` : 'transparent'}`,
                cursor: 'pointer',
                '&:hover': { bgcolor: `${filter.color}15` },
              }}
            />
          );
        })}
      </Box>

      {/* Content */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          bgcolor: 'rgba(2, 6, 23, 0.88)',
          '&::-webkit-scrollbar': { width: '4px' },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(255,255,255,0.15)',
            borderRadius: '3px',
          },
        }}
      >
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} sx={{ color: '#00e5ff' }} />
          </Box>
        ) : buildings.length === 0 ? (
          <Typography sx={{ color: '#94a3b8', fontSize: 12, p: 2, textAlign: 'center' }}>
            Chưa có tòa nhà nào
          </Typography>
        ) : (
          buildings.map((building) => (
            <Box key={building.id}>
              {/* Building item */}
              <Box
                onClick={() => onSelectBuilding(building)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  px: 2, py: 1.5, cursor: 'pointer',
                  bgcolor: expandedBuilding === building.id ? 'rgba(0,200,255,0.08)' : 'transparent',
                  borderLeft: expandedBuilding === building.id ? '3px solid #00e5ff' : '3px solid transparent',
                  '&:hover': { bgcolor: 'rgba(0,200,255,0.05)' },
                  transition: 'all 0.2s',
                }}
              >
                {expandedBuilding === building.id ? (
                  <ChevronDown size={14} color="#00e5ff" />
                ) : (
                  <ChevronRight size={14} color="#94a3b8" />
                )}
                <Building size={14} color={expandedBuilding === building.id ? '#00e5ff' : '#94a3b8'} />
                <Typography
                  sx={{
                    flex: 1,
                    color: expandedBuilding === building.id ? '#fff' : '#cbd5e1',
                    fontSize: 12, fontWeight: expandedBuilding === building.id ? 600 : 400,
                  }}
                >
                  {building.name}
                </Typography>
                <Chip
                  label={building._count?.floors || 0}
                  size="small"
                  sx={{
                    height: 18, fontSize: 10,
                    bgcolor: 'rgba(0,200,255,0.15)',
                    color: '#00e5ff',
                  }}
                />
              </Box>

              {/* Floors */}
              {expandedBuilding === building.id && (
                <Box sx={{ pl: 2 }}>
                  {floors.map((floor) => (
                    <Box key={floor.id}>
                      <Box
                        onClick={() => onSelectFloor(floor, building.id)}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 1,
                          px: 2, py: 1, cursor: 'pointer',
                          bgcolor: selectedFloor === floor.id ? 'rgba(0,200,255,0.12)' : 'transparent',
                          borderRadius: 1,
                          '&:hover': { bgcolor: 'rgba(0,200,255,0.06)' },
                        }}
                      >
                        <Box
                          sx={{
                            width: 6, height: 6, borderRadius: '50%',
                            bgcolor: selectedFloor === floor.id ? '#00e5ff' : '#475569',
                          }}
                        />
                        <Typography
                          sx={{
                            flex: 1,
                            color: selectedFloor === floor.id ? '#e2e8f0' : '#94a3b8',
                            fontSize: 11,
                            fontWeight: selectedFloor === floor.id ? 500 : 400,
                          }}
                        >
                          {floor.name}
                        </Typography>
                        <Typography sx={{ color: '#64748b', fontSize: 10 }}>
                          {floor._count?.devices || 0}
                        </Typography>
                      </Box>
                    </Box>
                  ))}

                  {/* Grouped devices for selected floor */}
                  {selectedFloor && (
                    <Box sx={{ pl: 1, pb: 1 }}>
                      {devicesLoading ? (
                        <Box sx={{ py: 1, display: 'flex', justifyContent: 'center' }}>
                          <CircularProgress size={16} sx={{ color: '#00e5ff' }} />
                        </Box>
                      ) : filteredDevices.length === 0 ? (
                        <Typography sx={{ color: '#64748b', fontSize: 10, py: 1, px: 2 }}>
                          {searchQuery || activeFilters.length > 0
                            ? 'Không tìm thấy thiết bị'
                            : 'Không có thiết bị'}
                        </Typography>
                      ) : (
                        Object.entries(groupedDevices).map(([type, typeDevices]) => {
                          const typeInfo = getDeviceTypeInfo(type);
                          const TypeIcon = typeInfo.icon;
                          return (
                            <Box key={type}>
                              {/* Type group header */}
                              <Box
                                sx={{
                                  display: 'flex', alignItems: 'center', gap: 0.75,
                                  px: 2, py: 0.5, mt: 0.5,
                                }}
                              >
                                <TypeIcon size={11} color={typeInfo.color} />
                                <Typography
                                  sx={{
                                    fontSize: 10, fontWeight: 600,
                                    color: typeInfo.color, textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                  }}
                                >
                                  {typeInfo.label}
                                </Typography>
                                <Typography sx={{ fontSize: 9, color: '#64748b', ml: 'auto' }}>
                                  {typeDevices.length}
                                </Typography>
                              </Box>

                              {/* Devices */}
                              {typeDevices.map((d) => (
                                <Box
                                  key={d.id}
                                  onClick={() => handleDeviceSelect(d)}
                                  sx={{
                                    p: 1.5,
                                    m: 1,
                                    borderRadius: 2,
                                    cursor: 'pointer',
                                    bgcolor: selectedDevice?.id === d.id ? 'rgba(0,200,255,0.15)' : 'rgba(255,255,255,0.02)',
                                    border: `1px solid ${selectedDevice?.id === d.id ? 'rgba(0,200,255,0.4)' : 'transparent'}`,
                                    transition: 'all 0.15s',
                                    display: 'flex', alignItems: 'center', gap: 1
                                  }}
                                >
                                  <Box
                                    sx={{
                                      width: 5, height: 5, borderRadius: '50%',
                                      bgcolor: getDeviceStatusColor(d),
                                      boxShadow: `0 0 6px ${getDeviceStatusColor(d)}`,
                                      flexShrink: 0,
                                    }}
                                  />
                                  <Typography
                                    sx={{
                                      flex: 1, color: '#cbd5e1', fontSize: 10,
                                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {d.name}
                                  </Typography>
                                  {/* Quick status indicator */}
                                  {(d.attributes as any)?.running != null && (
                                    <Box
                                      sx={{
                                        width: 6, height: 6, borderRadius: 1,
                                        bgcolor: (d.attributes as any)?.running ? '#22c55e' : '#475569',
                                      }}
                                    />
                                  )}
                                </Box>
                              ))}
                            </Box>
                          );
                        })
                      )}
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          ))
        )}
      </Box>

      {/* Footer status */}
      <Box
        sx={{
          px: 2.5, py: 2,
          borderTop: `1px solid ${theme.palette.base.whiteAlpha[100]}`,
          bgcolor: 'rgba(2, 6, 23, 0.9)',
        }}
      >
        <Typography sx={{ fontSize: 11, color: '#94a3b8', mb: 0.5 }}>
          {SYSTEM_TITLES[systemFilter]} Status
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 8, height: 8, borderRadius: '50%',
              bgcolor: '#22c55e',
              boxShadow: '0 0 8px rgba(34,197,94,0.8)',
            }}
          />
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#22c55e' }}>
            Online — {devices.filter((d) => d.isOnline !== false).length}/{devices.length}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default BuildingSidebar;
