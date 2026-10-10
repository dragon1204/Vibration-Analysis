import { CommonInput } from '@modules/bms-router/services/base/input.base';
import { IntersectionType } from '@nestjs/swagger';
import { FanAttributeDto } from './fan.dto';

export class FanInputDto extends IntersectionType(CommonInput, FanAttributeDto) {}