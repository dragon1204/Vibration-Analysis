import { httpService } from '@/base/http-service';

export interface UserDto {
  id: string;
  email: string;
  fullName?: string;
  role: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PagedUserResultRequestDto {
  keyword?: string;
  isActive?: boolean;
  skipCount: number;
  maxResultCount: number;
}

/**
 * User management service.
 * Uses the local NestJS auth endpoints.
 * Note: Full CRUD for users requires a backend User Management module.
 * Currently only getAll (via auth/me for current user) is supported.
 */
class UserService {
  async getAll(params: PagedUserResultRequestDto): Promise<{ data: UserDto[], total: number }> {
    try {
      // Backend doesn't have a user list endpoint yet.
      // Try to get current user as a placeholder.
      const res = await httpService.request<any>({
        url: '/api/auth/me',
        method: 'GET',
      });
      const user = res.data || res;
      return {
        data: user ? [{ ...user, isActive: true }] : [],
        total: user ? 1 : 0,
      };
    } catch {
      return { data: [], total: 0 };
    }
  }

  async create(data: any): Promise<any> {
    return httpService.request({
      url: '/api/auth/register',
      method: 'POST',
      data,
    });
  }

  async update(_data: any): Promise<any> {
    // TODO: Implement when backend has user update endpoint
    console.warn('[UserService] update() not implemented on backend yet');
    return { success: false, error: 'Not implemented' };
  }

  async delete(_id: number | string): Promise<any> {
    // TODO: Implement when backend has user delete endpoint
    console.warn('[UserService] delete() not implemented on backend yet');
    return { success: false, error: 'Not implemented' };
  }

  async activate(_id: number): Promise<any> {
    console.warn('[UserService] activate() not implemented on backend yet');
    return { success: false, error: 'Not implemented' };
  }

  async deactivate(_id: number): Promise<any> {
    console.warn('[UserService] deactivate() not implemented on backend yet');
    return { success: false, error: 'Not implemented' };
  }
}

export const userService = new UserService();
