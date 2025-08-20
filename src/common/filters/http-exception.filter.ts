import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const responseBody = exception.getResponse();

    // TODO: Implement comprehensive error handling
    // This filter should:
    // 1. Log errors appropriately based on their severity
    // 2. Format error responses in a consistent way
    // 3. Include relevant error details without exposing sensitive information
    // 4. Handle different types of errors with appropriate status codes

    this.logger.error(
      `HTTP Exception: ${exception.message}`,
      exception.stack,
    );

    const message = typeof responseBody === 'object'
      ? (responseBody as any).message ?? exception.message
      : exception.message;

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
} 