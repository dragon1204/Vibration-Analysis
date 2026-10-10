import { httpService } from '@/base/http-service';

export const MeterStatus = {
  Active: 1,
  Inactive: 2,
  Broken: 3,
  Maintenance: 4,
  Other: 5,
} as const;

export type MeterStatus = (typeof MeterStatus)[keyof typeof MeterStatus];

export interface Meter {
  id?: number;
  name: string;
  code: string;
  meterTypeId: number;
  meterTypeName?: string;
  apartmentId: number;
  buildingId: number;
  status: MeterStatus;
}

export interface PagedResult<T> {
  totalCount: number;
  items: T[];
}

export interface YootekDataResult<T> {
  success: boolean;
  totalRecords: number;
  data: T;
  result_Code?: string | number | null;
}

export const meterService = {
  async getMeters(
    skipCount = 0,
    maxResultCount = 1000,
    keyword?: string,
    status?: MeterStatus,
    meterTypeId?: number,
  ): Promise<PagedResult<Meter>> {
    try {
      const res = await httpService.requestApi<YootekDataResult<Meter[]>>({
        url: '/api/services/app/Meter/GetAll',
        method: 'GET',
        params: { skipCount, maxResultCount, keyword, status, meterTypeId }, // 👈 thêm
      });
      if (res?.success) {
        return {
          totalCount: res.totalRecords ?? 0,
          items: res.data ?? [],
        };
      }
      return { totalCount: 0, items: [] };
    } catch (e) {
      console.error('Error fetching Meters:', e);
      return { totalCount: 0, items: [] };
    }
  },

  async getMeterById(id: number): Promise<Meter | null> {
    try {
      const res = await httpService.requestApi<YootekDataResult<Meter>>({
        url: '/api/services/app/Meter/GetById',
        method: 'GET',
        params: { id },
      });
      return res?.success ? (res.data ?? null) : null;
    } catch (e) {
      console.error('Error fetching Meter by id:', e);
      return null;
    }
  },

  async createMeter(data: Partial<Meter>): Promise<Meter | null> {
    const res = await httpService.requestApi<YootekDataResult<Meter>>({
      url: '/api/services/app/Meter/Create',
      method: 'POST',
      data,
    });
    return res?.success ? res.data || null : null;
  },

  async updateMeter(data: Partial<Meter>): Promise<Meter | null> {
    const res = await httpService.requestApi<YootekDataResult<Meter>>({
      url: '/api/services/app/Meter/Update',
      method: 'PUT',
      data,
    });
    return res?.success ? res.data || null : null;
  },

  async deleteMeter(id: number): Promise<void> {
    await httpService.requestApi({
      url: '/api/services/app/Meter/Delete',
      method: 'DELETE',
      params: { id },
    });
  },
};
