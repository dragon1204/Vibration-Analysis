import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  BuildingDeviceType,
  DeviceStatus,
  SecurityLevel,
} from '@prisma/client';

export class BuildingDeviceResponse {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Unique identifier (auto-generated)',
    example: 'a3f1d4c2-8b8e-4e27-bc9e-93ef1c733cbb',
  })
  id?: string;

  @ApiProperty({ description: 'Unique device ID', example: 'device-12345' })
  deviceId: string;

  @ApiProperty({ description: 'Device name', example: 'Temperature Sensor A1' })
  name: string;

  @ApiPropertyOptional({
    enum: BuildingDeviceType,
    default: BuildingDeviceType.OTHER,
    description: 'Type of the device',
  })
  type?: BuildingDeviceType = BuildingDeviceType.OTHER;

  @ApiPropertyOptional({
    description: 'Device manufacturer',
    example: 'Siemens',
  })
  manufacturer?: string;

  @ApiPropertyOptional({ description: 'Device model', example: 'X1000' })
  model?: string;

  @ApiPropertyOptional({ description: 'Serial number', example: 'SN123456789' })
  serialNumber?: string;

  @ApiPropertyOptional({ description: 'Firmware version', example: 'v2.3.1' })
  firmwareVersion?: string;

  @ApiPropertyOptional({ description: 'Hardware version', example: 'HW1.0' })
  hardwareVersion?: string;

  @ApiPropertyOptional({
    description: 'MAC address',
    example: '00:1B:44:11:3A:B7',
  })
  macAddress?: string;

  @ApiPropertyOptional({ description: 'IP address', example: '192.168.1.100' })
  ipAddress?: string;

  @ApiPropertyOptional({
    description: 'Device endpoint URL or identifier',
    example: '/device/endpoint',
  })
  endpoint?: string;

  @ApiPropertyOptional({ type: Number, description: 'Building ID' })
  buildingId?: number;

  @ApiPropertyOptional({ description: 'buidling name', example: '2A' })
  buildingName?: string;

  @ApiPropertyOptional({ type: Number, description: 'Urban area ID' })
  urbanId?: number;

  @ApiPropertyOptional({ description: 'Floor label', example: '5th Floor' })
  floor?: string;

  @ApiPropertyOptional({ description: 'Room ID', example: 'RM-201' })
  roomId?: string;

  @ApiPropertyOptional({ description: 'Room name', example: 'Server Room' })
  roomName?: string;

  @ApiPropertyOptional({
    enum: DeviceStatus,
    description: 'Current device status',
  })
  status?: DeviceStatus;

  @ApiPropertyOptional({
    description: 'Indicates if device is currently online',
    default: true,
  })
  isOnline?: boolean = true;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Last time the device was seen active',
    example: '2025-10-30T10:15:00.000Z',
  })
  lastSeenAt?: Date;

  @ApiPropertyOptional({ description: 'Battery level percentage', example: 87 })
  batteryLevel?: number;

  @ApiPropertyOptional({ description: 'Signal strength (RSSI)', example: -67 })
  signalStrength?: number;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Device installation date',
    example: '2025-08-01T10:00:00.000Z',
  })
  installationDate?: Date;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Last maintenance date',
    example: '2025-09-15T12:30:00.000Z',
  })
  lastMaintenanceDate?: Date;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Warranty expiry date',
    example: '2026-08-01T00:00:00.000Z',
  })
  warrantyExpiry?: Date;

  @ApiPropertyOptional({
    description: 'Installer name or ID',
    example: 'John Doe',
  })
  installedBy?: string;

  @ApiPropertyOptional({
    type: Object,
    description: 'Device attributes as JSON object',
    example: { color: 'white', size: 'medium' },
  })
  attributes?: Record<string, any>;

  @ApiPropertyOptional({
    type: Object,
    description: 'Device configuration as JSON object',
    example: { powerMode: 'auto', threshold: 75 },
  })
  configuration?: Record<string, any>;

  @ApiPropertyOptional({
    type: [String],
    description: 'List of tags associated with the device',
    example: ['sensor', 'temperature', 'floor5'],
  })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Certificate ID for secure communication',
    example: 'cert-001',
  })
  certificateId?: string;

  @ApiPropertyOptional({
    enum: SecurityLevel,
    description: 'Device security classification',
  })
  securityLevel?: SecurityLevel;

  @ApiPropertyOptional({
    description: 'Device description',
    example: 'Main temperature sensor in lobby area',
  })
  description?: string;

  @ApiPropertyOptional({
    description: 'Additional notes',
    example: 'Needs calibration every 3 months',
  })
  notes?: string;

  @ApiPropertyOptional({
    description: 'Image URL of the device',
    example: 'https://example.com/device.png',
  })
  imageUrl?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Timestamp indicating when the record was created',
    example: '2025-10-30T08:00:00.000Z',
  })
  createdAt: Date;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Timestamp indicating when the record was last updated',
    example: '2025-10-30T12:45:00.000Z',
  })
  updatedAt: Date;
}
