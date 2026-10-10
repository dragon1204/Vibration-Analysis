import { httpService } from '@/base/http-service';

export const InvoiceMeterType = {
  Electric: 1,
  Water: 2,
  Parking: 3,
  Management: 4,
  Other: 5,
} as const;

export type InvoiceMeterType =
  (typeof InvoiceMeterType)[keyof typeof InvoiceMeterType];

export interface MeterType {
  id?: number;
  buildingId: number;
  name: string;
  invoiceType: InvoiceMeterType;
  description?: string;
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

export const meterTypeService = {
  async getMeterTypes(
    skipCount = 0,
    maxResultCount = 1000,
    keyword?: string,
    invoiceType?: InvoiceMeterType,
  ): Promise<PagedResult<MeterType>> {
    try {
      const res = await httpService.requestApi<YootekDataResult<MeterType[]>>({
        url: '/api/services/app/MeterType/GetAll',
        method: 'GET',
        params: { skipCount, maxResultCount, keyword, invoiceType },
      });
      if (res?.success) {
        return {
          totalCount: res.totalRecords ?? 0,
          items: res.data ?? [],
        };
      }
      return { totalCount: 0, items: [] };
    } catch (e) {
      console.error('Error fetching MeterTypes:', e);
      return { totalCount: 0, items: [] };
    }
  },

  async getMeterTypeById(id: number): Promise<MeterType | null> {
    try {
      const res = await httpService.requestApi<YootekDataResult<MeterType>>({
        url: '/api/services/app/MeterType/GetById',
        method: 'GET',
        params: { id },
      });
      return res?.success ? (res.data ?? null) : null;
    } catch (e) {
      console.error('Error fetching MeterType by id:', e);
      return null;
    }
  },

  async createMeterType(data: Partial<MeterType>): Promise<MeterType | null> {
    const res = await httpService.requestApi<YootekDataResult<MeterType>>({
      url: '/api/services/app/MeterType/Create',
      method: 'POST',
      data,
    });
    return res?.success ? res.data || null : null;
  },

  async updateMeterType(data: Partial<MeterType>): Promise<MeterType | null> {
    const res = await httpService.requestApi<YootekDataResult<MeterType>>({
      url: '/api/services/app/MeterType/Update',
      method: 'PUT',
      data,
    });
    return res?.success ? res.data || null : null;
  },

  async deleteMeterType(id: number): Promise<void> {
    await httpService.requestApi({
      url: '/api/services/app/MeterType/Delete',
      method: 'DELETE',
      params: { id },
    });
  },
};
