import { httpService } from '@/base/http-service';

export const Scope = {
  Web: 1,
  MobileApp: 2,
  All: 3,
} as const;

export type Scope = (typeof Scope)[keyof typeof Scope];

export interface DocumentType {
  id?: number;
  code: string;
  name: string;
  scope: Scope;
  iconImageUrl?: string;
  description?: string;
  buildingId: number;
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

export const documentTypeService = {
  async getDocumentTypes(
    skipCount = 0,
    maxResultCount = 1000,
    keyword?: string,
    scope?: Scope,
  ): Promise<PagedResult<DocumentType>> {
    try {
      const res = await httpService.requestApi<
        YootekDataResult<DocumentType[]>
      >({
        url: '/api/services/app/DocumentType/GetAll',
        method: 'GET',
        params: { skipCount, maxResultCount, keyword, scope },
      });
      if (res?.success) {
        return {
          totalCount: res.totalRecords ?? 0,
          items: res.data ?? [],
        };
      }
      return { totalCount: 0, items: [] };
    } catch (e) {
      console.error('Error fetching DocumentTypes:', e);
      return { totalCount: 0, items: [] };
    }
  },

  async getDocumentTypeById(id: number): Promise<DocumentType | null> {
    try {
      const res = await httpService.requestApi<YootekDataResult<DocumentType>>({
        url: '/api/services/app/DocumentType/GetById',
        method: 'GET',
        params: { id },
      });
      return res?.success ? (res.data ?? null) : null;
    } catch (e) {
      console.error('Error fetching DocumentType by id:', e);
      return null;
    }
  },

  async createDocumentType(
    data: Partial<DocumentType>,
  ): Promise<DocumentType | null> {
    const res = await httpService.requestApi<YootekDataResult<DocumentType>>({
      url: '/api/services/app/DocumentType/Create',
      method: 'POST',
      data,
    });
    return res?.success ? res.data || null : null;
  },

  async updateDocumentType(
    data: Partial<DocumentType>,
  ): Promise<DocumentType | null> {
    const res = await httpService.requestApi<YootekDataResult<DocumentType>>({
      url: '/api/services/app/DocumentType/Update',
      method: 'PUT',
      data,
    });
    return res?.success ? res.data || null : null;
  },

  async deleteDocumentType(id: number): Promise<void> {
    await httpService.requestApi({
      url: '/api/services/app/DocumentType/Delete',
      method: 'DELETE',
      params: { id },
    });
  },
};
