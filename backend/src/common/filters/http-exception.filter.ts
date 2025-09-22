import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    const errorResponse = exception.getResponse();
    
    // Estruturar a resposta de erro
    let message: string | string[];
    
    if (typeof errorResponse === 'string') {
      message = errorResponse;
    } else if (typeof errorResponse === 'object' && errorResponse !== null) {
      message = (errorResponse as any).message || exception.message;
    } else {
      message = exception.message;
    }

    const errorResponseBody = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: message,
      error: HttpStatus[status],
    };

    // Log do erro para debugging
    this.logger.error(
      `${request.method} ${request.url}`,
      JSON.stringify(errorResponseBody),
      exception.stack,
    );

    response.status(status).json(errorResponseBody);
  }
}