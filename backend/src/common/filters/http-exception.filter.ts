import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { Request, Response } from 'express';

@Catch(HttpException, QueryFailedError)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException | QueryFailedError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string | string[];

    // Tratamento de erros de banco de dados (violação de foreign key, etc)
    if (exception instanceof QueryFailedError) {
      const err: any = exception;
      // Código 23503 => foreign key violation
      if (err.driverError && err.driverError.code === '23503') {
        status = HttpStatus.BAD_REQUEST;
        
        // Verificar se é exclusão de venda com baixas associadas
        const detail: string = (err.driverError.detail as string) || '';
        if (detail.includes('baixas') && detail.includes('vendas')) {
          message = 'Excluir todas as baixas antes de excluir a venda!';
        } else {
          // Extrai tabela referenciada do detalhe do erro
          const match = /referenced from table \"([^\"]+)\"/.exec(detail);
          const tabela = match ? match[1] : 'outros registros';
          const suggestion = `Por favor, exclua antes os registros em "${tabela}" que dependem deste item e tente novamente.`;
          message = `Operação inválida: existem registros vinculados. ${suggestion}`;
        }
      } else {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'Erro interno de banco de dados.';
      }
    } else {
      // Erros HTTP do Nest
      status = exception.getStatus();
      const errorResponse = exception.getResponse();
      if (typeof errorResponse === 'string') {
        message = errorResponse;
      } else if (typeof errorResponse === 'object' && errorResponse !== null) {
        message = (errorResponse as any).message || exception.message;
      } else {
        message = exception.message;
      }
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
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json(errorResponseBody);
  }
}
