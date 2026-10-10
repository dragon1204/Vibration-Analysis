import { httpService } from '@/base/http-service';
import type { PagedResult, YootekDataResult, InnerDataResult } from '@/services/common/types';
export type { PagedResult, YootekDataResult } from '@/services/common/types';


export interface SystemCode {
  id?: number;
  code: string;
  name: string;
  description?: string;
}

export interface AssetGroup {
  id?: number;
  code: string;
  name: string;
  description?: string;
  parentId?: number | null;
  systemCodeId?: number | null;
  // read-only display fields from BE
  parentName?: string;
  systemCodeName?: string;
  systemCodeCode?: string;
}

export interface AssetUnit {
  id?: number;
  code: string;
  name: string;
  description?: string;
}

export interface AssetType {
  id?: number;
  code: string;
  name: string;
  description?: string;
}

export interface AssetManufacturer {
  id?: number;
  code: string;
  name: string;
  description?: string;
  address?: string;
  phone?: string;
}

export interface WarehouseCategory {
  id?: number;
  code: string;
  name: string;
  description?: string;
  location?: string;
  managerId?: number;
  managerName?: string;
}



export const categoryService = {
  async getAssetUnits(skipCount = 0, maxResultCount = 1000, keyword?: string): Promise<PagedResult<AssetUnit>> {
    try {
      const res = await httpService.requestApi<YootekDataResult<{ items: AssetUnit[], totalCount: number }>>({
        url: '/api/services/app/AssetUnit/GetAll',
        method: 'GET',
        params: { skipCount, maxResultCount, keyword },
      });
      if (res?.success && res.data) {
        // Handle nested YootekDataResult format properly
        const innerData = res.data as unknown as InnerDataResult<AssetUnit>;
        return { 
          totalCount: innerData.totalRecords ?? innerData.totalCount ?? 0, 
          items: innerData.data ?? innerData.items ?? [] 
        };
      }
      return { totalCount: 0, items: [] };
    } catch (e) {
      console.error('Error fetching AssetUnits:', e);
      return { totalCount: 0, items: [] };
    }
  },

  async createAssetUnit(data: Partial<AssetUnit>): Promise<AssetUnit | null> {
    const res = await httpService.requestApi<YootekDataResult<AssetUnit>>({
      url: '/api/services/app/AssetUnit/Create',
      method: 'POST',
      data,
    });
    return res?.success ? (res.data || null) : null;
  },

  async updateAssetUnit(data: Partial<AssetUnit>): Promise<AssetUnit | null> {
    const res = await httpService.requestApi<YootekDataResult<AssetUnit>>({
      url: '/api/services/app/AssetUnit/Update',
      method: 'PUT',
      data,
    });
    return res?.success ? (res.data || null) : null;
  },

  async deleteAssetUnit(id: number): Promise<void> {
    await httpService.requestApi({
      url: `/api/services/app/AssetUnit/Delete`,
      method: 'DELETE',
      params: { id },
    });
  },

  async getAssetTypes(skipCount = 0, maxResultCount = 1000, keyword?: string): Promise<PagedResult<AssetType>> {
    try {
      const res = await httpService.requestApi<YootekDataResult<{ items: AssetType[], totalCount: number }>>({
        url: '/api/services/app/AssetType/GetAll',
        method: 'GET',
        params: { skipCount, maxResultCount, keyword },
      });
      if (res?.success && res.data) {
        // Handle nested YootekDataResult format properly
        const innerData = res.data as unknown as InnerDataResult<AssetType>;
        return { 
          totalCount: innerData.totalRecords ?? innerData.totalCount ?? 0, 
          items: innerData.data ?? innerData.items ?? [] 
        };
      }
      return { totalCount: 0, items: [] };
    } catch (e) {
      console.error('Error fetching AssetTypes:', e);
      return { totalCount: 0, items: [] };
    }
  },

  async createAssetType(data: Partial<AssetType>): Promise<AssetType | null> {
    const res = await httpService.requestApi<YootekDataResult<AssetType>>({
      url: '/api/services/app/AssetType/Create',
      method: 'POST',
      data,
    });
    return res?.success ? (res.data || null) : null;
  },

  async updateAssetType(data: Partial<AssetType>): Promise<AssetType | null> {
    const res = await httpService.requestApi<YootekDataResult<AssetType>>({
      url: '/api/services/app/AssetType/Update',
      method: 'PUT',
      data,
    });
    return res?.success ? (res.data || null) : null;
  },

  async deleteAssetType(id: number): Promise<void> {
    await httpService.requestApi({
      url: `/api/services/app/AssetType/Delete`,
      method: 'DELETE',
      params: { id },
    });
  },

  async getAssetManufacturers(skipCount = 0, maxResultCount = 1000, keyword?: string): Promise<PagedResult<AssetManufacturer>> {
    try {
      const res = await httpService.requestApi<YootekDataResult<{ items: AssetManufacturer[], totalCount: number }>>({
        url: '/api/services/app/AssetManufacturer/GetAll',
        method: 'GET',
        params: { skipCount, maxResultCount, keyword },
      });
      if (res?.success && res.data) {
        // Handle nested YootekDataResult format properly
        const innerData = res.data as unknown as InnerDataResult<AssetManufacturer>;
        return { 
          totalCount: innerData.totalRecords ?? innerData.totalCount ?? 0, 
          items: innerData.data ?? innerData.items ?? [] 
        };
      }
      return { totalCount: 0, items: [] };
    } catch (e) {
      console.error('Error fetching AssetManufacturers:', e);
      return { totalCount: 0, items: [] };
    }
  },

  async createAssetManufacturer(data: Partial<AssetManufacturer>): Promise<AssetManufacturer | null> {
    const res = await httpService.requestApi<YootekDataResult<AssetManufacturer>>({
      url: '/api/services/app/AssetManufacturer/Create',
      method: 'POST',
      data,
    });
    return res?.success ? (res.data || null) : null;
  },

  async updateAssetManufacturer(data: Partial<AssetManufacturer>): Promise<AssetManufacturer | null> {
    const res = await httpService.requestApi<YootekDataResult<AssetManufacturer>>({
      url: '/api/services/app/AssetManufacturer/Update',
      method: 'PUT',
      data,
    });
    return res?.success ? (res.data || null) : null;
  },

  async deleteAssetManufacturer(id: number): Promise<void> {
    await httpService.requestApi({
      url: `/api/services/app/AssetManufacturer/Delete`,
      method: 'DELETE',
      params: { id },
    });
  },

  async getSystemCodes(skipCount = 0, maxResultCount = 1000, keyword?: string): Promise<PagedResult<SystemCode>> {
    try {
      const res = await httpService.requestApi<YootekDataResult<{ items: SystemCode[], totalCount: number }>>({
        url: '/api/services/app/SystemCode/GetAll',
        method: 'GET',
        params: { skipCount, maxResultCount, keyword },
      });
      if (res?.success && res.data) {
        // Handle nested YootekDataResult format properly
        const innerData = res.data as unknown as InnerDataResult<SystemCode>;
        return { 
          totalCount: innerData.totalRecords ?? innerData.totalCount ?? 0, 
          items: innerData.data ?? innerData.items ?? [] 
        };
      }
      return { totalCount: 0, items: [] };
    } catch (e) {
      console.error('Error fetching SystemCodes:', e);
      return { totalCount: 0, items: [] };
    }
  },

  async createSystemCode(data: Partial<SystemCode>): Promise<SystemCode | null> {
    const res = await httpService.requestApi<YootekDataResult<SystemCode>>({
      url: '/api/services/app/SystemCode/Create',
      method: 'POST',
      data,
    });
    return res?.success ? (res.data || null) : null;
  },

  async updateSystemCode(data: Partial<SystemCode>): Promise<SystemCode | null> {
    const res = await httpService.requestApi<YootekDataResult<SystemCode>>({
      url: '/api/services/app/SystemCode/Update',
      method: 'PUT',
      data,
    });
    return res?.success ? (res.data || null) : null;
  },

  async deleteSystemCode(id: number): Promise<void> {
    await httpService.requestApi({
      url: `/api/services/app/SystemCode/Delete`,
      method: 'DELETE',
      params: { id },
    });
  },

  async getAssetGroups(skipCount = 0, maxResultCount = 1000, keyword?: string): Promise<PagedResult<AssetGroup>> {
    try {
      const res = await httpService.requestApi<YootekDataResult<{ items: AssetGroup[], totalCount: number }>>({
        url: '/api/services/app/AssetGroup/GetAll',
        method: 'GET',
        params: { skipCount, maxResultCount, keyword },
      });
      if (res?.success && res.data) {
        // Handle nested YootekDataResult format properly
        const innerData = res.data as unknown as InnerDataResult<AssetGroup>;
        return { 
          totalCount: innerData.totalRecords ?? innerData.totalCount ?? 0, 
          items: innerData.data ?? innerData.items ?? [] 
        };
      }
      return { totalCount: 0, items: [] };
    } catch (e) {
      console.error('Error fetching AssetGroups:', e);
      return { totalCount: 0, items: [] };
    }
  },

  async createAssetGroup(data: Partial<AssetGroup>): Promise<AssetGroup | null> {
    const res = await httpService.requestApi<YootekDataResult<AssetGroup>>({
      url: '/api/services/app/AssetGroup/Create',
      method: 'POST',
      data,
    });
    return res?.success ? (res.data || null) : null;
  },

  async updateAssetGroup(data: Partial<AssetGroup>): Promise<AssetGroup | null> {
    const res = await httpService.requestApi<YootekDataResult<AssetGroup>>({
      url: '/api/services/app/AssetGroup/Update',
      method: 'PUT',
      data,
    });
    return res?.success ? (res.data || null) : null;
  },

  async deleteAssetGroup(id: number): Promise<void> {
    await httpService.requestApi({
      url: `/api/services/app/AssetGroup/Delete`,
      method: 'DELETE',
      params: { id },
    });
  },

  async getWarehouseCategories(skipCount = 0, maxResultCount = 1000, keyword?: string): Promise<PagedResult<WarehouseCategory>> {
    try {
      const res = await httpService.requestApi<YootekDataResult<{ items: WarehouseCategory[], totalCount: number }>>({
        url: '/api/services/app/WarehouseCategory/GetAll',
        method: 'GET',
        params: { skipCount, maxResultCount, keyword },
      });
      if (res?.success && res.data) {
        const innerData = res.data as unknown as InnerDataResult<WarehouseCategory>;
        return { 
          totalCount: innerData.totalRecords ?? innerData.totalCount ?? 0, 
          items: innerData.data ?? innerData.items ?? [] 
        };
      }
      return { totalCount: 0, items: [] };
    } catch (e) {
      console.error('Error fetching WarehouseCategories:', e);
      return { totalCount: 0, items: [] };
    }
  },

  async createWarehouseCategory(data: Partial<WarehouseCategory>): Promise<WarehouseCategory | null> {
    const res = await httpService.requestApi<YootekDataResult<WarehouseCategory>>({
      url: '/api/services/app/WarehouseCategory/Create',
      method: 'POST',
      data,
    });
    return res?.success ? (res.data || null) : null;
  },

  async updateWarehouseCategory(data: Partial<WarehouseCategory>): Promise<WarehouseCategory | null> {
    const res = await httpService.requestApi<YootekDataResult<WarehouseCategory>>({
      url: '/api/services/app/WarehouseCategory/Update',
      method: 'PUT',
      data,
    });
    return res?.success ? (res.data || null) : null;
  },

  async deleteWarehouseCategory(id: number): Promise<void> {
    await httpService.requestApi({
      url: `/api/services/app/WarehouseCategory/Delete`,
      method: 'DELETE',
      params: { id },
    });
  },

};
