import { BaseCrudService } from '@/base/base-crud-service';

export interface Urban {
  id: number;
  code: string | null;
  slug: string;
  name: string;
  address: string | null;
  description: string | null;
  imageUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  buildings?: any[];
  _count?: { buildings: number };
  createdAt?: string;
  updatedAt?: string;
}

class UrbanService extends BaseCrudService {
  constructor() {
    super('/api/ioc/urban', true);
  }

  /** Get all urbans with building counts */
  async getAllUrban(): Promise<Urban[]> {
    return this.getAll<Urban>() as any;
  }

  /** Get single urban with full building tree */
  async getUrbanDetail(id: number): Promise<Urban> {
    return this.getOne<Urban>(id) as any;
  }

  /** Create a new urban */
  async createUrban(data: Partial<Urban>): Promise<Urban> {
    return this.create<Urban>(data) as any;
  }

  /** Update an urban */
  async updateUrban(id: number, data: Partial<Urban>): Promise<Urban> {
    return this.update<Urban>({ ...data, id }) as any;
  }

  /** Delete an urban */
  async deleteUrban(id: number): Promise<void> {
    return this.delete(id) as any;
  }
}

export const urbanService = new UrbanService();
export default urbanService;