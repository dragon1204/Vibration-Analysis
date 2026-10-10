import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpArgumentsHost } from '@nestjs/common/interfaces/features/arguments-host.interface';

import { Response } from 'express';

import { CHttpException } from '@shared/custom-http-exception';
import { TransformResponse } from '@shared/response';

const handleReply = (
  res: Response,
  exception: HttpException | CHttpException | Error,
): void => {
  const responseBody = TransformResponse.internalServerError(
    'Internal Server Error',
  );

  let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;

  if (exception instanceof CHttpException) {
    statusCode = exception.status;

    responseBody.message = exception.message;
    responseBody.code = exception.code;
  } else if (exception instanceof HttpException) {
    statusCode = exception.getStatus();

    responseBody.message = exception.message;
  } else if (exception instanceof Error) {
    responseBody.message = exception.message;
  }

  res.status(statusCode).send(responseBody);
};

const handleMessage = (
  exception: HttpException | CHttpException | Error,
  logger: Logger,
): void => {
  let message = 'Internal Server Error';
  let context = GlobalExceptionsFilter.name;
  let stack = '';

  if (exception instanceof CHttpException) {
    message = exception.message || message;
    context = exception.context || context;
    stack = exception.detail;
  } else if (exception instanceof HttpException) {
    message = JSON.stringify(exception.getResponse());
    stack = exception.stack;
  } else if (exception instanceof Error) {
    message = exception.message;
    stack = exception.stack;
  }

  logger.error(message, stack, context);
};

@Catch()
export class GlobalExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionsFilter.name);

  catch(
    exception: HttpException | CHttpException | Error,
    host: ArgumentsHost,
  ): void {
    // Handling error message and logging
    handleMessage(exception, this.logger);

    const ctx: HttpArgumentsHost = host.switchToHttp();
    const reply = ctx.getResponse<Response>();
    handleReply(reply, exception);
  }
}
