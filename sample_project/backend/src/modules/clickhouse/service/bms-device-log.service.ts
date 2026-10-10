import { Injectable } from "@nestjs/common";
import { BmsDeviceLogRepository } from "../reposiroty/bms-device-log.repository";
import { DeviceLogData } from "../interface/device-log.interface";


@Injectable()
export class BmsDeviceLogService {
    private readonly batchSize = 10000; // Số lượng bản ghi tối đa để gửi đi
    private readonly flushInterval = 10000; // 10 giây (ms) - Tự động gửi nếu chưa đủ batchSize
    private logBuffer: DeviceLogData[] = [];
    private flushTimer: NodeJS.Timeout | null = null;

    constructor(
        private readonly deviceLogRepository: BmsDeviceLogRepository,
    ) { }

    async createDeviceLog(data: DeviceLogData[]) {
        this.logBuffer.push(...data);

        if (this.logBuffer.length >= this.batchSize) {
            await this.flushLogs();
        } else {
            if (!this.flushTimer) {
                this.flushTimer = setTimeout(async () => {
                    await this.flushLogs();
                }, this.flushInterval);
            }
        }
    }

    private async flushLogs() {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }

        if (this.logBuffer.length === 0) return;

        const dataToInsert = [...this.logBuffer];
        this.logBuffer = [];

        await this.deviceLogRepository.insert(dataToInsert);
    }

    async findLogs(query: any) {
        return this.deviceLogRepository.query(query.filter, query.filterTime, query.paging, query.order);
    }
}  