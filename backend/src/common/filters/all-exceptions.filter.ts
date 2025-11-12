import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  // Helper para formatar nomes de entidade (snake_case ou kebab-case para Title Case)
  private formatName(name: string): string {
    return name
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Erro interno do servidor';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string'
        ? res
        : Array.isArray((res as any).message)
          ? (res as any).message.join(', ')
          : (res as any).message || message;
    } else if (exception instanceof QueryFailedError) {
      const err = exception as any;
      const code = err.driverError.code;
      const detail = err.driverError.detail || '';
      // Extrai rota de entidade do URL (ex: /api/perfil/123)
      const segments = request.url.split('/').filter(s => s);
      const entityRoute = segments[1] || '';
      const entityName = this.formatName(entityRoute);
      if (code === '23505') {
        status = HttpStatus.CONFLICT;
        // Tenta extrair coluna e valor da violação
        const uniqueMatch = /Key \(([^)]+)\)=\(([^)]+)\)/.exec(detail);
        if (uniqueMatch) {
          const column = this.formatName(uniqueMatch[1]);
          const value = uniqueMatch[2];
          message = `${entityName} duplicado: já existe ${entityName} com ${column} = "${value}".`;
        } else {
          message = `${entityName} duplicado: já existe um registro com esses dados.`;
        }
      } else if (code === '23503') {
  status = HttpStatus.BAD_REQUEST;
        status = HttpStatus.BAD_REQUEST;
  // Extrai todos os nomes entre aspas e pega a última ocorrência como tabela dependente
  const quotedMatches = Array.from(detail.matchAll(/"([^\"]+)"/g)) as RegExpMatchArray[];
  const refTable = quotedMatches.length > 0 ? quotedMatches[quotedMatches.length - 1][1] : '';
        const refName = refTable ? this.formatName(refTable) : 'outros registros';
        // Mensagem específica para vendas com baixas
        if (entityRoute === 'vendas' && refTable === 'baixas') {
          message = 'Não é possível excluir a Venda pois existem baixas registradas!';
        } else {
          message = `Não é possível excluir ${entityName} pois está sendo usado no cadastro de ${refName}.`;
        }
      } else {
        message = `Violação de integridade de dados em ${entityName}.`;
      }
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message
    });
  }
}
