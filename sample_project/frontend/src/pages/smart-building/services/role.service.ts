/**
 * Role management service.
 * Backend doesn't have a Role CRUD module yet.
 * Returns static default roles to prevent 404 errors in the SYS page.
 */

export interface RoleDto {
  id: number;
  name: string;
  displayName: string;
  description?: string;
  isStatic: boolean;
  isDefault: boolean;
  creationTime: string;
}

export interface PagedRoleResultRequestDto {
  keyword?: string;
  skipCount?: number;
  maxResultCount?: number;
}

export interface FlatPermissionDto {
  parentId?: number;
  parentName?: string | null;
  name: string;
  displayName: string;
  description?: string;
  isGrantedByDefault: boolean;
}

export interface CreateRoleDto {
  name: string;
  displayName: string;
  description?: string;
  isStatic?: boolean;
  isDefault?: boolean;
  grantedPermissions?: string[];
}

export interface RoleEditDto {
  id: number;
  name: string;
  displayName: string;
  description?: string;
  isStatic?: boolean;
  isDefault?: boolean;
}

export interface UpdateRoleDto {
  role: RoleEditDto;
  grantedPermissionNames: string[];
}

export interface GetRoleForEditOutput {
  role: RoleEditDto;
  permissions: FlatPermissionDto[];
  grantedPermissionNames: string[];
}

// Default roles returned until backend Role module is implemented
const DEFAULT_ROLES: RoleDto[] = [
  {
    id: 1,
    name: 'admin',
    displayName: 'Quản trị viên',
    description: 'Toàn quyền quản lý hệ thống',
    isStatic: true,
    isDefault: false,
    creationTime: new Date().toISOString(),
  },
  {
    id: 2,
    name: 'operator',
    displayName: 'Vận hành viên',
    description: 'Quản lý thiết bị và giám sát BMS',
    isStatic: true,
    isDefault: true,
    creationTime: new Date().toISOString(),
  },
];

class RoleService {
  async getAll(_params?: PagedRoleResultRequestDto): Promise<{ data: RoleDto[], total: number }> {
    // TODO: Replace with API call when backend has Role module
    return { data: DEFAULT_ROLES, total: DEFAULT_ROLES.length };
  }

  async create(_data: CreateRoleDto): Promise<any> {
    console.warn('[RoleService] create() not implemented on backend yet');
    return { success: false, error: 'Not implemented' };
  }

  async update(_data: RoleEditDto, _grantedPermissionNames?: string[]): Promise<any> {
    console.warn('[RoleService] update() not implemented on backend yet');
    return { success: false, error: 'Not implemented' };
  }

  async delete(_id: number): Promise<any> {
    console.warn('[RoleService] delete() not implemented on backend yet');
    return { success: false, error: 'Not implemented' };
  }

  async getAllPermissions(): Promise<{ data: FlatPermissionDto[] }> {
    return { data: [] };
  }

  async getRoleForEdit(_id: number): Promise<GetRoleForEditOutput> {
    const role = DEFAULT_ROLES.find(r => r.id === _id);
    return {
      role: role as RoleEditDto,
      permissions: [],
      grantedPermissionNames: [],
    };
  }
}

export const roleService = new RoleService();
