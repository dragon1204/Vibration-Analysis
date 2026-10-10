import { BaseCrudService } from '@/base/base-crud-service';

class AssetLogService extends BaseCrudService {
  constructor() {
    super('/api/clickhouse', true);
  }

  /**
   * Fetch device history logs from ClickHouse
   * @param deviceId - ID of the device
   * @param fromDate - Start date (ISO string)
   * @param toDate - End date (ISO string)
   */
  async getDeviceLogs(deviceId: string, fromDate: string, toDate: string) {
    const res = await this.getAll<any>(
      {
        filter: JSON.stringify({ deviceId }),
        filterTime: JSON.stringify({
          field: 'createdAt',
          fromDate,
          toDate,
        }),
        paging: JSON.stringify({ skip: 0, take: 1000 }),
        order: JSON.stringify({ field: 'createdAt', by: 'ASC' }),
      },
      '/device-logs'
    );
    return (res as any).data || res;
  }
}

export const assetLogService = new AssetLogService();
export default assetLogService;
