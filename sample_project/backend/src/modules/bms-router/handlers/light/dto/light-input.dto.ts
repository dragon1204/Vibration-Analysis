import { CommonInput } from '@modules/bms-router/services/base/input.base';
import { IntersectionType } from '@nestjs/swagger';
import { LightAttributeDto } from './light.dto';
import { DimLightAttributeDto } from './dim-light.dto';
;

export class LightInputDto extends IntersectionType(CommonInput, LightAttributeDto) {
    abc: string;
}


export class DimLightInputDto extends IntersectionType(CommonInput, DimLightAttributeDto) {
    bcd: string;
}