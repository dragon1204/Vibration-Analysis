// Enum đầy đủ khớp với Prisma BuildingDeviceType
export type DeviceType =
  | 'OTHER'
  | 'CAMERA'
  | 'FIRE_ALARM'
  | 'FIRE_PUMP'
  | 'FAN'
  | 'PUMP'
  | 'DIM_LIGHT'
  | 'LIGHT'
  | 'ELECTRIC'
  | 'ELECTRIC_METER'
  | 'POWER_BREAKER'
  | 'WATER_METER'
  | 'BTU_METER'
  | 'CO2_METER'
  | 'CHILLER'
  | 'CHILLER_PIPE'
  | 'CHILLER_VALVE'
  | 'CHILLER_COLD_PUMP'
  | 'CHILLER_COOLING_PUMP'
  | 'CHILLER_COOLING_TOWER'
  | 'PAU'
  | 'PAU_FILTER'
  | 'PAU_VALVE'
  | 'PAU_SENSOR_TEMPERATURE'
  | 'AHU'
  | 'AHU_FILTER'
  | 'AHU_VALVE'
  | 'AHU_SENSOR_TEMPERATURE'
  | 'FCU'
  | 'VAV';

export type DeviceStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'OFFLINE' | 'ERROR';

// Interface cho query parameters
export interface IDeviceQuery {
  skip?: number;
  take?: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  type?: DeviceType;
  buildingId?: number;
  urbanId?: number;
  floorId?: number;
}

// Interface cho device model — khớp với Prisma BuildingDevice
export interface IDevice {
  id: string;
  deviceId?: string;
  eboId?: string;
  featureCode?: string;
  name: string;
  type: DeviceType;
  status?: DeviceStatus;
  isOnline?: boolean;

  buildingId?: number;
  urbanId?: number;
  floorId?: number;

  // Attributes & configuration
  attributes?: Record<string, any>;
  configuration?: Record<string, any>;

  // Positioning
  xCoordinate?: number;
  yCoordinate?: number;
  zCoordinate?: number;

  // Hardware info
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  firmwareVersion?: string;
  hardwareVersion?: string;
  macAddress?: string;
  ipAddress?: string;

  // Metadata
  description?: string;
  notes?: string;
  imageUrl?: string;
  tags?: string[];

  lastSeenAt?: string;
  installationDate?: string;
  lastMaintenanceDate?: string;

  createdAt?: string;
  updatedAt?: string;
}

// Interface cho response data
export interface IDeviceResponse {
  items: IDevice[];
  total: number;
}