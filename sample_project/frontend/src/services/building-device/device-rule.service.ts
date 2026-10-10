import { BaseCrudService } from '@/base/base-crud-service';

export type RuleType = 'PREREQUISITE' | 'CASCADE';

export interface DeviceRule {
  id: string;
  buildingId: number;
  ruleType: RuleType;
  sourceDeviceId: string;
  targetDeviceId: string;
  triggerOn?: string | null;  // "ON" | "OFF"
  targetAction?: string | null; // "ON" | "OFF"
  priority: number;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  sourceDevice?: { id: string; name: string; type: string; deviceId?: string };
  targetDevice?: { id: string; name: string; type: string; deviceId?: string };
}

export interface CreateDeviceRuleDto {
  buildingId: number;
  ruleType: RuleType;
  sourceDeviceId: string;
  targetDeviceId: string;
  triggerOn?: string;
  targetAction?: string;
  priority?: number;
  description?: string;
}

class DeviceRuleService extends BaseCrudService {
  constructor() {
    super('/api/ioc/device-rule', true);
  }

  /** Get all rules for a building */
  async getRules(buildingId: number): Promise<DeviceRule[]> {
    const res = await this.executeRequest<any>({
      method: 'GET',
      url: this.basePath,
      params: { buildingId },
    });
    return res.data ?? res.result ?? res;
  }

  /** Create a new rule */
  async createRule(data: CreateDeviceRuleDto): Promise<DeviceRule> {
    const res = await this.executeRequest<any>({
      method: 'POST',
      url: this.basePath,
      data,
    });
    return res.data ?? res.result ?? res;
  }

  /** Delete a rule */
  async deleteRule(id: string): Promise<void> {
    await this.executeRequest<any>({
      method: 'DELETE',
      url: `${this.basePath}/${id}`,
    });
  }
}

export const deviceRuleService = new DeviceRuleService();
export default deviceRuleService;
