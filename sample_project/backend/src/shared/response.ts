import { Type, applyDecorators } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';

import { ApiResponseCode } from '@shared/constants/api-response-code.constant';

export class TransformResponse<T> {
  @ApiPropertyOptional({ type: 'string' })
  public message: string | null;

  @ApiProperty({ type: 'number' })
  public code: number;

  @ApiPropertyOptional({
    type: [String],
  })
  public params: string[] | null;

  @ApiPropertyOptional({
    type: Object,
  })
  public data: T | null;

  public static ok<T>(
    data: T | null,
    message: string | null = 'Ok',
    params: string[] | null = null,
  ): TransformResponse<T> {
    const res = new TransformResponse<T>();
    res.message = message;
    res.code = ApiResponseCode.OK;
    res.params = params;
    res.data = data;

    return res;
  }

  public static internalServerError(message: string): TransformResponse<null> {
    const res = new TransformResponse<null>();
    res.message = message;
    res.code = ApiResponseCode.INTERNAL_SERVER_ERROR;
    res.params = null;
    res.data = null;

    return res;
  }
}

export const ApiResponse = <TModel extends Type<any>>(model: TModel) => {
  return applyDecorators(
    ApiExtraModels(TransformResponse, model),
    ApiOkResponse({
      description: 'Ok',
      schema: {
        allOf: [
          { $ref: getSchemaPath(TransformResponse) },
          {
            properties: {
              data: { $ref: getSchemaPath(model) },
            },
          },
        ],
      },
    }),
  );
};

export const ApiArrayResponse = <TModel extends Type<any>>(model: TModel) => {
  return applyDecorators(
    ApiExtraModels(TransformResponse, model),
    ApiOkResponse({
      description: 'Ok',
      schema: {
        allOf: [
          { $ref: getSchemaPath(TransformResponse) },
          {
            properties: {
              data: { type: 'array', items: { $ref: getSchemaPath(model) } },
            },
          },
        ],
      },
    }),
  );
};

export const ApiPaginatedResponse = <TModel extends Type<any>>(
  model: TModel,
) => {
  return applyDecorators(
    ApiExtraModels(TransformResponse, model),
    ApiOkResponse({
      description: 'Ok',
      schema: {
        allOf: [
          { $ref: getSchemaPath(TransformResponse) },
          {
            properties: {
              data: {
                type: 'object',
                properties: {
                  total: {
                    type: 'number',
                  },
                  items: {
                    type: 'array',
                    items: { $ref: getSchemaPath(model) },
                  },
                },
              },
            },
          },
        ],
      },
    }),
  );
};

export const ApiUpdatedResponse = () => {
  return applyDecorators(
    ApiExtraModels(TransformResponse),
    ApiOkResponse({
      description: 'Ok',
      schema: {
        allOf: [
          { $ref: getSchemaPath(TransformResponse) },
          {
            properties: {
              data: {
                type: 'object',
                properties: {
                  count: {
                    type: 'number',
                  },
                },
              },
            },
          },
        ],
      },
    }),
  );
};

export const ApiDeletedResponse = () => {
  return applyDecorators(
    ApiExtraModels(TransformResponse),
    ApiOkResponse({
      description: 'Ok',
      schema: {
        allOf: [
          { $ref: getSchemaPath(TransformResponse) },
          {
            properties: {
              data: {
                type: 'object',
                properties: {
                  count: {
                    type: 'number',
                  },
                },
              },
            },
          },
        ],
      },
    }),
  );
};
