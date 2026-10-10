import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

import { BuildingDeviceType } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { PrismaService } from '@src/prisma/prisma.service';

import { getAttributeReceiveDto } from './attribute-receive.decorator';

@Injectable()
export class AttributeReceiveValidationPipe implements PipeTransform {
  private readonly prisma = new PrismaService();

  async transform(value: any) {
    // Lấy type từ DB
    const type = value?.type as BuildingDeviceType;

    // Lấy DTO tương ứng
    const dtoClass = getAttributeReceiveDto(type);
    if (!dtoClass) {
      throw new BadRequestException(`No DTO registered for type ${type}`);
    }

    // Chuyển đổi & validate dữ liệu
    const dtoObject = plainToInstance(dtoClass, value.data);

    const errors = validateSync(dtoObject, { whitelist: true });
    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }

    // Trả lại dữ liệu đã chuẩn hóa + thêm device info
    return {
      deviceId: value.deviceId,
      productCode: value.productCode,
      type: type,
      data: dtoObject,
    };
  }
}
