import { BaseCrudService } from '@/base/base-crud-service';
import type { IDevice, IDeviceQuery, IDeviceResponse } from './device.model';

class DeviceService extends BaseCrudService {
  constructor() {
    super('/api/ioc/building-device', true);
  }

  /** Get paginated device list with filters */
  async getDevices(params?: IDeviceQuery): Promise<IDeviceResponse> {
    return this.getAll<IDevice>(params) as any;
  }

  /** Get device detail by ID */
  async getDeviceById(id: string): Promise<IDevice> {
    const res = await this.executeRequest<any>({
      method: 'GET',
      url: `${this.basePath}/detail/${id}`,
    });
    // Backend returns { message, code, data }
    return res.data ?? res;
  }

  /** Create a new device */
  async createDevice(data: Partial<IDevice>): Promise<IDevice> {
    return this.create<IDevice>(data) as any;
  }

  /** Update a device */
  async updateDevice(id: string, data: Partial<IDevice>): Promise<IDevice> {
    return this.update<IDevice>({ ...data, id }) as any;
  }

  /** Delete a device */
  async deleteDevice(id: string): Promise<void> {
    return this.delete(id) as any;
  }

  /**
   * Execute a control command on a device (e.g. Turn On/Off, Set Speed)
   * Calls: PATCH /api/ioc/building-device/:id/command
   * 
   * Backend expects AttributeCommandDto: { type, buildingId, data }
   */
  async executeCommand(
    id: string,
    type: string,
    buildingId: number,
    data: Record<string, any>,
  ): Promise<any> {
    try {
      const payload = {
        type,
        buildingId,
        data,
      };
      console.log('Sending command payload:', payload);
      const res = await this.executeRequest<any>({
        method: 'PATCH',
        url: `${this.basePath}/${id}/command`,
        data: payload,
      });
      console.log('Command response:', res.data ?? res);
      return res.data ?? res;
    } catch (error: any) {
      console.error('Command failed:', error?.response?.data || error);
      throw error;
    }
  }
}

const deviceService = new DeviceService();

export default deviceService;
