import type { IPaginatedItems } from './base.model';
import { httpService } from './http-service';

export type TGetAllQuery = {
  keyword?: string;
  skipCount?: number;
  maxResultCount?: number;
  page?: number;
  pageSize?: number;
} & {
  [key: string]: any;
};

export type TBaseResponse<T> = {
  success?: boolean;
  message?: string;
  code?: number;
  result?: T;
  data?: T;
};

/** Extract data from response — handles both ABP (result) and NestJS (data) formats */
function extractData<T>(res: TBaseResponse<T>): T {
  return (res.data ?? res.result ?? res) as T;
}

export type TData<T> = {
  data: T;
};

export abstract class BaseCrudService {
  public basePath: string;
  protected useApiEndpoint: boolean;

  constructor(basePath: string, useApiEndpoint: boolean = false) {
    this.basePath = basePath;
    this.useApiEndpoint = useApiEndpoint;
  }

  protected async executeRequest<T>(config: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    url: string;
    params?: any;
    data?: any;
    contentType?: string;
  }): Promise<T> {
    if (this.useApiEndpoint) {
      return httpService.requestApi<T>(config);
    }
    return httpService.request<T>(config);
  }

  public async getAll<T>(
    query?: TGetAllQuery,
    path = '',
  ): Promise<IPaginatedItems<T>> {
    // if (query?.page !== undefined && query?.pageSize !== undefined) {
    //   query.skipCount = query.page * query.pageSize;
    //   query.maxResultCount = query.pageSize;

    //   delete query.page;
    //   delete query.pageSize;
    // }

    const res = await this.executeRequest<TBaseResponse<IPaginatedItems<T>>>({
      method: 'GET',
      url: `${this.basePath}${path}`,
      params: query,
    });

    return extractData(res);
  }

  public async getOne<T>(
    id: string | number,
    path = '',
  ): Promise<{ data: T }> {
    const url = path === '' ? `${this.basePath}/${id}` : `${this.basePath}${path}/${id}`;
    const res = await this.executeRequest<TBaseResponse<{ data: T }>>({
      method: 'GET',
      url: url,
    });

    return extractData(res);
  }

  public async createOrUpdate<T>(data: any, path = '/CreateOrUpdate') {
    const res = await this.executeRequest<TBaseResponse<T>>({
      method: 'POST',
      url: `${this.basePath}${path}`,
      data,
    });

    return extractData(res);
  }

  public async create<T>(data: any, path = '') {
    const res = await this.executeRequest<TBaseResponse<T>>({
      method: 'POST',
      url: `${this.basePath}${path}`,
      data,
    });

    return extractData(res);
  }

  public async update<T>(data: any, path = '') {
    const url = path === '' ? `${this.basePath}/${data.id}` : `${this.basePath}${path}`;
    const res = await this.executeRequest<TBaseResponse<T>>({
      method: 'PATCH',
      url: url,
      data,
    });
    return extractData(res);
  }

  public async delete<T>(id: string | number, path = '') {
    const url = path === '' ? `${this.basePath}/${id}` : `${this.basePath}${path}`;
    const res = await this.executeRequest<TBaseResponse<T>>({
      method: 'DELETE',
      url: url,
    });

    return extractData(res);
  }

  public async deleteMany<T>(ids: string[] | number[], path = '/DeleteMany') {
    const res = await this.executeRequest<TBaseResponse<T>>({
      method: 'DELETE',
      url: `${this.basePath}${path}`,
      data: {
        ids: ids,
      },
    });

    return extractData(res);
  }
}
