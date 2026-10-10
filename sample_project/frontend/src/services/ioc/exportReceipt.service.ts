import { httpService } from '@/base/http-service';
import type { YootekDataResult } from '@/services/common/types';

export interface ExportReceiptDetailDto {
  id?: number;
  exportReceiptId?: number;
  assetCategoryId: number;
  assetCategoryName?: string;
  unitName?: string;
  quantity: number;
  unitPrice: number;
  finalAmount: number;
}

export interface ExportReceiptDto {
  id?: number;
  code: string;
  warehouseCategoryId: number;
  warehouseCategoryName?: string;
  exportType: number; // 1: Xuất sử dụng, 2: Xuất luân chuyển
  toWarehouseCategoryId?: number | null;
  toWarehouseCategoryName?: string;
  exportDate: string;
  exportDestination: string;
  receiver: string;
  reason: string;
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
  otherCosts: number;
  totalAmount: number;
  finalAmount: number;
  attachedFiles?: string[];
  details?: ExportReceiptDetailDto[];
}

export interface ExportReceiptPagedResult {
  items: ExportReceiptDto[];
  totalCount: number;
}

class ExportReceiptService {
  async getAll(params?: {
    keyword?: string;
    status?: number;
    exportType?: number;
    warehouseCategoryId?: number;
    buildingId?: number;
    fromDate?: string;
    toDate?: string;
    skipCount?: number;
    maxResultCount?: number;
  }): Promise<ExportReceiptPagedResult> {
    const res = await httpService.requestApi<YootekDataResult<ExportReceiptPagedResult>>({
      url: '/api/services/app/ExportReceipt/GetAll',
      method: 'GET',
      params,
    });
    if (res?.success && res.data) {
      type PagedData = { totalCount?: number; totalRecords?: number; items?: ExportReceiptDto[]; data?: ExportReceiptDto[] };
      const inner = res.data as PagedData;
      return {
        totalCount: inner.totalRecords ?? inner.totalCount ?? 0,
        items: inner.data ?? inner.items ?? [],
      };
    }
    return { items: [], totalCount: 0 };
  }

  async getById(id: number): Promise<ExportReceiptDto | null> {
    const res = await httpService.requestApi<YootekDataResult<ExportReceiptDto>>({
      url: '/api/services/app/ExportReceipt/Get',
      method: 'GET',
      params: { id },
    });
    return res?.success ? (res.data ?? null) : null;
  }

  async create(data: Partial<ExportReceiptDto>): Promise<ExportReceiptDto | null> {
    const res = await httpService.requestApi<YootekDataResult<ExportReceiptDto>>({
      url: '/api/services/app/ExportReceipt/Create',
      method: 'POST',
      data,
    });
    return res?.success ? (res.data ?? null) : null;
  }

  async update(data: Partial<ExportReceiptDto>): Promise<ExportReceiptDto | null> {
    const res = await httpService.requestApi<YootekDataResult<ExportReceiptDto>>({
      url: '/api/services/app/ExportReceipt/Update',
      method: 'PUT',
      data,
    });
    return res?.success ? (res.data ?? null) : null;
  }

  async delete(id: number): Promise<void> {
    await httpService.requestApi({
      url: '/api/services/app/ExportReceipt/Delete',
      method: 'DELETE',
      params: { id },
    });
  }

  async approve(id: number): Promise<void> {
    await httpService.requestApi({
      url: '/api/services/app/ExportReceipt/Approve',
      method: 'POST',
      data: { id },
    });
  }

  async cancel(id: number): Promise<void> {
    await httpService.requestApi({
      url: '/api/services/app/ExportReceipt/Cancel',
      method: 'POST',
      data: { id },
    });
  }
}

export const exportReceiptService = new ExportReceiptService();
