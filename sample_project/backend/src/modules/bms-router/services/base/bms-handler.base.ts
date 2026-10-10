import { Injectable, Logger } from '@nestjs/common';
import { CommonInput } from './input.base';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getAttributeReceiveDto } from '@modules/bms-router/decorators/attribute-receive.decorator';
import { BuildingDeviceType } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { getMetadataStorage, validateSync } from 'class-validator';
import Redis from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';

@Injectable()
export abstract class BmsHandlerBaseService<I extends CommonInput> {
  private readonly logger = new Logger(BmsHandlerBaseService.name);

  constructor(
    public readonly eventEmitter: EventEmitter2,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async handle(eboId: string, type: string, input: I) {
    const validationResult = await this.valiate(input, type);
    if (!validationResult) {
      return;
    }

    // process data
    await this.process(input, validationResult.type, validationResult.data);
  }

  async valiate(input: I, deviceType: string): Promise<{ type: BuildingDeviceType; data: any } | null> {
    const type = deviceType as BuildingDeviceType;
    if (!type) {
      this.logger.error(`Invalid device type: ${deviceType}`);
      return;
    }

    const dtoClass = getAttributeReceiveDto(type);
    if (!dtoClass) {
      this.logger.error(`No DTO registered for device type: ${type}`);
      return;
    }

    const dtoObject = plainToInstance(dtoClass, input);

    // Lấy danh sách field hợp lệ từ metadata
    const dtoKeys = [
      ...new Set(
        getMetadataStorage()
          .getTargetValidationMetadatas(dtoClass, '', false, false)
          .map((meta) => meta.propertyName),
      ),
    ];

    // Lọc ra những field hợp lệ có trong input
    const validKeys = Object.keys(dtoObject).filter((key) =>
      dtoKeys.includes(key),
    );

    if (!validKeys.length) {
      this.logger.error(`No valid fields for device type: ${type}`);
      return;
    }

    // Validate từng field -> chỉ cần 1 cái pass là OK
    let isValid = false;
    let firstErrorMessage = '';

    for (const key of validKeys) {
      const partial = { [key]: dtoObject[key] };

      const instance = plainToInstance(dtoClass, partial);

      const errors = validateSync(instance, {
        whitelist: true,
        skipMissingProperties: true,
      });

      if (!errors.length) {
        isValid = true;
        break;
      }

      // lưu lỗi đầu tiên để log
      if (!firstErrorMessage && errors[0]?.constraints) {
        firstErrorMessage = Object.values(errors[0].constraints)[0];
      }
    }

    if (!isValid) {
      this.logger.error(
        `Validation failed for device type ${type}: ${firstErrorMessage || 'Invalid data'}`,
      );
      return;
    }

    // Lọc lại data theo DTO + loại undefined
    const cleanedData = Object.fromEntries(
      Object.entries(dtoObject).filter(
        ([key, value]) =>
          dtoKeys.includes(key) && value !== undefined
      )
    );


    return {
      type,
      data: cleanedData,
    };
  }

  protected abstract process(input: I, type: BuildingDeviceType, data: any): any;


  /**
   * Checks and updates cached data in Redis for the given output.
   *
   * Behavior:
   * - If there is no existing cache for the given key, the function stores the current data and returns true.
   * - If a cache exists, it compares each key-value pair in the current data with the cached data.
   * - If any key is missing or its value differs from the cached one, the cache is updated and the function returns true.
   * - If all values match the cached data, the function returns false (no update needed).
   *
   * @param output - The output object to compare and possibly store in cache.
   * @returns Promise<boolean> - True if the cache was created or updated, false if no changes were needed.
   */
  protected async checkCache(input: I): Promise<boolean | object> {
    const cacheKey = `base-router/buildingId/${input.buildingId}/deviceId/${input.deviceId}`;
    const cachedValue = await this.redis.get(cacheKey);

    console.log(`Checking cache for key: ${cacheKey}`);
    // Loại bỏ các trường không cần lưu/so sánh
    const {
      buildingId,
      deviceId,
      ...currentData
    } = input;

    // Nếu chưa có cache → lưu mới
    if (!cachedValue) {
      await this.redis.set(cacheKey, JSON.stringify(currentData));
      return input;
    }

    // Đã có cache → parse và so sánh
    const cachedData = JSON.parse(cachedValue);
    let isUpdated = false;

    for (const key of Object.keys(currentData)) {
      const newValue = currentData[key];
      const oldValue = cachedData[key];

      // Nếu giá trị thay đổi hoặc chưa có key trong cache
      if ((oldValue === undefined || oldValue !== newValue) && newValue !== undefined) {
        cachedData[key] = newValue;
        isUpdated = true;
        console.log(`Cache updated for key: ${key}`);
      }
    }

    if (isUpdated) {
      await this.redis.set(cacheKey, JSON.stringify(cachedData));
      return {
        buildingId,
        deviceId,
        ...cachedData,
      };
    }

    return false;
  }
}
