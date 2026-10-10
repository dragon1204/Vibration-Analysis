export interface DeviceLogData {
    id: string;
    deviceType: string;
    featureCode?: string;
    deviceId: string;
    buildingId?: string;
    attribute: string;
    xCoordinate?: number;
    yCoordinate?: number;
    zCoordinate?: number | null;
}