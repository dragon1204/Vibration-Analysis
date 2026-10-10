import { BaseCrudService } from '@/base/base-crud-service';

export type FloorType = 'BASEMENT' | 'GROUND' | 'OFFICE' | 'COMMERCIAL' | 'MECHANICAL' | 'ROOFTOP' | 'PARKING';

export interface Floor {
  id: number;
  buildingId: number;
  floorNumber: number;
  name: string;
  floorType: FloorType;
  description: string | null;
  planImageUrl: string | null;
  height: number;
  elevation: number;
  building?: { id: number; name: string; urbanId: number };
  devices?: any[];
  _count?: { devices: number };
  createdAt?: string;
  updatedAt?: string;
}

class FloorService extends BaseCrudService {
  constructor() {
    super('/api/ioc/floor', true);
  }

  /** Get floors, optionally filtered by buildingId */
  async getFloors(buildingId?: number): Promise<Floor[]> {
    return this.getAll<Floor>(buildingId ? { buildingId } : {}) as any;
  }

  /** Get floor detail with devices */
  async getFloorDetail(id: number): Promise<Floor> {
    return this.getOne<Floor>(id) as any;
  }

  /** Create a new floor */
  async createFloor(data: Partial<Floor>): Promise<Floor> {
    return this.create<Floor>(data) as any;
  }

  /** Update a floor */
  async updateFloor(id: number, data: Partial<Floor>): Promise<Floor> {
    return this.update<Floor>({ ...data, id }) as any;
  }

  /** Delete a floor */
  async deleteFloor(id: number): Promise<void> {
    return this.delete(id) as any;
  }
}

export const floorService = new FloorService();
export default floorService;
