// Shared types dùng chung cho toàn bộ service trong hệ thống

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

// Kiểu dùng để parse nested response từ BE (tránh dùng `as any`)
export interface InnerDataResult<T> {
  totalRecords?: number;
  totalCount?: number;
  data?: T[];
  items?: T[];
}
