/* eslint-disable @typescript-eslint/ban-types */
import {
  ArgumentMetadata,
  Injectable,
  PipeTransform,
  ValidationPipe,
} from '@nestjs/common';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ApiResponseCode } from '@shared/constants/api-response-code.constant';
import { CBadRequestException } from '@shared/custom-http-exception';

@Injectable()
export class CValidationPipe implements PipeTransform<any> {
  private needTransform?: boolean = true;

  constructor(input?: { transform?: boolean }) {
    this.needTransform = input?.transform || true;
  }

  async transform(value: any, argumentMetaData: ArgumentMetadata) {
    const { metatype } = argumentMetaData;

    if (this.needTransform) {
      const defaultPipe = new ValidationPipe({
        transform: true,
        whitelist: true,
      });
      value = await defaultPipe.transform(value, argumentMetaData);
    }

    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }
    const object = plainToInstance(metatype, value);
    const errors = await validate(object);

    if (errors.length > 0) {
      throw new CBadRequestException(
        metatype.name,
        'Validation failed',
        ApiResponseCode.BAD_REQUEST,
        errors.map((error) => error.constraints),
      );
    }
    return value;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}

@Injectable()
export class ParseMACAddressPipe implements PipeTransform {
  transform(value: string, metadata: ArgumentMetadata) {
    //check value is have MAC address format or not
    //for example:  84:71:27:ff:fe:76:12:b3 -> 847127fffe7612b3
    const regex = /^([0-9A-Fa-f]{2}[:-]){5,7}([0-9A-Fa-f]{2})$/;

    const isMacAddress = regex.test(value);
    if (!isMacAddress) {
      throw new CBadRequestException(
        ParseMACAddressPipe.name,
        'Invalid MAC address',
        ApiResponseCode.BAD_REQUEST,
        'Invalid MAC address',
      );
    }
    return value.replace(/:/g, '');
  }
}
