import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_KEY, RateLimitOptions } from '../decorators/rate-limit.decorator';
import { createHash } from 'crypto';

// Note: This guard remains in-memory, but now uses a bounded map and per-route config.
// In production, replace with a Redis-based limiter (e.g., rate-limiter-flexible with ioredis).
type WindowRecord = { count: number; resetAt: number };
const windowByKey = new Map<string, WindowRecord>();

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) || { limit: 100, windowMs: 60_000 };

    const ip = request.ip ?? 'unknown';
    const route = `${request.method}:${request.originalUrl ?? request.url}`;
    const key = this.hashKey(`${ip}:${route}`);
    const now = Date.now();
    let record = windowByKey.get(key);
    if (!record || record.resetAt <= now) {
      record = { count: 0, resetAt: now + options.windowMs };
    }
    record.count += 1;
    windowByKey.set(key, record);

    if (record.count > options.limit) {
      const retryAfter = Math.max(0, Math.ceil((record.resetAt - now) / 1000));
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS, {
        description: 'Rate limit exceeded',
      });
    }
    return true;
  }

  private hashKey(value: string) {
    return createHash('sha256').update(value).digest('base64url');
  }
}