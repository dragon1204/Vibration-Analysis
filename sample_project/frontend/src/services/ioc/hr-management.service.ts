import { httpService } from '@/base/http-service';

export interface HrUserOption {
  id: number;
  userName: string;
  name: string;
  surname: string;
  emailAddress: string;
  fullName?: string;
  dateOfBirth?: string | null;
}

export interface HrPositionOption {
  id: number;
  displayName: string;
  name?: string;
}

type GenericListResponse<T> = {
  data?: T[];
  result?: { data?: T[] } | T[];
};

export interface HrManagement {
  positionName?: string;
  id?: number;
  specialize?: string;
  positionId: number;
  organizationUnitId?: number | null;
  userId: number;
  departmentUnitId?: number | null;
  type?: number | null;
  name?: string;
  surname?: string;
  accountName?: string;
  password?: string;
  email?: string;
  dateOfBirth?: string | null;
  addressOfBirth?: string;
}

interface PagedResult<T> {
  totalCount: number;
  items: T[];
}

interface YootekDataResult<T> {
  success: boolean;
  totalRecords: number;
  data: T;
}

interface YootekPagedData<T> {
  items?: T[];
  data?: T[];
  totalCount?: number;
  totalRecords?: number;
}

export const hrManagementService = {
  async getAll(skipCount = 0, maxResultCount = 1000, keyword?: string, departmentUnitId?: number | null): Promise<PagedResult<HrManagement>> {
    try {
      const params: Record<string, unknown> = { skipCount, maxResultCount };
      if (keyword) params.keyword = keyword;
      if (departmentUnitId != null) params.departmentUnitId = departmentUnitId;

      const res = await httpService.requestApi<YootekDataResult<YootekPagedData<HrManagement>>>({
        url: '/api/services/app/HrManagement/GetAll',
        method: 'GET',
        params,
      });
      if (res?.success && res.data) {
        // ABP trả: { success, data: { totalCount, items } }
        const inner = res.data as YootekPagedData<HrManagement>;
        return {
          totalCount: inner?.totalCount ?? inner?.totalRecords ?? 0,
          items: inner?.items ?? inner?.data ?? [],
        };
      }
      return { totalCount: 0, items: [] };
    } catch (_e) {
      return { totalCount: 0, items: [] };
    }
  },

  async getAllUsers(): Promise<HrUserOption[]> {
    try {
      const res = await httpService.requestApi<GenericListResponse<HrUserOption>>({
        url: '/api/services/app/Account/GetAll',
        method: 'GET',
        params: { skipCount: 0, maxResultCount: 1000 },
      });
      if (Array.isArray(res?.data)) return res.data;
      if (Array.isArray(res?.result)) return res.result;
      if (Array.isArray(res?.result?.data)) return res.result.data;
      return [];
    } catch (_e) {
      return [];
    }
  },

  async getAllPositions(): Promise<HrPositionOption[]> {
    try {
      const res = await httpService.requestApi<GenericListResponse<HrPositionOption>>({
        url: '/api/services/app/Position/GetAll',
        method: 'GET',
        params: { skipCount: 0, maxResultCount: 1000 },
      });
      if (Array.isArray(res?.data)) return res.data;
      if (Array.isArray(res?.result)) return res.result;
      if (Array.isArray(res?.result?.data)) return res.result.data;
      return [];
    } catch (_e) {
      return [];
    }
  },

  create(data: Partial<HrManagement>) {
    return httpService.requestApi({ url: '/api/services/app/HrManagement/Create', method: 'POST', data });
  },
  update(data: Partial<HrManagement>) {
    return httpService.requestApi({ url: '/api/services/app/HrManagement/Update', method: 'PUT', data });
  },
  delete(id: number) {
    return httpService.requestApi({ url: '/api/services/app/HrManagement/Delete', method: 'DELETE', params: { id } });
  },

  /** Gán nhân sự vào phòng ban */
  async assignDepartment(hrId: number, departmentUnitId: number): Promise<boolean> {
    const res = await httpService.requestApi<{ success: boolean }>({
      url: '/api/services/app/HrManagement/AssignDepartment',
      method: 'POST',
      data: { hrId, departmentUnitId },
    });
    return res?.success ?? false;
  },

  /** Bỏ nhân sự khỏi phòng ban (đặt DepartmentUnitId = null) */
  async removeFromDepartment(hrId: number): Promise<boolean> {
    const res = await httpService.requestApi<{ success: boolean }>({
      url: '/api/services/app/HrManagement/RemoveFromDepartment',
      method: 'DELETE',
      params: { hrId },
    });
    return res?.success ?? false;
  },
};
