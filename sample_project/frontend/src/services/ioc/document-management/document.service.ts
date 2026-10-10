import { httpService } from '@/base/http-service';
import { Scope } from '@/services/ioc/document-management/document-type.service';

export interface Document {
  id?: number;
  code: string;
  name: string;
  documentTypeId: number;
  documentTypeName?: string;
  scope?: Scope;
  fileUrl: string;
  linkUrl?: string;
  buildingId: number;
  createdDate?: string;
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

export const documentService = {
  async getDocuments(
    skipCount = 0,
    maxResultCount = 1000,
    keyword?: string,
    scope?: Scope,
    documentTypeId?: number,
  ): Promise<PagedResult<Document>> {
    try {
      const res = await httpService.requestApi<YootekDataResult<Document[]>>({
        url: '/api/services/app/Document/GetAll',
        method: 'GET',
        params: { skipCount, maxResultCount, keyword, scope, documentTypeId },
      });
      if (res?.success) {
        return {
          totalCount: res.totalRecords ?? 0,
          items: res.data ?? [],
        };
      }
      return { totalCount: 0, items: [] };
    } catch (e) {
      console.error('Error fetching Documents:', e);
      return { totalCount: 0, items: [] };
    }
  },

  async getDocumentById(id: number): Promise<Document | null> {
    try {
      const res = await httpService.requestApi<YootekDataResult<Document>>({
        url: '/api/services/app/Document/GetById',
        method: 'GET',
        params: { id },
      });
      return res?.success ? (res.data ?? null) : null;
    } catch (e) {
      console.error('Error fetching Document by id:', e);
      return null;
    }
  },

  async createDocument(data: Partial<Document>): Promise<Document | null> {
    const res = await httpService.requestApi<YootekDataResult<Document>>({
      url: '/api/services/app/Document/Create',
      method: 'POST',
      data,
    });
    return res?.success ? res.data || null : null;
  },

  async updateDocument(data: Partial<Document>): Promise<Document | null> {
    const res = await httpService.requestApi<YootekDataResult<Document>>({
      url: '/api/services/app/Document/Update',
      method: 'PUT',
      data,
    });
    return res?.success ? res.data || null : null;
  },

  async deleteDocument(id: number): Promise<void> {
    await httpService.requestApi({
      url: '/api/services/app/Document/Delete',
      method: 'DELETE',
      params: { id },
    });
  },
};
