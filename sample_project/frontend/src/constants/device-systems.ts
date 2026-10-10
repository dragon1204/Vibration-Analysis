import type { DeviceType } from '@/services/building-device/device.model';

/**
 * Phân loại thiết bị theo hệ thống con
 * BMS  = Building Management System (HVAC, quạt, bơm, chiếu sáng, PCCC)
 * CCTV = Camera giám sát
 * EMS  = Energy Management System (đồng hồ điện, nước, BTU, CO2)
 */

export const BMS_DEVICE_TYPES: DeviceType[] = [
  'FAN', 'PUMP',
  'FIRE_PUMP', 'FIRE_ALARM',
  'LIGHT', 'DIM_LIGHT',
  'AHU', 'AHU_FILTER', 'AHU_VALVE', 'AHU_SENSOR_TEMPERATURE',
  'FCU', 'VAV',
  'PAU', 'PAU_FILTER', 'PAU_VALVE', 'PAU_SENSOR_TEMPERATURE',
  'CHILLER', 'CHILLER_PIPE', 'CHILLER_VALVE',
  'CHILLER_COLD_PUMP', 'CHILLER_COOLING_PUMP', 'CHILLER_COOLING_TOWER',
];

export const CCTV_DEVICE_TYPES: DeviceType[] = [
  'CAMERA',
];

export const EMS_DEVICE_TYPES: DeviceType[] = [
  'ELECTRIC', 'ELECTRIC_METER', 'POWER_BREAKER',
  'WATER_METER', 'BTU_METER', 'CO2_METER',
];

export type SystemType = 'bms' | 'cctv' | 'ems';

export const SYSTEM_DEVICE_TYPES: Record<SystemType, DeviceType[]> = {
  bms: BMS_DEVICE_TYPES,
  cctv: CCTV_DEVICE_TYPES,
  ems: EMS_DEVICE_TYPES,
};

/** Check if a device type belongs to a specific system */
export const isDeviceOfSystem = (type: string, system: SystemType): boolean => {
  return SYSTEM_DEVICE_TYPES[system].includes(type as DeviceType);
};
