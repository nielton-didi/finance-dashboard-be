import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { AutocountConnectionError } from '../../modules/autocount-connections/autocount-connection.errors';

const STATUS_BY_REASON: Record<AutocountConnectionError['reason'], HttpStatus> =
  {
    NOT_CONFIGURED: HttpStatus.FAILED_DEPENDENCY,
    AUTH_FAILED: HttpStatus.BAD_GATEWAY,
    UNREACHABLE: HttpStatus.SERVICE_UNAVAILABLE,
    UNKNOWN: HttpStatus.BAD_GATEWAY,
  };

@Catch(AutocountConnectionError)
export class AutocountConnectionExceptionFilter implements ExceptionFilter {
  catch(exception: AutocountConnectionError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = STATUS_BY_REASON[exception.reason];
    response.status(status).json({
      statusCode: status,
      reason: exception.reason,
      message: exception.message,
    });
  }
}
