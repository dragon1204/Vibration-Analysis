import { BaseCrudService } from '@/base/base-crud-service';

export interface Building {
  id: number;
  urbanId: number;
  code: string | null;
  slug: string;
  name: string;
  address: string | null;
  description: string | null;
  imageUrl: string | null;
  modelUrl: string | null;
  totalFloors: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  rotationY: number;
  scale: number;
  urban?: { id: number; name: string; slug: string; latitude?: number; longitude?: number; address?: string };
  floors?: any[];
  _count?: { floors: number };
  createdAt?: string;
  updatedAt?: string;
}

class BuildingService extends BaseCrudService {
  constructor() {
    super('/api/ioc/building', true);
  }

  /** Get buildings, optionally filtered by urbanId */
  async getBuildings(urbanId?: number): Promise<Building[]> {
    return this.getAll<Building>(urbanId ? { urbanId } : {}) as any;
  }

  /** Get building detail with floors */
  async getBuildingDetail(id: number): Promise<Building> {
    return this.getOne<Building>(id) as any;
  }

  /** Create a new building (supports file upload via FormData) */
  async createBuilding(data: Partial<Building> & { modelFile?: File }): Promise<Building> {
    if (data.modelFile) {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, value instanceof File ? value : String(value));
        }
      });
      const res = await this.executeRequest<any>({
        method: 'POST',
        url: this.basePath,
        data: formData,
        contentType: 'multipart/form-data',
      });
      return res.data ?? res.result ?? res;
    }
    return this.create<Building>(data) as any;
  }

  /** Update a building */
  async updateBuilding(id: number, data: Partial<Building>): Promise<Building> {
    return this.update<Building>({ ...data, id }) as any;
  }

  /** Delete a building */
  async deleteBuilding(id: number): Promise<void> {
    return this.delete(id) as any;
  }

  /** Get building by urban slug + building slug (for URL resolution) */
  async getBuildingBySlug(urbanSlug: string, buildingSlug: string): Promise<Building> {
    const res = await this.executeRequest<any>({
      method: 'GET',
      url: `${this.basePath}/slug/${urbanSlug}/${buildingSlug}`,
    });
    return res.data ?? res.result ?? res;
  }
}

export const buildingService = new BuildingService();
export default buildingService;
