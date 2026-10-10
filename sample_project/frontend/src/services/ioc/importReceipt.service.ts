import { httpService } from '@/base/http-service';
import type { YootekDataResult } from '@/services/common/types';

export interface ImportReceiptDetailDto {
  id?: number;
  importReceiptId?: number;
  assetCategoryId: number;
  assetCategoryName?: string;
  unitName?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  finalAmount: number;
}

export interface ImportReceiptDto {
  id?: number;
  code: string;
  warehouseCategoryId: number;
  warehouseCategoryName?: string;
  importDate: string;
  importReason: string;
  deliverer: string;
  creatorId?: number | null;
  creatorName?: string;
  accountantId?: number | null;
  accountantName?: string;
  storekeeperId?: number | null;
  storekeeperName?: string;
  approverId?: number | null;
  approverName?: string;
  approveDate?: string | null;
  status: number;
  vat: number;
  otherCosts: number;
  totalAmount: number;
  finalAmount: number;
  details?: ImportReceiptDetailDto[];
}

export interface ImportReceiptPagedResult {
  items: ImportReceiptDto[];
  totalCount: number;
}

class ImportReceiptService {
  async getAll(params?: {
    keyword?: string;
    status?: number;
    warehouseCategoryId?: number;
    buildingId?: number;
    fromDate?: string;
    toDate?: string;
    skipCount?: number;
    maxResultCount?: number;
  }): Promise<ImportReceiptPagedResult> {
    const res = await httpService.requestApi<YootekDataResult<ImportReceiptPagedResult>>({
      url: '/api/services/app/ImportReceipt/GetAll',
      method: 'GET',
      params,
    });
    if (res?.success && res.data) {
      type PagedData = { totalCount?: number; totalRecords?: number; items?: ImportReceiptDto[]; data?: ImportReceiptDto[] };
      const inner = res.data as PagedData;
      return {
        totalCount: inner.totalRecords ?? inner.totalCount ?? 0,
        items: inner.data ?? inner.items ?? [],
      };
    }
    return { items: [], totalCount: 0 };
  }

  async getById(id: number): Promise<ImportReceiptDto | null> {
    const res = await httpService.requestApi<YootekDataResult<ImportReceiptDto>>({
      url: '/api/services/app/ImportReceipt/Get',
      method: 'GET',
      params: { id },
    });
    return res?.success ? (res.data ?? null) : null;
  }

  async create(data: Partial<ImportReceiptDto>): Promise<ImportReceiptDto | null> {
    const res = await httpService.requestApi<YootekDataResult<ImportReceiptDto>>({
      url: '/api/services/app/ImportReceipt/Create',
      method: 'POST',
      data,
    });
    return res?.success ? (res.data ?? null) : null;
  }

  async update(data: Partial<ImportReceiptDto>): Promise<ImportReceiptDto | null> {
    const res = await httpService.requestApi<YootekDataResult<ImportReceiptDto>>({
      url: '/api/services/app/ImportReceipt/Update',
      method: 'PUT',
      data,
    });
    return res?.success ? (res.data ?? null) : null;
  }

  async delete(id: number): Promise<void> {
    await httpService.requestApi({
      url: '/api/services/app/ImportReceipt/Delete',
      method: 'DELETE',
      params: { id },
    });
  }

  async approve(id: number): Promise<void> {
    await httpService.requestApi({
      url: '/api/services/app/ImportReceipt/Approve',
      method: 'POST',
      data: { id },
    });
  }

  async cancel(id: number): Promise<void> {
    await httpService.requestApi({
      url: '/api/services/app/ImportReceipt/Cancel',
      method: 'POST',
      data: { id },
    });
  }
}

export const importReceiptService = new ImportReceiptService();
