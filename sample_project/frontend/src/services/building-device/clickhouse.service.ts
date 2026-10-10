import { httpClient } from '@/configs/http.config';

export interface DeviceLogEntry {
  timestamp: string;
  deviceId: string;
  deviceType: string;
  featureCode: string | null;
  buildingId: string | null;
  attribute: string; // JSON string of attributes
  xCoordinate: number | null;
  yCoordinate: number | null;
  zCoordinate: number | null;
}

export interface DeviceLogQuery {
  deviceId?: string;
  deviceType?: string;
  buildingId?: string;
  from?: string; // ISO date
  to?: string;   // ISO date
  limit?: number;
}

export interface DeviceLogAggregateQuery extends DeviceLogQuery {
  interval?: '5m' | '15m' | '1h' | '6h' | '1d';
  attributeKey?: string;
  aggregation?: 'avg' | 'min' | 'max' | 'sum';
}

export interface AggregateResult {
  timestamp: string;
  value: number;
  min?: number;
  max?: number;
  avg?: number;
}

class ClickhouseService {
  private basePath = '/api/clickhouse';

  /**
   * Get raw device logs from ClickHouse
   */
  async getDeviceLogs(query: DeviceLogQuery): Promise<DeviceLogEntry[]> {
    try {
      const params = new URLSearchParams();
      if (query.deviceId) params.set('deviceId', query.deviceId);
      if (query.deviceType) params.set('deviceType', query.deviceType);
      if (query.buildingId) params.set('buildingId', query.buildingId);
      if (query.from) params.set('from', query.from);
      if (query.to) params.set('to', query.to);
      if (query.limit) params.set('limit', String(query.limit));

      const response = await httpClient.get(`${this.basePath}/device-logs?${params.toString()}`);
      return response.data?.data || response.data || [];
    } catch (error) {
      console.error('Failed to fetch device logs:', error);
      return [];
    }
  }

  /**
   * Get aggregated device logs (e.g., average temperature per hour)
   */
  async getDeviceLogsAggregate(query: DeviceLogAggregateQuery): Promise<AggregateResult[]> {
    try {
      const params = new URLSearchParams();
      if (query.deviceId) params.set('deviceId', query.deviceId);
      if (query.from) params.set('from', query.from);
      if (query.to) params.set('to', query.to);
      if (query.interval) params.set('interval', query.interval);
      if (query.attributeKey) params.set('attributeKey', query.attributeKey);
      if (query.aggregation) params.set('aggregation', query.aggregation);

      const response = await httpClient.get(`${this.basePath}/device-logs/aggregate?${params.toString()}`);
      return response.data?.data || response.data || [];
    } catch (error) {
      console.error('Failed to fetch aggregated device logs:', error);
      return [];
    }
  }

  /**
   * Parse attribute JSON string from ClickHouse log entry
   */
  parseAttributes(attributeJson: string): Record<string, any> {
    try {
      return JSON.parse(attributeJson);
    } catch {
      return {};
    }
  }
}

const clickhouseService = new ClickhouseService();
export default clickhouseService;
