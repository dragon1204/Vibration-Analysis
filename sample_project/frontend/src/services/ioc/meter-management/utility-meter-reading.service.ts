import { httpService } from '@/base/http-service';

export const UtilityMeterReadingStatus = {
  Pending: 1,
  Approved: 2,
  Rejected: 3,
} as const;

export type UtilityMeterReadingStatus =
  (typeof UtilityMeterReadingStatus)[keyof typeof UtilityMeterReadingStatus];

export interface UtilityMeterReading {
  id?: number;
  meterId: number;
  previousReading: number;
  currentReading: number;
  readingMonth: string;
  readingImageUrl?: string;
  apartmentId: number;
  buildingId: number;
  status: UtilityMeterReadingStatus;
  meterCode?: string;
  meterName?: string;
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

export const utilityMeterReadingService = {
  async getAll(
    skipCount = 0,
    maxResultCount = 1000,
    keyword?: string,
    status?: UtilityMeterReadingStatus, // 👈
    meterId?: number,
    readingMonth?: string,
  ): Promise<PagedResult<UtilityMeterReading>> {
    try {
      const res = await httpService.requestApi<
        YootekDataResult<UtilityMeterReading[]>
      >({
        url: '/api/services/app/UtilityMeterReading/GetAll',
        method: 'GET',
        params: {
          skipCount,
          maxResultCount,
          keyword,
          status,
          meterId,
          readingMonth: readingMonth ? `${readingMonth}-01` : undefined, // 👈 gửi dạng DateTime
        },
      });
      if (res?.success) {
        return { totalCount: res.totalRecords ?? 0, items: res.data ?? [] };
      }
      return { totalCount: 0, items: [] };
    } catch (e) {
      console.error('Error fetching UtilityMeterReadings:', e);
      return { totalCount: 0, items: [] };
    }
  },

  async getById(id: number): Promise<UtilityMeterReading | null> {
    try {
      const res = await httpService.requestApi<
        YootekDataResult<UtilityMeterReading>
      >({
        url: '/api/services/app/UtilityMeterReading/GetById',
        method: 'GET',
        params: { id },
      });
      return res?.success ? (res.data ?? null) : null;
    } catch (e) {
      console.error('Error fetching UtilityMeterReading by id:', e);
      return null;
    }
  },

  async create(
    data: Partial<UtilityMeterReading>,
  ): Promise<UtilityMeterReading | null> {
    const res = await httpService.requestApi<
      YootekDataResult<UtilityMeterReading>
    >({
      url: '/api/services/app/UtilityMeterReading/Create',
      method: 'POST',
      data,
    });
    return res?.success ? res.data || null : null;
  },

  async update(
    data: Partial<UtilityMeterReading>,
  ): Promise<UtilityMeterReading | null> {
    const res = await httpService.requestApi<
      YootekDataResult<UtilityMeterReading>
    >({
      url: '/api/services/app/UtilityMeterReading/Update',
      method: 'PUT',
      data,
    });
    return res?.success ? res.data || null : null;
  },

  async setStatus(
    id: number,
    status: UtilityMeterReadingStatus,
  ): Promise<void> {
    await httpService.requestApi({
      url: '/api/services/app/UtilityMeterReading/SetStatus',
      method: 'PUT',
      params: { id, status },
    });
  },

  async delete(id: number): Promise<void> {
    await httpService.requestApi({
      url: '/api/services/app/UtilityMeterReading/Delete',
      method: 'DELETE',
      params: { id },
    });
  },
};
