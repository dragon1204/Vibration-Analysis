import { httpService } from '@/base/http-service';

export interface ManagementDepartment {
  id?: number;
  code: string;
  name: string;
  displayName?: string;
  description?: string;
  buildingId: number;
  parentId?: number | null;
  children?: ManagementDepartment[];
}

interface PagedResult<T> {
  totalCount: number;
  items: T[];
}

interface YootekDataResult<T> {
  success: boolean;
  totalRecords: number;
  data: T;
  result_Code?: string | number | null;
}

interface YootekPagedData<T> {
  items?: T[];
  data?: T[];
  totalCount?: number;
  totalRecords?: number;
}

export const managementDepartmentService = {
  async getAll(skipCount = 0, maxResultCount = 1000, keyword?: string): Promise<PagedResult<ManagementDepartment>> {
    try {
      const res = await httpService.requestApi<YootekDataResult<YootekPagedData<ManagementDepartment>>>({
        url: '/api/services/app/ManagementDepartment/GetAll',
        method: 'GET',
        params: { skipCount, maxResultCount, keyword },
      });
      if (res?.success && res.data) {
        const innerData = res.data;
        return {
          totalCount: innerData.totalRecords ?? innerData.totalCount ?? 0,
          items: innerData.data ?? innerData.items ?? [],
        };
      }
      return { totalCount: 0, items: [] };
    } catch (e) {
      console.error('Error fetching ManagementDepartments:', e);
      return { totalCount: 0, items: [] };
    }
  },

  async getTree(): Promise<ManagementDepartment[]> {
    try {
      const res = await httpService.requestApi<YootekDataResult<ManagementDepartment[]>>({
        url: '/api/services/app/ManagementDepartment/GetDepartmentTree',
        method: 'GET',
      });
      if (res?.success && res.data) {
        return res.data ?? [];
      }
      return [];
    } catch (e) {
      console.error('Error fetching ManagementDepartment tree:', e);
      return [];
    }
  },

  async create(data: Partial<ManagementDepartment>): Promise<ManagementDepartment | null> {
    const res = await httpService.requestApi<YootekDataResult<ManagementDepartment>>({
      url: '/api/services/app/ManagementDepartment/Create',
      method: 'POST',
      data,
    });
    return res?.success ? (res.data || null) : null;
  },

  async update(data: Partial<ManagementDepartment>): Promise<ManagementDepartment | null> {
    const res = await httpService.requestApi<YootekDataResult<ManagementDepartment>>({
      url: '/api/services/app/ManagementDepartment/Update',
      method: 'PUT',
      data,
    });
    return res?.success ? (res.data || null) : null;
  },

  async createOrUpdate(data: Partial<ManagementDepartment> & { id?: number }): Promise<ManagementDepartment | null> {
    const res = await httpService.requestApi<YootekDataResult<ManagementDepartment>>({
      url: '/api/services/app/ManagementDepartment/CreateOrUpdate',
      method: 'POST',
      data,
    });
    return res?.success ? (res.data || null) : null;
  },

  async delete(id: number): Promise<void> {
    await httpService.requestApi({
      url: '/api/services/app/ManagementDepartment/Delete',
      method: 'DELETE',
      params: { id },
    });
  },
};
