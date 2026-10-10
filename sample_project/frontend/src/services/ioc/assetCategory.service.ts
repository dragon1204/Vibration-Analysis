import { httpService } from '@/base/http-service';
import type { PagedResult, YootekDataResult, InnerDataResult } from '@/services/common/types';

export interface AssetCategory {
  id?: number;
  code: string;
  name: string;
  description?: string;
  assetGroupId?: number | null;
  assetTypeId?: number | null;
  manufacturerId?: number | null;
  unitId?: number | null;
  unitName?: string;
  importPrice?: number;
  exportPrice?: number;
  imageUrls?: string[] | null;
  depreciationRate?: number;
  currentQuantity?: number;
}

export const assetCategoryService = {
  async getAssetCategories(
    skipCount = 0, 
    maxResultCount = 1000, 
    keyword?: string,
    assetGroupId?: number,
    assetTypeId?: number,
    unitId?: number
  ): Promise<PagedResult<AssetCategory>> {
    try {
      const res = await httpService.requestApi<YootekDataResult<{ items: AssetCategory[], totalCount: number }>>({
        url: '/api/services/app/AssetCategory/GetAll',
        method: 'GET',
        params: { skipCount, maxResultCount, keyword, assetGroupId, assetTypeId, unitId },
      });
      if (res?.success && res.data) {
        const innerData = res.data as unknown as InnerDataResult<AssetCategory>;
        return { 
          totalCount: innerData.totalRecords ?? innerData.totalCount ?? 0, 
          items: innerData.data ?? innerData.items ?? [] 
        };
      }
      return { totalCount: 0, items: [] };
    } catch (e) {
      console.error('Error fetching AssetCategories:', e);
      return { totalCount: 0, items: [] };
    }
  },

  async createAssetCategory(data: Partial<AssetCategory>): Promise<AssetCategory | null> {
    const res = await httpService.requestApi<YootekDataResult<AssetCategory>>({
      url: '/api/services/app/AssetCategory/Create',
      method: 'POST',
      data,
    });
    return res?.success ? (res.data || null) : null;
  },

  async updateAssetCategory(data: Partial<AssetCategory>): Promise<AssetCategory | null> {
    const res = await httpService.requestApi<YootekDataResult<AssetCategory>>({
      url: '/api/services/app/AssetCategory/Update',
      method: 'PUT',
      data,
    });
    return res?.success ? (res.data || null) : null;
  },

  async deleteAssetCategory(id: number): Promise<void> {
    await httpService.requestApi({
      url: `/api/services/app/AssetCategory/Delete`,
      method: 'DELETE',
      params: { id },
    });
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getAssetStockCard(id: number): Promise<any[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await httpService.requestApi<YootekDataResult<any[]>>({
      url: '/api/services/app/AssetCategory/GetStockCard',
      method: 'GET',
      params: { assetCategoryId: id },
    });
    return res?.success ? (res.data || []) : [];
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getAssetInventoryBreakdown(id: number): Promise<any[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await httpService.requestApi<YootekDataResult<any[]>>({
      url: '/api/services/app/AssetCategory/GetInventoryBreakdown',
      method: 'GET',
      params: { assetCategoryId: id },
    });
    return res?.success ? (res.data || []) : [];
  },
};
