import { httpService } from '@/base/http-service';
import type { PagedResult, YootekDataResult } from '@/services/common/types';

export interface AssetDetail {
  id?: number;
  assetCategoryId: number;
  warehouseCategoryId?: number | null;
  systemCodeId?: number | null;
  assetCode: string;
  assetName: string;
  serialNumber?: string;
  status: number;
  location?: string;
  warrantyCode?: string;
  assetValue: number;
  usageDate?: string;
  startDate?: string;
  endDate?: string;
  origin?: string;
  notes?: string;
  buildingId?: number;
  // Display fields từ BE join - chỉ đọc, không gửi lên khi create/update
  assetCategoryName?: string;
  warehouseCategoryName?: string;
}

export const assetDetailService = {
  async getAssetDetails(
    skipCount = 0, 
    maxResultCount = 1000, 
    keyword?: string,
    assetCategoryId?: number,
    warehouseCategoryId?: number,
    status?: number,
    systemCodeId?: number
  ): Promise<PagedResult<AssetDetail>> {
    try {
      const res = await httpService.requestApi<YootekDataResult<{ items: AssetDetail[], totalCount: number }>>({
        url: '/api/services/app/AssetDetail/GetAll',
        method: 'GET',
        params: { 
          skipCount, 
          maxResultCount, 
          keyword, 
          assetCategoryId, 
          warehouseCategoryId, 
          status, 
          systemCodeId 
        },
      });
      if (res?.success && res.data) {
        type PagedData = { totalCount?: number; totalRecords?: number; items?: AssetDetail[]; data?: AssetDetail[] };
        const innerData = res.data as PagedData;
        return { 
          totalCount: innerData.totalRecords ?? innerData.totalCount ?? 0, 
          items: innerData.data ?? innerData.items ?? [] 
        };
      }
      return { totalCount: 0, items: [] };
    } catch (e) {
      console.error('Error fetching AssetDetails:', e);
      return { totalCount: 0, items: [] };
    }
  },

  async createAssetDetail(data: Partial<AssetDetail>): Promise<AssetDetail | null> {
    const res = await httpService.requestApi<YootekDataResult<AssetDetail>>({
      url: '/api/services/app/AssetDetail/Create',
      method: 'POST',
      data,
    });
    return res?.success ? (res.data || null) : null;
  },

  async updateAssetDetail(data: Partial<AssetDetail>): Promise<AssetDetail | null> {
    const res = await httpService.requestApi<YootekDataResult<AssetDetail>>({
      url: '/api/services/app/AssetDetail/Update',
      method: 'PUT',
      data,
    });
    return res?.success ? (res.data || null) : null;
  },

  async deleteAssetDetail(id: number): Promise<void> {
    await httpService.requestApi({
      url: `/api/services/app/AssetDetail/Delete`,
      method: 'DELETE',
      params: { id },
    });
  },
};
