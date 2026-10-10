import { HttpStatus } from '@nestjs/common';

import { ApiResponseCode } from './constants/api-response-code.constant';

export class CHttpException {
  public readonly status: HttpStatus;
  public readonly message: string | null;
  public readonly code: number;
  public readonly detail: any;
  public readonly context: string;

  constructor(
    context: string,
    status: HttpStatus,
    message = 'Internal server error',
    code = ApiResponseCode.INTERNAL_SERVER_ERROR,
    detail: any = null,
  ) {
    this.context = context;
    this.status = status;
    this.message = message;
    this.code = code;
    this.detail = detail;
  }
}

export class CBadRequestException extends CHttpException {
  constructor(
    context: string,
    message = 'Bad request',
    code = ApiResponseCode.BAD_REQUEST,
    detail: any = null,
  ) {
    super(context, HttpStatus.BAD_REQUEST, message, code, detail);
  }
}

export class CUnauthorizedException extends CHttpException {
  constructor(
    context: string,
    message = 'Unauthorized',
    code = ApiResponseCode.UNAUTHORIZED,
    detail: any = null,
  ) {
    super(context, HttpStatus.UNAUTHORIZED, message, code, detail);
  }
}

export class CForbiddenException extends CHttpException {
  constructor(
    context: string,
    message = 'Forbidden',
    code = ApiResponseCode.FORBIDDEN,
    detail: any = null,
  ) {
    super(context, HttpStatus.FORBIDDEN, message, code, detail);
  }
}

export class CNotFoundException extends CHttpException {
  constructor(
    context: string,
    message = 'Not found',
    code = ApiResponseCode.NOT_FOUND,
    detail: any = null,
  ) {
    super(context, HttpStatus.NOT_FOUND, message, code, detail);
  }
}

export class CConflictException extends CHttpException {
  constructor(
    context: string,
    message = 'Conflict',
    code = ApiResponseCode.CONFLICT,
    detail: any = null,
  ) {
    super(context, HttpStatus.CONFLICT, message, code, detail);
  }
}

export class CInternalServerException extends CHttpException {
  constructor(
    context: string,
    message = 'Internal server error',
    code = ApiResponseCode.INTERNAL_SERVER_ERROR,
    detail: any = null,
  ) {
    super(context, HttpStatus.INTERNAL_SERVER_ERROR, message, code, detail);
  }
}
